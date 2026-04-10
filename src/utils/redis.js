// ─────────────────────────────────────────────────────────────
// Redis Client Singleton
// ─────────────────────────────────────────────────────────────
// WHY: Redis is used for two things in this gateway:
//   1. Rate limiting — shared counters across multiple gateway instances
//   2. (Optional) Response caching — avoid hitting backend services repeatedly
//
// We create a SINGLETON so every module shares the same connection
// pool instead of each creating their own (which wastes resources).
//
// The gateway gracefully degrades if Redis is unavailable:
//   - Rate limiting falls back to in-memory (per-instance)
//   - A warning is logged, but the gateway keeps running
// ─────────────────────────────────────────────────────────────

const Redis = require('ioredis');
const config = require('../config');
const logger = require('./logger');

let redisClient = null;
let isConnected = false;

/**
 * Creates and returns a Redis client singleton.
 * Returns null if Redis is unavailable (gateway degrades gracefully).
 */
function getRedisClient() {
  if (redisClient) return redisClient;

  try {
    redisClient = new Redis(config.redis.url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 5) {
          logger.warn('Redis: max reconnection attempts reached, giving up');
          return null; // Stop retrying
        }
        const delay = Math.min(times * 200, 2000);
        logger.info({ attempt: times, delayMs: delay }, 'Redis: reconnecting...');
        return delay;
      },
      lazyConnect: true, // Don't connect until first command
    });

    redisClient.on('connect', () => {
      isConnected = true;
      logger.info('Redis: connected');
    });

    redisClient.on('error', (err) => {
      isConnected = false;
      logger.error({ err: err.message }, 'Redis: connection error');
    });

    redisClient.on('close', () => {
      isConnected = false;
      logger.warn('Redis: connection closed');
    });

    // Attempt to connect
    redisClient.connect().catch((err) => {
      logger.warn({ err: err.message }, 'Redis: initial connection failed, gateway will use in-memory fallbacks');
    });

    return redisClient;
  } catch (err) {
    logger.warn({ err: err.message }, 'Redis: failed to create client');
    return null;
  }
}

/**
 * Gracefully disconnect Redis (called during shutdown).
 */
async function disconnectRedis() {
  if (redisClient) {
    await redisClient.quit();
    logger.info('Redis: disconnected gracefully');
  }
}

/**
 * Check if Redis is currently connected.
 */
function isRedisConnected() {
  return isConnected;
}

module.exports = { getRedisClient, disconnectRedis, isRedisConnected };
