/**
 * Spreadsheet adapter for finance import and export (FEAT-006/REQ-007, REQ-008).
 * Knows file formats only: it turns CSV and XLSX bytes into raw text rows and turns
 * finance records into a workbook. Validation and money rules stay in the use cases.
 */

import { inflateRawSync } from 'node:zlib';
import ExcelJS from 'exceljs';

export const CSV_MIME = 'text/csv';
export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_DATA_ROWS = 5000;

// A 5,000-row sheet is a few MiB of XML at most; a workbook that inflates beyond this is refused unparsed.
const MAX_WORKBOOK_UNCOMPRESSED_BYTES = 20 * 1024 * 1024;

export const IMPORT_FIELDS = ['occurredOn', 'amount', 'category', 'description', 'vendor', 'reference'];
const REQUIRED_FIELDS = ['occurredOn', 'amount', 'category', 'description'];
const FIELD_LABELS = {
  occurredOn: 'Date',
  amount: 'Amount',
  category: 'Category',
  description: 'Description',
  vendor: 'Vendor',
  reference: 'Reference',
};
const HEADER_ALIASES = {
  occurredOn: ['date', 'occurred on', 'expense date'],
  amount: ['amount', 'amount (php)', 'amount php'],
  category: ['category'],
  description: ['description', 'details'],
  vendor: ['vendor', 'payee', 'supplier'],
  reference: ['reference', 'ref', 'reference no', 'receipt no'],
};

/** A problem with the file as a whole, as opposed to a problem with one row. */
export class ImportFileError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 400;
  }
}

// --- Reading ---

/**
 * Reads the first worksheet (or the CSV) into raw text rows.
 * Returns { ignoredColumns, rows: [{ rowNumber, input, formulaFields }] } where `input`
 * holds untrimmed text per import field and `formulaFields` lists fields that held a formula.
 * Throws ImportFileError for unreadable files, missing columns, or more than MAX_DATA_ROWS rows.
 */
export async function readImportRows(buffer, contentType) {
  const records = contentType === XLSX_MIME ? xlsxRecords(buffer) : csvRecords(buffer);

  let columns = null;
  const rows = [];
  for await (const record of records) {
    if (columns === null) {
      columns = mapHeader(record.cells.map(cell => cell.text));
      continue;
    }
    if (record.cells.every(cell => cell.text.trim() === '' && !cell.isFormula)) continue;

    if (rows.length === MAX_DATA_ROWS) {
      throw new ImportFileError(`The file has more than ${MAX_DATA_ROWS} data rows. Split it into smaller files.`);
    }
    rows.push(toImportRow(record, columns.indexByField));
  }

  if (columns === null) throw new ImportFileError('The file is empty. It needs a header row and at least one data row.');
  return { ignoredColumns: columns.ignored, rows };
}

function mapHeader(headerTexts) {
  const indexByField = {};
  const ignored = [];

  headerTexts.forEach((text, index) => {
    const name = text.trim().toLowerCase();
    if (name === '') return;
    const field = IMPORT_FIELDS.find(f => HEADER_ALIASES[f].includes(name));
    if (!field) {
      ignored.push(text.trim());
    } else if (indexByField[field] !== undefined) {
      throw new ImportFileError(`The header row has more than one "${FIELD_LABELS[field]}" column.`);
    } else {
      indexByField[field] = index;
    }
  });

  const missing = REQUIRED_FIELDS.filter(field => indexByField[field] === undefined);
  if (missing.length > 0) {
    throw new ImportFileError(
      `The header row is missing required columns: ${missing.map(f => FIELD_LABELS[f]).join(', ')}. ` +
      'Expected columns are Date, Amount, Category, Description, and optionally Vendor and Reference.'
    );
  }
  return { indexByField, ignored };
}

function toImportRow(record, indexByField) {
  const input = {};
  const formulaFields = [];
  for (const field of IMPORT_FIELDS) {
    const cell = record.cells[indexByField[field]];
    input[field] = cell ? cell.text : '';
    if (cell?.isFormula) formulaFields.push(field);
  }
  return { rowNumber: record.rowNumber, input, formulaFields };
}

// --- CSV ---

function* csvRecords(buffer) {
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    throw new ImportFileError('The CSV file is not valid UTF-8 text.');
  }
  if (text.includes('\u0000')) throw new ImportFileError('The file is not a CSV text file.');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  let rowNumber = 0;
  for (const fields of parseCsv(text)) {
    rowNumber++;
    yield { rowNumber, cells: fields.map(field => ({ text: field, isFormula: false })) };
  }
}

