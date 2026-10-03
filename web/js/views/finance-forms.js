/**
 * Finance dialogs: record or edit an expense, set or change a budget, and view change history.
 * Requirements: FEAT-006/REQ-004 through REQ-006, REQ-012; PROD-005/UI-REQ-010, UI-REQ-011
 */

import { escapeHtml, formatPhp, formatManilaTime } from '../format.js';
import { openModal } from '../modal.js';

const AMOUNT_PATTERN = /^\d{1,9}(\.\d{1,2})?$/;
const AMOUNT_HELP = 'PHP, digits only, up to two decimals. Example: 1250.50';

/** Shows problems in the dialog's error summary and moves focus there so they are announced. */
function showErrors(modal, messages) {
  const summary = modal.element.querySelector('[data-error-summary]');
  summary.innerHTML = `
    <div class="form-error-summary-title">Please review:</div>
    <ul>${messages.map(message => `<li>${escapeHtml(message)}</li>`).join('')}</ul>
  `;
  summary.style.display = 'block';
  summary.focus();
}

function errorSummaryHtml() {
  return '<div data-error-summary class="form-error-summary" style="display:none;" tabindex="-1" role="alert"></div>';
}

function categoryDatalist(id, categories) {
  return `<datalist id="${id}">${categories.map(c => `<option value="${escapeHtml(c)}"></option>`).join('')}</datalist>`;
}

function isValidAmount(text) {
  return AMOUNT_PATTERN.test(text) && Number(text.replace('.', '')) > 0;
}

/** Runs a save and keeps the dialog open with the member's input when it fails. */
async function submitWith(modal, submitButton, save) {
  submitButton.disabled = true;
  try {
    await save();
    modal.close();
  } catch (error) {
    showErrors(modal, [error.message]);
    return error;
  } finally {
    submitButton.disabled = false;
  }
  return null;
}

/**
 * Opens the expense dialog. With `expense` it edits that record, otherwise it records a new one.
 * After a stale-edit conflict the member's input stays in the form and the latest version is loaded,
 * so saving again applies their edit on top of the other member's change.
 */
