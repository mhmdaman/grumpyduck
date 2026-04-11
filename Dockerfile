# ─────────────────────────────────────────────────────────────
# Multi-stage Dockerfile for API Gateway
# ─────────────────────────────────────────────────────────────
# WHY multi-stage?
#   Stage 1: Install ALL dependencies (including devDependencies)
#   Stage 2: Copy only production deps + source code
#   Result:  ~80MB image instead of ~400MB
# ─────────────────────────────────────────────────────────────

# ─── Stage 1: Build ──────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first (Docker layer caching)
# If package.json hasn't changed, Docker reuses the cached npm install
COPY package.json package-lock.json ./

# Install ALL dependencies (need devDeps for building)
RUN npm ci --production=false

# ─── Stage 2: Production ────────────────────────────────────
FROM node:20-alpine AS production

# Security: Don't run as root
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

WORKDIR /app

# Copy only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy source code
COPY src/ ./src/

# Set ownership
RUN chown -R appuser:appgroup /app

USER appuser

# Expose the gateway port
EXPOSE 3000

# Health check — Docker/Kubernetes uses this
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the gateway
CMD ["node", "src/server.js"]
