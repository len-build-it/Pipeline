import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { cleanupTestDatabase } from '../helpers/db-helper.js';
import { setupFinanceTest, expenseInput, manilaDate, THIRD_ORG_ID } from './finance-helper.js';

const ORG_1 = '/organizations/org-1/finance';
const ORG_2 = '/organizations/org-2/finance';
const ORG_3 = `/organizations/${THIRD_ORG_ID}/finance`;
const THIS_MONTH = manilaDate().slice(0, 7);

describe('PLAN-002 Phase 2: budgets and expenses (FEAT-006/REQ-002 through REQ-006)', () => {
  let app;
  let pool;
  let api;

  before(async () => {
    ({ app, pool, api } = await setupFinanceTest());
  });

  after(async () => {
    if (app) await app.close();
    await cleanupTestDatabase();
  });

  async function createExpense(user, base, overrides) {
    const res = await api(user, 'POST', `${base}/expenses`, expenseInput(overrides));
    assert.equal(res.status, 201, JSON.stringify(res.body));
    return res.body;
  }

  async function countRows(table) {
    return (await pool.query(`SELECT COUNT(*)::int AS count FROM ${table}`)).rows[0].count;
  }

  describe('Equal member access (REQ-003)', () => {
    // len is the global Owner, alex is a Lead in org-1, sam is a Member in org-1.
    for (const user of ['len', 'alex', 'sam']) {
      test(`${user} can create, edit, and void an expense and set a budget`, async () => {
        const created = await createExpense(user, ORG_1, { category: `Access ${user}` });
        assert.equal(created.amount, '100.00');
        assert.equal(created.currency, 'PHP');
        assert.equal(created.source, 'manual');

        const edited = await api(user, 'PATCH', `${ORG_1}/expenses/${created.id}`, { amount: '150.25', version: created.version });
        assert.equal(edited.status, 200);
        assert.equal(edited.body.amount, '150.25');
        assert.equal(edited.body.version, created.version + 1);

        const voided = await api(user, 'POST', `${ORG_1}/expenses/${created.id}/void`, { version: edited.body.version });
        assert.equal(voided.status, 200);
        assert.equal(voided.body.voided, true);

        const budget = await api(user, 'POST', `${ORG_1}/budgets`, { month: THIS_MONTH, category: `Access ${user}`, amount: '5000' });
        assert.equal(budget.status, 201);
        assert.equal(budget.body.amount, '5000.00');

        const raised = await api(user, 'PATCH', `${ORG_1}/budgets/${budget.body.id}`, { amount: '6000.50', version: budget.body.version });
        assert.equal(raised.status, 200);
        assert.equal(raised.body.amount, '6000.50');

        for (const path of ['budgets', 'expenses', 'categories', 'activity']) {
          assert.equal((await api(user, 'GET', `${ORG_1}/${path}`)).status, 200, path);
        }
      });
    }
  });

  describe('Organization scope (REQ-002)', () => {
    let org1Expense;
    let org1Budget;

    before(async () => {
      org1Expense = await createExpense('alex', ORG_1, { category: 'Scope' });
      org1Budget = (await api('alex', 'POST', `${ORG_1}/budgets`, { month: '2025-01', category: 'Scope', amount: '10' })).body;
    });

    test('a user without membership is denied on every finance route', async () => {
      // jordan belongs to org-2 only.
      const attempts = [
        ['GET', `${ORG_1}/budgets`],
        ['POST', `${ORG_1}/budgets`, { month: THIS_MONTH, category: 'Forged', amount: '1' }],
        ['PATCH', `${ORG_1}/budgets/${org1Budget.id}`, { amount: '2', version: org1Budget.version }],
        ['GET', `${ORG_1}/expenses`],
        ['POST', `${ORG_1}/expenses`, expenseInput()],
        ['PATCH', `${ORG_1}/expenses/${org1Expense.id}`, { amount: '2', version: org1Expense.version }],
        ['POST', `${ORG_1}/expenses/${org1Expense.id}/void`, { version: org1Expense.version }],
        ['GET', `${ORG_1}/categories`],
        ['GET', `${ORG_1}/activity`],
      ];
      for (const [method, path, payload] of attempts) {
        const res = await api('jordan', method, path, payload);
        assert.equal(res.status, 403, `${method} ${path}`);
      }
    });

    test('every finance route requires authentication', async () => {
      assert.equal((await api(null, 'GET', `${ORG_1}/expenses`)).status, 401);
      assert.equal((await api(null, 'POST', `${ORG_1}/expenses`, expenseInput())).status, 401);
    });

    test('a record cannot be reached through another organization the caller belongs to', async () => {
      // alex belongs to org-1 and org-2; the expense and budget belong to org-1.
      const edit = await api('alex', 'PATCH', `${ORG_2}/expenses/${org1Expense.id}`, { amount: '2', version: org1Expense.version });
      assert.equal(edit.status, 404);
      const voided = await api('alex', 'POST', `${ORG_2}/expenses/${org1Expense.id}/void`, { version: org1Expense.version });
      assert.equal(voided.status, 404);
      const budget = await api('alex', 'PATCH', `${ORG_2}/budgets/${org1Budget.id}`, { amount: '2', version: org1Budget.version });
      assert.equal(budget.status, 404);

      const listed = await api('alex', 'GET', `${ORG_2}/expenses?includeVoided=true&limit=200`);
      assert.equal(listed.body.expenses.some(e => e.id === org1Expense.id), false);
    });

    test('third organization records are visible only to its members', async () => {
      const harborExpense = await createExpense('sam', ORG_3, { category: 'Motors', amount: '7777.77' });
      assert.equal(harborExpense.orgId, THIRD_ORG_ID);

      assert.equal((await api('alex', 'GET', `${ORG_3}/expenses`)).status, 403);
      assert.equal((await api('jordan', 'GET', `${ORG_3}/expenses`)).status, 403);

      const samView = await api('sam', 'GET', `${ORG_3}/expenses`);
      assert.deepEqual(samView.body.expenses.map(e => e.id), [harborExpense.id]);
      assert.equal(samView.body.totalAmount, '7777.77');

      const otherOrg = await api('sam', 'GET', `${ORG_1}/expenses?category=Motors`);
      assert.equal(otherOrg.body.total, 0);
    });

    test('inactive membership, archived organization, and unknown organization are denied', async () => {
      await pool.query(`UPDATE memberships SET status = 'inactive' WHERE id = 'mem-sam-harbor'`);
      assert.equal((await api('sam', 'GET', `${ORG_3}/expenses`)).status, 403);
      await pool.query(`UPDATE memberships SET status = 'active' WHERE id = 'mem-sam-harbor'`);

      await pool.query(`UPDATE organizations SET status = 'archived' WHERE id = $1`, [THIRD_ORG_ID]);
      assert.equal((await api('sam', 'GET', `${ORG_3}/expenses`)).status, 403);
      assert.equal((await api('len', 'POST', `${ORG_3}/expenses`, expenseInput())).status, 403);
      await pool.query(`UPDATE organizations SET status = 'active' WHERE id = $1`, [THIRD_ORG_ID]);

      assert.equal((await api('len', 'GET', '/organizations/org-missing/finance/expenses')).status, 403);
    });
  });

  describe('Exact centavo arithmetic (REQ-004)', () => {
    test('totals that break floating point are exact', async () => {
      for (const amount of ['0.10', '0.20', '0.70', '1.10', '2.20']) {
        await createExpense('jordan', ORG_2, { category: 'Exact', amount });
      }
      const res = await api('jordan', 'GET', `${ORG_2}/expenses?category=Exact`);
      assert.equal(res.body.total, 5);
      assert.equal(res.body.totalAmount, '4.30');
      assert.deepEqual(res.body.expenses.map(e => e.amount).sort(), ['0.10', '0.20', '0.70', '1.10', '2.20']);
    });

    test('the largest amounts are stored and summed without loss', async () => {
      await createExpense('jordan', ORG_2, { category: 'Ceiling', amount: '999999999.99' });
      await createExpense('jordan', ORG_2, { category: 'Ceiling', amount: '999999999.99' });
      await createExpense('jordan', ORG_2, { category: 'Ceiling', amount: '0.02' });
      const res = await api('jordan', 'GET', `${ORG_2}/expenses?category=Ceiling`);
      assert.equal(res.body.totalAmount, '2000000000.00');

      const stored = await pool.query(
        `SELECT amount_centavos::text AS centavos FROM expenses WHERE organization_id = 'org-2' AND category = 'Ceiling' ORDER BY amount_centavos`
      );
      assert.deepEqual(stored.rows.map(r => r.centavos), ['2', '99999999999', '99999999999']);
    });

    test('amounts with one decimal or none are normalized to two decimals', async () => {
      assert.equal((await createExpense('jordan', ORG_2, { amount: '12.5' })).amount, '12.50');
      assert.equal((await createExpense('jordan', ORG_2, { amount: '12' })).amount, '12.00');
    });
  });

  describe('Validation without partial writes (REQ-004)', () => {
    const invalidInputs = [
      ['zero amount', { amount: '0' }],
      ['negative amount', { amount: '-5.00' }],
      ['three decimals', { amount: '1.005' }],
      ['thousands separator', { amount: '1,000.00' }],
      ['amount above the ceiling', { amount: '1000000000.00' }],
      ['floating point artifact', { amount: 0.1 + 0.2 }],
      ['future date', { occurredOn: manilaDate(1) }],
      ['impossible date', { occurredOn: '2026-02-30' }],
      ['wrong date format', { occurredOn: '10/03/2026' }],
      ['blank category', { category: '   ' }],
      ['category over 60 characters', { category: 'c'.repeat(61) }],
      ['blank description', { description: '  ' }],
      ['vendor over 120 characters', { vendor: 'v'.repeat(121) }],
    ];

    for (const [label, overrides] of invalidInputs) {
      test(`rejects ${label} and writes nothing`, async () => {
        const expensesBefore = await countRows('expenses');
        const eventsBefore = await countRows('activity_events');

        const res = await api('sam', 'POST', `${ORG_1}/expenses`, expenseInput(overrides));

        assert.equal(res.status, 400, JSON.stringify(res.body));
        assert.equal(await countRows('expenses'), expensesBefore);
        assert.equal(await countRows('activity_events'), eventsBefore);
      });
    }

    test('missing required fields are rejected', async () => {
      const res = await api('sam', 'POST', `${ORG_1}/expenses`, { amount: '5.00' });
      assert.equal(res.status, 400);
    });

    test('an expense dated today in Manila is accepted', async () => {
      const created = await createExpense('sam', ORG_1, { occurredOn: manilaDate(0) });
      assert.equal(created.occurredOn, manilaDate(0));
    });

    test('an invalid edit leaves the stored expense unchanged', async () => {
      const created = await createExpense('sam', ORG_1, { category: 'Edit guard' });
      const res = await api('sam', 'PATCH', `${ORG_1}/expenses/${created.id}`, {
        amount: '250.00',
        occurredOn: manilaDate(5),
        version: created.version,
      });
      assert.equal(res.status, 400);

      const listed = await api('sam', 'GET', `${ORG_1}/expenses?category=Edit%20guard`);
      assert.equal(listed.body.expenses[0].amount, '100.00');
      assert.equal(listed.body.expenses[0].version, created.version);
    });

    test('optional vendor and reference are stored trimmed and can be cleared', async () => {
      const created = await createExpense('sam', ORG_1, { vendor: '  Ace Hardware ', reference: ' OR-1001 ' });
      assert.equal(created.vendor, 'Ace Hardware');
      assert.equal(created.reference, 'OR-1001');

      const cleared = await api('sam', 'PATCH', `${ORG_1}/expenses/${created.id}`, { vendor: null, reference: '', version: created.version });
      assert.equal(cleared.body.vendor, null);
      assert.equal(cleared.body.reference, null);
    });

    test('invalid list filters are rejected', async () => {
      assert.equal((await api('sam', 'GET', `${ORG_1}/expenses?from=2026-13-01`)).status, 400);
      assert.equal((await api('sam', 'GET', `${ORG_1}/budgets?month=2026-10-01`)).status, 400);
    });
  });

  describe('Monthly budgets (REQ-005)', () => {
    test('one budget per organization, month, and case-insensitive category', async () => {
      const first = await api('alex', 'POST', `${ORG_1}/budgets`, { month: '2026-08', category: 'Travel', amount: '1000' });
      assert.equal(first.status, 201);
      assert.equal(first.body.month, '2026-08');

      for (const category of ['Travel', 'travel', '  TRAVEL  ']) {
        const duplicate = await api('sam', 'POST', `${ORG_1}/budgets`, { month: '2026-08', category, amount: '2000' });
        assert.equal(duplicate.status, 409, category);
      }

      const listed = await api('sam', 'GET', `${ORG_1}/budgets?month=2026-08`);
      assert.deepEqual(listed.body.budgets.map(b => [b.category, b.amount]), [['Travel', '1000.00']]);
    });

    test('the same category is allowed in another month and another organization', async () => {
      assert.equal((await api('alex', 'POST', `${ORG_1}/budgets`, { month: '2026-09', category: 'Travel', amount: '1' })).status, 201);
      assert.equal((await api('alex', 'POST', `${ORG_2}/budgets`, { month: '2026-08', category: 'Travel', amount: '1' })).status, 201);
    });

    test('invalid budgets are rejected without a write', async () => {
      const budgetsBefore = await countRows('budgets');
      for (const payload of [
        { month: '2026-13', category: 'Ops', amount: '10' },
        { month: '2026-08', category: '', amount: '10' },
        { month: '2026-08', category: 'Ops', amount: '0' },
        { month: '2026-08', category: 'Ops', amount: '10.001' },
      ]) {
        assert.equal((await api('alex', 'POST', `${ORG_1}/budgets`, payload)).status, 400, JSON.stringify(payload));
      }
      assert.equal(await countRows('budgets'), budgetsBefore);
    });
  });

  describe('Visible change history (REQ-006)', () => {
    test('expense create, edit, and void record actor, time, and allowlisted values for every member', async () => {
      const created = await createExpense('alex', ORG_1, { category: 'History', amount: '40.00', description: 'Private wording A' });
      const edited = await api('sam', 'PATCH', `${ORG_1}/expenses/${created.id}`, {
        amount: '45.50',
        category: 'History revised',
        description: 'Private wording B',
        version: created.version,
      });
      await api('len', 'POST', `${ORG_1}/expenses/${created.id}/void`, { version: edited.body.version });

      // sam did not create the expense and still sees its full history.
      const history = await api('sam', 'GET', `${ORG_1}/activity?entityId=${created.id}`);
      assert.equal(history.status, 200);
      const events = history.body.events.reverse();
      assert.deepEqual(events.map(e => [e.action, e.actorName]), [
        ['create', 'Alex Rivera'],
        ['update', 'Sam Taylor'],
        ['void', 'Len'],
      ]);
      assert.deepEqual(events[0].metadata.after, { amount: '40.00', occurredOn: created.occurredOn, category: 'History' });
      assert.deepEqual(events[1].metadata.before, { amount: '40.00', category: 'History' });
      assert.deepEqual(events[1].metadata.after, { amount: '45.50', category: 'History revised' });
      assert.deepEqual(events[1].metadata.otherChangedFields, ['description']);
      assert.deepEqual(events[2].metadata.before, { amount: '45.50', occurredOn: created.occurredOn, category: 'History revised' });
      for (const event of events) {
        assert.ok(!Number.isNaN(Date.parse(event.createdAt)));
        assert.equal(event.entityType, 'expense');
      }

      // Free-text contents never enter the history.
      assert.equal(JSON.stringify(history.body).includes('Private wording'), false);
    });

    test('budget create and update record before and after amounts', async () => {
      const budget = (await api('alex', 'POST', `${ORG_1}/budgets`, { month: '2026-07', category: 'Audit', amount: '300' })).body;
      await api('sam', 'PATCH', `${ORG_1}/budgets/${budget.id}`, { amount: '350.75', version: budget.version });

      const events = (await api('len', 'GET', `${ORG_1}/activity?entityId=${budget.id}`)).body.events.reverse();
      assert.deepEqual(events.map(e => [e.entityType, e.action, e.actorName]), [
        ['budget', 'create', 'Alex Rivera'],
        ['budget', 'update', 'Sam Taylor'],
      ]);
      assert.deepEqual(events[0].metadata.after, { amount: '300.00', month: '2026-07', category: 'Audit' });
      assert.deepEqual(events[1].metadata.before, { amount: '300.00' });
      assert.deepEqual(events[1].metadata.after, { amount: '350.75' });
    });

    test('a save that changes nothing adds no history and keeps the version', async () => {
      const created = await createExpense('alex', ORG_1, { category: 'No-op' });
      const eventsBefore = await countRows('activity_events');
      const res = await api('alex', 'PATCH', `${ORG_1}/expenses/${created.id}`, { amount: '100.00', version: created.version });
      assert.equal(res.status, 200);
      assert.equal(res.body.version, created.version);
      assert.equal(await countRows('activity_events'), eventsBefore);
    });

    test('finance history is not shown to other organizations', async () => {
      const org2History = await api('jordan', 'GET', `${ORG_2}/activity?limit=200`);
      const org1EventCount = (await pool.query(
        `SELECT COUNT(*)::int AS count FROM activity_events WHERE organization_id = 'org-1' AND entity_type IN ('expense', 'budget')`
      )).rows[0].count;
      assert.ok(org1EventCount > 0);
      assert.equal(org2History.body.events.some(e => e.entityId.startsWith('exp-') && e.metadata?.after?.category === 'History'), false);

      const org2Ids = new Set((await pool.query(
        `SELECT id FROM activity_events WHERE organization_id = 'org-2'`
      )).rows.map(r => r.id));
      assert.ok(org2History.body.events.every(e => org2Ids.has(e.id)));
    });

    test('the register names who recorded and who last changed each expense', async () => {
      const created = await createExpense('alex', ORG_1, { category: 'Attribution' });
      await api('sam', 'PATCH', `${ORG_1}/expenses/${created.id}`, { amount: '101.00', version: created.version });
      const row = (await api('len', 'GET', `${ORG_1}/expenses?category=Attribution`)).body.expenses[0];
      assert.equal(row.createdByName, 'Alex Rivera');
      assert.equal(row.updatedByName, 'Sam Taylor');
      assert.ok(Date.parse(row.updatedAt) >= Date.parse(row.createdAt));
    });
  });

  describe('Voiding instead of deleting (REQ-006)', () => {
    test('a void expense leaves totals and the default register but stays stored', async () => {
      const keep = await createExpense('sam', ORG_1, { category: 'Voiding', amount: '10.00' });
      const drop = await createExpense('sam', ORG_1, { category: 'Voiding', amount: '25.00' });
      await api('sam', 'POST', `${ORG_1}/expenses/${drop.id}/void`, { version: drop.version });

      const active = await api('sam', 'GET', `${ORG_1}/expenses?category=Voiding`);
      assert.deepEqual(active.body.expenses.map(e => e.id), [keep.id]);
      assert.equal(active.body.totalAmount, '10.00');

      const all = await api('sam', 'GET', `${ORG_1}/expenses?category=Voiding&includeVoided=true`);
      assert.equal(all.body.total, 2);
      assert.equal(all.body.totalAmount, '10.00');
      assert.equal(all.body.expenses.find(e => e.id === drop.id).voided, true);

      const stored = await pool.query('SELECT voided_at, voided_by FROM expenses WHERE id = $1', [drop.id]);
      assert.equal(stored.rows.length, 1);
      assert.ok(stored.rows[0].voided_at);
      assert.equal(stored.rows[0].voided_by, 'usr-sam');
    });

    test('a void expense cannot be edited or voided again', async () => {
      const created = await createExpense('sam', ORG_1, { category: 'Void lock' });
      const voided = await api('sam', 'POST', `${ORG_1}/expenses/${created.id}/void`, { version: created.version });

      const edit = await api('sam', 'PATCH', `${ORG_1}/expenses/${created.id}`, { amount: '1.00', version: voided.body.version });
      assert.equal(edit.status, 400);
      const again = await api('sam', 'POST', `${ORG_1}/expenses/${created.id}/void`, { version: voided.body.version });
      assert.equal(again.status, 400);
    });

    test('there is no route that deletes an expense or a budget', async () => {
      const created = await createExpense('sam', ORG_1, { category: 'No delete' });
      assert.equal((await api('len', 'DELETE', `${ORG_1}/expenses/${created.id}`)).status, 404);
      assert.equal((await api('len', 'DELETE', `${ORG_1}/budgets/any`)).status, 404);
      assert.equal((await pool.query('SELECT 1 FROM expenses WHERE id = $1', [created.id])).rows.length, 1);
    });
  });

  describe('Stale edits (REQ-012)', () => {
    test('an expense edit or void with an old version is refused and changes nothing', async () => {
      const created = await createExpense('alex', ORG_1, { category: 'Stale' });
      const first = await api('alex', 'PATCH', `${ORG_1}/expenses/${created.id}`, { amount: '110.00', version: created.version });
      assert.equal(first.status, 200);

      const staleEdit = await api('sam', 'PATCH', `${ORG_1}/expenses/${created.id}`, { amount: '999.00', version: created.version });
      assert.equal(staleEdit.status, 409);
      const staleVoid = await api('sam', 'POST', `${ORG_1}/expenses/${created.id}/void`, { version: created.version });
      assert.equal(staleVoid.status, 409);

      const row = (await api('sam', 'GET', `${ORG_1}/expenses?category=Stale`)).body.expenses[0];
      assert.equal(row.amount, '110.00');
      assert.equal(row.voided, false);
      assert.equal(row.version, first.body.version);
    });

    test('a budget edit with an old version is refused', async () => {
      const budget = (await api('alex', 'POST', `${ORG_1}/budgets`, { month: '2026-06', category: 'Stale', amount: '100' })).body;
      await api('alex', 'PATCH', `${ORG_1}/budgets/${budget.id}`, { amount: '200', version: budget.version });
      const stale = await api('sam', 'PATCH', `${ORG_1}/budgets/${budget.id}`, { amount: '900', version: budget.version });
      assert.equal(stale.status, 409);

      const listed = await api('sam', 'GET', `${ORG_1}/budgets?month=2026-06`);
      assert.equal(listed.body.budgets[0].amount, '200.00');
    });

    test('edits without a version are rejected', async () => {
      const created = await createExpense('alex', ORG_1, { category: 'Versionless' });
      assert.equal((await api('alex', 'PATCH', `${ORG_1}/expenses/${created.id}`, { amount: '5.00' })).status, 400);
      assert.equal((await api('alex', 'POST', `${ORG_1}/expenses/${created.id}/void`, {})).status, 400);
    });

    test('concurrent edits with the same version let exactly one win', async () => {
      const created = await createExpense('alex', ORG_1, { category: 'Race' });
      const results = await Promise.all([
        api('alex', 'PATCH', `${ORG_1}/expenses/${created.id}`, { amount: '201.00', version: created.version }),
        api('sam', 'PATCH', `${ORG_1}/expenses/${created.id}`, { amount: '202.00', version: created.version }),
      ]);
      assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
    });
  });

  describe('Category suggestions and register filters', () => {
    test('categories are suggested once per case-insensitive spelling, per organization', async () => {
      await createExpense('sam', ORG_3, { category: 'Batteries' });
      await createExpense('sam', ORG_3, { category: 'batteries' });
      await api('sam', 'POST', `${ORG_3}/budgets`, { month: '2026-05', category: 'Field Rental', amount: '900' });

      const res = await api('sam', 'GET', `${ORG_3}/categories`);
      assert.deepEqual(res.body.categories.map(c => c.toLowerCase()), ['batteries', 'field rental', 'motors']);
    });

    test('date range and category filters select matching expenses only', async () => {
      await createExpense('sam', ORG_3, { category: 'Range', amount: '1.00', occurredOn: '2026-03-31' });
      await createExpense('sam', ORG_3, { category: 'Range', amount: '2.00', occurredOn: '2026-04-01' });
      await createExpense('sam', ORG_3, { category: 'Range', amount: '4.00', occurredOn: '2026-04-30' });
      await createExpense('sam', ORG_3, { category: 'Range', amount: '8.00', occurredOn: '2026-05-01' });

      const april = await api('sam', 'GET', `${ORG_3}/expenses?category=range&from=2026-04-01&to=2026-04-30`);
      assert.equal(april.body.total, 2);
      assert.equal(april.body.totalAmount, '6.00');
      assert.deepEqual(april.body.expenses.map(e => e.occurredOn), ['2026-04-30', '2026-04-01']);
    });

    test('pagination returns the requested page while the total covers every match', async () => {
      const page = await api('sam', 'GET', `${ORG_3}/expenses?category=Range&limit=3&page=2`);
      assert.equal(page.body.total, 4);
      assert.equal(page.body.expenses.length, 1);
      assert.equal(page.body.totalAmount, '15.00');
    });
  });
});