export function openExpenseForm({ api, categories, today, expense = null, onSaved }) {
  const isEdit = expense !== null;
  let version = expense?.version;

  const modal = openModal({
    id: 'expense-form-modal',
    title: isEdit ? 'Edit expense' : 'Record expense',
    bodyHtml: `
      <form id="expense-form" novalidate>
        ${errorSummaryHtml()}
        <div class="finance-form-grid">
          <div class="form-group">
            <label for="expense-date" class="form-label">Date *</label>
            <input type="date" id="expense-date" class="form-input" required max="${today}" value="${escapeHtml(expense?.occurredOn ?? today)}" data-autofocus />
            <span class="form-help-text">Actual spending only. Future dates are not accepted.</span>
          </div>
          <div class="form-group">
            <label for="expense-amount" class="form-label">Amount (PHP) *</label>
            <input type="text" id="expense-amount" class="form-input" inputmode="decimal" required maxlength="12" autocomplete="off" value="${escapeHtml(expense?.amount ?? '')}" aria-describedby="expense-amount-help" />
            <span class="form-help-text" id="expense-amount-help">${AMOUNT_HELP}</span>
          </div>
        </div>
        <div class="form-group">
          <label for="expense-category" class="form-label">Category *</label>
          <input type="text" id="expense-category" class="form-input" required maxlength="60" list="expense-category-options" autocomplete="off" value="${escapeHtml(expense?.category ?? '')}" />
          ${categoryDatalist('expense-category-options', categories)}
          <span class="form-help-text">1 to 60 characters. Existing categories are suggested as you type.</span>
        </div>
        <div class="form-group">
          <label for="expense-description" class="form-label">Description *</label>
          <textarea id="expense-description" class="form-textarea" required maxlength="500" rows="2">${escapeHtml(expense?.description ?? '')}</textarea>
        </div>
        <div class="finance-form-grid">
          <div class="form-group">
            <label for="expense-vendor" class="form-label">Vendor (optional)</label>
            <input type="text" id="expense-vendor" class="form-input" maxlength="120" value="${escapeHtml(expense?.vendor ?? '')}" />
          </div>
          <div class="form-group">
            <label for="expense-reference" class="form-label">Reference (optional)</label>
            <input type="text" id="expense-reference" class="form-input" maxlength="120" value="${escapeHtml(expense?.reference ?? '')}" />
          </div>
        </div>
      </form>
    `,
    footerHtml: `
      <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
      <button type="submit" class="btn btn-primary" form="expense-form" id="btn-save-expense">${isEdit ? 'Save changes' : 'Record expense'}</button>
    `,
  });

  const field = name => modal.element.querySelector(`#expense-${name}`);

  function readForm() {
    return {
      occurredOn: field('date').value,
      amount: field('amount').value.trim(),
      category: field('category').value.trim(),
      description: field('description').value.trim(),
      vendor: field('vendor').value.trim() || null,
      reference: field('reference').value.trim() || null,
    };
  }

  function clientErrors(input) {
    const errors = [];
    if (!input.occurredOn) errors.push('Enter the date of the expense.');
    else if (input.occurredOn > today) errors.push('The date cannot be in the future.');
    if (!isValidAmount(input.amount)) errors.push(`Enter a positive amount. ${AMOUNT_HELP}`);
    if (!input.category) errors.push('Enter a category.');
    if (!input.description) errors.push('Enter a description.');
    return errors;
  }

  modal.element.querySelector('#expense-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = readForm();
    const errors = clientErrors(input);
    if (errors.length > 0) {
      showErrors(modal, errors);
      return;
    }

    const failure = await submitWith(modal, modal.element.querySelector('#btn-save-expense'), async () => {
      const saved = isEdit ? await api.updateExpense(expense.id, { ...input, version }) : await api.createExpense(input);
      onSaved(saved);
    });

    if (failure?.isConflict && isEdit) {
      try {
        const latest = await api.getExpense(expense.id);
        version = latest.version;
        showErrors(modal, [
          failure.message,
          `Latest saved values: ${latest.occurredOn}, ${formatPhp(latest.amount)}, ${latest.category}, changed by ${latest.updatedByName}.`,
          latest.voided ? 'The expense has since been voided and can no longer be edited.' : 'Your edits are still in the form. Save again to apply them over the latest version.',
        ]);
      } catch (reloadError) {
        showErrors(modal, [failure.message, reloadError.message]);
      }
    }
  });
}

/**
 * Opens the budget dialog. A new budget needs month, category (optionally prefilled), and amount;
 * an existing budget keeps its month and category and changes only the amount.
 */
export function openBudgetForm({ api, categories, month, budget = null, category = '', onSaved }) {
  const isEdit = budget !== null;

  const modal = openModal({
    id: 'budget-form-modal',
    title: isEdit ? 'Change budget' : 'Set budget',
    bodyHtml: `
      <form id="budget-form" novalidate>
        ${errorSummaryHtml()}
        <div class="finance-form-grid">
          <div class="form-group">
            <label for="budget-month" class="form-label">Month *</label>
            <input type="month" id="budget-month" class="form-input" required value="${escapeHtml(budget?.month ?? month)}" ${isEdit ? 'disabled' : ''} />
          </div>
          <div class="form-group">
            <label for="budget-category" class="form-label">Category *</label>
            <input type="text" id="budget-category" class="form-input" required maxlength="60" list="budget-category-options" autocomplete="off" value="${escapeHtml(budget?.category ?? category)}" ${isEdit ? 'disabled' : 'data-autofocus'} />
            ${categoryDatalist('budget-category-options', categories)}
          </div>
        </div>
        <div class="form-group">
          <label for="budget-amount" class="form-label">Budget amount (PHP) *</label>
          <input type="text" id="budget-amount" class="form-input" inputmode="decimal" required maxlength="12" autocomplete="off" value="${escapeHtml(budget?.amount ?? '')}" aria-describedby="budget-amount-help" ${isEdit ? 'data-autofocus' : ''} />
          <span class="form-help-text" id="budget-amount-help">${AMOUNT_HELP}</span>
        </div>
        <p class="form-help-text">One budget per month and category. Every change is recorded in the change history.</p>
      </form>
    `,
    footerHtml: `
      <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
      <button type="submit" class="btn btn-primary" form="budget-form" id="btn-save-budget">${isEdit ? 'Save budget' : 'Set budget'}</button>
    `,
  });

  modal.element.querySelector('#budget-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = {
      month: modal.element.querySelector('#budget-month').value,
      category: modal.element.querySelector('#budget-category').value.trim(),
      amount: modal.element.querySelector('#budget-amount').value.trim(),
    };

    const errors = [];
    if (!/^\d{4}-\d{2}$/.test(input.month)) errors.push('Choose the budget month.');
    if (!input.category) errors.push('Enter a category.');
    if (!isValidAmount(input.amount)) errors.push(`Enter a positive amount. ${AMOUNT_HELP}`);
    if (errors.length > 0) {
      showErrors(modal, errors);
      return;
    }

    await submitWith(modal, modal.element.querySelector('#btn-save-budget'), async () => {
      const saved = isEdit
        ? await api.updateBudget(budget.id, { amount: input.amount, version: budget.version })
        : await api.createBudget(input);
      onSaved(saved);
    });
  });
}

