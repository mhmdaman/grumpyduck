// ─────────────────────────────────────────────────────────────
// Circuit Breaker Service
// ─────────────────────────────────────────────────────────────
// WHY: If the Order Service goes down, without a circuit breaker
// the gateway keeps sending requests to it. Each one waits for
// the timeout (5 seconds) before failing. With 100 concurrent
// users, that's 100 hanging connections eating gateway memory.
// Eventually the gateway crashes too → CASCADING FAILURE.
//
// The circuit breaker pattern solves this:
//   CLOSED  → Normal operation, requests flow through
//   OPEN    → Service is down, requests INSTANTLY fail with 503
//             (no waiting, no wasted resources)
//   HALF-OPEN → After a cooldown, let ONE request through to
//               test if the service recovered
//
// We use the Opossum library — the most battle-tested circuit
// breaker for Node.js.
// ─────────────────────────────────────────────────────────────

const CircuitBreaker = require('opossum');
const logger = require('../utils/logger');
const { circuitBreakerState } = require('../utils/metrics');

// Store breakers by service name so we can inspect them
const breakers = new Map();

/**
 * Creates a circuit breaker for a given async function.
 *
 * @param {string} serviceName - Identifies this breaker in logs/metrics
 * @param {Function} asyncFn - The async function to protect
 * @param {Object} options - Circuit breaker options from service config
 * @returns {CircuitBreaker} Opossum circuit breaker instance
 */
function createCircuitBreaker(serviceName, asyncFn, options = {}) {
  const breakerOptions = {
    timeout: options.timeout || 5000,              // Max wait time per request
    errorThresholdPercentage: options.errorThresholdPercentage || 50,
    resetTimeout: options.resetTimeout || 30000,   // How long to wait before trying again
    rollingCountTimeout: 10000,                    // Window for counting errors
    rollingCountBuckets: 10,                       // Number of buckets in the window
    volumeThreshold: 5,                            // Min requests before breaker can trip
  };

  const breaker = new CircuitBreaker(asyncFn, breakerOptions);

  // ─── Event Listeners for Observability ─────────────────────

  breaker.on('open', () => {
    logger.error(
      { service: serviceName },
      `Circuit OPEN — ${serviceName} is unavailable, failing fast`
    );
    circuitBreakerState.set({ service: serviceName }, 1); // 1 = OPEN
  });

  breaker.on('halfOpen', () => {
    logger.info(
      { service: serviceName },
      `Circuit HALF-OPEN — testing if ${serviceName} has recovered`
    );
    circuitBreakerState.set({ service: serviceName }, 2); // 2 = HALF-OPEN
  });

  breaker.on('close', () => {
    logger.info(
      { service: serviceName },
      `Circuit CLOSED — ${serviceName} is healthy again`
    );
    circuitBreakerState.set({ service: serviceName }, 0); // 0 = CLOSED
  });

  breaker.on('fallback', () => {
    logger.warn(
      { service: serviceName },
      `Circuit FALLBACK — serving fallback for ${serviceName}`
    );
  });

  breaker.on('timeout', () => {
    logger.warn(
      { service: serviceName },
      `Circuit TIMEOUT — ${serviceName} took too long to respond`
    );
  });

  // Store for status checks
  breakers.set(serviceName, breaker);

  return breaker;
}

/**
 * Get the status of all circuit breakers (for health checks).
 */
function getAllBreakerStats() {
  const stats = {};
  for (const [name, breaker] of breakers) {
    stats[name] = {
      state: breaker.opened ? 'OPEN' : breaker.halfOpen ? 'HALF-OPEN' : 'CLOSED',
      stats: breaker.stats || {},
    };
  }
  return stats;
}

module.exports = { createCircuitBreaker, getAllBreakerStats };
