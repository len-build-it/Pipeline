import {
  listBudgets,
  createBudget,
  updateBudget,
  listExpenses,
  getExpense,
  createExpense,
  updateExpense,
  voidExpense,
  listCategories,
  listActivity,
  httpError,
} from '../finance/service.js';
import { previewImport, confirmImport } from '../finance/import.js';
import { exportExpenses, importTemplate } from '../finance/export.js';
import { budgetReport } from '../finance/analytics.js';
import { CSV_MIME, XLSX_MIME, MAX_UPLOAD_BYTES } from '../finance/spreadsheet.js';

const UPLOAD_TYPES = [CSV_MIME, XLSX_MIME];

/** The uploaded spreadsheet: the raw request body plus its declared type and display name. */
function uploadedFile(request) {
  const contentType = String(request.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
  if (!UPLOAD_TYPES.includes(contentType)) {
    throw httpError(415, 'Upload a .csv or .xlsx file.');
  }
  const filename = String(request.query.filename ?? '').replace(/[\\/\u0000-\u001f]/g, '').trim().slice(0, 200);
  return { buffer: request.body, contentType, filename: filename || 'upload' };
}

function sendWorkbook(reply, { filename, buffer }) {
  reply
    .header('Content-Type', XLSX_MIME)
    .header('Content-Disposition', `attachment; filename="${filename}"`)
    .header('Cache-Control', 'no-store');
  return buffer;
}

// Amounts cross the API as decimal strings, never as JSON numbers.
const amount = { type: 'string', maxLength: 20 };
const optionalText = { type: ['string', 'null'], maxLength: 500 };
const version = { type: 'integer' };

const orgParams = {
  type: 'object',
  required: ['orgId'],
  properties: { orgId: { type: 'string' } },
};

function recordParams(idName) {
  return {
    type: 'object',
    required: ['orgId', idName],
    properties: { orgId: { type: 'string' }, [idName]: { type: 'string' } },
  };
}

const expenseProperties = {
  occurredOn: { type: 'string', maxLength: 10 },
  amount,
  category: { type: 'string', maxLength: 200 },
  description: { type: 'string', maxLength: 2000 },
  vendor: optionalText,
  reference: optionalText,
};

export async function financeRoutes(fastify, options) {
  const pool = options.pool || null;
  const base = '/organizations/:orgId/finance';
  const preHandler = [fastify.authenticate];

  fastify.get(`${base}/budgets`, {
    preHandler,
    schema: {
      params: orgParams,
      querystring: { type: 'object', properties: { month: { type: 'string' } } },
    },
  }, async (request) => listBudgets(request.params.orgId, request.query, request.user, pool));

  fastify.post(`${base}/budgets`, {
    preHandler,
    schema: {
      params: orgParams,
      body: {
        type: 'object',
        required: ['month', 'category', 'amount'],
        properties: { month: { type: 'string', maxLength: 7 }, category: { type: 'string', maxLength: 200 }, amount },
      },
    },
  }, async (request, reply) => {
    reply.code(201);
    return createBudget(request.params.orgId, request.body, request.user, pool);
  });

  fastify.patch(`${base}/budgets/:budgetId`, {
    preHandler,
    schema: {
      params: recordParams('budgetId'),
      body: { type: 'object', required: ['amount', 'version'], properties: { amount, version } },
    },
  }, async (request) => updateBudget(request.params.orgId, request.params.budgetId, request.body, request.user, pool));

  fastify.get(`${base}/expenses`, {
    preHandler,
    schema: {
      params: orgParams,
      querystring: {
        type: 'object',
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
          category: { type: 'string' },
          includeVoided: { type: 'string' },
          page: { type: 'string' },
          limit: { type: 'string' },
        },
      },
    },
  }, async (request) => listExpenses(request.params.orgId, request.query, request.user, pool));

  fastify.get(`${base}/expenses/:expenseId`, {
    preHandler,
    schema: { params: recordParams('expenseId') },
  }, async (request) => getExpense(request.params.orgId, request.params.expenseId, request.user, pool));

  fastify.post(`${base}/expenses`, {
    preHandler,
    schema: {
      params: orgParams,
      body: {
        type: 'object',
        required: ['occurredOn', 'amount', 'category', 'description'],
        properties: expenseProperties,
      },
    },
  }, async (request, reply) => {
    reply.code(201);
    return createExpense(request.params.orgId, request.body, request.user, pool);
  });

  fastify.patch(`${base}/expenses/:expenseId`, {
    preHandler,
    schema: {
      params: recordParams('expenseId'),
      body: { type: 'object', required: ['version'], properties: { ...expenseProperties, version } },
    },
  }, async (request) => updateExpense(request.params.orgId, request.params.expenseId, request.body, request.user, pool));

  fastify.post(`${base}/expenses/:expenseId/void`, {
    preHandler,
    schema: {
      params: recordParams('expenseId'),
      body: { type: 'object', required: ['version'], properties: { version } },
    },
  }, async (request) => voidExpense(request.params.orgId, request.params.expenseId, request.body, request.user, pool));

  // Spreadsheet files arrive as the raw request body; no multipart parser is involved.
  fastify.addContentTypeParser(UPLOAD_TYPES, { parseAs: 'buffer' }, (request, body, done) => done(null, body));

  const uploadOptions = {
    preHandler,
    bodyLimit: MAX_UPLOAD_BYTES,
    schema: {
      params: orgParams,
      querystring: {
        type: 'object',
        properties: {
          filename: { type: 'string', maxLength: 400 },
          duplicates: { type: 'string', enum: ['skip', 'include'] },
        },
      },
    },
  };

  fastify.post(`${base}/imports/preview`, uploadOptions, async (request) =>
    previewImport(request.params.orgId, uploadedFile(request), request.user, pool));

  fastify.post(`${base}/imports/confirm`, uploadOptions, async (request, reply) => {
    const result = await confirmImport(request.params.orgId, uploadedFile(request), request.query.duplicates, request.user, pool);
    reply.code(201);
    return result;
  });

  fastify.get(`${base}/import-template.xlsx`, {
    preHandler,
    schema: { params: orgParams },
  }, async (request, reply) => sendWorkbook(reply, await importTemplate(request.params.orgId, request.user, pool)));

  fastify.get(`${base}/export.xlsx`, {
    preHandler,
    schema: {
      params: orgParams,
      querystring: {
        type: 'object',
        properties: { from: { type: 'string' }, to: { type: 'string' }, category: { type: 'string' } },
      },
    },
  }, async (request, reply) => sendWorkbook(reply, await exportExpenses(request.params.orgId, request.query, request.user, pool)));

  fastify.get(`${base}/report`, {
    preHandler,
    schema: {
      params: orgParams,
      querystring: {
        type: 'object',
        properties: { month: { type: 'string' }, trendMonths: { type: 'string' } },
      },
    },
  }, async (request) => budgetReport(request.params.orgId, request.query, request.user, pool));

  fastify.get(`${base}/categories`, {
    preHandler,
    schema: { params: orgParams },
  }, async (request) => listCategories(request.params.orgId, request.user, pool));

  fastify.get(`${base}/activity`, {
    preHandler,
    schema: {
      params: orgParams,
      querystring: {
        type: 'object',
        properties: { entityId: { type: 'string' }, page: { type: 'string' }, limit: { type: 'string' } },
      },
    },
  }, async (request) => listActivity(request.params.orgId, request.query, request.user, pool));
}
