import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { cleanupTestDatabase } from '../helpers/db-helper.js';
import { setupFinanceTest, expenseInput, manilaDate, THIRD_ORG_ID } from './finance-helper.js';
import { CSV_MIME, XLSX_MIME, MAX_UPLOAD_BYTES, MAX_DATA_ROWS } from '../../server/finance/spreadsheet.js';

const ORG_1 = '/organizations/org-1/finance';
const ORG_2 = '/organizations/org-2/finance';
const ORG_3 = `/organizations/${THIRD_ORG_ID}/finance`;
const HEADER = 'Date,Amount,Category,Description,Vendor,Reference';

function csv(...lines) {
  return Buffer.from([HEADER, ...lines].join('\n'), 'utf-8');
}

/** Builds an .xlsx buffer; `fill` receives the first worksheet and the workbook. */
async function xlsx(fill) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Expenses');
  sheet.addRow(['Date', 'Amount', 'Category', 'Description', 'Vendor', 'Reference']);
  fill(sheet, workbook);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function utc(isoDate) {
  return new Date(`${isoDate}T00:00:00Z`);
}

describe('PLAN-002 Phase 3: spreadsheet import (FEAT-006/REQ-007)', () => {
  let app;
  let pool;
  let api;
  let upload;

  before(async () => {
    ({ app, pool, api, upload } = await setupFinanceTest());
  });

  after(async () => {
    if (app) await app.close();
    await cleanupTestDatabase();
  });

  async function financeRowCounts() {
    const res = await pool.query(`
      SELECT (SELECT COUNT(*)::int FROM expenses) AS expenses,
             (SELECT COUNT(*)::int FROM import_batches) AS batches,
             (SELECT COUNT(*)::int FROM activity_events) AS events`);
    return res.rows[0];
  }

  const preview = (user, base, file, type = CSV_MIME, query = '') =>
    upload(user, `${base}/imports/preview${query}`, file, type);
  const confirm = (user, base, file, type = CSV_MIME, query = '') =>
    upload(user, `${base}/imports/confirm${query}`, file, type);

  describe('Preview and atomic commit', () => {
    const file = csv(
      '2026-09-01,1250.50,Supplies,Printer paper,Office Depot,OR-100',
      '2026-09-02,0.10,Snacks,Candy,,',
      '2026-09-02,0.20,Snacks,Gum,,'
    );

    test('preview reports every row and stores nothing', async () => {
      const before = await financeRowCounts();
      const res = await preview('sam', ORG_1, file, CSV_MIME, '?filename=september.csv');

      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.equal(res.body.filename, 'september.csv');
      assert.equal(res.body.rowCount, 3);
      assert.equal(res.body.validCount, 3);
      assert.equal(res.body.invalidCount, 0);
      assert.equal(res.body.duplicateCount, 0);
      assert.equal(res.body.totalAmount, '1250.80');
      assert.equal(res.body.canCommit, true);
      assert.deepEqual(res.body.rows.map(r => [r.rowNumber, r.status, r.amount]), [
        [2, 'valid', '1250.50'],
        [3, 'valid', '0.10'],
        [4, 'valid', '0.20'],
      ]);
      assert.deepEqual(await financeRowCounts(), before);
    });

    test('confirm imports every row in one batch with provenance and one history event', async () => {
      const res = await confirm('sam', ORG_1, file, CSV_MIME, '?filename=september.csv');
      assert.equal(res.status, 201, JSON.stringify(res.body));
      assert.equal(res.body.importedCount, 3);
      assert.equal(res.body.skippedDuplicateCount, 0);
      assert.equal(res.body.totalAmount, '1250.80');

      const stored = await pool.query(
        `SELECT amount_centavos::text AS centavos, source, source_row, created_by, vendor, reference
         FROM expenses WHERE import_batch_id = $1 ORDER BY source_row`,
        [res.body.importBatchId]
      );
      assert.deepEqual(stored.rows.map(r => [r.centavos, r.source, r.source_row, r.created_by]), [
        ['125050', 'import', 2, 'usr-sam'],
        ['10', 'import', 3, 'usr-sam'],
        ['20', 'import', 4, 'usr-sam'],
      ]);
      assert.equal(stored.rows[0].vendor, 'Office Depot');
      assert.equal(stored.rows[1].reference, null);

      const batch = (await pool.query('SELECT * FROM import_batches WHERE id = $1', [res.body.importBatchId])).rows[0];
      assert.equal(batch.source_filename, 'september.csv');
      assert.equal(batch.row_count, 3);
      assert.equal(batch.imported_count, 3);
      assert.match(batch.content_digest, /^[0-9a-f]{64}$/);

      // Another member sees who imported, when, and how much.
      const history = await api('alex', 'GET', `${ORG_1}/activity?entityId=${res.body.importBatchId}`);
      assert.equal(history.body.events.length, 1);
      assert.equal(history.body.events[0].action, 'import');
      assert.equal(history.body.events[0].actorName, 'Sam Taylor');
      assert.deepEqual(history.body.events[0].metadata, {
        filename: 'september.csv',
        importedCount: 3,
        skippedDuplicateCount: 0,
        totalAmount: '1250.80',
      });
    });
  });

  describe('Any invalid row blocks the whole batch', () => {
    const mixed = csv(
      '2026-09-03,10.00,Supplies,Valid row,,',
      '2026-13-03,10.00,Supplies,Bad month,,',
      '2026-09-03,1.999,Supplies,Too many decimals,,',
      `${manilaDate(2)},10.00,Supplies,Future date,,`,
      '2026-09-03,10.00,,Missing category,,',
      '2026-09-03,"1,000.00",Supplies,Thousands separator,,',
      '2026-09-04,25.00,Supplies,Second valid row,,'
    );

    test('preview lists row-level errors with spreadsheet row numbers', async () => {
      const res = await preview('sam', ORG_1, mixed);
      assert.equal(res.status, 200);
      assert.equal(res.body.rowCount, 7);
      assert.equal(res.body.invalidCount, 5);
      assert.equal(res.body.validCount, 2);
      assert.equal(res.body.canCommit, false);
      assert.deepEqual(res.body.rows.map(r => [r.rowNumber, r.status]), [
        [2, 'valid'], [3, 'invalid'], [4, 'invalid'], [5, 'invalid'], [6, 'invalid'], [7, 'invalid'], [8, 'valid'],
      ]);
      assert.match(res.body.rows[1].errors[0], /valid calendar date/);
      assert.match(res.body.rows[2].errors[0], /at most two decimals/);
      assert.match(res.body.rows[3].errors[0], /future/);
      assert.match(res.body.rows[4].errors[0], /Category/);
      // The invalid row echoes what the file contained so the member can find it.
      assert.equal(res.body.rows[5].amount, '1,000.00');
    });

    test('confirm is refused and writes nothing, including the valid rows', async () => {
      const before = await financeRowCounts();
      const res = await confirm('sam', ORG_1, mixed, CSV_MIME, '?duplicates=include');
      assert.equal(res.status, 400);
      assert.match(res.body.message, /5 row\(s\) are invalid/);
      assert.deepEqual(await financeRowCounts(), before);
    });
  });

  describe('Duplicate candidates', () => {
    let existing;

    before(async () => {
      existing = (await api('jordan', 'POST', `${ORG_2}/expenses`, expenseInput({
        occurredOn: '2026-08-10', amount: '50.00', category: 'Fuel', description: 'Diesel', reference: 'OR-7',
      }))).body;
      await api('jordan', 'POST', `${ORG_2}/expenses`, expenseInput({
        occurredOn: '2026-08-11', amount: '30.00', category: 'Fuel', description: 'No reference',
      }));
      const voided = (await api('jordan', 'POST', `${ORG_2}/expenses`, expenseInput({
        occurredOn: '2026-08-12', amount: '70.00', category: 'Fuel', description: 'Voided', reference: 'OR-9',
      }))).body;
      await api('jordan', 'POST', `${ORG_2}/expenses/${voided.id}/void`, { version: voided.version });
    });

    const file = csv(
      '2026-08-10,50.00,fuel,Other wording,Other vendor, or-7 ', // row 2: same date, amount, category, reference
      '2026-08-09,50.00,Fuel,Different date,,OR-7',              // row 3
      '2026-08-10,50.01,Fuel,Different amount,,OR-7',            // row 4
      '2026-08-10,50.00,Fuel additive,Different category,,OR-7', // row 5
      '2026-08-10,50.00,Fuel,Different reference,,OR-8',         // row 6
      '2026-08-10,50.00,Fuel,Blank reference,,',                 // row 7
      '2026-08-09,50.00,FUEL,Repeats row 3,,or-7',               // row 8: duplicate inside the file
      '2026-08-11,30.00,Fuel,Blank matches blank,,',             // row 9: stored expense has no reference
      '2026-08-12,70.00,Fuel,Matches only a void expense,,OR-9'  // row 10
    );

    test('a row is a duplicate only when date, amount, category, and reference all match', async () => {
      const res = await preview('jordan', ORG_2, file);
      assert.equal(res.status, 200);
      assert.deepEqual(res.body.rows.map(r => [r.rowNumber, r.status]), [
        [2, 'duplicate'], [3, 'valid'], [4, 'valid'], [5, 'valid'], [6, 'valid'], [7, 'valid'], [8, 'duplicate'], [9, 'duplicate'], [10, 'valid'],
      ]);
      assert.deepEqual(res.body.rows[0].duplicateOf, { kind: 'existing', expenseId: existing.id });
      assert.deepEqual(res.body.rows[6].duplicateOf, { kind: 'file', rowNumber: 3 });
      assert.equal(res.body.rows[7].duplicateOf.kind, 'existing');
      assert.equal(res.body.duplicateCount, 3);
      assert.equal(res.body.validCount, 6);
      assert.equal(res.body.duplicateAmount, '130.00');
      assert.equal(res.body.canCommit, true);
    });

    test('the same rows are not duplicates in another organization', async () => {
      const res = await preview('sam', ORG_3, file);
      assert.equal(res.body.rows.filter(r => r.duplicateOf?.kind === 'existing').length, 0);
      assert.equal(res.body.duplicateCount, 1); // only the in-file repeat
    });

    test('confirm without a duplicate choice is refused and writes nothing', async () => {
      const before = await financeRowCounts();
      const res = await confirm('jordan', ORG_2, file);
      assert.equal(res.status, 409);
      assert.deepEqual(await financeRowCounts(), before);
    });

    test('an unknown duplicate choice is rejected', async () => {
      assert.equal((await confirm('jordan', ORG_2, file, CSV_MIME, '?duplicates=maybe')).status, 400);
    });

    test('"skip" imports only the non-duplicate rows', async () => {
      const res = await confirm('jordan', ORG_2, file, CSV_MIME, '?duplicates=skip');
      assert.equal(res.status, 201, JSON.stringify(res.body));
      assert.equal(res.body.importedCount, 6);
      assert.equal(res.body.skippedDuplicateCount, 3);
      assert.equal(res.body.totalAmount, '320.01');

      const rows = await pool.query('SELECT source_row FROM expenses WHERE import_batch_id = $1 ORDER BY source_row', [res.body.importBatchId]);
      assert.deepEqual(rows.rows.map(r => r.source_row), [3, 4, 5, 6, 7, 10]);
    });

    test('"include" imports every row, duplicates too', async () => {
      const res = await confirm('sam', ORG_3, file, CSV_MIME, '?duplicates=include');
      assert.equal(res.status, 201);
      assert.equal(res.body.importedCount, 9);
      assert.equal(res.body.skippedDuplicateCount, 0);
    });

    test('importing the same file twice flags every row the second time', async () => {
      const again = await preview('sam', ORG_3, file);
      assert.equal(again.body.duplicateCount, 9);
      assert.equal(again.body.validCount, 0);
    });
  });

  describe('Confirm revalidates against data that changed after preview', () => {
    test('a duplicate that appears after preview blocks a confirm that carries no choice', async () => {
      const file = csv('2026-07-01,88.00,Late,Arrives twice,,LATE-1');
      const first = await preview('alex', ORG_1, file);
      assert.equal(first.body.duplicateCount, 0);

      // Another member records the same expense between preview and confirm.
      await api('sam', 'POST', `${ORG_1}/expenses`, expenseInput({
        occurredOn: '2026-07-01', amount: '88.00', category: 'Late', reference: 'LATE-1',
      }));

      const before = await financeRowCounts();
      const res = await confirm('alex', ORG_1, file);
      assert.equal(res.status, 409);
      assert.deepEqual(await financeRowCounts(), before);
    });

    test('a file edited after preview is judged on its confirmed contents', async () => {
      const previewed = csv('2026-07-02,10.00,Edited,Fine at preview,,');
      assert.equal((await preview('alex', ORG_1, previewed)).body.canCommit, true);

      const before = await financeRowCounts();
      const confirmed = csv('2026-07-02,-10.00,Edited,Changed before confirm,,');
      assert.equal((await confirm('alex', ORG_1, confirmed)).status, 400);
      assert.deepEqual(await financeRowCounts(), before);
    });
  });

  describe('Upload limits', () => {
    test('a body over 5 MiB is refused with HTTP 413 before parsing', async () => {
      const oversized = Buffer.concat([csv('2026-09-01,1.00,Big,Padding,,'), Buffer.alloc(MAX_UPLOAD_BYTES, 0x20)]);
      assert.ok(oversized.length > MAX_UPLOAD_BYTES);
      const before = await financeRowCounts();
      assert.equal((await preview('sam', ORG_1, oversized)).status, 413);
      assert.equal((await confirm('sam', ORG_1, oversized)).status, 413);
      assert.deepEqual(await financeRowCounts(), before);
    });

    test('exactly 5,000 data rows are accepted and committed atomically', async () => {
      const lines = Array.from({ length: MAX_DATA_ROWS }, (_, i) => `2026-06-15,0.01,Bulk,Row ${i + 1},,BULK-${i + 1}`);
      const file = csv(...lines);
      const previewed = await preview('sam', ORG_3, file);
      assert.equal(previewed.status, 200);
      assert.equal(previewed.body.rowCount, MAX_DATA_ROWS);
      assert.equal(previewed.body.totalAmount, '50.00');

      const res = await confirm('sam', ORG_3, file);
      assert.equal(res.status, 201);
      assert.equal(res.body.importedCount, MAX_DATA_ROWS);
      const listed = await api('sam', 'GET', `${ORG_3}/expenses?category=Bulk&limit=1`);
      assert.equal(listed.body.total, MAX_DATA_ROWS);
      assert.equal(listed.body.totalAmount, '50.00');
    });

    test('a CSV with 5,001 data rows is refused', async () => {
      const lines = Array.from({ length: MAX_DATA_ROWS + 1 }, (_, i) => `2026-06-16,0.01,Over,Row ${i + 1},,OVER-${i + 1}`);
      const res = await preview('sam', ORG_3, csv(...lines));
      assert.equal(res.status, 400);
      assert.match(res.body.message, /more than 5000 data rows/);
    });

    test('a workbook with 5,001 data rows is refused while parsing', async () => {
      const file = await xlsx(sheet => {
        for (let i = 0; i <= MAX_DATA_ROWS; i++) sheet.addRow([utc('2026-06-17'), 0.01, 'Over', `Row ${i + 1}`, '', `X-${i + 1}`]);
      });
      const res = await preview('sam', ORG_3, file, XLSX_MIME);
      assert.equal(res.status, 400);
      assert.match(res.body.message, /supported range of one header row and 5000 data rows/);
    });

    test('a sparse row beyond the supported worksheet range is refused before scanning gaps', async () => {
      const file = await xlsx(sheet => {
        const row = sheet.getRow(MAX_DATA_ROWS + 2);
        row.getCell(1).value = utc('2026-06-17');
        row.getCell(2).value = 0.01;
        row.getCell(3).value = 'Sparse';
        row.getCell(4).value = 'Beyond supported row span';
      });

      const res = await preview('sam', ORG_3, file, XLSX_MIME);
      assert.equal(res.status, 400);
      assert.match(res.body.message, /supported range of one header row and 5000 data rows/);
    });

    test('a small upload that inflates past the workbook size cap is refused before parsing', async () => {
      // 21 MiB of one repeated character compresses to a few kilobytes.
      const file = await xlsx(sheet => sheet.addRow([utc('2026-06-18'), 1, 'Bomb', 'x'.repeat(21 * 1024 * 1024), '', '']));
      assert.ok(file.length < MAX_UPLOAD_BYTES, `upload is ${file.length} bytes`);
      const res = await preview('sam', ORG_3, file, XLSX_MIME);
      assert.equal(res.status, 400);
      assert.match(res.body.message, /too large/);
    });

    test('forged size fields in the zip directory do not bypass the cap', async () => {
      const file = await xlsx(sheet => sheet.addRow([utc('2026-06-18'), 1, 'Bomb', 'x'.repeat(21 * 1024 * 1024), '', '']));
      // Overwrite every declared uncompressed size with a tiny value.
      const signature = Buffer.from([0x50, 0x4b, 0x01, 0x02]);
      for (let at = file.indexOf(signature); at !== -1; at = file.indexOf(signature, at + 4)) {
        file.writeUInt32LE(10, at + 24);
      }
      const res = await preview('sam', ORG_3, file, XLSX_MIME);
      assert.equal(res.status, 400);
    });
  });

  describe('XLSX workbooks', () => {
    test('date cells, numeric cells, and text cells import with exact amounts', async () => {
      const file = await xlsx((sheet, workbook) => {
        sheet.addRow([utc('2026-05-04'), 19.99, 'Tools', 'Hex keys', 'Ace', 'T-1']);
        sheet.addRow([utc('2026-05-05'), 1250.5, 'Tools', 'Drill', null, 1002]);
        sheet.addRow(['2026-05-06', '999999999.99', 'Tools', 'Text cells', '', '']);
        sheet.addRow([utc('2026-05-07'), 100, 'Tools', { richText: [{ text: 'Rich ' }, { text: 'text' }] }, '', '']);
        // Data on a second worksheet must be ignored.
        workbook.addWorksheet('Notes').addRow(['2026-05-08', 5, 'Ignored', 'Second sheet', '', '']);
      });

      const res = await preview('sam', ORG_1, file, XLSX_MIME, '?filename=tools.xlsx');
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.deepEqual(res.body.rows.map(r => [r.occurredOn, r.amount, r.description, r.reference, r.status]), [
        ['2026-05-04', '19.99', 'Hex keys', 'T-1', 'valid'],
        ['2026-05-05', '1250.50', 'Drill', '1002', 'valid'],
        ['2026-05-06', '999999999.99', 'Text cells', null, 'valid'],
        ['2026-05-07', '100.00', 'Rich text', null, 'valid'],
      ]);
      assert.equal(res.body.totalAmount, '1000001370.48');
    });

    test('formula cells in import fields make the row invalid', async () => {
      const file = await xlsx(sheet => {
        sheet.addRow([utc('2026-05-10'), { formula: '10+5', result: 15 }, 'Formulas', 'Amount formula', '', '']);
        sheet.addRow([utc('2026-05-10'), 20, 'Formulas', { formula: '"a"&"b"', result: 'ab' }, '', '']);
        sheet.addRow([{ formula: 'TODAY()', result: utc('2026-05-10') }, 20, 'Formulas', 'Date formula', '', '']);
        sheet.addRow([utc('2026-05-10'), 30, 'Formulas', 'Plain row', '', '']);
      });

      const res = await preview('sam', ORG_1, file, XLSX_MIME);
      assert.deepEqual(res.body.rows.map(r => r.status), ['invalid', 'invalid', 'invalid', 'valid']);
      assert.deepEqual(res.body.rows[0].errors, ['Amount contains a formula. Replace it with a plain value.']);
      assert.deepEqual(res.body.rows[1].errors, ['Description contains a formula. Replace it with a plain value.']);
      assert.deepEqual(res.body.rows[2].errors, ['Date contains a formula. Replace it with a plain value.']);
      assert.equal(res.body.canCommit, false);

      const before = await financeRowCounts();
      assert.equal((await confirm('sam', ORG_1, file, XLSX_MIME)).status, 400);
      assert.deepEqual(await financeRowCounts(), before);
    });

    test('a numeric cell holding a floating point artifact is rejected, not rounded', async () => {
      const file = await xlsx(sheet => sheet.addRow([utc('2026-05-11'), 0.1 + 0.2, 'Float', 'Artifact', '', '']));
      const res = await preview('sam', ORG_1, file, XLSX_MIME);
      assert.equal(res.body.rows[0].status, 'invalid');
      assert.match(res.body.rows[0].errors[0], /at most two decimals/);
    });
  });

  describe('Malformed and unsupported files', () => {
    const rejected = [
      ['random bytes sent as a workbook', Buffer.from('this is not a zip archive at all'), XLSX_MIME, 400, /not a readable \.xlsx/],
      ['an empty CSV', Buffer.from(''), CSV_MIME, 400, /empty/],
      ['a CSV without required columns', Buffer.from('Date,Category\n2026-09-01,Supplies'), CSV_MIME, 400, /missing required columns: Amount, Description/],
      ['a CSV with a repeated column', Buffer.from('Date,Amount,Amount,Category,Description\n2026-09-01,1,2,A,B'), CSV_MIME, 400, /more than one "Amount" column/],
      ['a CSV with an unterminated quote', Buffer.from(`${HEADER}\n2026-09-01,1.00,A,"never closed`), CSV_MIME, 400, /never closed/],
      ['a CSV that is not UTF-8', Buffer.from([0x44, 0x61, 0x74, 0x65, 0xff, 0xfe, 0xfd]), CSV_MIME, 400, /not valid UTF-8/],
      ['a PDF', Buffer.from('%PDF-1.7'), 'application/pdf', 415, null],
    ];

    for (const [label, buffer, type, status, message] of rejected) {
      test(`${label} is rejected with ${status}`, async () => {
        const before = await financeRowCounts();
        for (const send of [preview, confirm]) {
          const res = await send('sam', ORG_1, buffer, type);
          assert.equal(res.status, status, JSON.stringify(res.body));
          if (message) assert.match(res.body.message, message);
        }
        assert.deepEqual(await financeRowCounts(), before);
      });
    }

    test('a workbook sent as CSV is rejected', async () => {
      const file = await xlsx(sheet => sheet.addRow([utc('2026-05-12'), 1, 'A', 'B', '', '']));
      assert.equal((await preview('sam', ORG_1, file, CSV_MIME)).status, 400);
    });

    test('a JSON body is not accepted as an upload', async () => {
      const res = await api('sam', 'POST', `${ORG_1}/imports/preview`, { rows: [] });
      assert.equal(res.status, 415);
    });

    test('a header-only file previews as empty and cannot be confirmed', async () => {
      const res = await preview('sam', ORG_1, csv());
      assert.equal(res.status, 200);
      assert.equal(res.body.rowCount, 0);
      assert.equal(res.body.canCommit, false);
      assert.equal((await confirm('sam', ORG_1, csv())).status, 400);
    });
  });

  describe('CSV reading', () => {
    test('quotes, embedded commas and newlines, BOM, CRLF, blank lines, aliases, and extra columns', async () => {
      const text = [
        '﻿expense date,AMOUNT (PHP),Category,Details,Payee,Ref,Approved By',
        '2026-04-01,12.50,"Food, drinks","Said ""thanks""",Cafe,R-1,Len',
        '',
        '2026-04-02,7,Food,"Two',
        'lines",,,',
        ',,,,,,',
        '2026-04-03,3.5,Food,Last row without newline,,,',
      ].join('\r\n');

      const res = await preview('sam', ORG_1, Buffer.from(text, 'utf-8'));
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.deepEqual(res.body.ignoredColumns, ['Approved By']);
      assert.deepEqual(res.body.rows.map(r => [r.rowNumber, r.amount, r.category, r.description, r.vendor, r.reference]), [
        [2, '12.50', 'Food, drinks', 'Said "thanks"', 'Cafe', 'R-1'],
        [4, '7.00', 'Food', 'Two\r\nlines', null, null],
        [6, '3.50', 'Food', 'Last row without newline', null, null],
      ]);
    });

    test('formula-like text in a CSV is stored as literal text', async () => {
      const file = csv('2026-04-05,5.00,Literal,=HYPERLINK("http://example.com"),+1+1,@SUM(A1)');
      const res = await confirm('sam', ORG_1, file);
      assert.equal(res.status, 201);
      const row = (await pool.query('SELECT description, vendor, reference FROM expenses WHERE import_batch_id = $1', [res.body.importBatchId])).rows[0];
      assert.deepEqual(row, { description: '=HYPERLINK("http://example.com")', vendor: '+1+1', reference: '@SUM(A1)' });
    });

    test('a formula in the amount column of a CSV is an invalid amount', async () => {
      const res = await preview('sam', ORG_1, csv('2026-04-06,=1+1,Literal,Formula amount,,'));
      assert.equal(res.body.rows[0].status, 'invalid');
    });
  });

  describe('Access', () => {
    test('import routes are denied to non-members and unauthenticated callers', async () => {
      const file = csv('2026-09-01,1.00,Access,Row,,');
      assert.equal((await preview('jordan', ORG_1, file)).status, 403);
      assert.equal((await confirm('jordan', ORG_1, file)).status, 403);

      const anonymous = await app.inject({
        method: 'POST',
        url: `/api${ORG_1}/imports/confirm`,
        headers: { 'content-type': CSV_MIME },
        payload: file,
      });
      assert.equal(anonymous.statusCode, 401);
    });

    test('Owner, Lead, and Member can all import', async () => {
      for (const user of ['len', 'alex', 'sam']) {
        const res = await confirm(user, ORG_1, csv(`2026-03-01,1.00,Import access,By ${user},,ACC-${user}`));
        assert.equal(res.status, 201, user);
      }
    });
  });
});
