// ─────────────────────────────────────────────────────────────
// Unit Tests — Rate Limiter
// ─────────────────────────────────────────────────────────────

const { createRateLimiter } = require('../../src/middleware/rateLimiter');

jest.mock('../../src/config', () => ({
  rateLimit: { windowMs: 60000, maxRequests: 100 },
  logLevel: 'silent',
  isDev: true,
  nodeEnv: 'test',
}));

jest.mock('../../src/utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('Rate Limiter', () => {
  test('should create a rate limiter middleware', () => {
    const limiter = createRateLimiter({ windowMs: 60000, max: 10 }, 'test-service');
    expect(typeof limiter).toBe('function');
  });

  test('should create with default config when no options provided', () => {
    const limiter = createRateLimiter({}, 'default-service');
    expect(typeof limiter).toBe('function');
  });

  test('should create with custom window and max', () => {
    const limiter = createRateLimiter({ windowMs: 30000, max: 50 }, 'custom-service');
    expect(typeof limiter).toBe('function');
  });
});
