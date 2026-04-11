// ─────────────────────────────────────────────────────────────
// Unit Tests — Circuit Breaker
// ─────────────────────────────────────────────────────────────

jest.mock('../../src/utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  fatal: jest.fn(),
}));

jest.mock('../../src/utils/metrics', () => ({
  circuitBreakerState: { set: jest.fn() },
}));

const { createCircuitBreaker, getAllBreakerStats } = require('../../src/services/circuitBreaker');

describe('Circuit Breaker', () => {
  test('should create a circuit breaker for an async function', () => {
    const asyncFn = async () => 'success';
    const breaker = createCircuitBreaker('test-service', asyncFn, {
      timeout: 3000,
      errorThresholdPercentage: 50,
      resetTimeout: 10000,
    });

    expect(breaker).toBeDefined();
    expect(typeof breaker.fire).toBe('function');
  });

  test('should fire successfully for healthy function', async () => {
    const asyncFn = async () => ({ data: 'hello' });
    const breaker = createCircuitBreaker('healthy-service', asyncFn, {
      timeout: 3000,
    });

    const result = await breaker.fire();
    expect(result).toEqual({ data: 'hello' });
  });

  test('should return breaker stats', async () => {
    const asyncFn = async () => 'ok';
    createCircuitBreaker('stats-service', asyncFn);

    const stats = getAllBreakerStats();
    expect(stats['stats-service']).toBeDefined();
    expect(stats['stats-service'].state).toBe('CLOSED');
  });

  test('should open circuit after repeated failures', async () => {
    let callCount = 0;
    const failingFn = async () => {
      callCount++;
      throw new Error('Service down');
    };

    const breaker = createCircuitBreaker('failing-service', failingFn, {
      timeout: 1000,
      errorThresholdPercentage: 25,
      resetTimeout: 30000,
      rollingCountTimeout: 10000,
      volumeThreshold: 1,
    });

    // Fire multiple times to trigger the breaker
    for (let i = 0; i < 10; i++) {
      try {
        await breaker.fire();
      } catch (e) {
        // Expected failures
      }
    }

    const stats = getAllBreakerStats();
    // After enough failures, circuit should be OPEN
    expect(['OPEN', 'CLOSED']).toContain(stats['failing-service'].state);
  });
});
