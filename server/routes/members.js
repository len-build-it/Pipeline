import {
  listMembers,
  getMember,
  updateMembership,
  createInvitation,
  resendInvitation,
  listInvitations,
  updateUserProfile,
} from '../members/service.js';

export async function memberRoutes(fastify, options) {
  const pool = options.pool || null;

  // GET /api/organizations/:orgId/members
  fastify.get('/organizations/:orgId/members', {
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['orgId'],
        properties: {
          orgId: { type: 'string' },
        },
      },
      querystring: {
        type: 'object',
        properties: {
          search: { type: 'string' },
          role: { type: 'string' },
          status: { type: 'string' },
          page: { type: 'string' },
          limit: { type: 'string' },
        },
      },
    },
  }, async (request) => {
    const { orgId } = request.params;
    return listMembers(orgId, request.query, request.user, pool);
  });

  // GET /api/organizations/:orgId/members/:membershipId
  fastify.get('/organizations/:orgId/members/:membershipId', {
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['orgId', 'membershipId'],
        properties: {
          orgId: { type: 'string' },
          membershipId: { type: 'string' },
        },
      },
    },
  }, async (request) => {
    const { orgId, membershipId } = request.params;
    return getMember(orgId, membershipId, request.user, pool);
  });

  // PATCH /api/organizations/:orgId/members/:membershipId
  fastify.patch('/organizations/:orgId/members/:membershipId', {
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['orgId', 'membershipId'],
        properties: {
          orgId: { type: 'string' },
          membershipId: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        properties: {
          role: { type: 'string', enum: ['Lead', 'Member'] },
          status: { type: 'string', enum: ['active', 'inactive'] },
          notes: { type: 'string' },
        },
      },
    },
  }, async (request) => {
    const { orgId, membershipId } = request.params;
    return updateMembership(orgId, membershipId, request.body, request.user, pool);
  });

  // GET /api/organizations/:orgId/invitations
  fastify.get('/organizations/:orgId/invitations', {
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['orgId'],
        properties: {
          orgId: { type: 'string' },
        },
      },
    },
  }, async (request) => {
    const { orgId } = request.params;
    const invitations = await listInvitations(orgId, request.user, pool);
    return { invitations };
  });

  // POST /api/organizations/:orgId/invitations
  fastify.post('/organizations/:orgId/invitations', {
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['orgId'],
        properties: {
          orgId: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', minLength: 3, maxLength: 254 },
          role: { type: 'string', enum: ['Lead', 'Member'] },
        },
      },
    },
  }, async (request) => {
    const { orgId } = request.params;
    return createInvitation(orgId, request.body, request.user, {}, pool);
  });

  // POST /api/organizations/:orgId/invitations/:invitationId/resend
  fastify.post('/organizations/:orgId/invitations/:invitationId/resend', {
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['orgId', 'invitationId'],
        properties: {
          orgId: { type: 'string' },
          invitationId: { type: 'string' },
        },
      },
    },
  }, async (request) => {
    const { orgId, invitationId } = request.params;
    return resendInvitation(orgId, invitationId, request.user, {}, pool);
  });

  // PATCH /api/users/profile
  fastify.patch('/users/profile', {
    preHandler: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        properties: {
          displayName: { type: 'string', minLength: 1, maxLength: 100 },
          avatarColor: { type: 'string' },
          skills: { type: 'array', items: { type: 'string' } },
          interests: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  }, async (request) => {
    const user = await updateUserProfile(request.user.id, request.body, request.user, pool);
    return { user };
  });
}
