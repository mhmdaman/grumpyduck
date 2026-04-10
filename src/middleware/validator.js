// ─────────────────────────────────────────────────────────────
// Request Validator Middleware
// ─────────────────────────────────────────────────────────────
// WHY: Validating requests at the gateway edge means malformed
// data NEVER reaches your backend services. This provides:
//   - Defense in depth (even if a service has a validation bug)
//   - Faster feedback (400 error returned instantly, not after
//     the request travels through 3 services)
//   - Reduced load on backend services (reject garbage early)
//
// We use Zod because it gives great error messages and works
// well with TypeScript if you migrate later.
// ─────────────────────────────────────────────────────────────

const { z } = require('zod');
const { BadRequestError } = require('../utils/errors');

/**
 * Creates a validation middleware for a given Zod schema.
 * Validates req.body, req.query, and req.params against schema parts.
 *
 * @param {Object} schema - { body?: ZodSchema, query?: ZodSchema, params?: ZodSchema }
 * @returns {Function} Express middleware
 *
 * @example
 *   const schema = {
 *     body: z.object({
 *       email: z.string().email(),
 *       password: z.string().min(8),
 *     }),
 *   };
 *   app.post('/api/users/register', validate(schema), proxyMiddleware);
 */
function validate(schema) {
  return (req, res, next) => {
    const errors = [];

    // Validate request body
    if (schema.body) {
      const result = schema.body.safeParse(req.body);
      if (!result.success) {
        errors.push(
          ...result.error.issues.map((issue) => ({
            field: `body.${issue.path.join('.')}`,
            message: issue.message,
          }))
        );
      }
    }

    // Validate query parameters
    if (schema.query) {
      const result = schema.query.safeParse(req.query);
      if (!result.success) {
        errors.push(
          ...result.error.issues.map((issue) => ({
            field: `query.${issue.path.join('.')}`,
            message: issue.message,
          }))
        );
      }
    }

    // Validate URL parameters
    if (schema.params) {
      const result = schema.params.safeParse(req.params);
      if (!result.success) {
        errors.push(
          ...result.error.issues.map((issue) => ({
            field: `params.${issue.path.join('.')}`,
            message: issue.message,
          }))
        );
      }
    }

    if (errors.length > 0) {
      throw new BadRequestError(
        `Validation failed: ${errors.map((e) => `${e.field}: ${e.message}`).join('; ')}`
      );
    }

    next();
  };
}

// ─── Common Reusable Schemas ────────────────────────────────
// Add project-specific schemas here

const commonSchemas = {
  // Pagination query params
  pagination: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),

  // MongoDB ObjectId pattern
  objectId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format'),
};

module.exports = { validate, commonSchemas, z };
