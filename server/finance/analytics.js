/**
 * Budget and spending report use case (FEAT-006/REQ-009, REQ-010).
 * Every figure is computed here once, in exact centavos, from the same expense filter the
 * register uses. Clients display these values and never recalculate money.
 */

import { getPool } from '../../db/client.js';
import { CURRENCY, formatAmount } from './money.js';
import { isCalendarMonth, manilaToday } from './validation.js';
import { httpError, requireFinanceAccess } from './service.js';
import * as repository from './repository.js';

const DEFAULT_TREND_MONTHS = 6;
const MAX_TREND_MONTHS = 24;

/** Number of calendar days in a YYYY-MM month, leap years included. */
export function daysInMonth(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}

/** The `count` consecutive YYYY-MM months that end with `month`, oldest first. */
export function monthsEndingAt(month, count) {
  const [year, monthNumber] = month.split('-').map(Number);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, monthNumber - 1 - (count - 1 - index), 1));
    return date.toISOString().slice(0, 7);
  });
}

/**
 * Month-end run-rate estimate in centavos: month-to-date actual times days in the month,
 * divided by elapsed days including today, rounded half up with integer arithmetic.
 */
export function runRateEstimate(monthToDateCentavos, elapsedDays, totalDays) {
  const numerator = 2n * BigInt(monthToDateCentavos) * BigInt(totalDays) + BigInt(elapsedDays);
  return numerator / (2n * BigInt(elapsedDays));
}

function comparisonStatus(budgetCentavos, actualCentavos) {
  if (budgetCentavos === null) return 'unbudgeted';
  if (actualCentavos > budgetCentavos) return 'over';
  return actualCentavos === budgetCentavos ? 'at' : 'under';
}

/** One line per category that has a budget, spending, or both, matched case-insensitively. */
function categoryComparison(budgets, spending) {
  const lines = new Map();
  for (const budget of budgets) {
    lines.set(budget.category.toLowerCase(), {
      category: budget.category,
      budgetId: budget.id,
      budgetVersion: budget.version,
      budgetCentavos: BigInt(budget.amountCentavos),
      actualCentavos: 0n,
      expenseCount: 0,
    });
  }
  for (const spent of spending) {
    const key = spent.label.toLowerCase();
    const line = lines.get(key) ?? { category: spent.label, budgetId: null, budgetVersion: null, budgetCentavos: null, actualCentavos: 0n, expenseCount: 0 };
    line.actualCentavos = BigInt(spent.totalCentavos);
    line.expenseCount = spent.count;
    lines.set(key, line);
  }
  return [...lines.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, line]) => line);
}

function toCategoryLine(line) {
  const hasBudget = line.budgetCentavos !== null;
  return {
    category: line.category,
    budgetId: line.budgetId,
    budgetVersion: line.budgetVersion,
    budget: hasBudget ? formatAmount(line.budgetCentavos) : null,
    actual: formatAmount(line.actualCentavos),
    remaining: hasBudget ? formatAmount(line.budgetCentavos - line.actualCentavos) : null,
    expenseCount: line.expenseCount,
    status: comparisonStatus(line.budgetCentavos, line.actualCentavos),
  };
}

/** The estimate applies only to the current Manila month and only once something was spent. */
function forecastFor(month, today, actualCentavos) {
  if (month !== today.slice(0, 7) || actualCentavos === 0n) return null;
  const elapsedDays = Number(today.slice(8, 10));
  const totalDays = daysInMonth(month);
  return {
    estimate: formatAmount(runRateEstimate(actualCentavos, elapsedDays, totalDays)),
    monthToDate: formatAmount(actualCentavos),
    elapsedDays,
    daysInMonth: totalDays,
    basis: 'Month-to-date actual spending × days in the month ÷ elapsed days including today, rounded to the nearest centavo.',
  };
}

export async function budgetReport(orgId, query, caller, customPool = null, today = manilaToday()) {
  const db = customPool ?? getPool();
  await requireFinanceAccess(db, caller, orgId, customPool);

  const month = query.month ?? today.slice(0, 7);
  if (!isCalendarMonth(month)) throw httpError(400, 'Month must be in YYYY-MM format.');
  const trendLength = Math.min(MAX_TREND_MONTHS, Math.max(1, parseInt(query.trendMonths ?? DEFAULT_TREND_MONTHS, 10) || DEFAULT_TREND_MONTHS));

  const monthRange = { from: `${month}-01`, to: `${month}-${String(daysInMonth(month)).padStart(2, '0')}` };
  const trendMonths = monthsEndingAt(month, trendLength);

  const [budgets, spending, monthlyTotals] = await Promise.all([
    repository.listBudgets(db, orgId, month),
    repository.totalsByCategory(db, orgId, monthRange),
    repository.totalsByMonth(db, orgId, { from: `${trendMonths[0]}-01`, to: monthRange.to }),
  ]);

  const lines = categoryComparison(budgets, spending);
  const budgetCentavos = lines.reduce((total, line) => total + (line.budgetCentavos ?? 0n), 0n);
  const actualCentavos = lines.reduce((total, line) => total + line.actualCentavos, 0n);
  const unbudgetedCentavos = lines.reduce((total, line) => total + (line.budgetCentavos === null ? line.actualCentavos : 0n), 0n);
  const monthlyByLabel = new Map(monthlyTotals.map(total => [total.label, total]));

  return {
    currency: CURRENCY,
    month,
    asOf: today,
    totals: {
      budget: formatAmount(budgetCentavos),
      actual: formatAmount(actualCentavos),
      remaining: formatAmount(budgetCentavos - actualCentavos),
      unbudgetedActual: formatAmount(unbudgetedCentavos),
      status: comparisonStatus(budgets.length > 0 ? budgetCentavos : null, actualCentavos),
    },
    categories: lines.map(toCategoryLine),
    trend: trendMonths.map(label => ({
      month: label,
      actual: formatAmount(monthlyByLabel.get(label)?.totalCentavos ?? 0),
      expenseCount: monthlyByLabel.get(label)?.count ?? 0,
    })),
    forecast: forecastFor(month, today, actualCentavos),
  };
}
