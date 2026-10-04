/**
 * Finance workspace: the budget report, the expense register, spreadsheet transfer, and change history.
 * Requirements: FEAT-006/REQ-002 through REQ-010, REQ-012; PROD-005/UI-REQ-010 through UI-REQ-012
 */

import { escapeHtml, orgLabel, formatPhp, formatManilaTime, manilaToday } from '../format.js';
import { createFinanceApi, saveDownload } from '../finance-api.js';
import { openExpenseForm, openBudgetForm, openHistory, historyTableHtml } from './finance-forms.js';
import { openImport } from './finance-import.js';
import { reportSectionHtml } from './finance-report.js';

const PAGE_SIZE = 50;
const RECENT_HISTORY_SIZE = 20;

function lastDayOfMonth(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  const day = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return `${month}-${String(day).padStart(2, '0')}`;
}

function stateBox(title, description, actionHtml = '') {
  return `
    <div class="state-box">
      <p class="state-box-title">${escapeHtml(title)}</p>
      <p class="state-box-desc">${escapeHtml(description)}</p>
      ${actionHtml}
    </div>
  `;
}

function pageHeader(subtitleHtml, actionsHtml = '') {
  return `
    <header class="page-header">
      <div class="page-title-group">
        <h1>Finance</h1>
        <p>${subtitleHtml}</p>
      </div>
      <div class="page-actions">${actionsHtml}</div>
    </header>
  `;
}

