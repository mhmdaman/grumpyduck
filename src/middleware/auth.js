// ─────────────────────────────────────────────────────────────
// JWT Authentication Middleware
// ─────────────────────────────────────────────────────────────
// WHY: Without centralized auth, EVERY microservice must
// independently verify tokens — duplicated code, inconsistent
// rules, and security gaps. The gateway verifies the JWT ONCE,
// strips bad requests at the edge, and forwards a trusted
// x-user-id / x-user-role header to downstream services.
//
// Flow:
//   1. Extract token from Authorization: Bearer <token>
//   2. Verify signature and expiry using the shared secret
//   3. Attach decoded user data to req.user
//   4. Forward user info as headers to backend services
//   5. If invalid → 401 Unauthorized (never reaches backend)
//
// Public paths (login, register) bypass this middleware.
// ─────────────────────────────────────────────────────────────

const jwt = require('jsonwebtoken');
const config = require('../config');
const { UnauthorizedError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Creates an auth middleware for a specific service.
 * @param {Object} serviceConfig - The service entry from services.js
 * @returns {Function} Express middleware
 */
function createAuthMiddleware(serviceConfig) {
  return (req, res, next) => {
    // Skip auth if the service doesn't require it
    if (!serviceConfig.auth) {
      return next();
    }

    // Check if this specific path is public
    if (isPublicPath(req, serviceConfig.publicPaths)) {
      return next();
    }

    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided. Use: Authorization: Bearer <token>');
    }

    const token = authHeader.split(' ')[1];

    try {
      // Verify the JWT signature and expiry
      const decoded = jwt.verify(token, config.jwt.secret);

      // Attach user data to the request
      req.user = decoded;

      // Forward user info as headers to backend services
      // This way, backend services trust these headers because
      // they ONLY come from the gateway (internal network)
      req.headers['x-user-id'] = decoded.id || decoded.sub;
      req.headers['x-user-role'] = decoded.role || 'user';
      req.headers['x-user-email'] = decoded.email || '';

      logger.debug(
        { userId: decoded.id, path: req.originalUrl },
        'Auth: token verified'
      );

      next();
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new UnauthorizedError('Token expired. Please login again.');
      }
      if (err.name === 'JsonWebTokenError') {
        throw new UnauthorizedError('Invalid token.');
      }
      throw new UnauthorizedError('Authentication failed.');
    }
  };
}

/**
 * Check if the current request matches a public path.
 * Public paths skip JWT verification.
 */
function isPublicPath(req, publicPaths) {
  if (!publicPaths || publicPaths.length === 0) return false;

  return publicPaths.some((pp) => {
    const methodMatch = !pp.method || pp.method === req.method;

    // Support simple wildcard matching for path params
    // e.g., /api/products/:id matches /api/products/123
    const pathPattern = pp.path.replace(/:[\w]+/g, '[^/]+');
    const pathRegex = new RegExp(`^${pathPattern}(/.*)?$`);
    const pathMatch = pathRegex.test(req.originalUrl.split('?')[0]); // Strip query params

    return methodMatch && pathMatch;
  });
}

module.exports = { createAuthMiddleware, isPublicPath };
