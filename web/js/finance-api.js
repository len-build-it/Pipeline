/**
 * HTTP adapter for the finance API (FEAT-006).
 * Finance is online-only: nothing is cached or queued, and a request made while
 * offline fails immediately with an explanation instead of pretending to succeed.
 */

export class FinanceApiError extends Error {
  constructor(message, { status = 0, offline = false } = {}) {
    super(message);
    this.status = status;
    this.offline = offline;
  }

  get isConflict() { return this.status === 409; }
  get isDenied() { return this.status === 403; }
  get isSessionExpired() { return this.status === 401; }
}

const OFFLINE_MESSAGE = 'You are offline. Finance needs a connection, so nothing was saved. Reconnect and try again.';

function queryString(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '' && value !== false) search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

export function createFinanceApi(state, orgId) {
  const base = `/api/organizations/${encodeURIComponent(orgId)}/finance`;

  async function request(path, { method = 'GET', headers = {}, body } = {}) {
    if (navigator.onLine === false) throw new FinanceApiError(OFFLINE_MESSAGE, { offline: true });

    let response;
    try {
      response = await fetch(`${base}${path}`, {
        method,
        headers: { Authorization: `Bearer ${state.token}`, ...headers },
        body,
      });
    } catch {
      throw new FinanceApiError(OFFLINE_MESSAGE, { offline: true });
    }

    if (!response.ok) {
      const problem = await response.json().catch(() => ({}));
      const fallback = response.status === 413
        ? 'The file is larger than the 5 MiB upload limit.'
        : `The request failed (${response.status}).`;
      throw new FinanceApiError(problem.message || fallback, { status: response.status });
    }
    return response;
  }

  const getJson = async (path, params) => (await request(`${path}${queryString(params)}`)).json();

  const sendJson = async (method, path, payload) => (await request(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })).json();

  /** The spreadsheet is sent as the raw request body with its own content type. */
  const sendFile = async (path, file, params) => (await request(`${path}${queryString({ filename: file.name, ...params })}`, {
    method: 'POST',
    headers: { 'Content-Type': uploadContentType(file) },
    body: file,
  })).json();

  async function download(path, params) {
    const response = await request(`${path}${queryString(params)}`);
    const disposition = response.headers.get('Content-Disposition') || '';
    const filename = /filename="([^"]+)"/.exec(disposition)?.[1] || 'download.xlsx';
    return { filename, blob: await response.blob() };
  }

  return {
    listBudgets: (month) => getJson('/budgets', { month }),
    createBudget: (budget) => sendJson('POST', '/budgets', budget),
    updateBudget: (id, change) => sendJson('PATCH', `/budgets/${encodeURIComponent(id)}`, change),
    listExpenses: (filters) => getJson('/expenses', filters),
    getExpense: (id) => getJson(`/expenses/${encodeURIComponent(id)}`),
    createExpense: (expense) => sendJson('POST', '/expenses', expense),
    updateExpense: (id, change) => sendJson('PATCH', `/expenses/${encodeURIComponent(id)}`, change),
    voidExpense: (id, version) => sendJson('POST', `/expenses/${encodeURIComponent(id)}/void`, { version }),
    listCategories: () => getJson('/categories'),
    listActivity: (params) => getJson('/activity', params),
    previewImport: (file) => sendFile('/imports/preview', file),
    confirmImport: (file, duplicates) => sendFile('/imports/confirm', file, { duplicates }),
    downloadExport: (filters) => download('/export.xlsx', filters),
    downloadTemplate: () => download('/import-template.xlsx'),
  };
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Browsers report CSV types inconsistently, so the extension decides between the two accepted types. */
function uploadContentType(file) {
  return file.name.toLowerCase().endsWith('.xlsx') ? XLSX_MIME : 'text/csv';
}

/** Hands a downloaded file to the browser's native save flow. */
export function saveDownload({ filename, blob }) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
