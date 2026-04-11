// ─────────────────────────────────────────────────────────────
// Integration Tests — Full Gateway Flow
// ─────────────────────────────────────────────────────────────
// These tests spin up the real gateway and mock services,
// then send HTTP requests through the gateway and verify
// the full middleware chain works end-to-end.
// ─────────────────────────────────────────────────────────────

const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

// We test the app directly, not through the server
// (avoids port binding issues in tests)
const JWT_SECRET = 'dev-secret-change-me';

describe('API Gateway — Integration', () => {
  let app;
  let mockUserService;
  let mockProductService;

  beforeAll(async () => {
    // Start minimal mock services
    mockUserService = express();
    mockUserService.use(express.json());
    mockUserService.post('/api/users/login', (req, res) => {
      const token = jwt.sign({ id: 'user_1', email: 'test@test.com', role: 'user' }, JWT_SECRET);
      res.json({ token });
    });
    mockUserService.get('/api/users/profile', (req, res) => {
      res.json({ user: { id: req.headers['x-user-id'], name: 'Test User' } });
    });

    mockProductService = express();
    mockProductService.use(express.json());
    mockProductService.get('/api/products', (req, res) => {
      res.json({ products: [{ id: 'p1', name: 'Test Product' }] });
    });

    // Start mock servers
    const userServer = mockUserService.listen(3001);
    const productServer = mockProductService.listen(3002);

    // Import app AFTER mock services are running
    // Clear module cache to ensure fresh config
    delete require.cache[require.resolve('../../src/app')];
    app = require('../../src/app');

    // Store servers for cleanup
    global.__mockServers = [userServer, productServer];
  });

  afterAll(async () => {
    // Clean up mock servers
    if (global.__mockServers) {
      for (const server of global.__mockServers) {
        await new Promise((resolve) => server.close(resolve));
      }
    }
  });

  // ─── Health Check ─────────────────────────────────────────
  describe('GET /health', () => {
    it('should return health status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body).toHaveProperty('uptime');
      expect(res.body).toHaveProperty('timestamp');
    });
  });

  // ─── Metrics ──────────────────────────────────────────────
  describe('GET /metrics', () => {
    it('should return Prometheus metrics', async () => {
      const res = await request(app).get('/metrics');
      expect(res.status).toBe(200);
      expect(res.text).toContain('gateway_');
    });
  });

  // ─── 404 Handling ─────────────────────────────────────────
  describe('Unknown routes', () => {
    it('should return 404 for unknown routes', async () => {
      const res = await request(app).get('/api/unknown');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not Found');
    });
  });

  // ─── Correlation IDs ─────────────────────────────────────
  describe('Correlation IDs', () => {
    it('should return X-Request-ID header', async () => {
      const res = await request(app).get('/health');
      expect(res.headers['x-request-id']).toBeDefined();
    });

    it('should preserve client-provided X-Request-ID', async () => {
      const res = await request(app)
        .get('/health')
        .set('X-Request-ID', 'my-custom-id');
      expect(res.headers['x-request-id']).toBe('my-custom-id');
    });
  });

  // ─── Security Headers ────────────────────────────────────
  describe('Security', () => {
    it('should set security headers via Helmet', async () => {
      const res = await request(app).get('/health');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBeDefined();
    });
  });
});
