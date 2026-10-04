import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { cleanupTestDatabase } from '../helpers/db-helper.js';
import { setupFinanceTest, expenseInput, manilaDate, THIRD_ORG_ID } from './finance-helper.js';
import { budgetReport, daysInMonth, monthsEndingAt, runRateEstimate } from '../../server/finance/analytics.js';
import { formatAmount } from '../../server/finance/money.js';

const ORG_1 = '/organizations/org-1/finance';
const ORG_2 = '/organizations/org-2/finance';
const ORG_3 = `/organizations/${THIRD_ORG_ID}/finance`;
const LEN = { id: 'usr-len', isOwner: true };

describe('PLAN-002 Phase 4: budget and cost analytics (FEAT-006/REQ-009, REQ-010)', () => {
  describe('Calendar arithmetic', () => {
    test('days in month, including leap years and century rules', () => {
      assert.equal(daysInMonth('2026-01'), 31);
      assert.equal(daysInMonth('2026-04'), 30);
      assert.equal(daysInMonth('2026-02'), 28);
      assert.equal(daysInMonth('2028-02'), 29);
      assert.equal(daysInMonth('2100-02'), 28);
      assert.equal(daysInMonth('2000-02'), 29);
    });

    test('trend months cross year boundaries, oldest first', () => {
      assert.deepEqual(monthsEndingAt('2026-02', 4), ['2025-11', '2025-12', '2026-01', '2026-02']);
      assert.deepEqual(monthsEndingAt('2026-12', 1), ['2026-12']);
      assert.equal(monthsEndingAt('2027-01', 24)[0], '2025-02');
    });
  });

  describe('Run-rate estimate', () => {
    const estimate = (pesos, elapsed, total) => formatAmount(runRateEstimate(Math.round(pesos * 100), elapsed, total));

    test('hand-calculated examples', () => {
      // 1,000.00 spent in 10 of 31 days: 1000 * 31 / 10 = 3,100.00
      assert.equal(estimate(1000, 10, 31), '3100.00');
      // 100.00 spent in 3 of 31 days: 10000 * 31 / 3 = 103333.33... centavos
      assert.equal(estimate(100, 3, 31), '1033.33');
      // 200.00 spent in 3 of 31 days: 20000 * 31 / 3 = 206666.66... centavos, rounds up
      assert.equal(estimate(200, 3, 31), '2066.67');
      // The last day of the month estimates exactly what was spent.
      assert.equal(estimate(4321.09, 30, 30), '4321.09');
      // Day one extrapolates the first day across the month.
      assert.equal(estimate(50, 1, 28), '1400.00');
    });

    test('an exact half centavo rounds up', () => {
      // 1 centavo in 2 of 31 days: 31 / 2 = 15.5 centavos
      assert.equal(runRateEstimate(1, 2, 31), 16n);
      // 3 centavos in 2 of 29 days (leap February): 87 / 2 = 43.5 centavos
      assert.equal(runRateEstimate(3, 2, 29), 44n);
      // Just below a half stays down: 1 centavo in 3 of 28 days = 9.33 centavos
      assert.equal(runRateEstimate(1, 3, 28), 9n);
    });

    test('the largest amounts stay exact', () => {
      // 5,000 expenses of PHP 999,999,999.99 on day 1 of a 31-day month
      const monthToDate = 99_999_999_999n * 5000n;
      assert.equal(runRateEstimate(monthToDate, 1, 31), monthToDate * 31n);
    });
  });

  describe('Report through the API', () => {
    let app;
    let pool;
    let api;
    const today = manilaDate(0);
    const thisMonth = today.slice(0, 7);
    const dayOfMonth = Number(today.slice(8, 10));

    before(async () => {
      ({ app, pool, api } = await setupFinanceTest());
    });

    after(async () => {
      if (app) await app.close();
      await cleanupTestDatabase();
    });

    const record = (user, base, overrides) => api(user, 'POST', `${base}/expenses`, expenseInput(overrides));
    const budget = (user, base, month, category, amount) => api(user, 'POST', `${base}/budgets`, { month, category, amount });

    test('an empty period reports zero totals, no categories, and no forecast', async () => {
      const res = await api('sam', 'GET', `${ORG_3}/report?month=2024-02`);
      assert.equal(res.status, 200);
      assert.deepEqual(res.body.totals, { budget: '0.00', actual: '0.00', remaining: '0.00', unbudgetedActual: '0.00', status: 'unbudgeted' });
      assert.deepEqual(res.body.categories, []);
      assert.equal(res.body.forecast, null);
      assert.equal(res.body.trend.length, 6);
      assert.ok(res.body.trend.every(point => point.actual === '0.00' && point.expenseCount === 0));
      assert.equal(res.body.trend[5].month, '2024-02');
    });

    test('budget versus actual per category, with over, under, exact, and unbudgeted lines', async () => {
      await budget('alex', ORG_1, '2026-03', 'Supplies', '100.00');
      await budget('alex', ORG_1, '2026-03', 'Travel', '500.00');
      await budget('alex', ORG_1, '2026-03', 'Venue', '250.00');
      await budget('alex', ORG_1, '2026-03', 'Unused', '75.50');
      await record('sam', ORG_1, { occurredOn: '2026-03-01', amount: '60.10', category: 'supplies' });
      await record('sam', ORG_1, { occurredOn: '2026-03-31', amount: '60.20', category: 'SUPPLIES' });
      await record('sam', ORG_1, { occurredOn: '2026-03-15', amount: '120.00', category: 'Travel' });
      await record('sam', ORG_1, { occurredOn: '2026-03-15', amount: '250.00', category: 'Venue' });
      await record('sam', ORG_1, { occurredOn: '2026-03-20', amount: '33.33', category: 'Snacks' });
      // Outside the month, void, or in another organization: never counted.
      await record('sam', ORG_1, { occurredOn: '2026-02-28', amount: '999.00', category: 'Travel' });
      await record('sam', ORG_1, { occurredOn: '2026-04-01', amount: '999.00', category: 'Travel' });
      const voided = (await record('sam', ORG_1, { occurredOn: '2026-03-10', amount: '999.00', category: 'Travel' })).body;
      await api('sam', 'POST', `${ORG_1}/expenses/${voided.id}/void`, { version: voided.version });
      await record('jordan', ORG_2, { occurredOn: '2026-03-10', amount: '4242.42', category: 'Travel' });

      const res = await api('len', 'GET', `${ORG_1}/report?month=2026-03`);
      assert.equal(res.status, 200);
      assert.deepEqual(
        res.body.categories.map(c => [c.category, c.budget, c.actual, c.remaining, c.status, c.expenseCount]),
        [
          ['Snacks', null, '33.33', null, 'unbudgeted', 1],
          ['Supplies', '100.00', '120.30', '-20.30', 'over', 2],
          ['Travel', '500.00', '120.00', '380.00', 'under', 1],
          ['Unused', '75.50', '0.00', '75.50', 'under', 0],
          ['Venue', '250.00', '250.00', '0.00', 'at', 1],
        ]
      );
      assert.deepEqual(res.body.totals, {
        budget: '925.50',
        actual: '523.63',
        remaining: '401.87',
        unbudgetedActual: '33.33',
        status: 'under',
      });
      // A past month never carries a forecast.
      assert.equal(res.body.forecast, null);
    });

    test('report totals equal the expense register for the same organization and month', async () => {
      const report = (await api('len', 'GET', `${ORG_1}/report?month=2026-03`)).body;
      const registerList = (await api('len', 'GET', `${ORG_1}/expenses?from=2026-03-01&to=2026-03-31&limit=200`)).body;
      assert.equal(report.totals.actual, registerList.totalAmount);
      assert.equal(report.categories.reduce((n, c) => n + c.expenseCount, 0), registerList.total);

      // Independent sum of the listed rows in integer centavos.
      const summed = registerList.expenses.reduce((total, e) => total + BigInt(e.amount.replace('.', '')), 0n);
      assert.equal(formatAmount(summed), report.totals.actual);

      for (const line of report.categories) {
        const perCategory = (await api('len', 'GET', `${ORG_1}/expenses?from=2026-03-01&to=2026-03-31&category=${encodeURIComponent(line.category)}`)).body;
        assert.equal(perCategory.totalAmount, line.actual, line.category);
      }
    });

    test('an over-budget month reports a negative remaining amount', async () => {
      await budget('jordan', ORG_2, '2026-03', 'Travel', '1000.00');
      const res = await api('jordan', 'GET', `${ORG_2}/report?month=2026-03`);
      assert.equal(res.body.totals.remaining, '-3242.42');
      assert.equal(res.body.totals.status, 'over');
    });

    test('monthly trend fills empty months and covers multiple months per organization', async () => {
      await record('sam', ORG_3, { occurredOn: '2025-11-30', amount: '10.00', category: 'Trend' });
      await record('sam', ORG_3, { occurredOn: '2025-12-31', amount: '0.10', category: 'Trend' });
      await record('sam', ORG_3, { occurredOn: '2025-12-01', amount: '0.20', category: 'Trend' });
      await record('sam', ORG_3, { occurredOn: '2026-02-28', amount: '7.00', category: 'Trend' });

      const res = await api('sam', 'GET', `${ORG_3}/report?month=2026-02&trendMonths=4`);
      assert.deepEqual(res.body.trend, [
        { month: '2025-11', actual: '10.00', expenseCount: 1 },
        { month: '2025-12', actual: '0.30', expenseCount: 2 },
        { month: '2026-01', actual: '0.00', expenseCount: 0 },
        { month: '2026-02', actual: '7.00', expenseCount: 1 },
      ]);

      // Other organizations have their own trend.
      const other = await api('len', 'GET', `${ORG_1}/report?month=2026-02&trendMonths=4`);
      assert.equal(other.body.trend[0].actual, '0.00');
      assert.equal(other.body.trend[3].actual, '999.00');
    });

    test('the current month carries a labeled estimate that matches the documented calculation', async () => {
      await record('sam', ORG_3, { occurredOn: today, amount: '100.00', category: 'Forecast' });
      await record('sam', ORG_3, { occurredOn: `${thisMonth}-01`, amount: '0.01', category: 'Forecast' });

      const res = await api('sam', 'GET', `${ORG_3}/report`);
      assert.equal(res.body.month, thisMonth);
      assert.equal(res.body.asOf, today);

      const totalDays = daysInMonth(thisMonth);
      const expected = (2n * 10001n * BigInt(totalDays) + BigInt(dayOfMonth)) / (2n * BigInt(dayOfMonth));
      assert.deepEqual(
        { ...res.body.forecast, basis: undefined },
        { estimate: formatAmount(expected), monthToDate: '100.01', elapsedDays: dayOfMonth, daysInMonth: totalDays, basis: undefined }
      );
      assert.match(res.body.forecast.basis, /rounded to the nearest centavo/);
      // The estimate is separate from actual spending.
      assert.equal(res.body.totals.actual, '100.01');
    });

    test('the estimate uses the supplied Manila date at month boundaries', async () => {
      await pool.query(
        `INSERT INTO expenses (id, organization_id, occurred_on, amount_centavos, category, description, created_by, updated_by)
         VALUES ('exp-leap-1', $1, '2028-02-02', 300, 'Leap', 'Leap year fixture', 'usr-sam', 'usr-sam')`,
        [THIRD_ORG_ID]
      );
      const report = date => budgetReport(THIRD_ORG_ID, { month: '2028-02' }, LEN, pool, date);

      // Day 2 of a 29-day February: 300 * 29 / 2 = 4350 centavos.
      assert.equal((await report('2028-02-02')).forecast.estimate, '43.50');
      // Last day of the leap month: the estimate equals the actual.
      assert.equal((await report('2028-02-29')).forecast.estimate, '3.00');
      // Once the next month starts, February is history and has no estimate.
      assert.equal((await report('2028-03-01')).forecast, null);
    });

    test('a current month with no spending has no estimate', async () => {
      const res = await api('alex', 'GET', `${ORG_2}/report`);
      assert.equal(res.body.totals.actual, '0.00');
      assert.equal(res.body.forecast, null);
    });

    test('amounts are PHP decimal strings throughout', async () => {
      const res = await api('len', 'GET', `${ORG_1}/report?month=2026-03`);
      assert.equal(res.body.currency, 'PHP');
      const amounts = [
        ...Object.entries(res.body.totals).filter(([key]) => key !== 'status').map(([, value]) => value),
        ...res.body.categories.flatMap(c => [c.budget, c.actual, c.remaining]).filter(value => value !== null),
        ...res.body.trend.map(point => point.actual),
      ];
      for (const amount of amounts) assert.match(amount, /^-?\d+\.\d{2}$/);
    });

    test('the report is scoped: non-members and unauthenticated callers are refused', async () => {
      assert.equal((await api('jordan', 'GET', `${ORG_1}/report`)).status, 403);
      assert.equal((await api('alex', 'GET', `${ORG_3}/report`)).status, 403);
      assert.equal((await api(null, 'GET', `${ORG_1}/report`)).status, 401);
      assert.equal((await api('len', 'GET', `${ORG_1}/report?month=2026-13`)).status, 400);
    });

    test('Owner, Lead, and Member all read the same report', async () => {
      const bodies = [];
      for (const user of ['len', 'alex', 'sam']) bodies.push((await api(user, 'GET', `${ORG_1}/report?month=2026-03`)).body);
      assert.deepEqual(bodies[1], bodies[0]);
      assert.deepEqual(bodies[2], bodies[0]);
    });
  });
});
