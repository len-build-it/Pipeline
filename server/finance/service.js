/**
 * Finance use cases (FEAT-006).
 * Owns organization scope, equal member access, validation, optimistic concurrency,
 * and the visible change history. SQL lives in repository.js and HTTP in routes/finance.js.
 */

import { getPool, withTransaction } from '../../db/client.js';
import { getCallerOrgPermission } from '../members/service.js';
import { CURRENCY, formatAmount } from './money.js';
import { isCalendarDate, isCalendarMonth, normalizeBudget, normalizeExpense } from './validation.js';
import * as repository from './repository.js';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

export function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function rejectInvalid(errors) {
  if (errors.length > 0) {
    throw httpError(400, errors.map(e => e.message).join(' '));
  }
}

/**
 * Every active member of an active organization has the same finance access;
 * the role is deliberately not consulted (FEAT-006/REQ-002, REQ-003).
 */
export async function requireFinanceAccess(db, caller, orgId, customPool) {
  const permission = await getCallerOrgPermission(caller, orgId, customPool);
  const organization = permission.hasAccess ? await repository.findActiveOrganization(db, orgId) : null;
  if (!organization) {
    throw httpError(403, 'Inaccessible organization.');
  }
  return organization;
}

function requireVersion(version) {
  if (!Number.isInteger(version)) {
    throw httpError(400, 'The current record version is required to save changes.');
  }
}

function rejectStale(current, version, label) {
  if (current.version !== version) {
    throw httpError(409, `This ${label} was changed by another member. Refresh and review before saving.`);
  }
}

function pagination(query) {
  const page = Math.max(1, parseInt(query.page || '1', 10) || 1);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(query.limit || String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE));
  return { page, limit, offset: (page - 1) * limit };
}

function toBudget(row) {
  const { amountCentavos, ...rest } = row;
  return { ...rest, amount: formatAmount(amountCentavos) };
}

function toExpense(row) {
  const { amountCentavos, ...rest } = row;
  return { ...rest, amount: formatAmount(amountCentavos), voided: row.voidedAt !== null };
}

/** The financial values that may appear in the change history. */
function auditedExpenseValues(expense) {
  return {
    amount: formatAmount(expense.amountCentavos),
    occurredOn: expense.occurredOn,
    category: expense.category,
  };
}

function auditedBudgetValues(budget) {
  return {
    amount: formatAmount(budget.amountCentavos),
    month: budget.month,
    category: budget.category,
  };
}

/** Keeps only the audited values that differ, as matching before and after objects. */
function changedValues(before, after) {
  const changed = { before: {}, after: {} };
  for (const key of Object.keys(after)) {
    if (before[key] !== after[key]) {
      changed.before[key] = before[key];
      changed.after[key] = after[key];
    }
  }
  return changed;
}

// --- Budgets ---

export async function listBudgets(orgId, query, caller, customPool = null) {
  const db = customPool ?? getPool();
  await requireFinanceAccess(db, caller, orgId, customPool);

  if (query.month !== undefined && !isCalendarMonth(query.month)) {
    throw httpError(400, 'Month must be in YYYY-MM format.');
  }

  const rows = await repository.listBudgets(db, orgId, query.month);
  return { currency: CURRENCY, budgets: rows.map(toBudget) };
}

export async function createBudget(orgId, input, caller, customPool = null) {
  const db = customPool ?? getPool();
  await requireFinanceAccess(db, caller, orgId, customPool);

  const { value: budget, errors } = normalizeBudget(input);
  rejectInvalid(errors);

  return withTransaction(async (tx) => {
    const budgetId = await repository.insertBudget(tx, orgId, budget, caller.id);
    if (budgetId === null) {
      throw httpError(409, 'A budget already exists for this month and category.');
    }
    await repository.insertActivity(tx, orgId, caller.id, {
      entityType: 'budget',
      entityId: budgetId,
      action: 'create',
      metadata: { after: auditedBudgetValues(budget) },
    });
    return toBudget(await repository.findBudget(tx, orgId, budgetId));
  }, customPool);
}

/** Changes the amount of an existing budget; month and category identify it and do not change. */
export async function updateBudget(orgId, budgetId, input, caller, customPool = null) {
  const db = customPool ?? getPool();
  await requireFinanceAccess(db, caller, orgId, customPool);
  requireVersion(input.version);

  return withTransaction(async (tx) => {
    const current = await repository.findBudget(tx, orgId, budgetId, { forUpdate: true });
    if (!current) throw httpError(404, 'Budget not found.');
    rejectStale(current, input.version, 'budget');

    const { value: budget, errors } = normalizeBudget({ ...current, amount: input.amount });
    rejectInvalid(errors);

    const changes = changedValues(auditedBudgetValues(current), auditedBudgetValues(budget));
    if (Object.keys(changes.after).length === 0) return toBudget(current);

    await repository.updateBudgetAmount(tx, orgId, budgetId, budget.amountCentavos, caller.id);
    await repository.insertActivity(tx, orgId, caller.id, {
      entityType: 'budget',
      entityId: budgetId,
      action: 'update',
      metadata: { month: current.month, category: current.category, ...changes },
    });
    return toBudget(await repository.findBudget(tx, orgId, budgetId));
  }, customPool);
}

// --- Expenses ---

export function expenseFilters(query) {
  for (const field of ['from', 'to']) {
    if (query[field] !== undefined && !isCalendarDate(query[field])) {
      throw httpError(400, `Filter "${field}" must be a date in YYYY-MM-DD format.`);
    }
  }
  return {
    from: query.from,
    to: query.to,
    category: query.category?.trim() || undefined,
    includeVoided: query.includeVoided === 'true',
  };
}

