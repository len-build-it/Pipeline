import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assertSeedAllowed } from '../../db/seed-policy.js';
import { assertRestoreTarget, assertTestDatabaseTarget } from '../../db/test-target.js';
import { seedDatabase } from '../../db/seed.js';
import { runMigrations } from '../../db/migrate.js';
import { assertRuntimeConfig, DEVELOPMENT_JWT_SECRET } from '../../server/config.js';
import { buildApp } from '../../server/app.js';

const TEST_URL = 'postgres://test-user:test-password@127.0.0.1:5433/pipeline_test';
const DEV_URL = 'postgres://dev-user:dev-password@127.0.0.1:5433/pipeline_dev';
const PROJECT_ROOT = fileURLToPath(new URL('../../', import.meta.url));

function runNode(args, env) {
  return spawnSync(process.execPath, args, {
    cwd: PROJECT_ROOT,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    timeout: 5000,
  });
}

describe('FEAT-007 security startup and database-target guards', () => {
  test('allows the local development JWT default but rejects it in production', () => {
    assert.doesNotThrow(() => assertRuntimeConfig({
      isProd: false,
      nodeEnv: 'development',
      jwtSecret: DEVELOPMENT_JWT_SECRET,
    }));

    assert.throws(
      () => assertRuntimeConfig({
        isProd: true,
        nodeEnv: 'production',
        jwtSecret: DEVELOPMENT_JWT_SECRET,
      }),
      /unique JWT_SECRET/,
    );
  });

  test('rejects missing and short production JWT secrets without echoing values', () => {
    for (const secret of [undefined, '', 'too-short-secret']) {
      assert.throws(
        () => assertRuntimeConfig({ isProd: true, nodeEnv: 'production', jwtSecret: secret }),
        (error) => {
          assert.match(error.message, /unique JWT_SECRET/);
          assert.equal(secret ? error.message.includes(secret) : false, false);
          return true;
        },
      );
    }
  });

  test('accepts a unique production JWT secret of at least 32 characters', () => {
    assert.doesNotThrow(() => assertRuntimeConfig({
      isProd: true,
      nodeEnv: 'production',
      jwtSecret: 'unique-test-secret-with-at-least-32-characters',
    }));
  });

  test('buildApp rejects unsafe production config before constructing the HTTP adapter', async () => {
    await assert.rejects(
      () => buildApp({
        customConfig: {
          isProd: false,
          nodeEnv: 'production',
          jwtSecret: DEVELOPMENT_JWT_SECRET,
        },
      }),
      /unique JWT_SECRET/,
    );
  });

  test('production server command rejects a fallback secret before contacting PostgreSQL', () => {
    const result = runNode(['server/index.js'], {
      NODE_ENV: 'production',
      JWT_SECRET: 'too-short-test-secret',
      DATABASE_URL: 'postgres://test-user:test-password@127.0.0.1:1/pipeline_dev',
    });
    const output = result.stdout + result.stderr;

    assert.equal(result.status, 1);
    assert.match(output, /Invalid runtime configuration/);
    assert.doesNotMatch(output, /Failed to connect to database/);
    assert.doesNotMatch(output, /test-password/);
  });

  test('blocks the development seed function before opening a database in production', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      assert.throws(() => assertSeedAllowed(process.env.NODE_ENV), /not allowed in production/);
      await assert.rejects(
        () => seedDatabase({ customUrl: 'postgres://bad.invalid/should-never-connect' }),
        /not allowed in production/,
      );
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
    }
  });

  test('production seed command refuses before connecting or logging database credentials', () => {
    const result = runNode(['db/seed.js'], {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://test-user:test-password@127.0.0.1:1/pipeline_dev',
    });
    const output = result.stdout + result.stderr;

    assert.equal(result.status, 1);
    assert.match(output, /not allowed in production/);
    assert.doesNotMatch(output, /ECONNREFUSED/);
    assert.doesNotMatch(output, /test-password/);
  });

  test('allows only the named loopback test database and normalizes harmless URL aliases', () => {
    const target = assertTestDatabaseTarget(
      'postgresql://test-user:secret@localhost:5433/pipeline_test?application_name=unit-test',
      DEV_URL,
    );
    assert.deepEqual(target, { host: 'loopback', port: 5433, database: 'pipeline_test' });
  });

  test('rejects a test URL alias for the development target even when URL options differ', () => {
    assert.throws(
      () => assertTestDatabaseTarget(
        'postgres://other-user:another-secret@localhost:5433/pipeline_dev?application_name=test',
        DEV_URL,
      ),
      /unsafe test database target/,
    );
  });

  test('test migration rejects a development URL before creating a pool', async () => {
    await assert.rejects(
      () => runMigrations({ isTest: true, customUrl: DEV_URL }),
      /unsafe test database target/,
    );
  });

  test('rejects remote hosts, unapproved database names, and URI target overrides', () => {
    for (const unsafeUrl of [
      'postgres://user:password@db.example.invalid:5433/pipeline_test',
      'postgres://user:password@127.0.0.1:5433/pipeline_dev',
      'postgres://user:password@127.0.0.1:5433/production',
      'postgres://user:password@127.0.0.1:5433/pipeline_test?host=db.example.invalid',
      'postgres://user:password@127.0.0.1:5433/pipeline_test?port=5432',
      'postgres://user:password@127.0.0.1:5433/pipeline_test?service=production',
    ]) {
      assert.throws(
        () => assertTestDatabaseTarget(unsafeUrl, DEV_URL),
        /unsafe test database target/,
      );
    }
  });

  test('does not include connection credentials or query options in refusal errors', () => {
    assert.throws(
      () => assertTestDatabaseTarget(
        'postgres://operator:unique-password@remote.example.invalid/pipeline_test?sslpassword=unique-query-secret',
        DEV_URL,
      ),
      (error) => {
        assert.equal(error.message.includes('unique-password'), false);
        assert.equal(error.message.includes('unique-query-secret'), false);
        assert.equal(error.message.includes('remote.example.invalid'), false);
        return true;
      },
    );
  });

  test('permits restore only when source and destructive target match the loopback test server', () => {
    assert.deepEqual(assertRestoreTarget({
      testUrl: TEST_URL,
      developmentUrl: DEV_URL,
      restoreHost: 'localhost',
      restorePort: '5433',
      sourceDatabase: 'pipeline_test',
      restoreDatabase: 'pipeline_restore_test',
    }), {
      host: 'loopback',
      port: 5433,
      sourceDatabase: 'pipeline_test',
      restoreDatabase: 'pipeline_restore_test',
    });
  });

  test('rejects mismatched restore server, source database, and destructive database name', () => {
    const base = {
      testUrl: TEST_URL,
      developmentUrl: DEV_URL,
      restoreHost: '127.0.0.1',
      restorePort: '5433',
      sourceDatabase: 'pipeline_test',
      restoreDatabase: 'pipeline_restore_test',
    };

    for (const changes of [
      { restoreHost: 'remote.example.invalid' },
      { restorePort: '5434' },
      { restoreHostAddress: '127.0.0.1' },
      { restoreService: 'local-postgres' },
      { sourceDatabase: 'pipeline_dev' },
      { restoreDatabase: 'production' },
    ]) {
      assert.throws(
        () => assertRestoreTarget({ ...base, ...changes }),
        /unsafe restore database target/,
      );
    }
  });

  test('restore command rejects an environment-selected remote host before opening a database', () => {
    const result = runNode(['scripts/test-restore.js'], {
      NODE_ENV: 'test',
      TEST_DATABASE_URL: TEST_URL,
      DATABASE_URL: DEV_URL,
      PGHOST: 'remote.example.invalid',
      PGPORT: '5433',
      PGUSER: 'test-user',
      TEST_DB_NAME: 'pipeline_test',
    });
    const output = result.stdout + result.stderr;

    assert.equal(result.status, 1);
    assert.match(output, /unsafe restore database target/);
    assert.doesNotMatch(output, /Preparing source test database/);
    assert.doesNotMatch(output, /test-password/);
  });

  test('restore command rejects libpq host and service overrides before preparing a database', () => {
    for (const overrides of [
      { PGHOSTADDR: '192.0.2.10' },
      { PGSERVICE: 'unexpected-service' },
    ]) {
      const result = runNode(['scripts/test-restore.js'], {
        NODE_ENV: 'test',
        TEST_DATABASE_URL: TEST_URL,
        DATABASE_URL: DEV_URL,
        PGHOST: '127.0.0.1',
        PGPORT: '5433',
        PGUSER: 'test-user',
        TEST_DB_NAME: 'pipeline_test',
        ...overrides,
      });
      const output = result.stdout + result.stderr;

      assert.equal(result.status, 1);
      assert.match(output, /unsafe restore database target/);
      assert.doesNotMatch(output, /Preparing source test database/);
    }
  });
});
