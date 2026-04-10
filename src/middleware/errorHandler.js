// ─────────────────────────────────────────────────────────────
// Global Error Handler Middleware
// ─────────────────────────────────────────────────────────────
// WHY: Without a centralized error handler, every route must
// catch its own errors and format responses — leading to
// inconsistent error formats across your API:
//   Route A: { error: "not found" }
//   Route B: { message: "Not found", code: 404 }
//   Route C: Raw stack trace in production 🚨
//
// With this handler, ALL errors have a consistent format:
//   {
//     error: "Not Found",
//     message: "User with id 123 not found",
//     requestId: "abc-123"
//   }
//
// It also:
//   - Logs errors with context (requestId, path, method)
//   - Hides stack traces in production (security)
//   - Distinguishes operational errors (bad input) from bugs
// ─────────────────────────────────────────────────────────────

const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');

/**
 * Express error-handling middleware (must have 4 parameters).
 */
function errorHandler(err, req, res, _next) {
  // Default to 500 if no status code is set
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let errorName = err.name || 'Error';

  // If it's not an operational error (our custom errors), it's a bug
  const isOperational = err instanceof AppError && err.isOperational;

  if (!isOperational) {
    // Unexpected error — log the full stack for debugging
    logger.error(
      {
        err,
        stack: err.stack,
        requestId: req.id,
        method: req.method,
        path: req.originalUrl,
      },
      'Unhandled error'
    );

    // Don't leak internal error details in production
    if (process.env.NODE_ENV === 'production') {
      message = 'An unexpected error occurred';
      errorName = 'InternalServerError';
    }
  } else {
    // Operational error — log at warn level (expected behavior)
    logger.warn(
      {
        statusCode,
        message,
        requestId: req.id,
        method: req.method,
        path: req.originalUrl,
      },
      `Operational error: ${message}`
    );
  }

  // Send consistent error response
  res.status(statusCode).json({
    error: errorName,
    message,
    statusCode,
    requestId: req.id,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
}

/**
 * Catch 404 for routes that don't match any service.
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} not found`,
    statusCode: 404,
    requestId: req.id,
  });
}

module.exports = { errorHandler, notFoundHandler };
