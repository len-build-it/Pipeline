import pg from 'pg';

const { Pool } = pg;

export function createPool(connectionString) {
  const url = connectionString || process.env.DATABASE_URL || 'postgres://postgres@127.0.0.1:5433/pipeline_dev';
  return new Pool({
    connectionString: url,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
}

let defaultPool = null;

export function getPool() {
  if (!defaultPool) {
    defaultPool = createPool();
  }
  return defaultPool;
}

export async function query(text, params = []) {
  const pool = getPool();
  return pool.query(text, params);
}

export async function withTransaction(callback, customPool = null) {
  const pool = customPool || getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function closePool() {
  if (defaultPool) {
    await defaultPool.end();
    defaultPool = null;
  }
}
