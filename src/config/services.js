// ─────────────────────────────────────────────────────────────
// Service Registry
// ─────────────────────────────────────────────────────────────
// WHY: This is the ONLY file you change when reusing the gateway
// in a new project. It defines which backend services exist,
// where they live, and what protection each one gets.
//
// Each service entry configures:
//   - name:           Human-readable identifier (used in logs/metrics)
//   - pathPrefix:     Gateway listens on this path and forwards to target
//   - target:         The actual URL of the backend service
//   - auth:           Whether JWT authentication is required
//   - publicPaths:    Paths that skip auth even when auth=true
//   - rateLimit:      Per-service rate limit overrides
//   - circuitBreaker: Per-service circuit breaker thresholds
//   - timeout:        Max time to wait for a response (ms)
// ─────────────────────────────────────────────────────────────

const config = require('./index');

const services = [
  {
    name: 'user-service',
    pathPrefix: '/api/users',
    target: process.env.USER_SERVICE_URL || 'http://localhost:3001',
    auth: true,
    publicPaths: [
      { method: 'POST', path: '/api/users/login' },
      { method: 'POST', path: '/api/users/register' },
    ],
    rateLimit: {
      windowMs: 60 * 1000,   // 1 minute
      max: 100,               // 100 requests per window
    },
    circuitBreaker: {
      timeout: 5000,          // 5s timeout per request
      errorThresholdPercentage: 50,
      resetTimeout: 30000,    // Try again after 30s
    },
    timeout: 10000,
  },
  {
    name: 'product-service',
    pathPrefix: '/api/products',
    target: process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002',
    auth: true,
    publicPaths: [
      { method: 'GET', path: '/api/products' },     // Browse products publicly
      { method: 'GET', path: '/api/products/:id' },  // View single product publicly
    ],
    rateLimit: {
      windowMs: 60 * 1000,
      max: 200,               // Read-heavy, more lenient
    },
    circuitBreaker: {
      timeout: 3000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000,
    },
    timeout: 8000,
  },
  {
    name: 'order-service',
    pathPrefix: '/api/orders',
    target: process.env.ORDER_SERVICE_URL || 'http://localhost:3003',
    auth: true,
    publicPaths: [],           // ALL order routes require auth
    rateLimit: {
      windowMs: 60 * 1000,
      max: 50,                 // Write-heavy, strict limit
    },
    circuitBreaker: {
      timeout: 5000,
      errorThresholdPercentage: 30,  // More sensitive — orders are critical
      resetTimeout: 30000,
    },
    timeout: 15000,             // Orders may take longer (payment processing)
  },
];

module.exports = { services };
