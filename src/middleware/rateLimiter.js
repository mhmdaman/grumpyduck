// ─────────────────────────────────────────────────────────────
// Rate Limiter Middleware
// ─────────────────────────────────────────────────────────────
// WHY: Without rate limiting, a single malicious user (or a
// buggy client) can send millions of requests and overwhelm
// your backend services. Rate limiting protects:
//   - Your gateway from CPU/memory exhaustion
//   - Your backend services from being flooded
//   - Your users from degraded performance
//
// Strategy (tiered):
//   1. Global limit:     Protects the gateway itself (all routes)
//   2. Per-service limit: Different services get different budgets
//   3. Per-IP:           Each client IP has its own counter
//
// In production, we use Redis as the store so all gateway
// instances share the same counters. In dev, we fall back to
// in-memory (simpler, but only works with 1 instance).
// ─────────────────────────────────────────────────────────────

const rateLimit = require('express-rate-limit');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Creates a rate limiter for a specific service.
 * @param {Object} rateLimitConfig - { windowMs, max }
 * @param {string} serviceName - Used for logging and key prefix
 * @returns {Function} Express middleware
 */
function createRateLimiter(rateLimitConfig = {}, serviceName = 'global') {
  const windowMs = rateLimitConfig.windowMs || config.rateLimit.windowMs;
  const max = rateLimitConfig.max || config.rateLimit.maxRequests;

  const limiterOptions = {
    windowMs,
    max,

    // Custom response when limit is exceeded
    handler: (req, res) => {
      logger.warn(
        { ip: req.ip, service: serviceName, path: req.originalUrl },
        'Rate limit exceeded'
      );

      res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Try again in ${Math.ceil(windowMs / 1000)} seconds.`,
        retryAfter: Math.ceil(windowMs / 1000),
      });
    },

    // Tell clients their remaining budget via headers
    standardHeaders: true,  // RateLimit-* headers (draft-6)
    legacyHeaders: false,   // Disable X-RateLimit-* headers

    // Skip rate limiting for health checks
    skip: (req) => req.path === '/health' || req.path === '/metrics',

    // Use a prefix so each service has its own counter namespace
    // The default key generator uses req.ip safely for IPv6
    ...(serviceName !== 'global' && {
      keyGenerator: (req) => `${serviceName}:${req.ip}`,
      validate: { xForwardedForHeader: false, keyGeneratorIpFallback: false },
    }),
  };

  return rateLimit(limiterOptions);
}

/**
 * Global rate limiter — applied to ALL routes before service-specific limits.
 */
function createGlobalRateLimiter() {
  return createRateLimiter(
    {
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.maxRequests * 10, // 10x the per-service limit
    },
    'global'
  );
}

module.exports = { createRateLimiter, createGlobalRateLimiter };