/** RFC 4180 records: comma separated, double-quoted fields, "" as an escaped quote. */
function* parseCsv(text) {
  let fields = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 2;
      } else if (char === '"') {
        inQuotes = false;
        i++;
      } else {
        field += char;
        i++;
      }
    } else if (char === '"' && field === '') {
      inQuotes = true;
      i++;
    } else if (char === ',') {
      fields.push(field);
      field = '';
      i++;
    } else if (char === '\n' || char === '\r') {
      fields.push(field);
      yield fields;
      fields = [];
      field = '';
      i += char === '\r' && text[i + 1] === '\n' ? 2 : 1;
    } else {
      field += char;
      i++;
    }
  }

  if (inQuotes) throw new ImportFileError('The CSV file has a quoted field that is never closed.');
  if (field !== '' || fields.length > 0) {
    fields.push(field);
    yield fields;
  }
}

// --- XLSX ---

async function* xlsxRecords(buffer) {
  assertWorkbookWithinSizeLimit(buffer);

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw new ImportFileError('The workbook could not be read. Save it as .xlsx or .csv and try again.');
  }

  const worksheet = workbook.worksheets[0]; // Only the first worksheet is read.
  if (!worksheet) throw new ImportFileError('The workbook has no worksheets.');

  for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.findRow(rowNumber);
    if (!row) continue;
    const cells = [];
    row.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
      cells[columnNumber - 1] = xlsxCell(cell);
    });
    yield { rowNumber, cells: Array.from(cells, cell => cell ?? { text: '', isFormula: false }) };
  }
}

function xlsxCell(cell) {
  const value = cell.value;
  if (value === null || value === undefined) return { text: '', isFormula: false };
  if (typeof value === 'object' && ('formula' in value || 'sharedFormula' in value)) {
    return { text: '', isFormula: true };
  }
  // Excel dates arrive as UTC midnight; the calendar date is the ISO date part.
  if (value instanceof Date) return { text: value.toISOString().slice(0, 10), isFormula: false };
  // The shortest decimal form of a numeric cell is what the sheet displays; it is never used in arithmetic.
  if (typeof value === 'number') return { text: String(value), isFormula: false };
  return { text: String(cell.text ?? ''), isFormula: false };
}

/**
 * Inflates every zip entry with a hard output cap before the workbook parser sees the file.
 * The cap applies to the bytes actually produced, so a workbook that expands far beyond its
 * upload size is refused no matter what sizes its headers declare.
 */
function assertWorkbookWithinSizeLimit(buffer) {
  const invalid = new ImportFileError('The file is not a readable .xlsx workbook.');
  const tooLarge = new ImportFileError('The workbook is too large to import. Keep only the expense rows and try again.');
  const END_OF_DIRECTORY = 0x06054b50;
  const DIRECTORY_ENTRY = 0x02014b50;
  const LOCAL_ENTRY = 0x04034b50;
  const STORED = 0;
  const DEFLATED = 8;

  let end = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === END_OF_DIRECTORY) {
      end = i;
      break;
    }
  }
  if (end < 0) throw invalid;

  const entryCount = buffer.readUInt16LE(end + 10);
  let directoryOffset = buffer.readUInt32LE(end + 16);
  let remainingBytes = MAX_WORKBOOK_UNCOMPRESSED_BYTES;

  for (let entry = 0; entry < entryCount; entry++) {
    if (directoryOffset + 46 > buffer.length || buffer.readUInt32LE(directoryOffset) !== DIRECTORY_ENTRY) throw invalid;
    const method = buffer.readUInt16LE(directoryOffset + 10);
    const compressedSize = buffer.readUInt32LE(directoryOffset + 20);
    const localOffset = buffer.readUInt32LE(directoryOffset + 42);
    directoryOffset += 46
      + buffer.readUInt16LE(directoryOffset + 28)
      + buffer.readUInt16LE(directoryOffset + 30)
      + buffer.readUInt16LE(directoryOffset + 32);

    if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== LOCAL_ENTRY) throw invalid;
    const dataStart = localOffset + 30 + buffer.readUInt16LE(localOffset + 26) + buffer.readUInt16LE(localOffset + 28);
    const data = buffer.subarray(dataStart, dataStart + compressedSize);
    if (data.length !== compressedSize) throw invalid;

    if (method === STORED) {
      remainingBytes -= data.length;
    } else if (method === DEFLATED) {
      try {
        remainingBytes -= inflateRawSync(data, { maxOutputLength: Math.max(remainingBytes, 1) }).length;
      } catch (error) {
        throw error.code === 'ERR_BUFFER_TOO_LARGE' ? tooLarge : invalid;
      }
    } else {
      throw invalid;
    }
    if (remainingBytes < 0) throw tooLarge;
  }
}

// --- Writing ---

