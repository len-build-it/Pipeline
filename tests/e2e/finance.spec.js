import { test, expect } from '@playwright/test';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import { setupTestDatabase, cleanupTestDatabase, getTestPool } from '../helpers/db-helper.js';
import { manilaDate } from '../finance/finance-helper.js';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const screenshotsDir = resolve(rootDir, 'docs/evidence/screenshots');
const CSV_HEADER = 'Date,Amount,Category,Description,Vendor,Reference';
const TODAY = manilaDate(0);
const YESTERDAY = manilaDate(-1);

function csvFile(name, ...lines) {
  return { name, mimeType: 'text/csv', buffer: Buffer.from([CSV_HEADER, ...lines].join('\n'), 'utf-8') };
}

async function signIn(page, email) {
  await page.goto('/');
  await page.locator('#btn-sign-out').click();
  await page.locator('#signin-email').fill(email);
  await page.locator('#signin-password').fill('password123456');
  await page.locator('#btn-submit-signin').click();
  await expect(page.locator('h1')).toHaveText('Overview');
}

/** Opens Finance and widens the date filter so records from any date are listed. */
async function openFinance(page) {
  await page.locator('#nav-btn-finance').click();
  await expect(page.locator('h1')).toHaveText('Finance');
  await expect(page.locator('#finance-filter-form')).toBeVisible();
  await page.locator('#finance-from').fill('2020-01-01');
  await page.locator('#finance-filter-form button[type="submit"]').click();
  await expect(page.locator('#finance-body')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('#finance-from')).toHaveValue('2020-01-01');
}

async function recordExpense(page, { date = TODAY, amount, category, description, vendor = '', reference = '' }) {
  await page.locator('#btn-record-expense').click();
  const dialog = page.locator('#expense-form-modal');
  await dialog.locator('#expense-date').fill(date);
  await dialog.locator('#expense-amount').fill(amount);
  await dialog.locator('#expense-category').fill(category);
  await dialog.locator('#expense-description').fill(description);
  await dialog.locator('#expense-vendor').fill(vendor);
  await dialog.locator('#expense-reference').fill(reference);
  await dialog.locator('#btn-save-expense').click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('#finance-status')).toContainText('Expense recorded.');
}

const register = page => page.locator('table[aria-label="Expense register"]');
const expenseRow = (page, description) => register(page).locator('tbody tr', { hasText: description });

async function apiToken(page) {
  return page.evaluate(() => window.__app.state.token);
}

/** Records an expense through the API as the signed-in member, so a test owns the data it reads. */
async function seedExpense(page, orgId, expense) {
  const res = await page.request.post(`/api/organizations/${orgId}/finance/expenses`, {
    headers: { authorization: `Bearer ${await apiToken(page)}` },
    data: { occurredOn: YESTERDAY, ...expense },
  });
  expect(res.status()).toBe(201);
}

/** Presses Tab until the target has focus; a date input has several internal tab stops. */
async function tabTo(page, target, maxPresses = 6) {
  for (let press = 0; press < maxPresses; press++) {
    await page.keyboard.press('Tab');
    if (await target.evaluate(element => element === document.activeElement)) return;
  }
  await expect(target).toBeFocused();
}

