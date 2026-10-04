const TEST_DATABASE = 'pipeline_test';
const RESTORE_DATABASE = 'pipeline_restore_test';

function normalizeHost(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return 'loopback';
  return host;
}

function parseTarget(connectionString) {
  let parsed;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw new Error('Refusing unsafe test database target.');
  }

  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new Error('Refusing unsafe test database target.');
  }

  const blockedOptions = new Set(['host', 'hostaddr', 'service', 'servicefile', 'port', 'dbname', 'database']);
  for (const key of parsed.searchParams.keys()) {
    if (blockedOptions.has(key.toLowerCase())) {
      throw new Error('Refusing unsafe test database target.');
    }
  }

  const database = decodeURIComponent(parsed.pathname.slice(1));
  const port = parsed.port ? Number(parsed.port) : 5432;
  if (!database || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Refusing unsafe test database target.');
  }

  return {
    host: normalizeHost(parsed.hostname),
    port,
    database,
  };
}

function sameTarget(left, right) {
  return left.host === right.host && left.port === right.port && left.database === right.database;
}

export function assertTestDatabaseTarget(testUrl, developmentUrl) {
  const testTarget = parseTarget(testUrl);
  const devTarget = parseTarget(developmentUrl);

  if (
    testTarget.host !== 'loopback'
    || testTarget.database !== TEST_DATABASE
    || sameTarget(testTarget, devTarget)
  ) {
    throw new Error('Refusing unsafe test database target.');
  }

  return testTarget;
}

export function assertRestoreTarget({
  testUrl,
  developmentUrl,
  restoreHost,
  restorePort,
  restoreHostAddress,
  restoreService,
  sourceDatabase,
  restoreDatabase,
}) {
  const testTarget = assertTestDatabaseTarget(testUrl, developmentUrl);
  const host = normalizeHost(String(restoreHost || ''));
  const port = Number(restorePort);

  if (
    host !== 'loopback'
    || host !== testTarget.host
    || !Number.isInteger(port)
    || port !== testTarget.port
    || Boolean(restoreHostAddress)
    || Boolean(restoreService)
    || sourceDatabase !== TEST_DATABASE
    || restoreDatabase !== RESTORE_DATABASE
  ) {
    throw new Error('Refusing unsafe restore database target.');
  }

  return {
    host,
    port,
    sourceDatabase,
    restoreDatabase,
  };
}
