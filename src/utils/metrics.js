// ─────────────────────────────────────────────────────────────
// Prometheus Metrics
// ─────────────────────────────────────────────────────────────
// WHY: You need to MEASURE your gateway's behavior in production.
// Without metrics, you're blind. Prometheus is the industry
// standard for time-series metrics, and Grafana visualizes them.
//
// We track:
//   - http_requests_total:    How many requests hit each route (counter)
//   - http_request_duration:  How long each request takes (histogram)
//   - http_requests_in_flight: How many requests are being processed now (gauge)
//   - circuit_breaker_state:  Which services have tripped circuit breakers
//
// Access at GET /metrics — Prometheus scrapes this endpoint.
// ─────────────────────────────────────────────────────────────

const client = require('prom-client');

// Collect default Node.js metrics (memory, CPU, event loop lag)
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ prefix: 'gateway_' });

// ─── Custom Metrics ──────────────────────────────────────────

const httpRequestsTotal = new client.Counter({
  name: 'gateway_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status_code', 'service'],
});

const httpRequestDuration = new client.Histogram({
  name: 'gateway_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'path', 'status_code', 'service'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

const httpRequestsInFlight = new client.Gauge({
  name: 'gateway_http_requests_in_flight',
  help: 'Number of HTTP requests currently being processed',
  labelNames: ['service'],
});

const circuitBreakerState = new client.Gauge({
  name: 'gateway_circuit_breaker_state',
  help: 'Circuit breaker state: 0=closed, 1=open, 2=half-open',
  labelNames: ['service'],
});

/**
 * Express middleware to record metrics for each request.
 */
function metricsMiddleware(serviceName) {
  return (req, res, next) => {
    const start = process.hrtime.bigint();
    httpRequestsInFlight.inc({ service: serviceName });

    // When the response finishes, record metrics
    res.on('finish', () => {
      const durationNs = Number(process.hrtime.bigint() - start);
      const durationS = durationNs / 1e9;

      const labels = {
        method: req.method,
        path: req.route?.path || req.originalUrl,
        status_code: res.statusCode,
        service: serviceName,
      };

      httpRequestsTotal.inc(labels);
      httpRequestDuration.observe(labels, durationS);
      httpRequestsInFlight.dec({ service: serviceName });
    });

    next();
  };
}

module.exports = {
  client,
  httpRequestsTotal,
  httpRequestDuration,
  httpRequestsInFlight,
  circuitBreakerState,
  metricsMiddleware,
};
