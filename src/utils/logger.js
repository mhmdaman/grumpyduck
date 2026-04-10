// ─────────────────────────────────────────────────────────────
// Structured Logger (Pino)
// ─────────────────────────────────────────────────────────────
// WHY: In production, you need structured JSON logs that tools
// like ELK, Datadog, or CloudWatch can parse and search.
// Plain console.log("user logged in") is useless at scale —
// you can't filter, aggregate, or alert on it.
//
// Pino is the fastest Node.js logger. Each log line is a JSON
// object with timestamp, level, message, and any extra data:
//   {"level":30,"time":1712345678,"msg":"Request received","requestId":"abc-123"}
// ─────────────────────────────────────────────────────────────

const pino = require('pino');
const config = require('../config');

const logger = pino({
  name: config.name,
  level: config.logLevel,

  // In development, pretty-print for readability.
  // In production, raw JSON for log aggregation tools.
  transport: config.isDev
    ? {
        target: 'pino/file',
        options: { destination: 1 }, // stdout
      }
    : undefined,

  // Add useful default fields to every log line
  base: {
    service: 'api-gateway',
    env: config.nodeEnv,
  },

  // Custom timestamp format (ISO string is more readable than epoch)
  timestamp: pino.stdTimeFunctions.isoTime,
});

module.exports = logger;
