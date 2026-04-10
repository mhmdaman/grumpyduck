// ─────────────────────────────────────────────────────────────
// Custom Error Classes
// ─────────────────────────────────────────────────────────────
// WHY: Different errors need different HTTP status codes and
// different handling. By creating custom error classes, our
// error handler middleware can inspect the error type and
// respond with the correct status code automatically.
//
// Without this, you'd have status codes scattered everywhere:
//   res.status(401).json(...)  ← duplicated in 20 places
//
// With this, you throw once and the error handler does the rest:
//   throw new UnauthorizedError('Invalid token');
// ─────────────────────────────────────────────────────────────

class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational; // operational = expected error (bad input, auth fail)
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

class BadRequestError extends AppError {
  constructor(message = 'Bad Request') {
    super(message, 400);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Not Found') {
    super(message, 404);
  }
}

class TooManyRequestsError extends AppError {
  constructor(message = 'Too Many Requests') {
    super(message, 429);
  }
}

class ServiceUnavailableError extends AppError {
  constructor(message = 'Service Unavailable') {
    super(message, 503);
  }
}

module.exports = {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  TooManyRequestsError,
  ServiceUnavailableError,
};
