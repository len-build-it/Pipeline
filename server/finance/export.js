/**
 * Accountant workbook export use case (FEAT-006/REQ-008).
 * Detail rows and every summary figure come from one query, so the sheets always reconcile.
 */

import { getPool } from '../../db/client.js';
import { manilaToday } from './validation.js';
import { buildExportWorkbook, buildImportTemplate } from './spreadsheet.js';
import { expenseFilters, httpError, requireFinanceAccess } from './service.js';
import * as repository from './repository.js';

export const MAX_EXPORT_EXPENSES = 5000;

/** Groups expenses by a label and sums exact centavos per group, sorted by label. */
function totalsBy(expenses, labelOf) {
  const groups = new Map();
  for (const expense of expenses) {
    const label = labelOf(expense);
    const key = label.toLowerCase();
    const group = groups.get(key) ?? { label, count: 0, totalCentavos: 0n };
    group.count += 1;
    group.totalCentavos += BigInt(expense.amountCentavos);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()));
}

function fileSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'organization';
}

export async function exportExpenses(orgId, query, caller, customPool = null) {
  const db = customPool ?? getPool();
  const organization = await requireFinanceAccess(db, caller, orgId, customPool);

  const filters = { ...expenseFilters(query), includeVoided: false };
  const expenses = await repository.listExpensesForExport(db, orgId, filters, MAX_EXPORT_EXPENSES + 1);
  if (expenses.length > MAX_EXPORT_EXPENSES) {
    throw httpError(400, `This export matches more than ${MAX_EXPORT_EXPENSES} expenses. Narrow the date range or category filter and try again.`);
  }
  const generatedAt = new Date();

  const buffer = await buildExportWorkbook({
    organizationName: organization.name,
    filters,
    generatedAt,
    expenses,
    categoryTotals: totalsBy(expenses, expense => expense.category),
    monthTotals: totalsBy(expenses, expense => expense.occurredOn.slice(0, 7)),
    totalCentavos: expenses.reduce((total, expense) => total + BigInt(expense.amountCentavos), 0n),
  });

  return { filename: `expenses-${fileSlug(organization.name)}-${manilaToday(generatedAt)}.xlsx`, buffer };
}

export async function importTemplate(orgId, caller, customPool = null) {
  const db = customPool ?? getPool();
  await requireFinanceAccess(db, caller, orgId, customPool);
  return { filename: 'expense-import-template.xlsx', buffer: await buildImportTemplate() };
}