export async function listExpenses(orgId, query, caller, customPool = null) {
  const db = customPool ?? getPool();
  await requireFinanceAccess(db, caller, orgId, customPool);

  const filters = expenseFilters(query);
  const { page, limit, offset } = pagination(query);
  const [rows, summary] = await Promise.all([
    repository.listExpenses(db, orgId, filters, { limit, offset }),
    repository.summarizeExpenses(db, orgId, filters),
  ]);

  return {
    currency: CURRENCY,
    expenses: rows.map(toExpense),
    total: summary.count,
    totalAmount: formatAmount(summary.totalCentavos),
    page,
    limit,
  };
}

export async function getExpense(orgId, expenseId, caller, customPool = null) {
  const db = customPool ?? getPool();
  await requireFinanceAccess(db, caller, orgId, customPool);

  const expense = await repository.findExpense(db, orgId, expenseId);
  if (!expense) throw httpError(404, 'Expense not found.');
  return toExpense(expense);
}

export async function createExpense(orgId, input, caller, customPool = null) {
  const db = customPool ?? getPool();
  await requireFinanceAccess(db, caller, orgId, customPool);

  const { value: expense, errors } = normalizeExpense(input);
  rejectInvalid(errors);

  return withTransaction(async (tx) => {
    const expenseId = await repository.insertExpense(tx, orgId, expense, caller.id);
    await repository.insertActivity(tx, orgId, caller.id, {
      entityType: 'expense',
      entityId: expenseId,
      action: 'create',
      metadata: { after: auditedExpenseValues(expense) },
    });
    return toExpense(await repository.findExpense(tx, orgId, expenseId));
  }, customPool);
}

/** Overlays the supplied fields on the stored expense so partial edits validate as a whole record. */
function mergedExpenseInput(current, input) {
  const pick = (field, fallback) => (input[field] !== undefined ? input[field] : fallback);
  return {
    occurredOn: pick('occurredOn', current.occurredOn),
    amount: pick('amount', formatAmount(current.amountCentavos)),
    category: pick('category', current.category),
    description: pick('description', current.description),
    vendor: pick('vendor', current.vendor),
    reference: pick('reference', current.reference),
  };
}

const UNAUDITED_EXPENSE_FIELDS = ['description', 'vendor', 'reference'];

export async function updateExpense(orgId, expenseId, input, caller, customPool = null) {
  const db = customPool ?? getPool();
  await requireFinanceAccess(db, caller, orgId, customPool);
  requireVersion(input.version);

  return withTransaction(async (tx) => {
    const current = await repository.findExpense(tx, orgId, expenseId, { forUpdate: true });
    if (!current) throw httpError(404, 'Expense not found.');
    if (current.voidedAt !== null) throw httpError(400, 'Voided expenses are read-only.');
    rejectStale(current, input.version, 'expense');

    const { value: expense, errors } = normalizeExpense(mergedExpenseInput(current, input));
    rejectInvalid(errors);

    const changes = changedValues(auditedExpenseValues(current), auditedExpenseValues(expense));
    // Free-text fields are named but their contents stay out of the history.
    const otherChangedFields = UNAUDITED_EXPENSE_FIELDS.filter(field => current[field] !== expense[field]);
    if (Object.keys(changes.after).length === 0 && otherChangedFields.length === 0) {
      return toExpense(current);
    }

    await repository.updateExpense(tx, orgId, expenseId, expense, caller.id);
    await repository.insertActivity(tx, orgId, caller.id, {
      entityType: 'expense',
      entityId: expenseId,
      action: 'update',
      metadata: { ...changes, otherChangedFields },
    });
    return toExpense(await repository.findExpense(tx, orgId, expenseId));
  }, customPool);
}

/** Voids an expense: it stays in the register as a struck record and leaves every total. */
export async function voidExpense(orgId, expenseId, input, caller, customPool = null) {
  const db = customPool ?? getPool();
  await requireFinanceAccess(db, caller, orgId, customPool);
  requireVersion(input.version);

  return withTransaction(async (tx) => {
    const current = await repository.findExpense(tx, orgId, expenseId, { forUpdate: true });
    if (!current) throw httpError(404, 'Expense not found.');
    if (current.voidedAt !== null) throw httpError(400, 'This expense is already void.');
    rejectStale(current, input.version, 'expense');

    await repository.markExpenseVoid(tx, orgId, expenseId, caller.id);
    await repository.insertActivity(tx, orgId, caller.id, {
      entityType: 'expense',
      entityId: expenseId,
      action: 'void',
      metadata: { before: auditedExpenseValues(current) },
    });
    return toExpense(await repository.findExpense(tx, orgId, expenseId));
  }, customPool);
}

// --- Categories and change history ---

export async function listCategories(orgId, caller, customPool = null) {
  const db = customPool ?? getPool();
  await requireFinanceAccess(db, caller, orgId, customPool);
  return { categories: await repository.listCategories(db, orgId) };
}

export async function listActivity(orgId, query, caller, customPool = null) {
  const db = customPool ?? getPool();
  await requireFinanceAccess(db, caller, orgId, customPool);

  const { page, limit, offset } = pagination(query);
  const events = await repository.listActivity(db, orgId, { entityId: query.entityId, limit, offset });
  return { events, page, limit };
}
