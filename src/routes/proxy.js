// ─────────────────────────────────────────────────────────────
// Dynamic Proxy Route Builder
// ─────────────────────────────────────────────────────────────
// WHY: Instead of manually writing a route for each service,
// this module READS the service registry and GENERATES routes
// automatically. When you add a new service to services.js,
// a new proxy route is created without changing any other code.
//
// For each service, it stacks middleware in this order:
//   1. Metrics        → Record request count/latency
//   2. Rate limiter   → Reject if over budget
//   3. Auth           → Verify JWT token
//   4. Transformer    → Add gateway headers
//   5. Proxy          → Forward to backend service
// ─────────────────────────────────────────────────────────────

const express = require('express');
const { services } = require('../config/services');
const { createAuthMiddleware } = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimiter');
const { requestTransformer } = require('../middleware/transformer');
const { createProxy } = require('../services/proxyService');
const { metricsMiddleware } = require('../utils/metrics');
const logger = require('../utils/logger');

const { createCircuitBreaker } = require('../services/circuitBreaker');

const router = express.Router();

/**
 * Register proxy routes for each service in the registry.
 */
function registerProxyRoutes() {
  services.forEach((serviceConfig) => {
    const { name, pathPrefix, rateLimit: rateLimitConfig, circuitBreaker: cbConfig } = serviceConfig;

    logger.info(
      { service: name, pathPrefix, target: serviceConfig.target },
      `Registering proxy route: ${pathPrefix} → ${serviceConfig.target}`
    );

    // 1. Create a Circuit Breaker for this specific service
    // We wrap an empty async function because the proxy handling
    // is stream-based, but we use the breaker to track state.
    const breaker = createCircuitBreaker(name, async () => true, cbConfig);

    // Create middleware stack for this service
    const middlewareStack = [
      // 1. Record metrics for this service
      metricsMiddleware(name),

      // 2. Apply per-service rate limit
      createRateLimiter(rateLimitConfig, name),

      // 3. Circuit Breaker Sentinel
      // If the circuit is OPEN, reject the request instantly (fail-fast)
      (req, res, next) => {
        if (breaker.opened) {
          logger.warn({ service: name }, 'Circuit is OPEN, failing fast');
          return next(new ServiceUnavailableError(`${name} is currently unavailable (Circuit Open)`));
        }
        next();
      },

      // 4. Authenticate (skipped for public paths)
      createAuthMiddleware(serviceConfig),

      // 5. Transform request (add headers, clean up)
      requestTransformer,

      // 6. Proxy to backend service
      createProxy(serviceConfig),
    ];

    // Mount all middleware on the path prefix
    // The `**` means "match this path and anything after it"
    router.use(pathPrefix, ...middlewareStack);
  });

  return router;
}

module.exports = { registerProxyRoutes };
