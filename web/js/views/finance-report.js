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

function statCard(id, title, value, note, tint) {
  return `
    <article class="stat-card stat-card-support ${tint}" data-finance-stat="${id}">
      <div class="stat-card-title">${escapeHtml(title)}</div>
      <div class="stat-card-value finance-stat-value">${escapeHtml(value)}</div>
      <div class="stat-card-sub">${escapeHtml(note)}</div>
    </article>
  `;
}

function totalsHtml(report) {
  const { totals, forecast } = report;
  const hasBudget = totals.status !== 'unbudgeted';
  const isOver = totals.status === 'over';
  const spentPercent = hasBudget ? Math.round((Number(totals.actual) / Number(totals.budget)) * 100) : 0;
  const remainingValue = hasBudget ? formatPhp(withoutSign(totals.remaining)) : 'No budget set';
  const progressText = hasBudget
    ? `${formatPhp(totals.actual)} spent of ${formatPhp(totals.budget)} budget, ${spentPercent}% used${isOver ? ', over budget' : ''}.`
    : `No budget is set. ${formatPhp(totals.actual)} spent this month.`;
  const progressWidth = hasBudget ? drawingPercent(totals.actual, totals.budget) : 0;
  const title = isOver ? 'Over budget by' : 'Remaining';
  const note = hasBudget ? 'Available after this month’s spending' : 'Record a budget to track remaining funds';

  return `
    <div class="grid-cards finance-summary-grid" aria-label="Budget totals for ${escapeHtml(report.month)}">
      <article class="stat-card stat-card-hero finance-remaining-hero" data-status="${escapeHtml(totals.status)}" data-finance-stat="remaining">
        <div class="stat-card-title">${escapeHtml(title)}</div>
        <div class="stat-card-value finance-stat-value">${escapeHtml(remainingValue)}</div>
        <div class="stat-card-sub">${escapeHtml(note)}</div>
        <div class="finance-remaining-budget" data-finance-stat="budget">
          <span>Budget</span><strong>${escapeHtml(formatPhp(totals.budget))}</strong>
        </div>
        ${hasBudget
          ? `<div class="finance-remaining-track" role="progressbar" aria-label="Spending against budget" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100, Math.max(0, spentPercent))}" aria-valuetext="${escapeHtml(progressText)}">
              <div class="finance-remaining-fill" style="width:${progressWidth.toFixed(2)}%"></div>
            </div>`
          : '<div class="finance-remaining-track is-unbudgeted" aria-hidden="true"><div class="finance-remaining-fill"></div></div>'}
        <div class="finance-remaining-detail">${escapeHtml(progressText)}</div>
        ${isOver ? '<span class="badge badge-blocked finance-over-budget-chip">Over budget</span>' : ''}
      </article>
      ${statCard('actual', 'Actual spending', formatPhp(totals.actual), `Includes ${formatPhp(totals.unbudgetedActual)} without a budget`, 'stat-card-support-aqua')}
      ${forecast
        ? statCard('forecast', 'Month-end estimate', formatPhp(forecast.estimate), `Estimate, not actual: ${forecast.elapsedDays} of ${forecast.daysInMonth} days elapsed`, 'stat-card-support-lime')
        : statCard('forecast', 'Month-end estimate', 'Not available', 'Shown for the current month once spending is recorded', 'stat-card-support-lime')}
    </div>
    ${forecast ? `<p class="form-help-text" id="finance-forecast-basis">How the estimate is calculated: ${escapeHtml(forecast.basis)}</p>` : ''}
  `;
}

/** One bar per category: filled to actual spending, with a marker at the budget. */
function comparisonChartHtml(categories) {
  const rows = categories.map(line => {
    const scale = line.budget !== null && Number(line.budget) > Number(line.actual) ? line.budget : line.actual;
    const percentage = line.budget === null ? '' : ` · ${Math.round((Number(line.actual) / Number(line.budget)) * 100)}% of budget`;
    const figures = line.budget === null
      ? `${formatPhp(line.actual)} spent, no budget set`
      : `${formatPhp(line.actual)} of ${formatPhp(line.budget)} · ${remainingText(line.remaining)}${percentage}`;
    return `
      <li class="finance-bar-row" data-status="${line.status}">
        <div class="finance-bar-label">
          <strong class="finance-bar-category">${escapeHtml(line.category)}${line.status === 'over' ? ' <span class="badge badge-blocked finance-bar-status">Over budget</span>' : ''}</strong>
          <span class="finance-bar-figures">${escapeHtml(figures)}</span>
        </div>
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
    <div class="table-responsive finance-report-table" tabindex="0" role="region" aria-label="Budget table, scrollable">
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

function linePath(points) {
  if (points.length === 0) return '';
  const start = points[0];
  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index];
    const middle = (previous.x + point.x) / 2;
    return `${path} C ${middle.toFixed(1)} ${previous.y.toFixed(1)}, ${middle.toFixed(1)} ${point.y.toFixed(1)}, ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
  }, `M ${start.x.toFixed(1)} ${start.y.toFixed(1)}`);
}

