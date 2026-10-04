/**
 * Finance persistence adapter.
 * Every function takes `db` (a pool or a transaction client) and an organization ID,
 * so no query can run without an organization scope.
 */

import { generateRandomToken } from '../auth/crypto.js';

const FINANCE_ENTITY_TYPES = ['budget', 'expense', 'import_batch'];

const BUDGET_COLUMNS = `
  b.id,
  b.organization_id AS "orgId",
  TO_CHAR(b.month, 'YYYY-MM') AS month,
  b.category,
  b.amount_centavos AS "amountCentavos",
  b.currency,
  b.version,
  b.created_at AS "createdAt",
  b.updated_at AS "updatedAt",
  uu.display_name AS "updatedByName"`;

const EXPENSE_COLUMNS = `
  e.id,
  e.organization_id AS "orgId",
  TO_CHAR(e.occurred_on, 'YYYY-MM-DD') AS "occurredOn",
  e.amount_centavos AS "amountCentavos",
  e.currency,
  e.category,
  e.description,
  e.vendor,
  e.reference,
  e.source,
  e.import_batch_id AS "importBatchId",
  e.source_row AS "sourceRow",
  e.version,
  e.voided_at AS "voidedAt",
  e.created_at AS "createdAt",
  e.updated_at AS "updatedAt",
  cu.display_name AS "createdByName",
  uu.display_name AS "updatedByName"`;

const EXPENSE_JOINS = `
  FROM expenses e
  JOIN users cu ON e.created_by = cu.id
  JOIN users uu ON e.updated_by = uu.id`;

export async function findActiveOrganization(db, orgId) {
  const res = await db.query(`SELECT id, name FROM organizations WHERE id = $1 AND status = 'active'`, [orgId]);
  return res.rows[0] ?? null;
}

/**
 * Locks one row for the rest of the transaction.
 * The lock is taken on the table alone: a locking read that also joins on a column the
 * concurrent writer changes (updated_by) can lose the row when it is rechecked after the wait.
 */
async function lockRow(db, table, orgId, id) {
  await db.query(`SELECT 1 FROM ${table} WHERE id = $1 AND organization_id = $2 FOR UPDATE`, [id, orgId]);
}

// --- Budgets ---

export async function listBudgets(db, orgId, month) {
  const params = [orgId];
  let monthClause = '';
  if (month) {
    params.push(`${month}-01`);
    monthClause = 'AND b.month = $2::date';
  }
  const res = await db.query(
    `SELECT ${BUDGET_COLUMNS}
     FROM budgets b
     JOIN users uu ON b.updated_by = uu.id
     WHERE b.organization_id = $1 ${monthClause}
     ORDER BY b.month DESC, LOWER(b.category) ASC`,
    params
  );
  return res.rows;
}

export async function findBudget(db, orgId, budgetId, { forUpdate = false } = {}) {
  if (forUpdate) await lockRow(db, 'budgets', orgId, budgetId);
  const res = await db.query(
    `SELECT ${BUDGET_COLUMNS}
     FROM budgets b
     JOIN users uu ON b.updated_by = uu.id
     WHERE b.id = $1 AND b.organization_id = $2`,
    [budgetId, orgId]
  );
  return res.rows[0] ?? null;
}

/** Inserts a budget and returns its ID, or null when the month and category already have one. */
export async function insertBudget(db, orgId, { month, category, amountCentavos }, actorId) {
  const res = await db.query(
    `INSERT INTO budgets (id, organization_id, month, category, amount_centavos, created_by, updated_by)
     VALUES ($1, $2, $3::date, $4, $5, $6, $6)
     ON CONFLICT (organization_id, month, LOWER(category)) DO NOTHING
     RETURNING id`,
    ['bud-' + generateRandomToken(12), orgId, `${month}-01`, category, amountCentavos, actorId]
  );
  return res.rows[0]?.id ?? null;
}

export async function updateBudgetAmount(db, orgId, budgetId, amountCentavos, actorId) {
  await db.query(
    `UPDATE budgets
     SET amount_centavos = $3, updated_by = $4, updated_at = NOW(), version = version + 1
     WHERE id = $1 AND organization_id = $2`,
    [budgetId, orgId, amountCentavos, actorId]
  );
}

