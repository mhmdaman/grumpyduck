// ─────────────────────────────────────────────────────────────
// Request/Response Transformer Middleware
// ─────────────────────────────────────────────────────────────
// WHY: Sometimes the client sends data in one format but the
// backend service expects another. Or the backend response
// contains internal details you don't want to expose to clients.
//
// Examples:
//   - Strip internal headers before forwarding to backend
//   - Add gateway metadata headers
//   - Transform snake_case ↔ camelCase
//   - Inject tenant/org info from the JWT into the request
//
// This middleware runs BEFORE the request is proxied and
// can also transform the response coming BACK.
// ─────────────────────────────────────────────────────────────

const logger = require('../utils/logger');

/**
 * Request transformer — modifies the request before it's proxied.
 * Adds gateway metadata and cleans up headers.
 */
function requestTransformer(req, res, next) {
  // Add gateway metadata headers
  req.headers['x-gateway-timestamp'] = new Date().toISOString();
  req.headers['x-forwarded-for'] = req.ip || req.connection.remoteAddress;
  req.headers['x-request-id'] = req.id; // from requestId middleware

  // Remove headers that backend services shouldn't see
  delete req.headers['x-powered-by'];

  next();
}

/**
 * Creates a custom transformer for a specific service.
 * Use this when a service needs special header injection.
 *
 * @param {Function} transformFn - (req) => void — mutates req in place
 * @returns {Function} Express middleware
 *
 * @example
 *   const addTenant = createTransformer((req) => {
 *     req.headers['x-tenant-id'] = req.user?.tenantId || 'default';
 *   });
 */
function createTransformer(transformFn) {
  return (req, res, next) => {
    try {
      transformFn(req);
      next();
    } catch (err) {
      logger.error({ err: err.message }, 'Transform: failed to transform request');
      next(err);
    }
  };
}

module.exports = { requestTransformer, createTransformer };
