// ─────────────────────────────────────────────────────────────
// Proxy Service
// ─────────────────────────────────────────────────────────────
// WHY: This is the core of the gateway — it creates the reverse
// proxy that forwards client requests to backend services.
//
// It combines:
//   - http-proxy-middleware:  Does the actual HTTP proxying
//   - Circuit breaker:        Wraps the proxy for resilience
//   - Error handling:         Catches proxy errors gracefully
//
// For each service in the registry, we create a proxy middleware
// that listens on pathPrefix and forwards to target.
//
// Example:
//   Client → GET /api/users/123
//   Proxy  → GET http://localhost:3001/api/users/123
// ─────────────────────────────────────────────────────────────

const { createProxyMiddleware } = require('http-proxy-middleware');
const logger = require('../utils/logger');
const { ServiceUnavailableError } = require('../utils/errors');

/**
 * Creates an http-proxy-middleware instance for a service.
 *
 * @param {Object} serviceConfig - Service entry from services.js
 * @returns {Function} Express middleware that proxies requests
 */
function createProxy(serviceConfig) {
  const { name, target, pathPrefix, timeout } = serviceConfig;

  const proxyMiddleware = createProxyMiddleware({
    target,
    changeOrigin: true, // Sets the Host header to the target URL
    timeout: timeout || 10000,
    proxyTimeout: timeout || 10000,

    // When Express strips the pathPrefix (because we mount via
    // router.use('/api/users', proxy)), the proxy sees req.url = '/'
    // instead of '/api/users'. pathRewrite restores the full path
    // so the backend receives the correct URL.
    pathRewrite: (path, req) => req.originalUrl,

    // ─── Logging ──────────────────────────────────────────────
    on: {
      proxyReq: (proxyReq, req, _res) => {
        // Forward the correlation ID to the backend
        if (req.id) {
          proxyReq.setHeader('X-Request-ID', req.id);
        }

        // FIX: Re-stream the parsed body
        // If express.json() was used, req.body exists but the stream is consumed.
        // We must manually write it back for the backend to see it.
        if (req.body && Object.keys(req.body).length > 0) {
          const bodyData = JSON.stringify(req.body);
          proxyReq.setHeader('Content-Type', 'application/json');
          proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
          proxyReq.write(bodyData);
        }

        logger.info(
          {
            service: name,
            method: req.method,
            originalUrl: req.originalUrl,
            target: `${target}${req.originalUrl}`,
            requestId: req.id,
          },
          `Proxy → ${name}`
        );
      },

      proxyRes: (proxyRes, req, _res) => {
        logger.info(
          {
            service: name,
            method: req.method,
            path: req.originalUrl,
            statusCode: proxyRes.statusCode,
            requestId: req.id,
          },
          `Proxy ← ${name} responded ${proxyRes.statusCode}`
        );
      },

      error: (err, req, res) => {
        logger.error(
          {
            service: name,
            method: req.method,
            path: req.originalUrl,
            error: err.message,
            code: err.code,
            requestId: req.id,
          },
          `Proxy error → ${name}`
        );

        // Don't crash — send a meaningful error response
        if (!res.headersSent) {
          const statusCode = err.code === 'ECONNREFUSED' ? 503 : 502;
          res.status(statusCode).json({
            error: statusCode === 503 ? 'Service Unavailable' : 'Bad Gateway',
            message: `${name} is currently unavailable`,
            service: name,
            requestId: req.id,
          });
        }
      },
    },
  });

  return proxyMiddleware;
}

module.exports = { createProxy };
