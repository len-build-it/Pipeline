export const DEVELOPMENT_JWT_SECRET = 'dev-jwt-secret-do-not-use-in-production-min-32-chars-long';

export function assertRuntimeConfig(appConfig) {
  if (appConfig.isProd !== true && appConfig.nodeEnv !== 'production') return;

  const secret = appConfig.jwtSecret;
  if (typeof secret !== 'string' || secret.length < 32 || secret === DEVELOPMENT_JWT_SECRET) {
    throw new Error('Production requires a unique JWT_SECRET with at least 32 characters.');
  }
}

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '127.0.0.1',
  databaseUrl: process.env.DATABASE_URL || 'postgres://postgres@127.0.0.1:5433/pipeline_dev',
  jwtSecret: process.env.JWT_SECRET || DEVELOPMENT_JWT_SECRET,
  cookieSecret: process.env.COOKIE_SECRET || 'dev-cookie-secret-min-32-chars-long-do-not-use-in-production',
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  sessionExpiryDays: 7,
  accessTokenExpiry: '15m',
  // Requests allowed per client address per minute, static assets included.
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '200', 10),
};
