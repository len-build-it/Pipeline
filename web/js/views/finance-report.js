/**
 * Budget report section: totals, budget-versus-actual chart and table, and the monthly trend.
 * Every amount shown comes from the server report; the only arithmetic here is the
 * proportion used to draw a bar or a point, which never produces a displayed amount.
 * Requirements: FEAT-006/REQ-009, REQ-010; PROD-005/UI-REQ-010
 */

import { escapeHtml, formatPhp, formatManilaTime } from '../format.js';

const STATUS_LABELS = {
  under: 'Within budget',
  at: 'Budget fully used',
  over: 'Over budget',
  unbudgeted: 'No budget set',
};

/** Share of `part` in `whole` as a percentage for drawing only, clamped to 0 through 100. */
function drawingPercent(part, whole) {
  const wholeNumber = Number(whole);
  if (!(wholeNumber > 0)) return 0;
  return Math.max(0, Math.min(100, (Number(part) / wholeNumber) * 100));
}

function withoutSign(amount) {
  return String(amount).replace(/^-/, '');
}

/** "Remaining PHP 380.00" or "Over budget by PHP 20.30", so the sign is never the only cue. */
function remainingText(remaining) {
  if (remaining === null) return 'No budget set';
  return remaining.startsWith('-')
    ? `Over budget by ${formatPhp(withoutSign(remaining))}`
    : `Remaining ${formatPhp(remaining)}`;
}

function statCard(id, title, value, note) {
  return `
    <article class="stat-card" data-finance-stat="${id}">
      <div class="stat-card-title">${escapeHtml(title)}</div>
      <div class="stat-card-value finance-stat-value">${escapeHtml(value)}</div>
      <div class="stat-card-sub">${escapeHtml(note)}</div>
    </article>
  `;
}

function totalsHtml(report) {
  const { totals, forecast } = report;
  const isOver = totals.remaining.startsWith('-');
  return `
    <div class="grid-cards" aria-label="Budget totals for ${escapeHtml(report.month)}">
      ${statCard('budget', 'Budget', formatPhp(totals.budget), `All categories, ${report.month}`)}
      ${statCard('actual', 'Actual spending', formatPhp(totals.actual), `Includes ${formatPhp(totals.unbudgetedActual)} without a budget`)}
      ${statCard('remaining', isOver ? 'Over budget by' : 'Remaining', formatPhp(withoutSign(totals.remaining)), 'Budget minus actual spending')}
      ${forecast
        ? statCard('forecast', 'Month-end estimate', formatPhp(forecast.estimate), `Estimate, not actual: ${forecast.elapsedDays} of ${forecast.daysInMonth} days elapsed`)
        : statCard('forecast', 'Month-end estimate', 'Not available', 'Shown for the current month once spending is recorded')}
    </div>
    ${forecast ? `<p class="form-help-text" id="finance-forecast-basis">How the estimate is calculated: ${escapeHtml(forecast.basis)}</p>` : ''}
  `;
}

/** One bar per category: filled to actual spending, with a marker at the budget. */
function comparisonChartHtml(categories) {
  const rows = categories.map(line => {
    const scale = line.budget !== null && Number(line.budget) > Number(line.actual) ? line.budget : line.actual;
    const figures = line.budget === null
      ? `${formatPhp(line.actual)} spent, no budget set`
      : `${formatPhp(line.actual)} of ${formatPhp(line.budget)} · ${remainingText(line.remaining)}`;
    return `
      <li class="finance-bar-row" data-status="${line.status}">
        <div class="finance-bar-label"><strong>${escapeHtml(line.category)}</strong><span>${escapeHtml(figures)}</span></div>
        <div class="finance-bar-track" aria-hidden="true">
          <div class="finance-bar-fill" style="width:${drawingPercent(line.actual, scale).toFixed(2)}%"></div>
          ${line.budget === null ? '' : `<div class="finance-bar-marker" style="left:${drawingPercent(line.budget, scale).toFixed(2)}%"></div>`}
        </div>
      </li>
    `;
  }).join('');
  return `<ul class="finance-bars" aria-label="Budget compared with actual spending by category">${rows}</ul>`;
}

