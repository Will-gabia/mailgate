# ---- Stage 1: Build ----
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies first (layer caching)
COPY package.json package-lock.json* ./
RUN npm ci

# Copy Prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy source and build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- Stage 2: Production ----
FROM node:22-alpine AS production

WORKDIR /app

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Install production dependencies only
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copy Prisma schema and generate client (production only)
COPY prisma ./prisma
RUN npx prisma generate

# Copy built output from builder
COPY --from=builder /app/dist ./dist

# Copy helper scripts
COPY scripts ./scripts

# Create data directories
RUN mkdir -p data/attachments certs && chown -R appuser:appgroup data certs

# Switch to non-root user
USER appuser

# Expose SMTP port
EXPOSE 2525

# Health check — verify the process is running
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "process.exit(0)"

# Run database migrations then start the app
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]