import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyJwt from '@fastify/jwt';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { config as defaultConfig } from './config.js';
import { authRoutes } from './auth/routes.js';
import { organizationRoutes } from './routes/organizations.js';
import { memberRoutes } from './routes/members.js';
import { query } from '../db/client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function buildApp({ customPool = null, customConfig = {}, logger = false } = {}) {
  const appConfig = { ...defaultConfig, ...customConfig };

  const fastify = Fastify({
    logger: logger ? {
      level: 'info',
      redact: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["x-csrf-token"]',
        'body.password',
        'body.token',
        'body.refreshToken',
        'body.password_hash',
      ],
    } : false,
  });

  fastify.decorate('config', appConfig);

  // 1. Plugins
  await fastify.register(fastifyCookie, {
    secret: appConfig.cookieSecret,
  });

  await fastify.register(fastifyJwt, {
    secret: appConfig.jwtSecret,
    sign: {
      expiresIn: appConfig.accessTokenExpiry,
    },
  });

  await fastify.register(fastifyRateLimit, {
    max: 200,
    timeWindow: '1 minute',
  });

  await fastify.register(fastifyStatic, {
    root: path.join(__dirname, '../web'),
    prefix: '/',
  });

  // 2. Authentication Decorator
  fastify.decorate('authenticate', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      const error = new Error('Authentication required.');
      error.statusCode = 401;
      throw error;
    }

    const payload = request.user;
    const q = customPool ? (t, p) => customPool.query(t, p) : query;

    // Check session validity in database
    if (payload.sessionId) {
      const sessionRes = await q(
        'SELECT id, revoked_at, expires_at FROM sessions WHERE id = $1',
        [payload.sessionId]
      );
      if (sessionRes.rows.length === 0 || sessionRes.rows[0].revoked_at !== null || new Date(sessionRes.rows[0].expires_at) < new Date()) {
        const error = new Error('Session has been revoked or has expired.');
        error.statusCode = 401;
        throw error;
      }
    }

    // Check user account status
    const userRes = await q(
      'SELECT id, email, display_name, status, is_owner FROM users WHERE id = $1',
      [payload.sub]
    );

    if (userRes.rows.length === 0 || userRes.rows[0].status !== 'active') {
      const error = new Error('Account is inactive.');
      error.statusCode = 403;
      throw error;
    }

    const dbUser = userRes.rows[0];
    request.user = {
      id: dbUser.id,
      email: dbUser.email,
      displayName: dbUser.display_name,
      status: dbUser.status,
      isOwner: Boolean(dbUser.is_owner),
      sessionId: payload.sessionId,
    };
  });

  // 3. Centralized Safe Error Handler
  fastify.setErrorHandler((error, request, reply) => {
    if (error.validation) {
      reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: error.message,
      });
      return;
    }

    const statusCode = error.statusCode || (reply.statusCode !== 200 ? reply.statusCode : 500);
    if (statusCode >= 500) {
      reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'An unexpected internal error occurred.',
      });
      return;
    }

    reply.status(statusCode).send({
      statusCode,
      error: error.name || 'Error',
      message: error.message,
    });
  });

  // 4. API Routes
  await fastify.register(authRoutes, { prefix: '/api/auth', pool: customPool });
  await fastify.register(organizationRoutes, { prefix: '/api', pool: customPool });
  await fastify.register(memberRoutes, { prefix: '/api', pool: customPool });

  // 5. Client SPA Fallback for HTML requests
  fastify.setNotFoundHandler((request, reply) => {
    if (request.raw.url && !request.raw.url.startsWith('/api')) {
      reply.sendFile('index.html');
    } else {
      reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Route not found.' });
    }
  });

  return fastify;
}