function comparisonTableHtml(report, budgetsById) {
  const rows = report.categories.map(line => {
    const budget = budgetsById.get(line.budgetId);
    const actions = budget ? `
      <button class="btn btn-secondary btn-sm" data-edit-budget="${escapeHtml(budget.id)}" aria-label="Change budget for ${escapeHtml(line.category)}">Change</button>
      <button class="btn btn-secondary btn-sm" data-history="${escapeHtml(budget.id)}" data-history-title="Budget history: ${escapeHtml(line.category)} ${escapeHtml(report.month)}" aria-label="History of budget for ${escapeHtml(line.category)}">History</button>
    ` : `<button class="btn btn-secondary btn-sm" data-new-budget="${escapeHtml(line.category)}" aria-label="Set budget for ${escapeHtml(line.category)}">Set budget</button>`;
    return `
      <tr data-status="${line.status}">
        <th scope="row">${escapeHtml(line.category)}</th>
        <td class="finance-amount">${line.budget === null ? 'None' : escapeHtml(formatPhp(line.budget))}</td>
        <td class="finance-amount">${escapeHtml(formatPhp(line.actual))}</td>
        <td class="finance-amount">${line.remaining === null ? 'Not applicable' : escapeHtml(formatPhp(line.remaining))}</td>
        <td>${STATUS_LABELS[line.status]}</td>
        <td>${budget ? `${escapeHtml(budget.updatedByName)}, ${escapeHtml(formatManilaTime(budget.updatedAt))}` : ''}</td>
        <td>${actions}</td>
      </tr>
    `;
  }).join('');

  return `
    <div class="table-responsive" tabindex="0" role="region" aria-label="Budget table, scrollable">
      <table class="data-table" aria-label="Budgets for ${escapeHtml(report.month)} compared with actual spending">
        <thead>
          <tr>
            <th scope="col">Category</th><th scope="col" class="finance-amount">Budget</th><th scope="col" class="finance-amount">Actual</th>
            <th scope="col" class="finance-amount">Remaining</th><th scope="col">Status</th><th scope="col">Budget last changed</th><th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <th scope="row">All categories</th>
            <td class="finance-amount">${escapeHtml(formatPhp(report.totals.budget))}</td>
            <td class="finance-amount">${escapeHtml(formatPhp(report.totals.actual))}</td>
            <td class="finance-amount">${escapeHtml(formatPhp(report.totals.remaining))}</td>
            <td>${STATUS_LABELS[report.totals.status]}</td><td></td><td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;
}

/** A line through the monthly totals, with each value printed beside its point. */
function trendChartHtml(trend) {
  const width = 640;
  const height = 220;
  const left = 50;
  const right = 50;
  const top = 34;
  const bottom = 36;
  const peak = trend.reduce((max, point) => (Number(point.actual) > Number(max) ? point.actual : max), '0');
  const step = trend.length > 1 ? (width - left - right) / (trend.length - 1) : 0;

  const points = trend.map((point, index) => ({
    ...point,
    x: left + step * index,
    y: height - bottom - (drawingPercent(point.actual, peak) / 100) * (height - top - bottom),
  }));
  const path = points.map(point => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');

  return `
    <svg class="finance-trend" viewBox="0 0 ${width} ${height}" role="img" aria-label="Monthly actual spending trend; the same values are in the table below">
      <line x1="${left}" y1="${height - bottom}" x2="${width - right}" y2="${height - bottom}" class="finance-trend-axis" />
      <polyline points="${path}" class="finance-trend-line" />
      ${points.map(point => `
        <circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="4" class="finance-trend-point" />
        <text x="${point.x.toFixed(1)}" y="${(point.y - 10).toFixed(1)}" text-anchor="middle" class="finance-trend-value">${escapeHtml(formatPhp(point.actual).replace('PHP ', ''))}</text>
        <text x="${point.x.toFixed(1)}" y="${height - 12}" text-anchor="middle" class="finance-trend-month">${escapeHtml(point.month)}</text>
      `).join('')}
    </svg>
  `;
}

function trendTableHtml(trend) {
  return `
    <div class="table-responsive" tabindex="0" role="region" aria-label="Monthly spending table, scrollable">
      <table class="data-table" aria-label="Monthly actual spending">
        <thead><tr><th scope="col">Month</th><th scope="col" class="finance-amount">Expenses</th><th scope="col" class="finance-amount">Actual spending</th></tr></thead>
        <tbody>
          ${trend.map(point => `
            <tr>
              <th scope="row">${escapeHtml(point.month)}</th>
              <td class="finance-amount">${point.expenseCount}</td>
              <td class="finance-amount">${escapeHtml(formatPhp(point.actual))}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

export function reportSectionHtml(report, budgets) {
  const budgetsById = new Map(budgets.map(budget => [budget.id, budget]));
  const hasLines = report.categories.length > 0;

  return `
    <section class="section-panel" aria-labelledby="finance-report-title">
      <div class="section-panel-header">
        <h2 class="section-panel-title" id="finance-report-title">Budget report</h2>
        <div class="form-group" style="margin:0;">
          <label for="finance-month" class="form-label">Report month</label>
          <input type="month" id="finance-month" class="filter-input" value="${escapeHtml(report.month)}" />
        </div>
      </div>
      <p class="form-help-text">Actual spending counts non-void expenses dated in ${escapeHtml(report.month)}, in PHP, as of ${escapeHtml(report.asOf)} (Asia/Manila).</p>
      ${totalsHtml(report)}
      <h3 class="finance-subtitle">Budget compared with actual by category</h3>
      ${hasLines
        ? comparisonChartHtml(report.categories) + comparisonTableHtml(report, budgetsById)
        : `<div class="state-box">
            <p class="state-box-title">No budgets for ${escapeHtml(report.month)}</p>
            <p class="state-box-desc">Set a budget per category to compare it with actual spending. Spending without a budget is listed here too.</p>
          </div>`}
      <h3 class="finance-subtitle">Monthly actual spending</h3>
      ${trendChartHtml(report.trend)}
      ${trendTableHtml(report.trend)}
    </section>
  `;
}
