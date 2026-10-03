/**
 * Spreadsheet import dialog: choose a file, review every row, then confirm.
 * The chosen file stays selected through validation errors so the member never has to pick it again.
 * Requirements: FEAT-006/REQ-007, REQ-012; PROD-005/UI-REQ-012
 */

import { escapeHtml, formatPhp } from '../format.js';
import { openModal } from '../modal.js';
import { saveDownload } from '../finance-api.js';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_VALID_ROWS_SHOWN = 200;
const STATUS_LABELS = { valid: 'Ready', invalid: 'Problem', duplicate: 'Possible duplicate' };
const STATUS_BADGES = { valid: 'badge-active', invalid: 'badge-blocked', duplicate: 'badge-pending' };

function fileProblem(file) {
  if (!file) return 'Choose a .csv or .xlsx file first.';
  if (!/\.(csv|xlsx)$/i.test(file.name)) return 'Only .csv and .xlsx files can be imported.';
  if (file.size > MAX_UPLOAD_BYTES) return 'The file is larger than the 5 MiB upload limit.';
  if (file.size === 0) return 'The file is empty.';
  return null;
}

function duplicateNote(row) {
  if (!row.duplicateOf) return '';
  return row.duplicateOf.kind === 'file'
    ? `Same date, amount, category, and reference as row ${row.duplicateOf.rowNumber} of this file.`
    : 'Same date, amount, category, and reference as an expense already recorded.';
}

/** Problem and duplicate rows are always shown; a long run of ready rows is truncated. */
function rowsToShow(rows) {
  let validShown = 0;
  return rows.filter(row => row.status !== 'valid' || ++validShown <= MAX_VALID_ROWS_SHOWN);
}

