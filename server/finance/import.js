/**
 * Expense import use cases (FEAT-006/REQ-007).
 * Preview stores nothing. Confirm receives the same file again and repeats every check
 * inside the committing transaction, so a preview that has gone stale can never be committed.
 */

import { createHash } from 'node:crypto';
import { getPool, withTransaction } from '../../db/client.js';
import { formatAmount } from './money.js';
import { manilaToday, normalizeExpense } from './validation.js';
import { readImportRows } from './spreadsheet.js';
import { httpError, requireFinanceAccess } from './service.js';
import * as repository from './repository.js';

const DUPLICATE_CHOICES = ['skip', 'include'];

const FIELD_LABELS = {
  occurredOn: 'Date',
  amount: 'Amount',
  category: 'Category',
  description: 'Description',
  vendor: 'Vendor',
  reference: 'Reference',
};

/**
 * Two expenses are duplicate candidates when date, centavo amount, category, and reference match;
 * category and reference compare case-insensitively and a blank reference matches only a blank one.
 */
function duplicateKey({ occurredOn, amountCentavos, category, reference }) {
  return [occurredOn, String(amountCentavos), category.toLowerCase(), (reference ?? '').trim().toLowerCase()].join('\u0000');
}

/** Validates one raw row; a formula cell is reported once, in place of the field's own error. */
function checkRow(rawRow, today) {
  const { value: expense, errors } = normalizeExpense(rawRow.input, today);
  const formulaErrors = rawRow.formulaFields.map(field => ({
    field,
    message: `${FIELD_LABELS[field]} contains a formula. Replace it with a plain value.`,
  }));
  const otherErrors = errors.filter(error => !rawRow.formulaFields.includes(error.field));
  return { rowNumber: rawRow.rowNumber, input: rawRow.input, expense, errors: [...formulaErrors, ...otherErrors], duplicateOf: null };
}

/** Marks valid rows that match a stored non-void expense or an earlier row of the same file. */
async function markDuplicates(db, orgId, rows) {
  const validRows = rows.filter(row => row.errors.length === 0);
  const dates = [...new Set(validRows.map(row => row.expense.occurredOn))];
  const stored = dates.length > 0 ? await repository.listExpensesOnDates(db, orgId, dates) : [];

  const storedIdByKey = new Map(stored.map(expense => [duplicateKey(expense), expense.id]));
  const firstRowByKey = new Map();
  for (const row of validRows) {
    const key = duplicateKey(row.expense);
    if (storedIdByKey.has(key)) {
      row.duplicateOf = { kind: 'existing', expenseId: storedIdByKey.get(key) };
    } else if (firstRowByKey.has(key)) {
      row.duplicateOf = { kind: 'file', rowNumber: firstRowByKey.get(key) };
    } else {
      firstRowByKey.set(key, row.rowNumber);
    }
  }
}

async function analyzeFile(db, orgId, file) {
  if (!Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
    throw httpError(400, 'The uploaded file is empty.');
  }
  const { rows: rawRows, ignoredColumns } = await readImportRows(file.buffer, file.contentType);
  const today = manilaToday();
  const rows = rawRows.map(rawRow => checkRow(rawRow, today));
  await markDuplicates(db, orgId, rows);

  return {
    rows,
    ignoredColumns,
    invalidCount: rows.filter(row => row.errors.length > 0).length,
    duplicateCount: rows.filter(row => row.duplicateOf !== null).length,
  };
}

function rowStatus(row) {
  if (row.errors.length > 0) return 'invalid';
  return row.duplicateOf ? 'duplicate' : 'valid';
}