test.describe('Finance workspace with the real backend (PLAN-002 Phase 3 / FEAT-006)', () => {
  test.beforeAll(async () => {
    const pool = await setupTestDatabase();
    // Two more organizations, so every journey runs with four differently named teams.
    await pool.query(
      `INSERT INTO organizations (id, name, status) VALUES
         ('org-harbor', 'Harbor Robotics Club', 'active'),
         ('org-report', 'Report Fixture Team', 'active')`
    );
    await pool.query(
      `INSERT INTO memberships (id, user_id, organization_id, role, status) VALUES
         ('mem-sam-harbor', 'usr-sam', 'org-harbor', 'Member', 'active'),
         ('mem-sam-report', 'usr-sam', 'org-report', 'Member', 'active')`
    );
  });

  test.afterAll(async () => {
    await cleanupTestDatabase();
  });

  test('a member records, edits, reviews history of, and voids an expense and sets a budget', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page, 'sam@example.com');
    await page.selectOption('#desktop-scope-select', 'org-harbor');
    await openFinance(page);
    await expect(page.locator('.page-title-group')).toContainText('Harbor Robotics Club');
    await expect(page.locator('.page-title-group')).toContainText('PHP');

    // Empty state before any record exists
    await expect(page.locator('#finance-body')).toContainText('No expenses match these filters');
    await expect(page.locator('#finance-body')).toContainText('No budgets for');

    // Validation: an empty amount and a malformed amount keep the dialog open with an error summary
    await page.locator('#btn-record-expense').click();
    const dialog = page.locator('#expense-form-modal');
    await dialog.locator('#expense-category').fill('Motors');
    await dialog.locator('#expense-description').fill('Drive motor pair');
    await dialog.locator('#btn-save-expense').click();
    await expect(dialog.locator('[data-error-summary]')).toBeVisible();
    await expect(dialog.locator('[data-error-summary]')).toContainText('Enter a positive amount');
    await expect(dialog.locator('[data-error-summary]')).toBeFocused();
    await dialog.locator('#expense-amount').fill('1,250.50');
    await dialog.locator('#btn-save-expense').click();
    await expect(dialog.locator('[data-error-summary]')).toContainText('Enter a positive amount');
    // The member's other input is preserved through the failed attempts
    await expect(dialog.locator('#expense-category')).toHaveValue('Motors');
    await expect(dialog.locator('#expense-description')).toHaveValue('Drive motor pair');

    await dialog.locator('#expense-amount').fill('1250.50');
    await dialog.locator('#btn-save-expense').click();
    await expect(dialog).toHaveCount(0);
    await expect(expenseRow(page, 'Drive motor pair')).toContainText('PHP 1,250.50');
    await expect(page.locator('#finance-expense-total')).toContainText('PHP 1,250.50');

    await recordExpense(page, { amount: '0.10', category: 'Fasteners', description: 'M3 screw' });
    await recordExpense(page, { amount: '0.20', category: 'Fasteners', description: 'M3 nut' });
    await expect(page.locator('#finance-expense-total')).toContainText('3 expense(s)');
    await expect(page.locator('#finance-expense-total')).toContainText('PHP 1,250.80');

    // Budget: set, then a duplicate for the same month and category is refused with the form kept open
    await page.locator('#btn-set-budget').click();
    const budgetDialog = page.locator('#budget-form-modal');
    await budgetDialog.locator('#budget-category').fill('Motors');
    await budgetDialog.locator('#budget-amount').fill('5000');
    await budgetDialog.locator('#btn-save-budget').click();
    await expect(budgetDialog).toHaveCount(0);
    await expect(page.locator(`table[aria-label^="Budgets for"]`)).toContainText('PHP 5,000.00');

    await page.locator('#btn-set-budget').click();
    await budgetDialog.locator('#budget-category').fill('motors');
    await budgetDialog.locator('#budget-amount').fill('100');
    await budgetDialog.locator('#btn-save-budget').click();
    await expect(budgetDialog.locator('[data-error-summary]')).toContainText('already exists');
    await expect(budgetDialog.locator('#budget-amount')).toHaveValue('100');
    await page.keyboard.press('Escape');

    // Edit, then inspect the change history of that expense
    await expenseRow(page, 'Drive motor pair').getByRole('button', { name: /^Edit / }).click();
    await dialog.locator('#expense-amount').fill('1300.75');
    await dialog.locator('#btn-save-expense').click();
    await expect(dialog).toHaveCount(0);
    await expect(expenseRow(page, 'Drive motor pair')).toContainText('PHP 1,300.75');

    await expenseRow(page, 'Drive motor pair').getByRole('button', { name: /^History / }).click();
    const history = page.locator('#finance-history-modal');
    await expect(history.locator('tbody tr')).toHaveCount(2);
    await expect(history).toContainText('Sam Taylor');
    await expect(history).toContainText('Amount: PHP 1,250.50 → PHP 1,300.75');
    await history.getByRole('button', { name: 'Close', exact: true }).click();

    // Void: leaves the total and the default register, remains visible on request
    page.once('dialog', dialogBox => dialogBox.accept());
    await expenseRow(page, 'M3 nut').getByRole('button', { name: /^Void / }).click();
    await expect(page.locator('#finance-status')).toContainText('Expense voided.');
    await expect(expenseRow(page, 'M3 nut')).toHaveCount(0);
    await expect(page.locator('#finance-expense-total')).toContainText('PHP 1,300.85');

    await page.locator('#finance-include-voided').check();
    await page.locator('#finance-filter-form button[type="submit"]').click();
    await expect(expenseRow(page, 'M3 nut')).toContainText('Void');
    await expect(expenseRow(page, 'M3 nut').getByRole('button', { name: /^Edit / })).toHaveCount(0);
    await expect(page.locator('#finance-expense-total')).toContainText('PHP 1,300.85');

    // Recent changes list every action with the member who made it
    const recent = page.locator('table[aria-label="Recent finance changes"]');
    await expect(recent).toContainText('Voided expense');
    await expect(recent).toContainText('Recorded budget');

    await page.screenshot({ path: `${screenshotsDir}/plan2-p3-finance-desktop-1440.png`, fullPage: true });
  });

  test('integrated flow: budget, expense, reviewed import, history, analytics, and export in one session', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page, 'jordan@example.com');
    await page.locator('#nav-btn-finance').click();
    await expect(page.locator('.page-title-group')).toContainText('Dev Guild');
    const month = TODAY.slice(0, 7);

    // 1. Budget
    await page.locator('#btn-set-budget').click();
    const budgetDialog = page.locator('#budget-form-modal');
    await budgetDialog.locator('#budget-category').fill('Workshops');
    await budgetDialog.locator('#budget-amount').fill('1000');
    await budgetDialog.locator('#btn-save-budget').click();
    await expect(page.locator('#finance-status')).toContainText('Budget set.');

    // 2. Expense
    await recordExpense(page, { amount: '250.25', category: 'Workshops', description: 'Venue deposit', reference: 'INT-1' });

    // 3. Reviewed import: one duplicate of the expense above is skipped, two rows are imported
    await page.locator('#btn-import-expenses').click();
    const importDialog = page.locator('#finance-import-modal');
    await importDialog.locator('#import-file').setInputFiles(csvFile('integrated.csv',
      `${TODAY},250.25,workshops,Same as recorded,,int-1`,
      `${TODAY},0.10,Workshops,Sticker,,INT-2`,
      `${TODAY},0.20,Snacks,Candy,,INT-3`
    ));
    await importDialog.locator('#btn-preview-import').click();
    await expect(importDialog.locator('#import-preview-summary')).toContainText('3 row(s), 2 ready, 1 possible duplicate(s), 0 with problems');
    await importDialog.getByLabel('Skip the possible duplicates').check();
    await importDialog.locator('#btn-confirm-import').click();
    await expect(importDialog.locator('[data-import-alert]')).toContainText('Imported 2 expense(s) totalling PHP 0.30');
    await importDialog.locator('#btn-close-import').click();

    // 4. Audit history names the member for every step
    const recent = page.locator('table[aria-label="Recent finance changes"]');
    await expect(recent.locator('tbody tr')).toHaveCount(3);
    await expect(recent).toContainText('Imported spreadsheet');
    await expect(recent).toContainText('Recorded expense');
    await expect(recent).toContainText('Recorded budget');
    for (const row of await recent.locator('tbody tr').all()) await expect(row).toContainText('Jordan Lee');

    // 5. Analytics reconcile with the register
    const stat = id => page.locator(`[data-finance-stat="${id}"]`);
    await expect(stat('budget')).toContainText('PHP 1,000.00');
    await expect(stat('actual')).toContainText('PHP 250.55');
    await expect(stat('actual')).toContainText('Includes PHP 0.20 without a budget');
    await expect(stat('remaining')).toContainText('PHP 749.45');
    await expect(stat('forecast')).toContainText('Estimate, not actual');
    await expect(page.locator('.finance-bars li', { hasText: 'Workshops' })).toContainText('PHP 250.35 of PHP 1,000.00 · Remaining PHP 749.65');
    await expect(page.locator('#finance-expense-total')).toContainText('3 expense(s)');
    await expect(page.locator('#finance-expense-total')).toContainText('PHP 250.55');

    // 6. Export: the workbook holds exactly this organization's three expenses and the same total
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#btn-export-expenses').click(),
    ]);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(await download.path());
    const exported = [];
    workbook.getWorksheet('Expenses').eachRow((row, number) => {
      if (number > 1) exported.push([row.getCell(3).value, row.getCell(6).value, row.getCell(7).value, row.getCell(8).value]);
    });
    expect(exported.sort((a, b) => a[1] - b[1])).toEqual([
      ['Sticker', 0.1, 'import', 'Jordan Lee'],
      ['Candy', 0.2, 'import', 'Jordan Lee'],
      ['Venue deposit', 250.25, 'manual', 'Jordan Lee'],
    ]);
    const facts = {};
    workbook.getWorksheet('Summary').eachRow(row => { facts[row.getCell(1).value] = row.getCell(2).value; });
    expect(facts.Organization).toBe('Dev Guild');
    expect(facts.Currency).toBe('PHP');
    expect(facts['Period from']).toBe(`${month}-01`);
    expect(facts['Expense count']).toBe('3');
    expect(facts['Total amount']).toBe(250.55);

    // Existing destinations still work in the same session.
    for (const [button, title] of [['#nav-btn-overview', 'Overview'], ['#nav-btn-members', 'Members'], ['#nav-btn-tasks', 'Tasks'], ['#nav-btn-announcements', 'Announcements']]) {
      await page.locator(button).click();
      await expect(page.locator('h1')).toHaveText(title);
    }
  });

  test('budget report: totals, charts with matching tables, and the labeled estimate reconcile with the register', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page, 'sam@example.com');
    await page.selectOption('#desktop-scope-select', 'org-report');

    const month = TODAY.slice(0, 7);
    const headers = { authorization: `Bearer ${await apiToken(page)}` };
    const base = '/api/organizations/org-report/finance';
    for (const budget of [{ category: 'Supplies', amount: '100.00' }, { category: 'Travel', amount: '500.00' }]) {
      expect((await page.request.post(`${base}/budgets`, { headers, data: { month, ...budget } })).status()).toBe(201);
    }
    for (const expense of [
      { amount: '60.10', category: 'supplies', description: 'Paper' },
      { amount: '60.20', category: 'Supplies', description: 'Ink' },
      { amount: '120.00', category: 'Travel', description: 'Bus fare' },
      { amount: '33.33', category: 'Snacks', description: 'Team snacks' },
    ]) {
      await seedExpense(page, 'org-report', { occurredOn: TODAY, ...expense });
    }
    const serverReport = await (await page.request.get(`${base}/report`, { headers })).json();

    await page.locator('#nav-btn-finance').click();
    const stat = id => page.locator(`[data-finance-stat="${id}"]`);
    await expect(stat('budget')).toContainText('PHP 600.00');
    await expect(stat('actual')).toContainText('PHP 273.63');
    await expect(stat('actual')).toContainText('Includes PHP 33.33 without a budget');
    await expect(stat('remaining')).toContainText('Remaining');
    await expect(stat('remaining')).toContainText('PHP 326.37');

    // The estimate is the server's value, labeled as an estimate with its calculation.
    const estimate = serverReport.forecast.estimate;
    const [pesos, centavos] = estimate.split('.');
    await expect(stat('forecast')).toContainText(`PHP ${Number(pesos).toLocaleString('en-US')}.${centavos}`);
    await expect(stat('forecast')).toContainText('Estimate, not actual');
    await expect(page.locator('#finance-forecast-basis')).toContainText('days in the month');

    // Chart: one labeled bar per category, with status in words.
    const bars = page.locator('.finance-bars li');
    await expect(bars).toHaveCount(3);
    await expect(bars.nth(0)).toContainText('Snacks');
    await expect(bars.nth(0)).toContainText('PHP 33.33 spent, no budget set');
    await expect(bars.nth(1)).toContainText('PHP 120.30 of PHP 100.00 · Over budget by PHP 20.30');
    await expect(bars.nth(2)).toContainText('PHP 120.00 of PHP 500.00 · Remaining PHP 380.00');

    // Table equivalent of the chart, with the same figures.
    const budgetTable = page.locator('table[aria-label^="Budgets for"]');
    await expect(budgetTable.locator('tbody tr')).toHaveCount(3);
    await expect(budgetTable.locator('tbody tr').nth(0)).toContainText('No budget set');
    await expect(budgetTable.locator('tbody tr').nth(1)).toContainText('Over budget');
    await expect(budgetTable.locator('tbody tr').nth(1)).toContainText('-PHP 20.30');
    await expect(budgetTable.locator('tbody tr').nth(2)).toContainText('Within budget');
    await expect(budgetTable.locator('tfoot')).toContainText('PHP 273.63');
    await expect(page.locator('[role="region"][aria-label="Budget table, scrollable"]')).toHaveAttribute('tabindex', '0');

    // The register for the same month reconciles to the report.
    await expect(page.locator('#finance-expense-total')).toContainText('4 expense(s)');
    await expect(page.locator('#finance-expense-total')).toContainText('PHP 273.63');

    // Trend: chart with printed values and a matching table of six months.
    const trend = page.locator('svg.finance-trend');
    await expect(trend).toHaveAttribute('role', 'img');
    await expect(trend.locator('circle')).toHaveCount(6);
    await expect(trend).toContainText('273.63');
    const trendTable = page.locator('table[aria-label="Monthly actual spending"]');
    await expect(trendTable.locator('tbody tr')).toHaveCount(6);
    await expect(trendTable.locator('tbody tr').last()).toContainText(month);
    await expect(trendTable.locator('tbody tr').last()).toContainText('PHP 273.63');

    await page.screenshot({ path: `${screenshotsDir}/plan2-p4-finance-report-1440.png`, fullPage: true });

    // Setting a budget for the unbudgeted category starts from that category.
    await page.getByRole('button', { name: 'Set budget for Snacks' }).click();
    const budgetDialog = page.locator('#budget-form-modal');
    await expect(budgetDialog.locator('#budget-category')).toHaveValue('Snacks');
    await budgetDialog.locator('#budget-amount').fill('33.33');
    await budgetDialog.locator('#btn-save-budget').click();
    await expect(budgetDialog).toHaveCount(0);
    await expect(budgetTable.locator('tbody tr').nth(0)).toContainText('Budget fully used');
    await expect(stat('budget')).toContainText('PHP 633.33');

    // A past month has no estimate and no invented figures.
    await page.locator('#finance-month').fill('2025-01');
    await expect(stat('forecast')).toContainText('Not available');
    await expect(stat('actual')).toContainText('PHP 0.00');
    await expect(page.locator('#finance-body')).toContainText('No budgets for 2025-01');
  });

  test('spreadsheet import: problems block the batch, duplicates need a choice, confirm imports atomically', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page, 'alex@example.com');
    await page.selectOption('#desktop-scope-select', 'org-1');
    await openFinance(page);
    await recordExpense(page, { date: YESTERDAY, amount: '50.00', category: 'Fuel', description: 'Diesel', reference: 'OR-7' });

    await page.locator('#btn-import-expenses').click();
    const dialog = page.locator('#finance-import-modal');
    const confirmButton = dialog.locator('#btn-confirm-import');
    await expect(confirmButton).toBeDisabled();

    // Previewing without a file explains what to do
    await dialog.locator('#btn-preview-import').click();
    await expect(dialog.locator('[data-import-alert]')).toContainText('Choose a .csv or .xlsx file first.');

    // A file with invalid rows: every problem is listed, nothing can be confirmed, the file stays selected
    await dialog.locator('#import-file').setInputFiles(csvFile('mixed.csv',
      `${YESTERDAY},10.00,Supplies,Good row,,`,
      `${YESTERDAY},1.999,Supplies,Too many decimals,,`,
      `${manilaDate(3)},5.00,Supplies,Future date,,`
    ));
    await dialog.locator('#btn-preview-import').click();
    await expect(dialog.locator('#import-preview-summary')).toContainText('3 row(s), 1 ready, 0 possible duplicate(s), 2 with problems');
    await expect(dialog.locator('[data-import-preview] [role="alert"]')).toContainText('Nothing can be imported until every row is valid');
    await expect(dialog.locator('tr[data-import-status="invalid"]')).toHaveCount(2);
    await expect(dialog.locator('tr[data-import-status="invalid"]').first()).toContainText('at most two decimals');
    await expect(confirmButton).toBeDisabled();
    expect(await dialog.locator('#import-file').evaluate(input => input.files[0]?.name)).toBe('mixed.csv');

    // A corrected file with one duplicate of the stored expense and one new row
    await dialog.locator('#import-file').setInputFiles(csvFile('corrected.csv',
      `${YESTERDAY},50.00,fuel,Same as stored,,or-7`,
      `${YESTERDAY},10.00,Supplies,Good row,,`,
      `${YESTERDAY},0.10,Supplies,Ten centavos,,`
    ));
    await dialog.locator('#btn-preview-import').click();
    await expect(dialog.locator('#import-preview-summary')).toContainText('3 row(s), 2 ready, 1 possible duplicate(s), 0 with problems');
    await expect(dialog.locator('tr[data-import-status="duplicate"]')).toContainText('already recorded');
    await expect(dialog.locator('#import-duplicate-choice')).toBeVisible();
    await expect(confirmButton).toBeDisabled();

    await dialog.getByLabel('Skip the possible duplicates').check();
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();
    await expect(dialog.locator('[data-import-alert]')).toContainText('Imported 2 expense(s) totalling PHP 10.10. 1 possible duplicate(s) were skipped.');
    await dialog.locator('#btn-close-import').click();

    await expect(expenseRow(page, 'Good row')).toContainText('Imported');
    await expect(expenseRow(page, 'Ten centavos')).toContainText('PHP 0.10');
    await expect(expenseRow(page, 'Same as stored')).toHaveCount(0);
    await expect(page.locator('#finance-expense-total')).toContainText('PHP 60.10');
    await expect(page.locator('table[aria-label="Recent finance changes"]')).toContainText('2 expenses from corrected.csv, total PHP 10.10; 1 possible duplicates skipped');

    // A workbook with a formula cell is refused at the row level
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Expenses');
    sheet.addRow(['Date', 'Amount', 'Category', 'Description']);
    sheet.addRow([new Date(`${YESTERDAY}T00:00:00Z`), { formula: '5+5', result: 10 }, 'Supplies', 'Formula amount']);
    await page.locator('#btn-import-expenses').click();
    await dialog.locator('#import-file').setInputFiles({
      name: 'formula.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
    });
    await dialog.locator('#btn-preview-import').click();
    await expect(dialog.locator('tr[data-import-status="invalid"]')).toContainText('Amount contains a formula');
    await expect(confirmButton).toBeDisabled();

    // An oversized file and an unsupported type are refused before upload
    await dialog.locator('#import-file').setInputFiles({ name: 'huge.csv', mimeType: 'text/csv', buffer: Buffer.alloc(5 * 1024 * 1024 + 1, 0x61) });
    await dialog.locator('#btn-preview-import').click();
    await expect(dialog.locator('[data-import-alert]')).toContainText('larger than the 5 MiB upload limit');
    await dialog.locator('#import-file').setInputFiles({ name: 'notes.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF') });
    await dialog.locator('#btn-preview-import').click();
    await expect(dialog.locator('[data-import-alert]')).toContainText('Only .csv and .xlsx files can be imported.');

    await page.screenshot({ path: `${screenshotsDir}/plan2-p3-finance-import-1440.png` });
  });

  test('export downloads a workbook for the selected organization and filters', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page, 'alex@example.com');
    await page.selectOption('#desktop-scope-select', 'org-2');
    await seedExpense(page, 'org-2', { amount: '10.00', category: 'Export', description: 'Ten pesos' });
    await seedExpense(page, 'org-2', { amount: '0.10', category: 'Export', description: 'Ten centavos' });
    await seedExpense(page, 'org-2', { amount: '99.00', category: 'Other', description: 'Filtered out' });
    await openFinance(page);

    await page.locator('#finance-category').selectOption('Export');
    await page.locator('#finance-filter-form button[type="submit"]').click();
    await expect(page.locator('#finance-body')).toHaveAttribute('aria-busy', 'false');
    await expect(page.locator('#finance-expense-total')).toContainText('PHP 10.10');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#btn-export-expenses').click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^expenses-dev-guild-/);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(await download.path());
    const detail = workbook.getWorksheet('Expenses');
    const amounts = [];
    detail.eachRow((row, number) => { if (number > 1) amounts.push(row.getCell(6).value); });
    expect(amounts.sort()).toEqual([0.1, 10]);

    const facts = {};
    workbook.getWorksheet('Summary').eachRow(row => { facts[row.getCell(1).value] = row.getCell(2).value; });
    expect(facts.Organization).toBe('Dev Guild');
    expect(facts['Category filter']).toBe('Export');
    expect(facts['Period from']).toBe('2020-01-01');
    expect(facts['Total amount']).toBe(10.1);
  });

  test('a stale edit explains the conflict, keeps the member input, and saves on retry', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await signIn(page, 'alex@example.com');
    await page.selectOption('#desktop-scope-select', 'org-1');
    await openFinance(page);
    await recordExpense(page, { amount: '300.00', category: 'Conflict', description: 'Shared edit target' });

    await expenseRow(page, 'Shared edit target').getByRole('button', { name: /^Edit / }).click();
    const dialog = page.locator('#expense-form-modal');
    await dialog.locator('#expense-description').fill('Shared edit target, revised by Alex');

    // Another member changes the same expense while the dialog is open.
    const token = await apiToken(page);
    const listed = await (await page.request.get('/api/organizations/org-1/finance/expenses?category=Conflict', {
      headers: { authorization: `Bearer ${token}` },
    })).json();
    const samLogin = await (await page.request.post('/api/auth/login', { data: { email: 'sam@example.com', password: 'password123456' } })).json();
    const other = await page.request.patch(`/api/organizations/org-1/finance/expenses/${listed.expenses[0].id}`, {
      headers: { authorization: `Bearer ${samLogin.accessToken}` },
      data: { amount: '333.33', version: listed.expenses[0].version },
    });
    expect(other.status()).toBe(200);

    await dialog.locator('#btn-save-expense').click();
    const summary = dialog.locator('[data-error-summary]');
    await expect(summary).toContainText('changed by another member');
    await expect(summary).toContainText('PHP 333.33');
    await expect(summary).toContainText('changed by Sam Taylor');
    await expect(dialog.locator('#expense-description')).toHaveValue('Shared edit target, revised by Alex');

    // The member reviews, keeps their own amount, and saves again on top of the latest version.
    await dialog.locator('#btn-save-expense').click();
    await expect(dialog).toHaveCount(0);
    await expect(expenseRow(page, 'revised by Alex')).toContainText('PHP 300.00');
  });

  test('offline actions are rejected without saving and succeed after reconnecting', async ({ page, context }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await signIn(page, 'alex@example.com');
    await page.selectOption('#desktop-scope-select', 'org-1');
    await openFinance(page);

    await page.locator('#btn-record-expense').click();
    const dialog = page.locator('#expense-form-modal');
    await dialog.locator('#expense-amount').fill('42.00');
    await dialog.locator('#expense-category').fill('Offline');
    await dialog.locator('#expense-description').fill('Written while offline');

    await context.setOffline(true);
    await dialog.locator('#btn-save-expense').click();
    await expect(dialog.locator('[data-error-summary]')).toContainText('You are offline');
    await expect(dialog.locator('[data-error-summary]')).toContainText('nothing was saved');
    await expect(dialog.locator('#expense-description')).toHaveValue('Written while offline');

    const stored = await getTestPool().query(`SELECT COUNT(*)::int AS count FROM expenses WHERE description = 'Written while offline'`);
    expect(stored.rows[0].count).toBe(0);

    await context.setOffline(false);
    await dialog.locator('#btn-save-expense').click();
    await expect(dialog).toHaveCount(0);
    await expect(expenseRow(page, 'Written while offline')).toContainText('PHP 42.00');
  });

  test('losing membership replaces the workspace with a no-access state', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await signIn(page, 'jordan@example.com');
    await openFinance(page);
    await expect(page.locator('.page-title-group')).toContainText('Dev Guild');

    await getTestPool().query(`UPDATE memberships SET status = 'inactive' WHERE user_id = 'usr-jordan'`);
    await page.locator('#finance-filter-form button[type="submit"]').click();
    await expect(page.locator('#finance-body')).toContainText('No access to this organization');
    await expect(page.locator('#btn-record-expense')).toBeDisabled();
    await expect(register(page)).toHaveCount(0);
    await getTestPool().query(`UPDATE memberships SET status = 'active' WHERE user_id = 'usr-jordan'`);
  });

  test('the owner picks one of the configured organizations before Finance loads', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await signIn(page, 'len@example.com');
    await seedExpense(page, 'org-harbor', { amount: '15.00', category: 'Scope', description: 'Harbor only' });
    await seedExpense(page, 'org-1', { amount: '25.00', category: 'Scope', description: 'AqOne only' });
    await page.locator('#nav-btn-finance').click();
    await expect(page.locator('#finance-body')).toHaveCount(0);
    await expect(page.locator('#finance-org-select option')).toHaveText([
      'Select an organization…', 'AqOne', 'Dev Guild', 'Harbor Robotics Club', 'Report Fixture Team',
    ]);

    await page.locator('#finance-org-select').selectOption('org-harbor');
    await expect(page.locator('.page-title-group')).toContainText('Harbor Robotics Club');
    // Only the third organization's records are shown.
    await page.locator('#finance-from').fill('2020-01-01');
    await page.locator('#finance-filter-form button[type="submit"]').click();
    await expect(expenseRow(page, 'Harbor only')).toHaveCount(1);
    await expect(expenseRow(page, 'AqOne only')).toHaveCount(0);
  });

  test('keyboard-only use: open, fill, cancel, and save an expense without a pointer', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await signIn(page, 'alex@example.com');
    await page.selectOption('#desktop-scope-select', 'org-1');
    await openFinance(page);

    await page.locator('#btn-record-expense').focus();
    await page.keyboard.press('Enter');
    const dialog = page.locator('#expense-form-modal');
    await expect(dialog.locator('#expense-date')).toBeFocused();

    // Tab order follows the visual order of the fields.
    await tabTo(page, dialog.locator('#expense-amount'));
    for (const id of ['expense-category', 'expense-description', 'expense-vendor', 'expense-reference']) {
      await page.keyboard.press('Tab');
      await expect(dialog.locator(`#${id}`)).toBeFocused();
    }

    // Focus stays inside the dialog when tabbing past the last and before the first control.
    await page.keyboard.press('Tab'); // Cancel
    await page.keyboard.press('Tab'); // Save
    await expect(dialog.locator('#btn-save-expense')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(dialog.locator('.modal-close-btn')).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(dialog.locator('#btn-save-expense')).toBeFocused();

    // Escape closes the dialog and returns focus to the button that opened it.
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('#btn-record-expense')).toBeFocused();

    // Record an expense using the keyboard alone.
    await page.keyboard.press('Enter');
    await tabTo(page, dialog.locator('#expense-amount'));
    await page.keyboard.type('77.70');
    await page.keyboard.press('Tab');
    await page.keyboard.type('Keyboard');
    await page.keyboard.press('Tab');
    await page.keyboard.type('Typed without a pointer');
    await tabTo(page, dialog.locator('#btn-save-expense'));
    await page.keyboard.press('Enter');
    await expect(dialog).toHaveCount(0);
    await expect(expenseRow(page, 'Typed without a pointer')).toContainText('PHP 77.70');
  });

  test('every finance control has an accessible name and errors are announced', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await signIn(page, 'alex@example.com');
    await page.selectOption('#desktop-scope-select', 'org-1');
    await openFinance(page);

    const unnamed = () => page.evaluate(() => {
      const scope = document.querySelector('.modal-backdrop') || document.querySelector('#view-container');
      const controls = [...scope.querySelectorAll('input, select, textarea, button')];
      return controls
        .filter(el => {
          const labelled = el.labels?.length > 0 || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
          const buttonText = el.tagName === 'BUTTON' && el.textContent.trim().length > 0;
          return !labelled && !buttonText;
        })
        .map(el => el.id || el.outerHTML.slice(0, 80));
    });

    expect(await unnamed()).toEqual([]);
    await expect(page.locator('#finance-status')).toHaveAttribute('aria-live', 'polite');
    for (const table of await page.locator('#view-container table').all()) {
      await expect(table).toHaveAttribute('aria-label', /.+/);
    }

    await page.locator('#btn-record-expense').click();
    expect(await unnamed()).toEqual([]);
    await page.locator('#btn-save-expense').click();
    await expect(page.locator('#expense-form-modal [data-error-summary]')).toHaveAttribute('role', 'alert');
    await expect(page.locator('#expense-form-modal')).toHaveAttribute('aria-modal', 'true');
    await page.keyboard.press('Escape');

    await page.locator('#btn-set-budget').click();
    expect(await unnamed()).toEqual([]);
    await page.keyboard.press('Escape');

    await page.locator('#btn-import-expenses').click();
    expect(await unnamed()).toEqual([]);
    await page.keyboard.press('Escape');
  });

  test('responsive layouts at 375, 768, 1024, and 1440 pixels have no page overflow', async ({ page }) => {
    await signIn(page, 'alex@example.com');
    const mobileScope = page.locator('#mobile-scope-select');
    if (await mobileScope.isVisible()) await mobileScope.selectOption('org-1');
    else await page.selectOption('#desktop-scope-select', 'org-1');
    await seedExpense(page, 'org-1', { amount: '123456789.99', category: 'A long category name for layout checks', description: 'Layout fixture with a fairly long description that must not widen the page', vendor: 'Vendor name', reference: 'REF-LAYOUT-0001' });

    for (const width of [375, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.locator(width <= 768 ? '#mob-nav-finance' : '#nav-btn-finance').click();
      await expect(page.locator('#finance-filter-form')).toBeVisible();
      await page.locator('#finance-from').fill('2020-01-01');
      await page.locator('#finance-filter-form button[type="submit"]').click();
      await expect(register(page)).toBeVisible();

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(overflow, `Horizontal page scroll at ${width}px`).toBe(false);

      // Dialogs fit the viewport as well.
      await page.locator('#btn-record-expense').click();
      const box = await page.locator('#expense-form-modal .modal-dialog').boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      await page.keyboard.press('Escape');

      if (width === 375) await page.screenshot({ path: `${screenshotsDir}/plan2-p3-finance-phone-375.png`, fullPage: true });
    }
  });
});