function areaPath(points, baseline) {
  if (points.length === 0) return '';
  const first = points[0];
  const last = points[points.length - 1];
  return `${linePath(points)} L ${last.x.toFixed(1)} ${baseline} L ${first.x.toFixed(1)} ${baseline} Z`;
}

/** A smooth line through monthly totals, with a dotted current month and a table equivalent. */
function trendChartHtml(report) {
  const trend = report.trend;
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
  const currentMonth = report.asOf.slice(0, 7);
  const currentIndex = points.findIndex(point => point.month === currentMonth);
  const completedPoints = currentIndex < 0 ? points : points.slice(0, currentIndex);
  const currentSegment = currentIndex > 0 ? points.slice(currentIndex - 1, currentIndex + 1) : [];
  const caption = currentIndex >= 0
    ? `Monthly actual spending in PHP. ${currentMonth} is in progress through ${report.asOf}; its total may increase.`
    : `Monthly actual spending in PHP through ${trend[trend.length - 1]?.month ?? report.month}.`;

  return `
    <div class="finance-trend-chart">
      <svg class="finance-trend" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="finance-trend-title" aria-describedby="finance-trend-caption">
      <title id="finance-trend-title">Monthly actual spending trend</title>
      <path d="${areaPath(points, height - bottom)}" class="finance-trend-area" aria-hidden="true" />
      <line x1="${left}" y1="${height - bottom}" x2="${width - right}" y2="${height - bottom}" class="finance-trend-axis" />
      ${completedPoints.length > 1 ? `<path d="${linePath(completedPoints)}" class="finance-trend-line" aria-hidden="true" />` : ''}
      ${currentSegment.length > 1 ? `<path d="${linePath(currentSegment)}" class="finance-trend-line finance-trend-line-current" data-current-month="${escapeHtml(currentMonth)}" aria-hidden="true" />` : ''}
      ${points.map(point => `
        <circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="4" data-month="${escapeHtml(point.month)}" class="finance-trend-point${point.month === currentMonth ? ' finance-trend-point-current' : ''}" />
        <text x="${point.x.toFixed(1)}" y="${(point.y - 10).toFixed(1)}" text-anchor="middle" class="finance-trend-value">${escapeHtml(formatPhp(point.actual).replace('PHP ', ''))}</text>
        <text x="${point.x.toFixed(1)}" y="${height - 12}" text-anchor="middle" class="finance-trend-month">${escapeHtml(point.month)}</text>
      `).join('')}
      </svg>
      <p class="form-help-text finance-trend-caption" id="finance-trend-caption">${escapeHtml(caption)} The table below gives each month’s exact total and expense count.</p>
    </div>
  `;
}

function trendTableHtml(trend) {
  return `
    <div class="table-responsive finance-trend-table" tabindex="0" role="region" aria-label="Monthly spending table, scrollable">
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
    <section class="section-panel finance-report-panel" aria-labelledby="finance-report-title">
      <div class="section-panel-header finance-report-header">
        <h2 class="section-panel-title" id="finance-report-title">Budget report</h2>
        <div class="form-group" style="margin:0;">
          <label for="finance-month" class="form-label">Report month</label>
          <input type="month" id="finance-month" class="filter-input" value="${escapeHtml(report.month)}" aria-describedby="finance-report-period" />
        </div>
      </div>
      <p class="form-help-text finance-report-period" id="finance-report-period">Actual spending counts non-void expenses dated in ${escapeHtml(report.month)}, in PHP, as of ${escapeHtml(report.asOf)} (Asia/Manila).</p>
      ${totalsHtml(report)}
      <h3 class="finance-subtitle">Budget compared with actual by category</h3>
      ${hasLines
        ? comparisonChartHtml(report.categories) + comparisonTableHtml(report, budgetsById)
        : `<div class="state-box">
            <p class="state-box-title">No budgets for ${escapeHtml(report.month)}</p>
            <p class="state-box-desc">Set a budget per category to compare it with actual spending. Spending without a budget is listed here too.</p>
          </div>`}
      <h3 class="finance-subtitle">Monthly actual spending</h3>
      ${trendChartHtml(report)}
      ${trendTableHtml(report.trend)}
    </section>
  `;
}