/** Valid rows show their normalized values; invalid rows echo what the file contained. */
function previewRow(row) {
  const isValid = row.errors.length === 0;
  const text = field => String(row.input[field] ?? '').trim();
  return {
    rowNumber: row.rowNumber,
    status: rowStatus(row),
    occurredOn: isValid ? row.expense.occurredOn : text('occurredOn'),
    amount: isValid ? formatAmount(row.expense.amountCentavos) : text('amount'),
    category: isValid ? row.expense.category : text('category'),
    description: isValid ? row.expense.description : text('description'),
    vendor: isValid ? row.expense.vendor : text('vendor'),
    reference: isValid ? row.expense.reference : text('reference'),
    errors: row.errors.map(error => error.message),
    duplicateOf: row.duplicateOf,
  };
}

function sumCentavos(rows) {
  return rows.reduce((total, row) => total + BigInt(row.expense.amountCentavos), 0n);
}

export async function previewImport(orgId, file, caller, customPool = null) {
  const db = customPool ?? getPool();
  await requireFinanceAccess(db, caller, orgId, customPool);

  const analysis = await analyzeFile(db, orgId, file);
  const validRows = analysis.rows.filter(row => row.errors.length === 0);

  return {
    filename: file.filename,
    rowCount: analysis.rows.length,
    validCount: validRows.length - analysis.duplicateCount,
    invalidCount: analysis.invalidCount,
    duplicateCount: analysis.duplicateCount,
    totalAmount: formatAmount(sumCentavos(validRows)),
    duplicateAmount: formatAmount(sumCentavos(validRows.filter(row => row.duplicateOf !== null))),
    ignoredColumns: analysis.ignoredColumns,
    canCommit: analysis.rows.length > 0 && analysis.invalidCount === 0,
    rows: analysis.rows.map(previewRow),
  };
}

/**
 * Imports every accepted row in one transaction, or nothing.
 * `duplicateChoice` is 'skip' or 'include' and is required whenever duplicate candidates exist.
 */
export async function confirmImport(orgId, file, duplicateChoice, caller, customPool = null) {
  const db = customPool ?? getPool();
  await requireFinanceAccess(db, caller, orgId, customPool);

  if (duplicateChoice !== undefined && !DUPLICATE_CHOICES.includes(duplicateChoice)) {
    throw httpError(400, 'The duplicate choice must be "skip" or "include".');
  }

  return withTransaction(async (tx) => {
    await repository.lockImports(tx, orgId);
    const analysis = await analyzeFile(tx, orgId, file);

    if (analysis.rows.length === 0) {
      throw httpError(400, 'The file has no data rows to import.');
    }
    if (analysis.invalidCount > 0) {
      throw httpError(400, `Import blocked: ${analysis.invalidCount} row(s) are invalid, so nothing was imported. Preview the file to see each error.`);
    }
    if (analysis.duplicateCount > 0 && duplicateChoice === undefined) {
      throw httpError(409, 'Possible duplicates were found since the preview. Preview the file again and choose to skip or include them.');
    }

    const acceptedRows = analysis.rows.filter(row => row.duplicateOf === null || duplicateChoice === 'include');
    const skippedDuplicateCount = analysis.rows.length - acceptedRows.length;

    const importBatchId = await repository.insertImportBatch(tx, orgId, caller.id, {
      filename: file.filename,
      contentDigest: createHash('sha256').update(file.buffer).digest('hex'),
      rowCount: analysis.rows.length,
      importedCount: acceptedRows.length,
      skippedDuplicateCount,
    });
    for (const row of acceptedRows) {
      await repository.insertExpense(tx, orgId, row.expense, caller.id, { importBatchId, sourceRow: row.rowNumber });
    }

    const totalAmount = formatAmount(sumCentavos(acceptedRows));
    await repository.insertActivity(tx, orgId, caller.id, {
      entityType: 'import_batch',
      entityId: importBatchId,
      action: 'import',
      metadata: { filename: file.filename, importedCount: acceptedRows.length, skippedDuplicateCount, totalAmount },
    });

    return { importBatchId, importedCount: acceptedRows.length, skippedDuplicateCount, totalAmount };
  }, customPool);
}
