export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '127.0.0.1',
  databaseUrl: process.env.DATABASE_URL || 'postgres://postgres@127.0.0.1:5433/pipeline_dev',
  jwtSecret: process.env.JWT_SECRET || 'dev-jwt-secret-do-not-use-in-production-min-32-chars-long',
  cookieSecret: process.env.COOKIE_SECRET || 'dev-cookie-secret-min-32-chars-long-do-not-use-in-production',
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  sessionExpiryDays: 7,
  accessTokenExpiry: '15m',
};
