const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const pinoHttp = require('pino-http');

const config = require('./config');
const logger = require('./utils/logger');
const requestIdMiddleware = require('./middleware/requestId');
const { createGlobalRateLimiter } = require('./middleware/rateLimiter');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const routes = require('./routes');

const app = express();

// ─── Persona: GrumpyDuck ─────────────────────────────────────
// Set custom identity header
app.use((req, res, next) => {
  res.setHeader('X-Powered-By', 'GrumpyDuck');
  next();
});

// Custom Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    name: 'grumpyduck',
    timestamp: new Date().toISOString(),
  });
});
// ─────────────────────────────────────────────────────────────

// ─── 1. Security Headers ────────────────────────────────────
app.use(helmet());

// ─── 2. CORS ────────────────────────────────────────────────
app.use(
  cors({
    origin: config.isDev ? '*' : (process.env.ALLOWED_ORIGINS || '').split(','),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID', 'RateLimit-Limit', 'RateLimit-Remaining'],
    credentials: true,
    maxAge: 86400, // Cache preflight for 24h
  })
);

// ─── 3. Correlation ID ──────────────────────────────────────
app.use(requestIdMiddleware);

// ─── 4. Request Logging ─────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    genReqId: (req) => req.id,
    customLogLevel: (req, res, err) => {
      if (res.statusCode >= 500 || err) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    autoLogging: {
      ignore: (req) => req.url === '/health' || req.url === '/metrics',
    },
  })
);

// ─── 5. Body Parsing ────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── 6. Global Rate Limit ───────────────────────────────────
app.use(createGlobalRateLimiter());

// ─── 7. Trust Proxy ─────────────────────────────────────────
app.set('trust proxy', 1);

// ─── 8. Routes ──────────────────────────────────────────────
app.use('/', routes);

// ─── 9. 404 Handler ─────────────────────────────────────────
app.use(notFoundHandler);

// ─── 10. Global Error Handler ───────────────────────────────
app.use(errorHandler);

module.exports = app;

