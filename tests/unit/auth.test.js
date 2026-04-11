// ─────────────────────────────────────────────────────────────
// Unit Tests — Auth Middleware
// ─────────────────────────────────────────────────────────────

const jwt = require('jsonwebtoken');
const { createAuthMiddleware, isPublicPath } = require('../../src/middleware/auth');

const JWT_SECRET = 'test-secret';

// Override config for tests
jest.mock('../../src/config', () => ({
  jwt: { secret: 'test-secret', expiry: '1h' },
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

describe('Auth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
      originalUrl: '/api/orders',
      method: 'GET',
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  const serviceConfig = {
    auth: true,
    publicPaths: [
      { method: 'POST', path: '/api/users/login' },
      { method: 'POST', path: '/api/users/register' },
    ],
  };

  test('should pass for valid JWT token', () => {
    const token = jwt.sign({ id: 'user_1', email: 'test@test.com', role: 'user' }, JWT_SECRET);
    req.headers.authorization = `Bearer ${token}`;

    const middleware = createAuthMiddleware(serviceConfig);
    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toBeDefined();
    expect(req.user.id).toBe('user_1');
    expect(req.headers['x-user-id']).toBe('user_1');
  });

  test('should throw for missing token', () => {
    const middleware = createAuthMiddleware(serviceConfig);
    expect(() => middleware(req, res, next)).toThrow('No token provided');
  });

  test('should throw for invalid token', () => {
    req.headers.authorization = 'Bearer invalid-token';
    const middleware = createAuthMiddleware(serviceConfig);
    expect(() => middleware(req, res, next)).toThrow('Invalid token');
  });

  test('should throw for expired token', () => {
    const token = jwt.sign({ id: 'user_1' }, JWT_SECRET, { expiresIn: '-1s' });
    req.headers.authorization = `Bearer ${token}`;
    const middleware = createAuthMiddleware(serviceConfig);
    expect(() => middleware(req, res, next)).toThrow('Token expired');
  });

  test('should skip auth for public paths', () => {
    req.originalUrl = '/api/users/login';
    req.method = 'POST';
    const middleware = createAuthMiddleware(serviceConfig);
    middleware(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  test('should skip auth when service auth is disabled', () => {
    const noAuthConfig = { auth: false, publicPaths: [] };
    const middleware = createAuthMiddleware(noAuthConfig);
    middleware(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });
});

describe('isPublicPath', () => {
  const publicPaths = [
    { method: 'GET', path: '/api/products' },
    { method: 'GET', path: '/api/products/:id' },
    { method: 'POST', path: '/api/users/login' },
  ];

  test('should match exact public path', () => {
    const req = { method: 'POST', originalUrl: '/api/users/login' };
    expect(isPublicPath(req, publicPaths)).toBe(true);
  });

  test('should match path with params', () => {
    const req = { method: 'GET', originalUrl: '/api/products/prod_123' };
    expect(isPublicPath(req, publicPaths)).toBe(true);
  });

  test('should not match wrong method', () => {
    const req = { method: 'DELETE', originalUrl: '/api/users/login' };
    expect(isPublicPath(req, publicPaths)).toBe(false);
  });

  test('should not match non-public path', () => {
    const req = { method: 'GET', originalUrl: '/api/orders' };
    expect(isPublicPath(req, publicPaths)).toBe(false);
  });
});
