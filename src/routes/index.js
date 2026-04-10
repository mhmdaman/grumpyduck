// ─────────────────────────────────────────────────────────────
// Route Assembler
// ─────────────────────────────────────────────────────────────
// WHY: Keeps the main app.js clean. All route mounting happens
// here. As the gateway grows (versioning, admin routes, etc.),
// add them in this file instead of cluttering app.js.
// ─────────────────────────────────────────────────────────────

const express = require('express');
const { registerProxyRoutes } = require('./proxy');
const { client } = require('../utils/metrics');
const { getAllBreakerStats } = require('../services/circuitBreaker');
const { isRedisConnected } = require('../utils/redis');

const router = express.Router();

// ─── Health Check Endpoint ──────────────────────────────────
// WHY: Load balancers (Nginx, AWS ALB, Kubernetes) periodically
// hit this endpoint to check if the gateway is alive. If it
// returns non-200, the load balancer stops sending traffic here.
router.get('/health', (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    redis: isRedisConnected() ? 'connected' : 'disconnected',
    circuitBreakers: getAllBreakerStats(),
  };

  // If critical dependencies are down, report degraded
  const isHealthy = true; // Redis is optional, so we stay healthy
  res.status(isHealthy ? 200 : 503).json(health);
});

// ─── Prometheus Metrics Endpoint ────────────────────────────
// WHY: Prometheus scrapes this endpoint every 15-30 seconds
// to collect metrics. You then visualize them in Grafana.
router.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
  } catch (err) {
    res.status(500).json({ error: 'Failed to collect metrics' });
  }
});

// ─── Proxy Routes (auto-generated from service registry) ────
router.use('/', registerProxyRoutes());

module.exports = router;
