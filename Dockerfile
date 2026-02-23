# syntax=docker/dockerfile:1

# =============================================================================
# Stage 1: Build frontend
# =============================================================================
FROM oven/bun:1-alpine AS frontend-builder

WORKDIR /app/frontend

# Install dependencies first (layer caching)
COPY frontend/package.json frontend/bun.lock ./
RUN bun install --frozen-lockfile

# Copy source and build
COPY frontend/ ./
RUN bun run build

# =============================================================================
# Stage 2: Build backend
# =============================================================================
FROM rust:1.93-alpine AS backend-builder

# Install build dependencies
RUN apk add --no-cache musl-dev

WORKDIR /app

# Copy workspace files
COPY Cargo.toml Cargo.lock ./
COPY crates/ ./crates/

# Copy frontend build for embedding
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Build release binary
RUN cargo build --release --package nag-server

# =============================================================================
# Stage 3: Runtime
# =============================================================================
FROM alpine:3.21 AS runtime

# Install runtime dependencies (CA certs for HTTPS, timezone data, su-exec for privilege dropping)
RUN apk add --no-cache ca-certificates tzdata su-exec

# Create non-root user
RUN addgroup -g 1000 nag && adduser -u 1000 -G nag -s /bin/sh -D nag

WORKDIR /app

# Copy binary from builder
COPY --from=backend-builder /app/target/release/nag-server /app/nag-server

# Copy and set up entrypoint script
COPY docker/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Set ownership
RUN chown -R nag:nag /app

# Default environment variables
ENV SERVER_PORT=3000
ENV DATABASE_URL=sqlite:///app/data/nag.db?mode=rwc
ENV JSON_LOGS=true
ENV TZ=UTC
ENV PUID=1000
ENV PGID=1000

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Set entrypoint and default command
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["/app/nag-server"]
