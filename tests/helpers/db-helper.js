import { createPool } from '../../db/client.js';
import { runMigrations } from '../../db/migrate.js';
import { seedDatabase } from '../../db/seed.js';
import { buildApp } from '../../server/app.js';

export const TEST_DB_URL = process.env.TEST_DATABASE_URL || 'postgres://postgres@127.0.0.1:5433/pipeline_test';

let testPool = null;

export function getTestPool() {
  if (!testPool) {
    testPool = createPool(TEST_DB_URL);
  }
  return testPool;
}

export async function setupTestDatabase() {
  await runMigrations({ isTest: true, customUrl: TEST_DB_URL });
  const pool = getTestPool();
  await pool.query('TRUNCATE activity_events, task_comments, tasks, invitations, memberships, sessions, users, organizations CASCADE;');
  await seedDatabase({ customUrl: TEST_DB_URL });
  return pool;
}

export async function createTestApp() {
  const pool = getTestPool();
  return buildApp({
    customPool: pool,
    customConfig: {
      nodeEnv: 'test',
      jwtSecret: 'test-jwt-secret-must-be-at-least-32-characters-long!',
      cookieSecret: 'test-cookie-secret-must-be-at-least-32-characters!',
    },
    logger: false,
  });
}

export async function cleanupTestDatabase() {
  if (testPool) {
    await testPool.end();
    testPool = null;
  }
}