const AMOUNT_FORMAT = '#,##0.00';
const DATE_FORMAT = 'yyyy-mm-dd';

/** Integer centavos as the nearest double to the exact peso value, for numeric cells. */
function pesoNumber(centavos) {
  return Number(BigInt(centavos)) / 100;
}

function utcDate(isoDate) {
  return new Date(`${isoDate}T00:00:00Z`);
}

/** Sets a cell to literal text, whatever the text looks like. */
function setText(cell, text) {
  cell.value = text === null || text === undefined ? '' : String(text);
  cell.numFmt = '@';
}

/**
 * Builds the accountant workbook: an "Expenses" detail sheet first (so the file can be
 * imported again) and a "Summary" sheet. All values are literal; no formulas are written.
 */
export async function buildExportWorkbook({ organizationName, filters, generatedAt, expenses, categoryTotals, monthTotals, totalCentavos }) {
  const workbook = new ExcelJS.Workbook();
  workbook.created = generatedAt;

  const detail = workbook.addWorksheet('Expenses');
  detail.columns = [
    { header: 'Date', width: 12 },
    { header: 'Category', width: 24 },
    { header: 'Description', width: 44 },
    { header: 'Vendor', width: 24 },
    { header: 'Reference', width: 18 },
    { header: 'Amount', width: 16 },
    { header: 'Source', width: 10 },
    { header: 'Recorded by', width: 20 },
    { header: 'Last changed by', width: 20 },
    { header: 'Last changed at', width: 26 },
    { header: 'Expense ID', width: 30 },
  ];
  detail.getRow(1).font = { bold: true };

  for (const expense of expenses) {
    const row = detail.addRow([]);
    row.getCell(1).value = utcDate(expense.occurredOn);
    row.getCell(1).numFmt = DATE_FORMAT;
    setText(row.getCell(2), expense.category);
    setText(row.getCell(3), expense.description);
    setText(row.getCell(4), expense.vendor);
    setText(row.getCell(5), expense.reference);
    row.getCell(6).value = pesoNumber(expense.amountCentavos);
    row.getCell(6).numFmt = AMOUNT_FORMAT;
    setText(row.getCell(7), expense.source);
    setText(row.getCell(8), expense.createdByName);
    setText(row.getCell(9), expense.updatedByName);
    setText(row.getCell(10), new Date(expense.updatedAt).toISOString());
    setText(row.getCell(11), expense.id);
  }

  const summary = workbook.addWorksheet('Summary');
  summary.getColumn(1).width = 28;
  summary.getColumn(2).width = 36;
  summary.getColumn(3).width = 16;

  const addFact = (label, value) => {
    const row = summary.addRow([label]);
    row.getCell(1).font = { bold: true };
    setText(row.getCell(2), value);
  };
  addFact('Organization', organizationName);
  addFact('Currency', 'PHP');
  addFact('Period from', filters.from ?? 'Earliest record');
  addFact('Period to', filters.to ?? 'Latest record');
  addFact('Category filter', filters.category ?? 'All categories');
  addFact('Void expenses', 'Excluded');
  addFact('Generated at (Asia/Manila)', manilaTimestamp(generatedAt));
  addFact('Expense count', String(expenses.length));
  const totalRow = summary.addRow(['Total amount']);
  totalRow.getCell(1).font = { bold: true };
  totalRow.getCell(2).value = pesoNumber(totalCentavos);
  totalRow.getCell(2).numFmt = AMOUNT_FORMAT;

  const addBreakdown = (title, labelHeader, totals) => {
    summary.addRow([]);
    summary.addRow([title]).getCell(1).font = { bold: true };
    summary.addRow([labelHeader, 'Expenses', 'Amount']).font = { bold: true };
    for (const item of totals) {
      const row = summary.addRow([]);
      setText(row.getCell(1), item.label);
      row.getCell(2).value = item.count;
      row.getCell(3).value = pesoNumber(item.totalCentavos);
      row.getCell(3).numFmt = AMOUNT_FORMAT;
    }
  };
  addBreakdown('Totals by category', 'Category', categoryTotals);
  addBreakdown('Totals by month', 'Month', monthTotals);

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

/** An empty workbook with the import header row, as a starting point for members. */
export async function buildImportTemplate() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Expenses');
  sheet.columns = IMPORT_FIELDS.map(field => ({ header: FIELD_LABELS[field], width: field === 'description' ? 44 : 18 }));
  sheet.getRow(1).font = { bold: true };
  sheet.getColumn(1).numFmt = DATE_FORMAT;
  sheet.getColumn(2).numFmt = '0.00';
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function manilaTimestamp(date) {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Manila',
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(date);
  return `${parts.replace(' ', 'T')}+08:00`;
}
