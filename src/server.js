// ─────────────────────────────────────────────────────────────
// Server Entry Point + Graceful Shutdown
// ─────────────────────────────────────────────────────────────
// WHY: We separate the server from the app because:
//   1. Tests can import app.js without starting a real server
//   2. Graceful shutdown logic lives here, not in app.js
//   3. Signal handling (SIGTERM/SIGINT) is a server concern
//
// GRACEFUL SHUTDOWN — Why it matters:
// When you deploy a new version, the orchestrator (Docker,
// Kubernetes) sends SIGTERM to the old container. Without
// graceful shutdown, in-flight requests get KILLED mid-response
// and users see errors. With graceful shutdown:
//   1. Stop accepting NEW requests
//   2. Wait for IN-FLIGHT requests to complete (up to 30s)
//   3. Close database/Redis connections
//   4. Exit cleanly
// ─────────────────────────────────────────────────────────────

const app = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
const { getRedisClient, disconnectRedis } = require('./utils/redis');

// Initialize Redis connection (optional — gateway works without it)
getRedisClient();

const server = app.listen(config.port, () => {
  console.log('---------------------------------------------------------');
  console.log('🦆 GRUMPYDUCK GATEWAY ACTIVE');
  console.log(`🚀 Security & Proxying on port ${config.port} [${config.env}]`);
  console.log('---------------------------------------------------------');
  logger.info(
    { port: config.port, env: config.env },
    'GrumpyDuck is guarding the door'
  );
});

// ─── Graceful Shutdown ──────────────────────────────────────

const SHUTDOWN_TIMEOUT = 30000; // 30 seconds max to finish

async function gracefulShutdown(signal) {
  logger.info({ signal }, `${signal} received — starting graceful shutdown...`);

  // 1. Stop accepting new connections
  server.close(async () => {
    logger.info('HTTP server closed — no new connections accepted');

    try {
      // 2. Close Redis connection
      await disconnectRedis();

      // 3. Exit cleanly
      logger.info('Graceful shutdown complete');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
  });

  // Force shutdown if graceful shutdown takes too long
  setTimeout(() => {
    logger.error('Graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT);
}

// Listen for termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ─── Unhandled Errors ───────────────────────────────────────
// These should NEVER happen in production, but if they do,
// log them and crash (the process manager will restart us).

process.on('unhandledRejection', (reason, promise) => {
  logger.fatal({ reason, promise }, 'Unhandled Promise Rejection');
  // In production, crash so the process manager restarts us
  // A corrupted state is worse than a restart
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught Exception');
  process.exit(1);
});

module.exports = server; // For testing
