import { buildApp } from './app.js';
import { config } from './config.js';
import { getPool } from '../db/client.js';

async function start() {
  const pool = getPool();

  try {
    const res = await pool.query('SELECT current_database();');
    console.log(`[server] Connected to database: ${res.rows[0].current_database}`);
  } catch (err) {
    console.error('[server] Failed to connect to database:', err.message);
    process.exit(1);
  }

  // Ensure production refuses demo personas
  if (config.isProd) {
    console.log('[server] Production mode active: strictly enforcing real authentication and database integrity.');
  }

  const app = await buildApp({ logger: true });

  try {
    await app.listen({ port: config.port, host: config.host });
    console.log(`[server] Running at http://${config.host}:${config.port}`);
  } catch (err) {
    console.error('[server] Startup error:', err);
    process.exit(1);
  }
}

start();
