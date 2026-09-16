import {
  listTasks,
  getTask,
  createTask,
  updateTask,
  archiveTask,
  listComments,
  addComment,
  updateComment,
  deleteComment,
  getTaskActivity,
} from '../tasks/service.js';

export async function taskRoutes(fastify, options) {
  const pool = options.pool || null;

  // GET /api/organizations/:orgId/tasks
  fastify.get('/organizations/:orgId/tasks', {
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['orgId'],
        properties: { orgId: { type: 'string' } },
      },
      querystring: {
        type: 'object',
        properties: {
          search: { type: 'string' },
          status: { type: 'string' },
          priority: { type: 'string' },
          assignee: { type: 'string' },
          label: { type: 'string' },
          overdue: { type: 'string' },
          archived: { type: 'string' },
          page: { type: 'string' },
          limit: { type: 'string' },
        },
      },
    },
  }, async (request) => {
    return listTasks(request.params.orgId, request.query, request.user, pool);
  });

  // GET /api/organizations/:orgId/tasks/:taskId
  fastify.get('/organizations/:orgId/tasks/:taskId', {
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['orgId', 'taskId'],
        properties: {
          orgId: { type: 'string' },
          taskId: { type: 'string' },
        },
      },
    },
  }, async (request) => {
    return getTask(request.params.orgId, request.params.taskId, request.user, pool);
  });

  // POST /api/organizations/:orgId/tasks
  fastify.post('/organizations/:orgId/tasks', {
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['orgId'],
        properties: { orgId: { type: 'string' } },
      },
      body: {
        type: 'object',
        required: ['title'],
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 200 },
          description: { type: 'string' },
          assigneeId: { type: ['string', 'null'] },
          status: { type: 'string', enum: ['Backlog', 'In progress', 'Blocked', 'Done'] },
          priority: { type: 'string', enum: ['Low', 'Medium', 'High'] },
          dueDate: { type: ['string', 'null'] },
          labels: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  }, async (request) => {
    return createTask(request.params.orgId, request.body, request.user, pool);
  });

  // PATCH /api/organizations/:orgId/tasks/:taskId
  fastify.patch('/organizations/:orgId/tasks/:taskId', {
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['orgId', 'taskId'],
        properties: {
          orgId: { type: 'string' },
          taskId: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 200 },
          description: { type: 'string' },
          assigneeId: { type: ['string', 'null'] },
          status: { type: 'string', enum: ['Backlog', 'In progress', 'Blocked', 'Done'] },
          priority: { type: 'string', enum: ['Low', 'Medium', 'High'] },
          dueDate: { type: ['string', 'null'] },
          labels: { type: 'array', items: { type: 'string' } },
          version: { type: 'integer' },
        },
      },
    },
  }, async (request) => {
    return updateTask(request.params.orgId, request.params.taskId, request.body, request.user, pool);
  });

  // POST /api/organizations/:orgId/tasks/:taskId/archive
  fastify.post('/organizations/:orgId/tasks/:taskId/archive', {
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['orgId', 'taskId'],
        properties: {
          orgId: { type: 'string' },
          taskId: { type: 'string' },
        },
      },
    },
  }, async (request) => {
    return archiveTask(request.params.orgId, request.params.taskId, request.user, pool);
  });

  // GET /api/organizations/:orgId/tasks/:taskId/comments
  fastify.get('/organizations/:orgId/tasks/:taskId/comments', {
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['orgId', 'taskId'],
        properties: {
          orgId: { type: 'string' },
          taskId: { type: 'string' },
        },
      },
    },
  }, async (request) => {
    const comments = await listComments(request.params.orgId, request.params.taskId, request.user, pool);
    return { comments };
  });

  // POST /api/organizations/:orgId/tasks/:taskId/comments
  fastify.post('/organizations/:orgId/tasks/:taskId/comments', {
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['orgId', 'taskId'],
        properties: {
          orgId: { type: 'string' },
          taskId: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        required: ['body'],
        properties: {
          body: { type: 'string', minLength: 1, maxLength: 5000 },
        },
      },
    },
  }, async (request) => {
    return addComment(request.params.orgId, request.params.taskId, request.body, request.user, pool);
  });

  // PATCH /api/organizations/:orgId/tasks/:taskId/comments/:commentId
  fastify.patch('/organizations/:orgId/tasks/:taskId/comments/:commentId', {
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['orgId', 'taskId', 'commentId'],
        properties: {
          orgId: { type: 'string' },
          taskId: { type: 'string' },
          commentId: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        required: ['body'],
        properties: {
          body: { type: 'string', minLength: 1, maxLength: 5000 },
        },
      },
    },
  }, async (request) => {
    return updateComment(request.params.orgId, request.params.taskId, request.params.commentId, request.body, request.user, pool);
  });

  // DELETE /api/organizations/:orgId/tasks/:taskId/comments/:commentId
  fastify.delete('/organizations/:orgId/tasks/:taskId/comments/:commentId', {
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['orgId', 'taskId', 'commentId'],
        properties: {
          orgId: { type: 'string' },
          taskId: { type: 'string' },
          commentId: { type: 'string' },
        },
      },
    },
  }, async (request) => {
    return deleteComment(request.params.orgId, request.params.taskId, request.params.commentId, request.user, pool);
  });

  // GET /api/organizations/:orgId/tasks/:taskId/activity
  fastify.get('/organizations/:orgId/tasks/:taskId/activity', {
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['orgId', 'taskId'],
        properties: {
          orgId: { type: 'string' },
          taskId: { type: 'string' },
        },
      },
    },
  }, async (request) => {
    const activity = await getTaskActivity(request.params.orgId, request.params.taskId, request.user, pool);
    return { activity };
  });
}
