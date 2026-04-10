// ─────────────────────────────────────────────────────────────
// Correlation ID Middleware
// ─────────────────────────────────────────────────────────────
// WHY: When a single user request flows through Gateway → User
// Service → Order Service → Payment Service, you need ONE ID
// that ties all the logs together. Otherwise, debugging is:
//   "Something failed at 14:32:05" → good luck finding it in
//   4 different services each producing thousands of logs/sec.
//
// With correlation IDs:
//   grep "abc-123-def" across ALL service logs → instant trace.
//
// The client can also send X-Request-ID, which we'll preserve.
// ─────────────────────────────────────────────────────────────

const { v4: uuidv4 } = require('uuid');

function requestIdMiddleware(req, res, next) {
  // Use client-provided ID or generate a new one
  const requestId = req.headers['x-request-id'] || uuidv4();

  // Attach to request for downstream use
  req.id = requestId;

  // Set on response headers so the client can reference it
  res.setHeader('X-Request-ID', requestId);

  next();
}

module.exports = requestIdMiddleware;
