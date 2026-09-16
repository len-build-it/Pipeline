import { spawnSync } from 'node:child_process';
import { unlinkSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { setupTestDatabase, cleanupTestDatabase } from '../tests/helpers/db-helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const PG_HOST = process.env.PGHOST || '127.0.0.1';
const PG_PORT = process.env.PGPORT || '5433';
const PG_USER = process.env.PGUSER || 'postgres';
const SOURCE_DB = process.env.TEST_DB_NAME || 'pipeline_test';
const RESTORE_DB = 'pipeline_restore_test';
const DUMP_FILE = path.join(rootDir, '.db', 'restore_temp.sql');

// Binaries for PostgreSQL 18
const PG_BIN = process.env.PG_BIN_DIR || 'C:\\Program Files\\PostgreSQL\\18\\bin';
const PG_DUMP = path.join(PG_BIN, 'pg_dump.exe');
const PSQL = path.join(PG_BIN, 'psql.exe');

async function main() {
  console.log('[restore] 1. Preparing source test database...');
  await setupTestDatabase();
  await cleanupTestDatabase();

  const maintenancePool = new pg.Pool({
    host: PG_HOST,
    port: parseInt(PG_PORT, 10),
    user: PG_USER,
    database: 'postgres',
  });

  try {
    // 2. Query source counts
    const srcPool = new pg.Pool({
      host: PG_HOST,
      port: parseInt(PG_PORT, 10),
      user: PG_USER,
      database: SOURCE_DB,
    });

    const srcCounts = {
      organizations: (await srcPool.query('SELECT COUNT(*)::int AS count FROM organizations')).rows[0].count,
      users: (await srcPool.query('SELECT COUNT(*)::int AS count FROM users')).rows[0].count,
      activeMemberships: (await srcPool.query("SELECT COUNT(*)::int AS count FROM memberships WHERE status = 'active'")).rows[0].count,
      tasks: (await srcPool.query('SELECT COUNT(*)::int AS count FROM tasks')).rows[0].count,
      openTasks: (await srcPool.query("SELECT COUNT(*)::int AS count FROM tasks WHERE status != 'Done'")).rows[0].count,
      announcements: (await srcPool.query('SELECT COUNT(*)::int AS count FROM announcements')).rows[0].count,
      publicationTargets: (await srcPool.query('SELECT id, target_organizations FROM announcements')).rows,
      activityEvents: (await srcPool.query('SELECT COUNT(*)::int AS count FROM activity_events')).rows[0].count,
    };
    await srcPool.end();

    console.log('[restore] Source database stats:');
    console.log(`  Organizations:       ${srcCounts.organizations}`);
    console.log(`  Users:               ${srcCounts.users}`);
    console.log(`  Active Memberships:  ${srcCounts.activeMemberships}`);
    console.log(`  Tasks (Total/Open):  ${srcCounts.tasks} / ${srcCounts.openTasks}`);
    console.log(`  Announcements:       ${srcCounts.announcements}`);
    console.log(`  Activity Events:     ${srcCounts.activityEvents}`);

    // 3. Drop existing disposable database if it exists, then create fresh
    console.log(`[restore] 2. Creating disposable database "${RESTORE_DB}"...`);
    await maintenancePool.query(`DROP DATABASE IF EXISTS ${RESTORE_DB};`);
    await maintenancePool.query(`CREATE DATABASE ${RESTORE_DB};`);

    // 4. Dump source database using pg_dump
    console.log(`[restore] 3. Dumping "${SOURCE_DB}" to ${DUMP_FILE}...`);
    const dumpResult = spawnSync(PG_DUMP, [
      '-h', PG_HOST,
      '-p', PG_PORT,
      '-U', PG_USER,
      '-d', SOURCE_DB,
      '-F', 'p',
      '-f', DUMP_FILE,
    ], { stdio: 'pipe', encoding: 'utf-8' });

    if (dumpResult.status !== 0) {
      throw new Error(`pg_dump failed (exit ${dumpResult.status}):\n${dumpResult.stderr}`);
    }

    // 5. Restore dump into disposable database using psql
    console.log(`[restore] 4. Restoring dump into "${RESTORE_DB}"...`);
    const restoreResult = spawnSync(PSQL, [
      '-h', PG_HOST,
      '-p', PG_PORT,
      '-U', PG_USER,
      '-d', RESTORE_DB,
      '-f', DUMP_FILE,
      '-v', 'ON_ERROR_STOP=1',
    ], { stdio: 'pipe', encoding: 'utf-8' });

    if (restoreResult.status !== 0) {
      throw new Error(`psql restore failed (exit ${restoreResult.status}):\n${restoreResult.stderr}`);
    }

    // 6. Connect to restored database and verify relationships, active memberships, tasks, publication targets, and activity counts
    console.log(`[restore] 5. Verifying restored database integrity...`);
    const restoredPool = new pg.Pool({
      host: PG_HOST,
      port: parseInt(PG_PORT, 10),
      user: PG_USER,
      database: RESTORE_DB,
    });

    try {
      const dstCounts = {
        organizations: (await restoredPool.query('SELECT COUNT(*)::int AS count FROM organizations')).rows[0].count,
        users: (await restoredPool.query('SELECT COUNT(*)::int AS count FROM users')).rows[0].count,
        activeMemberships: (await restoredPool.query("SELECT COUNT(*)::int AS count FROM memberships WHERE status = 'active'")).rows[0].count,
        tasks: (await restoredPool.query('SELECT COUNT(*)::int AS count FROM tasks')).rows[0].count,
        openTasks: (await restoredPool.query("SELECT COUNT(*)::int AS count FROM tasks WHERE status != 'Done'")).rows[0].count,
        announcements: (await restoredPool.query('SELECT COUNT(*)::int AS count FROM announcements')).rows[0].count,
        publicationTargets: (await restoredPool.query('SELECT id, target_organizations FROM announcements')).rows,
        activityEvents: (await restoredPool.query('SELECT COUNT(*)::int AS count FROM activity_events')).rows[0].count,
      };

      // Assertions
      console.log(`[restore] Comparing counts and structures:`);

      if (dstCounts.organizations !== srcCounts.organizations) {
        throw new Error(`Organizations count mismatch: expected ${srcCounts.organizations}, got ${dstCounts.organizations}`);
      }
      console.log(`  ✔ Organizations: ${dstCounts.organizations} matched.`);

      if (dstCounts.users !== srcCounts.users) {
        throw new Error(`Users count mismatch: expected ${srcCounts.users}, got ${dstCounts.users}`);
      }
      console.log(`  ✔ Users: ${dstCounts.users} matched.`);

      if (dstCounts.activeMemberships !== srcCounts.activeMemberships) {
        throw new Error(`Active memberships count mismatch: expected ${srcCounts.activeMemberships}, got ${dstCounts.activeMemberships}`);
      }
      console.log(`  ✔ Active memberships: ${dstCounts.activeMemberships} matched.`);

      if (dstCounts.tasks !== srcCounts.tasks || dstCounts.openTasks !== srcCounts.openTasks) {
        throw new Error(`Tasks count mismatch: expected ${srcCounts.tasks} total / ${srcCounts.openTasks} open, got ${dstCounts.tasks} / ${dstCounts.openTasks}`);
      }
      console.log(`  ✔ Tasks: ${dstCounts.tasks} (open: ${dstCounts.openTasks}) matched.`);

      if (dstCounts.announcements !== srcCounts.announcements) {
        throw new Error(`Announcements count mismatch: expected ${srcCounts.announcements}, got ${dstCounts.announcements}`);
      }
      console.log(`  ✔ Announcements: ${dstCounts.announcements} matched.`);

      if (JSON.stringify(dstCounts.publicationTargets) !== JSON.stringify(srcCounts.publicationTargets)) {
        throw new Error(`Publication targets mismatch!`);
      }
      console.log(`  ✔ Publication targets matched.`);

      if (dstCounts.activityEvents !== srcCounts.activityEvents) {
        throw new Error(`Activity events mismatch: expected ${srcCounts.activityEvents}, got ${dstCounts.activityEvents}`);
      }
      console.log(`  ✔ Activity events: ${dstCounts.activityEvents} matched.`);

      // Verify relational integrity (referential keys)
      console.log(`[restore] Verifying relational integrity across entities...`);
      const orphanMemberships = await restoredPool.query(`
        SELECT m.id FROM memberships m
        LEFT JOIN users u ON m.user_id = u.id
        LEFT JOIN organizations o ON m.organization_id = o.id
        WHERE u.id IS NULL OR o.id IS NULL;
      `);
      if (orphanMemberships.rows.length > 0) {
        throw new Error(`Found ${orphanMemberships.rows.length} orphaned memberships!`);
      }

      const orphanTasks = await restoredPool.query(`
        SELECT t.id FROM tasks t
        LEFT JOIN organizations o ON t.organization_id = o.id
        LEFT JOIN users u ON t.assignee_id = u.id
        WHERE o.id IS NULL OR (t.assignee_id IS NOT NULL AND u.id IS NULL);
      `);
      if (orphanTasks.rows.length > 0) {
        throw new Error(`Found ${orphanTasks.rows.length} orphaned tasks!`);
      }

      const orphanAnnouncements = await restoredPool.query(`
        SELECT a.id FROM announcements a
        LEFT JOIN users u ON a.author_id = u.id
        WHERE u.id IS NULL;
      `);
      if (orphanAnnouncements.rows.length > 0) {
        throw new Error(`Found ${orphanAnnouncements.rows.length} orphaned announcements!`);
      }

      console.log(`  ✔ Foreign keys and relationships validated with zero orphans.`);
    } finally {
      await restoredPool.end();
    }

    // 7. Clean up disposable database
    console.log(`[restore] 6. Cleaning up disposable database "${RESTORE_DB}"...`);
    await maintenancePool.query(`DROP DATABASE ${RESTORE_DB};`);
    console.log(`  ✔ Database "${RESTORE_DB}" dropped.`);

    if (existsSync(DUMP_FILE)) {
      unlinkSync(DUMP_FILE);
      console.log(`  ✔ Temporary dump file deleted.`);
    }

    console.log('\n[restore:pass] Safe local backup and restore verified successfully.');
  } finally {
    await maintenancePool.end();
  }
}

main().catch(err => {
  console.error('[restore:error]', err);
  process.exit(1);
});
