import {
  listAnnouncements,
  getAnnouncement,
  createAnnouncement,
  updateAnnouncement,
  publishAnnouncement,
  archiveAnnouncement,
  getAnnouncementActivity,
} from '../announcements/service.js';

export async function announcementRoutes(fastify, options) {
  const pool = options.pool || null;

  // GET /api/announcements
  fastify.get('/announcements', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          scope: { type: 'string' },
          search: { type: 'string' },
          archived: { type: 'string' },
          status: { type: 'string' },
          page: { type: 'string' },
          limit: { type: 'string' },
        },
      },
    },
  }, async (request) => {
    return listAnnouncements(request.user, request.query, pool);
  });

  // GET /api/announcements/:announcementId
  fastify.get('/announcements/:announcementId', {
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['announcementId'],
        properties: { announcementId: { type: 'string' } },
      },
    },
  }, async (request) => {
    return getAnnouncement(request.params.announcementId, request.user, pool);
  });

  // POST /api/announcements
  fastify.post('/announcements', {
    preHandler: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['title', 'body', 'targetOrganizations'],
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 160 },
          body: { type: 'string', minLength: 1, maxLength: 10000 },
          targetOrganizations: { type: 'array', items: { type: 'string' } },
          publish: { type: 'boolean' },
        },
      },
    },
  }, async (request) => {
    return createAnnouncement(request.body, request.user, pool);
  });

  // PATCH /api/announcements/:announcementId
  fastify.patch('/announcements/:announcementId', {
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['announcementId'],
        properties: { announcementId: { type: 'string' } },
      },
      body: {
        type: 'object',
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 160 },
          body: { type: 'string', minLength: 1, maxLength: 10000 },
          targetOrganizations: { type: 'array', items: { type: 'string' } },
          updatedAt: { type: 'string' },
        },
      },
    },
  }, async (request) => {
    return updateAnnouncement(request.params.announcementId, request.body, request.user, pool);
  });

  // POST /api/announcements/:announcementId/publish
  fastify.post('/announcements/:announcementId/publish', {
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['announcementId'],
        properties: { announcementId: { type: 'string' } },
      },
    },
  }, async (request) => {
    return publishAnnouncement(request.params.announcementId, request.user, pool);
  });

  // POST /api/announcements/:announcementId/archive
  fastify.post('/announcements/:announcementId/archive', {
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['announcementId'],
        properties: { announcementId: { type: 'string' } },
      },
    },
  }, async (request) => {
    return archiveAnnouncement(request.params.announcementId, request.user, pool);
  });

  // GET /api/announcements/:announcementId/activity
  fastify.get('/announcements/:announcementId/activity', {
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['announcementId'],
        properties: { announcementId: { type: 'string' } },
      },
    },
  }, async (request) => {
    const activity = await getAnnouncementActivity(request.params.announcementId, request.user, pool);
    return { activity };
  });
}