// --- Expenses ---

/**
 * Builds the WHERE clause shared by the expense register, its totals, and analytics,
 * so every total reconciles to the same rows the register lists.
 */
function expenseFilter(orgId, { from, to, category, includeVoided = false } = {}) {
  const conditions = ['e.organization_id = $1'];
  const params = [orgId];

  if (!includeVoided) conditions.push('e.voided_at IS NULL');
  if (from) {
    params.push(from);
    conditions.push(`e.occurred_on >= $${params.length}::date`);
  }
  if (to) {
    params.push(to);
    conditions.push(`e.occurred_on <= $${params.length}::date`);
  }
  if (category) {
    params.push(category);
    conditions.push(`LOWER(e.category) = LOWER($${params.length})`);
  }

  return { where: conditions.join(' AND '), params };
}

export async function listExpenses(db, orgId, filters, { limit, offset }) {
  const { where, params } = expenseFilter(orgId, filters);
  const res = await db.query(
    `SELECT ${EXPENSE_COLUMNS} ${EXPENSE_JOINS}
     WHERE ${where}
     ORDER BY e.occurred_on DESC, e.created_at DESC, e.id ASC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  return res.rows;
}

/** At most the requested number of matching expenses, oldest first, for a bounded export. */
export async function listExpensesForExport(db, orgId, filters, limit) {
  const { where, params } = expenseFilter(orgId, filters);
  const res = await db.query(
    `SELECT ${EXPENSE_COLUMNS} ${EXPENSE_JOINS}
     WHERE ${where}
     ORDER BY e.occurred_on ASC, e.created_at ASC, e.id ASC
     LIMIT $${params.length + 1}`,
    [...params, limit]
  );
  return res.rows;
}

/** Count and exact centavo sum of matching expenses per category, one label per case-insensitive spelling. */
export async function totalsByCategory(db, orgId, filters) {
  const { where, params } = expenseFilter(orgId, filters);
  const res = await db.query(
    `SELECT MIN(e.category) AS label, COUNT(*)::int AS count, SUM(e.amount_centavos)::text AS "totalCentavos"
     FROM expenses e
     WHERE ${where}
     GROUP BY LOWER(e.category)
     ORDER BY LOWER(MIN(e.category)) ASC`,
    params
  );
  return res.rows;
}

/** Count and exact centavo sum of matching expenses per calendar month (YYYY-MM). */
export async function totalsByMonth(db, orgId, filters) {
  const { where, params } = expenseFilter(orgId, filters);
  const res = await db.query(
    `SELECT TO_CHAR(e.occurred_on, 'YYYY-MM') AS label, COUNT(*)::int AS count, SUM(e.amount_centavos)::text AS "totalCentavos"
     FROM expenses e
     WHERE ${where}
     GROUP BY TO_CHAR(e.occurred_on, 'YYYY-MM')
     ORDER BY label ASC`,
    params
  );
  return res.rows;
}

/** Row count and exact centavo sum of non-void expenses matching the filters. */
export async function summarizeExpenses(db, orgId, filters) {
  const { where, params } = expenseFilter(orgId, filters);
  const res = await db.query(
    `SELECT COUNT(*)::int AS count,
            COALESCE(SUM(e.amount_centavos) FILTER (WHERE e.voided_at IS NULL), 0)::text AS "totalCentavos"
     FROM expenses e
     WHERE ${where}`,
    params
  );
  return res.rows[0];
}

export async function findExpense(db, orgId, expenseId, { forUpdate = false } = {}) {
  if (forUpdate) await lockRow(db, 'expenses', orgId, expenseId);
  const res = await db.query(
    `SELECT ${EXPENSE_COLUMNS} ${EXPENSE_JOINS}
     WHERE e.id = $1 AND e.organization_id = $2`,
    [expenseId, orgId]
  );
  return res.rows[0] ?? null;
}

export async function insertExpense(db, orgId, expense, actorId, provenance = {}) {
  const id = 'exp-' + generateRandomToken(12);
  await db.query(
    `INSERT INTO expenses
       (id, organization_id, occurred_on, amount_centavos, category, description, vendor, reference,
        source, import_batch_id, source_row, created_by, updated_by)
     VALUES ($1, $2, $3::date, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)`,
    [
      id,
      orgId,
      expense.occurredOn,
      expense.amountCentavos,
      expense.category,
      expense.description,
      expense.vendor,
      expense.reference,
      provenance.importBatchId ? 'import' : 'manual',
      provenance.importBatchId ?? null,
      provenance.sourceRow ?? null,
      actorId,
    ]
  );
  return id;
}

export async function updateExpense(db, orgId, expenseId, expense, actorId) {
  await db.query(
    `UPDATE expenses
     SET occurred_on = $3::date, amount_centavos = $4, category = $5, description = $6,
         vendor = $7, reference = $8, updated_by = $9, updated_at = NOW(), version = version + 1
     WHERE id = $1 AND organization_id = $2`,
    [
      expenseId,
      orgId,
      expense.occurredOn,
      expense.amountCentavos,
      expense.category,
      expense.description,
      expense.vendor,
      expense.reference,
      actorId,
    ]
  );
}

export async function markExpenseVoid(db, orgId, expenseId, actorId) {
  await db.query(
    `UPDATE expenses
     SET voided_at = NOW(), voided_by = $3, updated_by = $3, updated_at = NOW(), version = version + 1
     WHERE id = $1 AND organization_id = $2`,
    [expenseId, orgId, actorId]
  );
}

// --- Imports ---

/** Serializes imports per organization so duplicate detection and the commit see the same rows. */
export async function lockImports(db, orgId) {
  await db.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`finance-import:${orgId}`]);
}

/** Non-void expenses on the given dates: the only rows an import row can duplicate. */
export async function listExpensesOnDates(db, orgId, dates) {
  const res = await db.query(
    `SELECT id,
            TO_CHAR(occurred_on, 'YYYY-MM-DD') AS "occurredOn",
            amount_centavos AS "amountCentavos",
            category,
            reference
     FROM expenses
     WHERE organization_id = $1 AND voided_at IS NULL AND occurred_on = ANY($2::date[])`,
    [orgId, dates]
  );
  return res.rows;
}

export async function insertImportBatch(db, orgId, actorId, batch) {
  const id = 'imp-' + generateRandomToken(12);
  await db.query(
    `INSERT INTO import_batches
       (id, organization_id, actor_id, source_filename, content_digest, row_count, imported_count, skipped_duplicate_count)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, orgId, actorId, batch.filename, batch.contentDigest, batch.rowCount, batch.importedCount, batch.skippedDuplicateCount]
  );
  return id;
}