export function renderFinance(container, state, actions) {
  if (!state.isRealAuth) {
    container.innerHTML = `
      ${pageHeader('Budgets, expenses, and spending records for your team.')}
      <div class="content-area">
        ${stateBox(
          'Sign in to use Finance',
          'Finance always shows live team records and is not part of the demo data. Sign in with your account to view budgets and expenses.',
          '<button class="btn btn-primary btn-sm" id="btn-finance-sign-in">Go to sign in</button>'
        )}
      </div>
    `;
    container.querySelector('#btn-finance-sign-in').addEventListener('click', () => actions.renderSignInView());
    return;
  }

  const orgId = state.currentScope;
  if (!state.organizations.some(o => o.id === orgId)) {
    container.innerHTML = `
      ${pageHeader('Budgets and expenses belong to one organization at a time.')}
      <div class="content-area">
        <div class="state-box">
          <p class="state-box-title">Choose an organization</p>
          <div class="form-group" style="max-width:320px; margin:0 auto; text-align:left;">
            <label for="finance-org-select" class="form-label">Organization</label>
            <select id="finance-org-select" class="form-select">
              <option value="">Select an organization…</option>
              ${state.organizations.map(o => `<option value="${escapeHtml(o.id)}">${escapeHtml(o.name)}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
    `;
    container.querySelector('#finance-org-select').addEventListener('change', (event) => {
      if (event.target.value) actions.setScope(event.target.value);
    });
    return;
  }

  createFinancePage(container, state, orgId).load();
}

function createFinancePage(container, state, orgId) {
  const api = createFinanceApi(state, orgId);
  const today = manilaToday();
  const organizationName = orgLabel(state, orgId);

  let month = today.slice(0, 7);
  let filters = { from: `${month}-01`, to: lastDayOfMonth(month), category: '', includeVoided: false };
  let page = 1;
  let data = null;
  let loadSequence = 0;

  container.innerHTML = `
    ${pageHeader(
      `Organization: <strong>${escapeHtml(organizationName)}</strong> · Currency: PHP · All members can view and change these records.`,
      `
        <button class="btn btn-secondary btn-sm" id="btn-import-expenses">Import spreadsheet</button>
        <button class="btn btn-secondary btn-sm" id="btn-export-expenses">Export XLSX</button>
        <button class="btn btn-secondary btn-sm" id="btn-set-budget">Set budget</button>
        <button class="btn btn-primary btn-sm" id="btn-record-expense">Record expense</button>
      `
    )}
    <div class="content-area">
      <div id="finance-status" aria-live="polite"></div>
      <div id="finance-body" aria-busy="true"></div>
    </div>
  `;

  const status = container.querySelector('#finance-status');
  const body = container.querySelector('#finance-body');
  const headerButtons = [...container.querySelectorAll('.page-actions button')];

  function showStatus(kind, message, retry = false) {
    status.innerHTML = message ? `
      <div class="alert-banner alert-${kind}" role="${kind === 'danger' ? 'alert' : 'status'}">
        <span>${escapeHtml(message)}</span>
        ${retry ? '<button class="btn btn-secondary btn-sm" id="btn-finance-retry">Try again</button>' : ''}
      </div>
    ` : '';
    status.querySelector('#btn-finance-retry')?.addEventListener('click', load);
  }

  /** Reports a failed action; a denied organization replaces the whole workspace. */
  function reportFailure(error) {
    if (error.isSessionExpired) {
      showStatus('danger', 'Your session has expired. Sign in again to continue.');
    } else if (error.isDenied) {
      data = null;
      headerButtons.forEach(button => { button.disabled = true; });
      body.innerHTML = stateBox('No access to this organization', 'Finance records are visible only to active members of the organization.');
      showStatus('', '');
    } else {
      showStatus('danger', error.message, true);
    }
  }

  async function load() {
    if (!container.isConnected) return false;
    const requestSequence = ++loadSequence;
    const requestedMonth = month;
    const requestedFilters = { ...filters };
    const requestedPage = page;
    body.setAttribute('aria-busy', 'true');
    if (data === null) body.innerHTML = '<p class="form-help-text" aria-busy="true">Loading finance records…</p>';

    try {
      const [report, budgets, expenses, categories, activity] = await Promise.all([
        api.getReport(requestedMonth),
        api.listBudgets(requestedMonth),
        api.listExpenses({ ...requestedFilters, page: requestedPage, limit: PAGE_SIZE }),
        api.listCategories(),
        api.listActivity({ limit: RECENT_HISTORY_SIZE }),
      ]);
      if (!container.isConnected || requestSequence !== loadSequence) return false;
      data = { report, budgets: budgets.budgets, expenses, categories: categories.categories, events: activity.events };
      headerButtons.forEach(button => { button.disabled = false; });
      showStatus('', '');
      renderBody();
      body.setAttribute('aria-busy', 'false');
      return true;
    } catch (error) {
      if (container.isConnected && requestSequence === loadSequence) {
        body.setAttribute('aria-busy', 'false');
        reportFailure(error);
      }
      return false;
    }
  }

  function announce(message) {
    showStatus('success', message);
  }

  // --- Sections ---

  function expenseRowHtml(expense) {
    const label = `${expense.description}, ${formatPhp(expense.amount)}`;
    const actionsHtml = expense.voided ? '' : `
      <button class="btn btn-secondary btn-sm" data-edit-expense="${escapeHtml(expense.id)}" aria-label="Edit ${escapeHtml(label)}">Edit</button>
      <button class="btn btn-danger btn-sm" data-void-expense="${escapeHtml(expense.id)}" aria-label="Void ${escapeHtml(label)}">Void</button>
    `;
    return `
      <tr class="${expense.voided ? 'finance-void-row' : ''}">
        <td>${escapeHtml(expense.occurredOn)}</td>
        <td>${escapeHtml(expense.category)}</td>
        <td>
          ${escapeHtml(expense.description)}
          ${expense.voided ? '<span class="badge badge-archived">Void</span>' : ''}
          ${expense.source === 'import' ? '<span class="badge badge-draft">Imported</span>' : ''}
        </td>
        <td>${escapeHtml(expense.vendor)}</td>
        <td>${escapeHtml(expense.reference)}</td>
        <td class="finance-amount">${escapeHtml(formatPhp(expense.amount))}</td>
        <td>${escapeHtml(expense.updatedByName)}, ${escapeHtml(formatManilaTime(expense.updatedAt))}</td>
        <td>
          ${actionsHtml}
          <button class="btn btn-secondary btn-sm" data-history="${escapeHtml(expense.id)}" data-history-title="Expense history: ${escapeHtml(expense.description)}" aria-label="History of ${escapeHtml(label)}">History</button>
        </td>
      </tr>
    `;
  }

  function expensesHtml() {
    const { expenses, total, totalAmount } = data.expenses;
    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return `
      <section class="section-panel" aria-labelledby="finance-expenses-title">
        <div class="section-panel-header">
          <h2 class="section-panel-title" id="finance-expenses-title">Expenses</h2>
        </div>
        <form class="filter-bar" id="finance-filter-form" aria-label="Expense filters">
          <div class="form-group">
            <label for="finance-from" class="form-label">From</label>
            <input type="date" id="finance-from" class="filter-input" value="${escapeHtml(filters.from)}" />
          </div>
          <div class="form-group">
            <label for="finance-to" class="form-label">To</label>
            <input type="date" id="finance-to" class="filter-input" value="${escapeHtml(filters.to)}" />
          </div>
          <div class="form-group">
            <label for="finance-category" class="form-label">Category</label>
            <select id="finance-category" class="filter-select">
              <option value="">All categories</option>
              ${data.categories.map(c => `<option value="${escapeHtml(c)}" ${c.toLowerCase() === filters.category.toLowerCase() ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
            </select>
          </div>
          <label class="finance-checkbox">
            <input type="checkbox" id="finance-include-voided" ${filters.includeVoided ? 'checked' : ''} /> Show void expenses
          </label>
          <button type="submit" class="btn btn-secondary btn-sm">Apply filters</button>
        </form>
        <p id="finance-expense-total"><strong>${total}</strong> expense(s) · Total of non-void expenses: <strong>${escapeHtml(formatPhp(totalAmount))}</strong></p>
        ${expenses.length === 0
          ? stateBox('No expenses match these filters', 'Change the dates or category, or record the first expense for this period.')
          : `<div class="table-responsive">
              <table class="data-table" aria-label="Expense register">
                <thead>
                  <tr>
                    <th scope="col">Date</th><th scope="col">Category</th><th scope="col">Description</th><th scope="col">Vendor</th>
                    <th scope="col">Reference</th><th scope="col" class="finance-amount">Amount</th><th scope="col">Last changed</th><th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>${expenses.map(expenseRowHtml).join('')}</tbody>
              </table>
            </div>
            <nav class="finance-pagination" aria-label="Expense pages">
              <button class="btn btn-secondary btn-sm" id="btn-expenses-prev" ${page <= 1 ? 'disabled' : ''}>Previous</button>
              <span>Page ${page} of ${pageCount}</span>
              <button class="btn btn-secondary btn-sm" id="btn-expenses-next" ${page >= pageCount ? 'disabled' : ''}>Next</button>
            </nav>`}
      </section>
    `;
  }

  function historyHtml() {
    return `
      <section class="section-panel" aria-labelledby="finance-history-title">
        <div class="section-panel-header">
          <h2 class="section-panel-title" id="finance-history-title">Recent changes</h2>
        </div>
        <p class="form-help-text">Every budget, expense, import, and void is recorded with the member and time. Visible to all members of ${escapeHtml(organizationName)}.</p>
        ${historyTableHtml(data.events, 'Recent finance changes')}
      </section>
    `;
  }

  function renderBody() {
    body.innerHTML = reportSectionHtml(data.report, data.budgets) + expensesHtml() + historyHtml();
    bindBody();
  }

  // --- Actions ---

  /** Reloads the workspace, then confirms the completed action to the member. */
  async function afterChange(message) {
    if (await load()) announce(message);
  }

  async function voidExpense(expense) {
    if (!confirm(`Void this expense?\n\n${expense.occurredOn}  ${formatPhp(expense.amount)}  ${expense.description}\n\nIt stays in the register as void and leaves every total.`)) return;
    try {
      await api.voidExpense(expense.id, expense.version);
      afterChange('Expense voided.');
    } catch (error) {
      reportFailure(error);
      if (error.isConflict) load();
    }
  }

  function bindBody() {
    body.querySelector('#finance-month').addEventListener('change', (event) => {
      if (!/^\d{4}-\d{2}$/.test(event.target.value)) return;
      month = event.target.value;
      filters = { ...filters, from: `${month}-01`, to: lastDayOfMonth(month) };
      page = 1;
      load();
    });

    body.querySelector('#finance-filter-form').addEventListener('submit', (event) => {
      event.preventDefault();
      filters = {
        from: body.querySelector('#finance-from').value,
        to: body.querySelector('#finance-to').value,
        category: body.querySelector('#finance-category').value,
        includeVoided: body.querySelector('#finance-include-voided').checked,
      };
      page = 1;
      load();
    });

    body.querySelector('#btn-expenses-prev')?.addEventListener('click', () => { page -= 1; load(); });
    body.querySelector('#btn-expenses-next')?.addEventListener('click', () => { page += 1; load(); });

    const expenseById = id => data.expenses.expenses.find(e => e.id === id);
    body.querySelectorAll('[data-edit-expense]').forEach(button => button.addEventListener('click', () => {
      openExpenseForm({ api, categories: data.categories, today, expense: expenseById(button.dataset.editExpense), onSaved: () => afterChange('Expense updated.') });
    }));
    body.querySelectorAll('[data-void-expense]').forEach(button => button.addEventListener('click', () => {
      voidExpense(expenseById(button.dataset.voidExpense));
    }));
    body.querySelectorAll('[data-edit-budget]').forEach(button => button.addEventListener('click', () => {
      const budget = data.budgets.find(b => b.id === button.dataset.editBudget);
      openBudgetForm({ api, categories: data.categories, month, budget, onSaved: () => afterChange('Budget updated.') });
    }));
    body.querySelectorAll('[data-new-budget]').forEach(button => button.addEventListener('click', () => {
      openBudgetForm({ api, categories: data.categories, month, category: button.dataset.newBudget, onSaved: () => afterChange('Budget set.') });
    }));
    body.querySelectorAll('[data-history]').forEach(button => button.addEventListener('click', () => {
      openHistory({ api, entityId: button.dataset.history, title: button.dataset.historyTitle });
    }));
  }

  container.querySelector('#btn-record-expense').addEventListener('click', () => {
    openExpenseForm({ api, categories: data?.categories ?? [], today, onSaved: () => afterChange('Expense recorded.') });
  });
  container.querySelector('#btn-set-budget').addEventListener('click', () => {
    openBudgetForm({ api, categories: data?.categories ?? [], month, onSaved: () => afterChange('Budget set.') });
  });
  container.querySelector('#btn-import-expenses').addEventListener('click', () => {
    openImport({ api, onImported: () => load() });
  });
  container.querySelector('#btn-export-expenses').addEventListener('click', async () => {
    try {
      const { from, to, category } = filters;
      saveDownload(await api.downloadExport({ from, to, category }));
      announce('Export downloaded for the current date and category filters. Void expenses are excluded.');
    } catch (error) {
      reportFailure(error);
    }
  });

  return { load };
}
