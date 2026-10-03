import {
  listBudgets,
  createBudget,
  updateBudget,
  listExpenses,
  createExpense,
  updateExpense,
  voidExpense,
  listCategories,
  listActivity,
} from '../finance/service.js';

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