function previewHtml(preview) {
  const shown = rowsToShow(preview.rows);
  const importable = preview.validCount + preview.duplicateCount;

  const blocked = preview.invalidCount > 0
    ? `<div class="alert-banner alert-danger" role="alert"><span><strong>${preview.invalidCount} row(s) have problems.</strong> Nothing can be imported until every row is valid. Correct the file, then choose it again.</span></div>`
    : '';
  const empty = preview.rowCount === 0
    ? '<div class="alert-banner alert-warning" role="alert"><span>The file has a header row but no expense rows.</span></div>'
    : '';
  const ignored = preview.ignoredColumns.length > 0
    ? `<p class="form-help-text">Ignored columns: ${escapeHtml(preview.ignoredColumns.join(', '))}.</p>`
    : '';

  const duplicateChoice = preview.canCommit && preview.duplicateCount > 0 ? `
    <fieldset class="finance-choice" id="import-duplicate-choice">
      <legend>${preview.duplicateCount} possible duplicate(s), ${escapeHtml(formatPhp(preview.duplicateAmount))}. Choose what to do with them:</legend>
      <label><input type="radio" name="import-duplicates" value="skip" /> Skip the possible duplicates</label>
      <label><input type="radio" name="import-duplicates" value="include" /> Import them anyway</label>
    </fieldset>
  ` : '';

  return `
    <p id="import-preview-summary"><strong>${escapeHtml(preview.filename)}</strong>:
      ${preview.rowCount} row(s), ${preview.validCount} ready, ${preview.duplicateCount} possible duplicate(s), ${preview.invalidCount} with problems.
      Total of valid rows: ${escapeHtml(formatPhp(preview.totalAmount))}.</p>
    ${blocked}${empty}${ignored}${duplicateChoice}
    ${preview.rowCount > 0 ? `
      <div class="table-responsive finance-preview-table">
        <table class="data-table" aria-label="Import preview, one line per spreadsheet row">
          <thead>
            <tr>
              <th scope="col">Row</th><th scope="col">Status</th><th scope="col">Date</th><th scope="col" class="finance-amount">Amount</th>
              <th scope="col">Category</th><th scope="col">Description</th><th scope="col">Vendor</th><th scope="col">Reference</th><th scope="col">Notes</th>
            </tr>
          </thead>
          <tbody>
            ${shown.map(row => `
              <tr data-import-status="${row.status}">
                <td>${row.rowNumber}</td>
                <td><span class="badge ${STATUS_BADGES[row.status]}">${STATUS_LABELS[row.status]}</span></td>
                <td>${escapeHtml(row.occurredOn)}</td>
                <td class="finance-amount">${escapeHtml(row.status === 'invalid' ? row.amount : formatPhp(row.amount))}</td>
                <td>${escapeHtml(row.category)}</td>
                <td>${escapeHtml(row.description)}</td>
                <td>${escapeHtml(row.vendor)}</td>
                <td>${escapeHtml(row.reference)}</td>
                <td>${escapeHtml([...row.errors, duplicateNote(row)].filter(Boolean).join(' '))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ${shown.length < preview.rows.length ? `<p class="form-help-text">Showing ${shown.length} of ${preview.rows.length} rows: every problem and possible duplicate, plus the first ${MAX_VALID_ROWS_SHOWN} ready rows.</p>` : ''}
    ` : ''}
    <p class="form-help-text">${preview.canCommit ? `Confirming imports up to ${importable} expense(s) in one step, or none if anything changed.` : ''}</p>
  `;
}

export function openImport({ api, onImported }) {
  let previewedFile = null;
  let preview = null;

  const modal = openModal({
    id: 'finance-import-modal',
    title: 'Import expenses from a spreadsheet',
    wide: true,
    bodyHtml: `
      <div data-import-alert aria-live="assertive"></div>
      <div class="form-group">
        <label for="import-file" class="form-label">Spreadsheet file (.csv or .xlsx) *</label>
        <input type="file" id="import-file" class="form-input" accept=".csv,.xlsx" data-autofocus aria-describedby="import-file-help" />
        <span class="form-help-text" id="import-file-help">
          Up to 5 MiB and 5,000 rows. The first row must name the columns Date, Amount, Category, and Description; Vendor and Reference are optional.
          Dates use YYYY-MM-DD or a date cell. Amounts are plain PHP numbers such as 1250.50. Formula cells are not accepted.
        </span>
      </div>
      <div style="display:flex; gap:var(--spacing-2); flex-wrap:wrap; margin-bottom:var(--spacing-4);">
        <button type="button" class="btn btn-primary btn-sm" id="btn-preview-import">Preview rows</button>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-download-template">Download template</button>
      </div>
      <div data-import-preview aria-live="polite"></div>
    `,
    footerHtml: `
      <button type="button" class="btn btn-secondary" data-modal-close id="btn-close-import">Close</button>
      <button type="button" class="btn btn-primary" id="btn-confirm-import" disabled>Confirm import</button>
    `,
  });

  const fileInput = modal.element.querySelector('#import-file');
  const alertBox = modal.element.querySelector('[data-import-alert]');
  const previewBox = modal.element.querySelector('[data-import-preview]');
  const previewButton = modal.element.querySelector('#btn-preview-import');
  const confirmButton = modal.element.querySelector('#btn-confirm-import');

  function showAlert(kind, message) {
    alertBox.innerHTML = message
      ? `<div class="alert-banner alert-${kind}" role="alert"><span>${escapeHtml(message)}</span></div>`
      : '';
  }

  function chosenDuplicateAction() {
    return modal.element.querySelector('input[name="import-duplicates"]:checked')?.value;
  }

  function refreshConfirmButton() {
    const needsChoice = preview?.duplicateCount > 0;
    confirmButton.disabled = !preview?.canCommit || (needsChoice && !chosenDuplicateAction());
  }

  function clearPreview() {
    preview = null;
    previewedFile = null;
    previewBox.innerHTML = '';
    refreshConfirmButton();
  }

  async function runPreview() {
    const file = fileInput.files[0];
    const problem = fileProblem(file);
    if (problem) {
      clearPreview();
      showAlert('danger', problem);
      return;
    }

    previewButton.disabled = true;
    previewBox.innerHTML = '<p class="form-help-text">Checking every row…</p>';
    try {
      preview = await api.previewImport(file);
      previewedFile = file;
      previewBox.innerHTML = previewHtml(preview);
      previewBox.querySelectorAll('input[name="import-duplicates"]').forEach(radio => radio.addEventListener('change', refreshConfirmButton));
    } catch (error) {
      clearPreview();
      showAlert('danger', error.message);
    } finally {
      previewButton.disabled = false;
      refreshConfirmButton();
    }
  }

  async function runConfirm() {
    confirmButton.disabled = true;
    try {
      const result = await api.confirmImport(previewedFile, chosenDuplicateAction());
      const skipped = result.skippedDuplicateCount > 0 ? ` ${result.skippedDuplicateCount} possible duplicate(s) were skipped.` : '';
      previewBox.innerHTML = '';
      fileInput.value = '';
      preview = null;
      showAlert('success', `Imported ${result.importedCount} expense(s) totalling ${formatPhp(result.totalAmount)}.${skipped}`);
      modal.element.querySelector('#btn-close-import').focus();
      onImported(result);
    } catch (error) {
      showAlert('danger', error.message);
      // The records changed since the preview: show the member the current state of the same file.
      if (error.isConflict) await runPreview();
    } finally {
      refreshConfirmButton();
    }
  }

  fileInput.addEventListener('change', () => {
    clearPreview();
    showAlert('', '');
  });
  previewButton.addEventListener('click', () => {
    showAlert('', '');
    runPreview();
  });
  confirmButton.addEventListener('click', runConfirm);
  modal.element.querySelector('#btn-download-template').addEventListener('click', async () => {
    try {
      saveDownload(await api.downloadTemplate());
    } catch (error) {
      showAlert('danger', error.message);
    }
  });
}