/** Distinct categories already used by the organization, one spelling per case-insensitive match. */
export async function listCategories(db, orgId) {
  const res = await db.query(
    `SELECT MIN(category) AS category
     FROM (
       SELECT category FROM budgets WHERE organization_id = $1
       UNION ALL
       SELECT category FROM expenses WHERE organization_id = $1 AND voided_at IS NULL
     ) used
     GROUP BY LOWER(category)
     ORDER BY LOWER(MIN(category)) ASC`,
    [orgId]
  );
  return res.rows.map(row => row.category);
}

// --- Change history ---

export async function insertActivity(db, orgId, actorId, { entityType, entityId, action, metadata }) {
  await db.query(
    `INSERT INTO activity_events (id, organization_id, actor_id, entity_type, entity_id, action, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    ['act-' + generateRandomToken(12), orgId, actorId, entityType, entityId, action, JSON.stringify(metadata)]
  );
}

export async function listActivity(db, orgId, { entityId, limit, offset }) {
  const params = [orgId, FINANCE_ENTITY_TYPES];
  let entityClause = '';
  if (entityId) {
    params.push(entityId);
    entityClause = `AND ae.entity_id = $${params.length}`;
  }
  const res = await db.query(
    `SELECT ae.id,
            ae.entity_type AS "entityType",
            ae.entity_id AS "entityId",
            ae.action,
            ae.metadata,
            ae.created_at AS "createdAt",
            u.display_name AS "actorName"
     FROM activity_events ae
     JOIN users u ON ae.actor_id = u.id
     WHERE ae.organization_id = $1 AND ae.entity_type = ANY($2) ${entityClause}
     ORDER BY ae.created_at DESC, ae.id ASC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  return res.rows;
}
