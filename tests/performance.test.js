import { performance } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';
import { setupTestDatabase, createTestApp, cleanupTestDatabase, getTestPool } from './helpers/db-helper.js';

async function runPerformanceTest() {
  console.log('[perf] Setting up test database with deterministic synthetic data...');
  await setupTestDatabase();
  const app = await createTestApp();
  await app.ready();

  try {
    // 1. Authenticate as Owner to obtain access token
    console.log('[perf] Authenticating as Owner...');
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'len@example.com',
        password: 'password123456',
      },
    });

    if (loginRes.statusCode !== 200) {
      throw new Error(`Login failed with status ${loginRes.statusCode}: ${loginRes.body}`);
    }

    const { accessToken } = JSON.parse(loginRes.body);
    const authHeaders = {
      authorization: `Bearer ${accessToken}`,
    };

    // 2. Warm up dashboard load (pre-warm connection pool and JIT)
    console.log('[perf] Pre-warming dashboard...');
    for (let w = 0; w < 3; w++) {
      const warmRes = await app.inject({
        method: 'GET',
        url: '/api/overview?scope=all',
        headers: authHeaders,
      });
      if (warmRes.statusCode !== 200) {
        throw new Error(`Warmup failed with status ${warmRes.statusCode}`);
      }
    }

    // 3. Measure 20 authenticated warm dashboard loads with 100 ms simulated round-trip latency
    const iterations = 20;
    const simulatedLatencyMs = 100;
    const measurements = [];

    console.log(`[perf] Measuring ${iterations} warm dashboard loads with ${simulatedLatencyMs}ms simulated latency...`);

    for (let i = 0; i < iterations; i++) {
      const t0 = performance.now();

      // Simulated network round-trip latency (50ms upload + 50ms download)
      await sleep(simulatedLatencyMs / 2);

      const res = await app.inject({
        method: 'GET',
        url: '/api/overview?scope=all',
        headers: authHeaders,
      });

      await sleep(simulatedLatencyMs / 2);

      const t1 = performance.now();
      const elapsed = t1 - t0;

      if (res.statusCode !== 200) {
        throw new Error(`Dashboard request ${i + 1} failed with status ${res.statusCode}`);
      }

      const body = JSON.parse(res.body);
      if (typeof body.metrics?.activeMembers !== 'number') {
        throw new Error(`Invalid response payload structure in iteration ${i + 1}`);
      }

      measurements.push(elapsed);
    }

    // 4. Calculate timing distribution metrics
    measurements.sort((a, b) => a - b);
    const min = measurements[0];
    const max = measurements[measurements.length - 1];
    const avg = measurements.reduce((acc, v) => acc + v, 0) / measurements.length;
    // p95 index for 20 samples: 0.95 * 20 = 19 (the 19th index, 0-based)
    const p95Index = Math.ceil(0.95 * measurements.length) - 1;
    const p95 = measurements[p95Index];

    console.log('\n================ Performance Results ================');
    console.log(`Target p95: <= 2000.00 ms (2.0s)`);
    console.log(`Samples:    ${iterations}`);
    console.log(`Min:        ${min.toFixed(2)} ms`);
    console.log(`Average:    ${avg.toFixed(2)} ms`);
    console.log(`p95:        ${p95.toFixed(2)} ms`);
    console.log(`Max:        ${max.toFixed(2)} ms`);
    console.log('=====================================================\n');

    const targetMs = 2000;
    if (p95 <= targetMs) {
      console.log(`[perf:pass] p95 latency (${p95.toFixed(2)} ms) is within target (<= ${targetMs} ms).`);
    } else {
      console.error(`[perf:fail] p95 latency (${p95.toFixed(2)} ms) exceeded target (<= ${targetMs} ms).`);
      process.exitCode = 1;
    }

    await measureFinanceReport(app, authHeaders, iterations, simulatedLatencyMs);
  } finally {
    await app.close();
    await cleanupTestDatabase();
  }
}

/**
 * Times the finance budget report separately from the dashboard.
 * These timings are recorded for information; the p95 target above applies to the dashboard only.
 */
async function measureFinanceReport(app, authHeaders, iterations, simulatedLatencyMs) {
  // Fixture rows are inserted directly: this run measures reading the report, not recording expenses.
  await getTestPool().query(`
    INSERT INTO expenses (id, organization_id, occurred_on, amount_centavos, category, description, created_by, updated_by)
    SELECT 'exp-perf-' || n, 'org-1', date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date,
           1234, 'Category ' || (n % 10), 'Timing fixture ' || n, 'usr-len', 'usr-len'
    FROM generate_series(1, 200) AS n
  `);

  const measurements = [];
  for (let i = 0; i < iterations + 3; i++) {
    const t0 = performance.now();
    await sleep(simulatedLatencyMs / 2);
    const res = await app.inject({ method: 'GET', url: '/api/organizations/org-1/finance/report', headers: authHeaders });
    await sleep(simulatedLatencyMs / 2);
    if (res.statusCode !== 200) throw new Error(`Finance report request ${i + 1} failed with status ${res.statusCode}`);
    if (JSON.parse(res.body).totals.actual !== '2468.00') throw new Error('Finance report total does not match the 200 fixture expenses.');
    if (i >= 3) measurements.push(performance.now() - t0); // the first three loads are warm-up
  }

  measurements.sort((a, b) => a - b);
  const p95 = measurements[Math.ceil(0.95 * measurements.length) - 1];
  const avg = measurements.reduce((acc, v) => acc + v, 0) / measurements.length;
  console.log('============ Finance Report Timings (no target) ============');
  console.log(`Fixture:    200 expenses in 10 categories, one organization`);
  console.log(`Samples:    ${measurements.length}, ${simulatedLatencyMs}ms simulated latency`);
  console.log(`Min:        ${measurements[0].toFixed(2)} ms`);
  console.log(`Average:    ${avg.toFixed(2)} ms`);
  console.log(`p95:        ${p95.toFixed(2)} ms`);
  console.log(`Max:        ${measurements[measurements.length - 1].toFixed(2)} ms`);
  console.log('============================================================\n');
}

runPerformanceTest().catch(err => {
  console.error('[perf:error]', err);
  process.exit(1);
});
