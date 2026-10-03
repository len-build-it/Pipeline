import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { cleanupTestDatabase } from '../helpers/db-helper.js';
import { setupFinanceTest, expenseInput, THIRD_ORG_ID } from './finance-helper.js';
import { XLSX_MIME } from '../../server/finance/spreadsheet.js';

const ORG_1 = '/organizations/org-1/finance';
const ORG_2 = '/organizations/org-2/finance';
const ORG_3 = `/organizations/${THIRD_ORG_ID}/finance`;

const FORMULA_LIKE_TEXT = ['=HYPERLINK("http://example.com","pay")', '+1+1', '-2+3', '@SUM(A1:A9)', "=cmd|' /C calc'!A0"];

async function readWorkbook(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
}

/** Summary facts as a label-to-value map from the first two columns. */
function summaryFacts(sheet) {
  const facts = {};
  sheet.eachRow(row => {
    const label = row.getCell(1).value;
    if (typeof label === 'string') facts[label] = row.getCell(2).value;
  });
  return facts;
}

function allCells(workbook) {
  const cells = [];
  workbook.eachSheet(sheet => sheet.eachRow(row => row.eachCell(cell => cells.push(cell))));
  return cells;
}

describe('PLAN-002 Phase 3: accountant workbook export (FEAT-006/REQ-008)', () => {
  let app;
  let api;
  let upload;
  let download;

  before(async () => {
    ({ app, api, upload, download } = await setupFinanceTest());

    const record = (user, base, overrides) => api(user, 'POST', `${base}/expenses`, expenseInput(overrides));
    await record('alex', ORG_1, { occurredOn: '2026-08-03', amount: '0.10', category: 'Supplies', description: FORMULA_LIKE_TEXT[0], vendor: FORMULA_LIKE_TEXT[1], reference: FORMULA_LIKE_TEXT[2] });
    await record('sam', ORG_1, { occurredOn: '2026-08-15', amount: '0.20', category: 'supplies', description: FORMULA_LIKE_TEXT[3] });
    await record('sam', ORG_1, { occurredOn: '2026-09-01', amount: '999999999.99', category: 'Venue', description: FORMULA_LIKE_TEXT[4], reference: 'INV-1' });
    await record('len', ORG_1, { occurredOn: '2026-09-02', amount: '1250.50', category: 'Travel', description: 'Bus fare', vendor: 'Victory Liner' });
    const voided = (await record('len', ORG_1, { occurredOn: '2026-09-03', amount: '777.00', category: 'Travel', description: 'Voided fare' })).body;
    await api('len', 'POST', `${ORG_1}/expenses/${voided.id}/void`, { version: voided.version });

    await record('jordan', ORG_2, { occurredOn: '2026-09-02', amount: '4242.42', category: 'Other organization', description: 'Must never leak' });
  });

  after(async () => {
    if (app) await app.close();
    await cleanupTestDatabase();
  });

  test('the download is a macro-free .xlsx attachment named for the organization', async () => {
    const res = await download('sam', `${ORG_1}/export.xlsx`);
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], XLSX_MIME);
    assert.match(res.headers['content-disposition'], /^attachment; filename="expenses-aqone-\d{4}-\d{2}-\d{2}\.xlsx"$/);
    assert.equal(res.buffer.subarray(0, 2).toString('latin1'), 'PK');
    assert.equal(res.buffer.includes(Buffer.from('vbaProject')), false);
  });

  test('the detail sheet lists non-void expenses with exact numeric amounts and real dates', async () => {
    const workbook = await readWorkbook((await download('sam', `${ORG_1}/export.xlsx`)).buffer);
    assert.deepEqual(workbook.worksheets.map(sheet => sheet.name), ['Expenses', 'Summary']);

    const detail = workbook.getWorksheet('Expenses');
    assert.deepEqual(detail.getRow(1).values.slice(1), [
      'Date', 'Category', 'Description', 'Vendor', 'Reference', 'Amount', 'Source', 'Recorded by', 'Last changed by', 'Last changed at', 'Expense ID',
    ]);

    const rows = [];
    detail.eachRow((row, number) => {
      if (number > 1) rows.push([row.getCell(1).value.toISOString().slice(0, 10), row.getCell(2).value, row.getCell(6).value, row.getCell(8).value]);
    });
    assert.deepEqual(rows, [
      ['2026-08-03', 'Supplies', 0.1, 'Alex Rivera'],
      ['2026-08-15', 'supplies', 0.2, 'Sam Taylor'],
      ['2026-09-01', 'Venue', 999999999.99, 'Sam Taylor'],
      ['2026-09-02', 'Travel', 1250.5, 'Len'],
    ]);
    for (let number = 2; number <= 5; number++) {
      assert.equal(detail.getRow(number).getCell(6).type, ExcelJS.ValueType.Number);
      assert.equal(detail.getRow(number).getCell(1).type, ExcelJS.ValueType.Date);
    }
  });

  test('formula-like text is written as literal text and the workbook holds no formulas', async () => {
    const workbook = await readWorkbook((await download('sam', `${ORG_1}/export.xlsx`)).buffer);
    const detail = workbook.getWorksheet('Expenses');

    const first = detail.getRow(2);
    assert.equal(first.getCell(3).value, FORMULA_LIKE_TEXT[0]);
    assert.equal(first.getCell(4).value, FORMULA_LIKE_TEXT[1]);
    assert.equal(first.getCell(5).value, FORMULA_LIKE_TEXT[2]);
    assert.equal(detail.getRow(3).getCell(3).value, FORMULA_LIKE_TEXT[3]);
    assert.equal(detail.getRow(4).getCell(3).value, FORMULA_LIKE_TEXT[4]);
    for (const cell of [first.getCell(3), first.getCell(4), first.getCell(5)]) {
      assert.equal(cell.type, ExcelJS.ValueType.String);
    }

    const cells = allCells(workbook);
    assert.ok(cells.length > 40);
    assert.equal(cells.filter(cell => cell.type === ExcelJS.ValueType.Formula).length, 0);
  });

  test('the summary identifies organization, currency, period, filters, and generation time and reconciles', async () => {
    const workbook = await readWorkbook((await download('sam', `${ORG_1}/export.xlsx`)).buffer);
    const summary = workbook.getWorksheet('Summary');
    const facts = summaryFacts(summary);

    assert.equal(facts.Organization, 'AqOne');
    assert.equal(facts.Currency, 'PHP');
    assert.equal(facts['Period from'], 'Earliest record');
    assert.equal(facts['Period to'], 'Latest record');
    assert.equal(facts['Category filter'], 'All categories');
    assert.equal(facts['Void expenses'], 'Excluded');
    assert.match(facts['Generated at (Asia/Manila)'], /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+08:00$/);
    assert.equal(facts['Expense count'], '4');
    assert.equal(facts['Total amount'], 1000001250.79);

    const breakdown = [];
    summary.eachRow(row => {
      if (typeof row.getCell(3).value === 'number') breakdown.push([row.getCell(1).value, row.getCell(2).value, row.getCell(3).value]);
    });
    assert.deepEqual(breakdown, [
      ['Supplies', 2, 0.3],
      ['Travel', 1, 1250.5],
      ['Venue', 1, 999999999.99],
      ['2026-08', 2, 0.3],
      ['2026-09', 2, 1000001250.49],
    ]);
  });

  test('date and category filters limit the rows and are stated in the summary', async () => {
    const res = await download('sam', `${ORG_1}/export.xlsx?from=2026-08-01&to=2026-08-31&category=SUPPLIES`);
    const workbook = await readWorkbook(res.buffer);
    const facts = summaryFacts(workbook.getWorksheet('Summary'));

    assert.equal(workbook.getWorksheet('Expenses').actualRowCount, 3); // header + 2 rows
    assert.equal(facts['Period from'], '2026-08-01');
    assert.equal(facts['Period to'], '2026-08-31');
    assert.equal(facts['Category filter'], 'SUPPLIES');
    assert.equal(facts['Total amount'], 0.3);
  });

  test('the export contains only the selected organization', async () => {
    const org1 = (await download('sam', `${ORG_1}/export.xlsx`)).buffer;
    const org2 = await readWorkbook((await download('jordan', `${ORG_2}/export.xlsx`)).buffer);

    const org1Text = allCells(await readWorkbook(org1)).map(cell => String(cell.value));
    assert.equal(org1Text.includes('Must never leak'), false);
    assert.equal(org1Text.includes('Other organization'), false);
    assert.equal(summaryFacts(org2.getWorksheet('Summary')).Organization, 'Dev Guild');
    assert.equal(org2.getWorksheet('Expenses').actualRowCount, 2);
  });

  test('export and template are denied to non-members and unauthenticated callers', async () => {
    assert.equal((await download('jordan', `${ORG_1}/export.xlsx`)).status, 403);
    assert.equal((await download('jordan', `${ORG_1}/import-template.xlsx`)).status, 403);
    assert.equal((await download(null, `${ORG_1}/export.xlsx`)).status, 401);
  });

  test('invalid export filters are rejected', async () => {
    assert.equal((await download('sam', `${ORG_1}/export.xlsx?from=08/01/2026`)).status, 400);
  });

  test('an exported workbook imports into another organization with identical centavo values', async () => {
    const exported = (await download('sam', `${ORG_1}/export.xlsx`)).buffer;

    const preview = await upload('sam', `${ORG_3}/imports/preview?filename=roundtrip.xlsx`, exported, XLSX_MIME);
    assert.equal(preview.status, 200, JSON.stringify(preview.body));
    assert.equal(preview.body.invalidCount, 0);
    assert.deepEqual(preview.body.rows.map(row => [row.occurredOn, row.amount, row.category, row.description]), [
      ['2026-08-03', '0.10', 'Supplies', FORMULA_LIKE_TEXT[0]],
      ['2026-08-15', '0.20', 'supplies', FORMULA_LIKE_TEXT[3]],
      ['2026-09-01', '999999999.99', 'Venue', FORMULA_LIKE_TEXT[4]],
      ['2026-09-02', '1250.50', 'Travel', 'Bus fare'],
    ]);
    assert.ok(preview.body.ignoredColumns.includes('Expense ID'));

    const confirmed = await upload('sam', `${ORG_3}/imports/confirm?filename=roundtrip.xlsx`, exported, XLSX_MIME);
    assert.equal(confirmed.status, 201);
    assert.equal(confirmed.body.totalAmount, '1000001250.79');

    const source = await api('sam', 'GET', `${ORG_1}/expenses?limit=200`);
    const copy = await api('sam', 'GET', `${ORG_3}/expenses?limit=200`);
    assert.equal(copy.body.totalAmount, source.body.totalAmount);
    assert.deepEqual(copy.body.expenses.map(e => e.amount).sort(), source.body.expenses.map(e => e.amount).sort());
  });

  test('the import template has the expected header row and imports as an empty file', async () => {
    const res = await download('sam', `${ORG_1}/import-template.xlsx`);
    assert.equal(res.status, 200);
    const sheet = (await readWorkbook(res.buffer)).worksheets[0];
    assert.deepEqual(sheet.getRow(1).values.slice(1), ['Date', 'Amount', 'Category', 'Description', 'Vendor', 'Reference']);

    const preview = await upload('sam', `${ORG_1}/imports/preview`, res.buffer, XLSX_MIME);
    assert.equal(preview.status, 200);
    assert.equal(preview.body.rowCount, 0);
  });
});
