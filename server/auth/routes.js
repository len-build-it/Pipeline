import { login, rotateRefreshToken, revokeSession, getUserOrganizations, acceptInvitation } from './service.js';
import { generateRandomToken, sha256Digest } from './crypto.js';
import { query } from '../../db/client.js';

export async function authRoutes(fastify, options) {
  const pool = options.pool || null;

  // POST /api/auth/login
  fastify.post('/login', {
    config: {
      rateLimit: {
        max: fastify.config?.nodeEnv === 'test' ? 1000 : 10,
        timeWindow: '1 minute',
      },
    },
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', minLength: 3, maxLength: 254 },
          password: { type: 'string', minLength: 1, maxLength: 128 },
        },
      },
    },
  }, async (request, reply) => {
    const { email, password } = request.body;
    const ip = request.ip;
    const userAgent = request.headers['user-agent'] || '';

    const { user, sessionId, refreshToken, expiresAt } = await login(
      email,
      password,
      { userAgent, ip },
      pool
    );

    const accessToken = fastify.jwt.sign({
      sub: user.id,
      email: user.email,
      isOwner: user.isOwner,
      sessionId,
    });

    const csrfToken = generateRandomToken(16);

    // Set refresh token cookie (for web client)
    reply.setCookie('refreshToken', refreshToken, {
      path: '/api/auth',
      httpOnly: true,
      secure: fastify.config.isProd,
      sameSite: 'strict',
      expires: expiresAt,
    });

    reply.setCookie('sessionId', sessionId, {
      path: '/api/auth',
      httpOnly: true,
      secure: fastify.config.isProd,
      sameSite: 'strict',
      expires: expiresAt,
    });

    reply.setCookie('csrfToken', csrfToken, {
      path: '/',
      httpOnly: false, // Accessible by JS to send in X-CSRF-Token header
      secure: fastify.config.isProd,
      sameSite: 'strict',
      expires: expiresAt,
    });

    const organizations = await getUserOrganizations(user.id, user.isOwner, pool);

    return {
      user,
      accessToken,
      refreshToken, // Also returned in JSON for mobile native client
      sessionId,
      csrfToken,
      organizations,
    };
  });

  // POST /api/auth/refresh
  fastify.post('/refresh', {
    config: {
      rateLimit: {
        max: fastify.config?.nodeEnv === 'test' ? 1000 : 30,
        timeWindow: '1 minute',
      },
    },
  }, async (request, reply) => {
    // 1. Resolve token & session from either body (mobile) or cookies (web)
    const bodyToken = request.body?.refreshToken;
    const bodySessionId = request.body?.sessionId;
    const cookieToken = request.cookies.refreshToken;
    const cookieSessionId = request.cookies.sessionId;

    const tokenToUse = bodyToken || cookieToken;
    const sessionToUse = bodySessionId || cookieSessionId;

    if (!tokenToUse || !sessionToUse) {
      reply.code(401);
      return { statusCode: 401, error: 'Unauthorized', message: 'No refresh token or session provided.' };
    }

    // 2. If cookie-based, verify CSRF
    if (cookieToken && !bodyToken) {
      const csrfCookie = request.cookies.csrfToken;
      const csrfHeader = request.headers['x-csrf-token'];
      if (!csrfHeader || csrfHeader !== csrfCookie) {
        reply.code(403);
        return { statusCode: 403, error: 'Forbidden', message: 'Invalid or missing CSRF token.' };
      }
    }

    const { user, sessionId, newRefreshToken } = await rotateRefreshToken(sessionToUse, tokenToUse, pool);

    const newAccessToken = fastify.jwt.sign({
      sub: user.id,
      email: user.email,
      isOwner: user.isOwner,
      sessionId,
    });

    const newCsrfToken = generateRandomToken(16);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    reply.setCookie('refreshToken', newRefreshToken, {
      path: '/api/auth',
      httpOnly: true,
      secure: fastify.config.isProd,
      sameSite: 'strict',
      expires: expiresAt,
    });

    reply.setCookie('csrfToken', newCsrfToken, {
      path: '/',
      httpOnly: false,
      secure: fastify.config.isProd,
      sameSite: 'strict',
      expires: expiresAt,
    });

    return {
      user,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      sessionId,
      csrfToken: newCsrfToken,
    };
  });

  // POST /api/auth/logout
  fastify.post('/logout', async (request, reply) => {
    const sessionId = request.body?.sessionId || request.cookies.sessionId;
    if (sessionId) {
      await revokeSession(sessionId, pool);
    }

    reply.clearCookie('refreshToken', { path: '/api/auth' });
    reply.clearCookie('sessionId', { path: '/api/auth' });
    reply.clearCookie('csrfToken', { path: '/' });

    return { success: true };
  });

  // GET /api/auth/me
  fastify.get('/me', {
    preHandler: [fastify.authenticate],
  }, async (request) => {
    const organizations = await getUserOrganizations(request.user.id, request.user.isOwner, pool);
    return {
      user: request.user,
      organizations,
    };
  });

  // GET /api/auth/invitation/:token
  fastify.get('/invitation/:token', async (request, reply) => {
    const { token } = request.params;
    const tokenDigest = sha256Digest(token);
    const q = pool ? (t, p) => pool.query(t, p) : query;

    const res = await q(
      `SELECT i.id, i.email, i.role, i.status, i.expires_at, o.name AS organization_name, o.id AS organization_id
       FROM invitations i
       JOIN organizations o ON i.organization_id = o.id
       WHERE i.token_digest = $1`,
      [tokenDigest]
    );

    if (res.rows.length === 0) {
      reply.code(404);
      return { statusCode: 404, error: 'Not Found', message: 'Invitation not found.' };
    }

    const inv = res.rows[0];
    const isExpired = new Date(inv.expires_at) < new Date();

    return {
      valid: inv.status === 'pending' && !isExpired,
      email: inv.email,
      organizationName: inv.organization_name,
      organizationId: inv.organization_id,
      role: inv.role,
      status: isExpired ? 'expired' : inv.status,
    };
  });

  // POST /api/auth/invitation/accept
  fastify.post('/invitation/accept', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute',
      },
    },
    schema: {
      body: {
        type: 'object',
        required: ['token', 'email'],
        properties: {
          token: { type: 'string' },
          email: { type: 'string', minLength: 3, maxLength: 254 },
          password: { type: 'string', minLength: 12, maxLength: 128 },
          displayName: { type: 'string', maxLength: 100 },
        },
      },
    },
  }, async (request) => {
    const result = await acceptInvitation(request.body, pool);
    return result;
  });
}
