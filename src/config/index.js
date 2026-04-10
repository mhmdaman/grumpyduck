// ─────────────────────────────────────────────────────────────
// Config Loader
// ─────────────────────────────────────────────────────────────
// WHY: Centralizes ALL configuration in one place. Every module
// imports config from here instead of reading process.env directly.
// This makes it easy to validate, override, and document config.
// ─────────────────────────────────────────────────────────────

require('dotenv').config();

const config = {
  name: process.env.GATEWAY_NAME || 'grumpyduck',
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 8000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: (process.env.NODE_ENV || 'development') === 'development',

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
    expiry: process.env.JWT_EXPIRY || '1h',
  },

  // Redis
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  // Rate Limiting (global defaults)
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  },

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
};

module.exports = config;