const ACTION_LABELS = { create: 'Recorded', update: 'Changed', void: 'Voided', import: 'Imported' };
const ENTITY_LABELS = { expense: 'expense', budget: 'budget', import_batch: 'spreadsheet' };
const VALUE_LABELS = { amount: 'Amount', occurredOn: 'Date', category: 'Category', month: 'Month' };

function valueText(key, value) {
  return key === 'amount' ? formatPhp(value) : String(value);
}

/** One history entry as plain text, for example "Amount: PHP 40.00 → PHP 45.50". */
export function describeChange(event) {
  const { before = {}, after = {}, otherChangedFields = [] } = event.metadata || {};
  const parts = [];

  if (event.action === 'import') {
    const { filename, importedCount, skippedDuplicateCount, totalAmount } = event.metadata;
    parts.push(`${importedCount} expenses from ${filename}, total ${formatPhp(totalAmount)}`);
    if (skippedDuplicateCount > 0) parts.push(`${skippedDuplicateCount} possible duplicates skipped`);
    return parts.join('; ');
  }

  for (const key of Object.keys(VALUE_LABELS)) {
    const hasBefore = before[key] !== undefined;
    const hasAfter = after[key] !== undefined;
    if (hasBefore && hasAfter) parts.push(`${VALUE_LABELS[key]}: ${valueText(key, before[key])} → ${valueText(key, after[key])}`);
    else if (hasAfter) parts.push(`${VALUE_LABELS[key]}: ${valueText(key, after[key])}`);
    else if (hasBefore) parts.push(`${VALUE_LABELS[key]} was ${valueText(key, before[key])}`);
  }
  if (otherChangedFields.length > 0) parts.push(`Also changed: ${otherChangedFields.join(', ')}`);
  return parts.join('; ');
}

export function historyTableHtml(events, label) {
  if (events.length === 0) {
    return '<p class="form-help-text">No changes have been recorded yet.</p>';
  }
  return `
    <div class="table-responsive">
      <table class="data-table" aria-label="${escapeHtml(label)}">
        <thead>
          <tr><th scope="col">When (Manila)</th><th scope="col">Member</th><th scope="col">Action</th><th scope="col">Financial values</th></tr>
        </thead>
        <tbody>
          ${events.map(event => `
            <tr>
              <td>${escapeHtml(formatManilaTime(event.createdAt))}</td>
              <td>${escapeHtml(event.actorName)}</td>
              <td>${escapeHtml(`${ACTION_LABELS[event.action] ?? event.action} ${ENTITY_LABELS[event.entityType] ?? event.entityType}`)}</td>
              <td>${escapeHtml(describeChange(event))}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/** Shows every recorded change for one expense or budget. */
export async function openHistory({ api, entityId, title }) {
  const modal = openModal({
    id: 'finance-history-modal',
    title: escapeHtml(title),
    wide: true,
    bodyHtml: '<div data-history aria-live="polite"><p class="form-help-text">Loading change history…</p></div>',
    footerHtml: '<button type="button" class="btn btn-secondary" data-modal-close data-autofocus>Close</button>',
  });

  const target = modal.element.querySelector('[data-history]');
  try {
    const { events } = await api.listActivity({ entityId, limit: 100 });
    target.innerHTML = historyTableHtml(events, title);
  } catch (error) {
    target.innerHTML = `<div class="alert-banner alert-danger" role="alert"><span>${escapeHtml(error.message)}</span></div>`;
  }
}
