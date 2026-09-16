import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPool, withTransaction } from './client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations({ isTest = false, customUrl = null } = {}) {
  let dbUrl = customUrl;

  if (isTest) {
    dbUrl = dbUrl || process.env.TEST_DATABASE_URL || 'postgres://postgres@127.0.0.1:5433/pipeline_test';
    const devUrl = process.env.DATABASE_URL || 'postgres://postgres@127.0.0.1:5433/pipeline_dev';
    if (dbUrl === devUrl || dbUrl.includes('pipeline_dev') || dbUrl.includes('production')) {
      throw new Error(`[migrate:test] Refusing to migrate development or production database: ${dbUrl}`);
    }
  } else {
    dbUrl = dbUrl || process.env.DATABASE_URL || 'postgres://postgres@127.0.0.1:5433/pipeline_dev';
  }

  const pool = createPool(dbUrl);

  try {
    // 1. Ensure schema_migrations table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 2. Fetch already applied migrations
    const appliedResult = await pool.query('SELECT version, name FROM schema_migrations ORDER BY version ASC');
    const appliedVersions = new Set(appliedResult.rows.map(r => r.version));

    // 3. Read migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.log('[migrate] No migrations directory found.');
      return;
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    let appliedCount = 0;

    for (const file of files) {
      const match = file.match(/^(\d+)_(.+)\.sql$/);
      if (!match) {
        console.warn(`[migrate] Ignoring non-conforming migration filename: ${file}`);
        continue;
      }

      const version = parseInt(match[1], 10);
      const name = match[2];

      if (appliedVersions.has(version)) {
        console.log(`[migrate] Skipping ${file} (already applied)`);
        continue;
      }

      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      console.log(`[migrate] Applying ${file}...`);
      await withTransaction(async (client) => {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
          [version, name]
        );
      }, pool);

      console.log(`[migrate] Applied ${file} successfully.`);
      appliedCount++;
    }

    console.log(`[migrate] Done. ${appliedCount} migration(s) applied to ${dbUrl.split('@')[1] || dbUrl}.`);
  } finally {
    await pool.end();
  }
}

// CLI invocation
if (process.argv[1] === __filename) {
  const isTest = process.argv.includes('--test');
  runMigrations({ isTest })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[migrate] Migration failed:', err.message);
      process.exit(1);
    });
}
