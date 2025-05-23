# Use Node.js 18 LTS as base image
FROM node:18-alpine AS base

# Set working directory
WORKDIR /app

# Install system dependencies needed for Playwright
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    curl

# Tell Playwright to use installed Chromium
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Development stage
FROM base AS development
# Install all dependencies (including dev dependencies)
RUN npm ci

# Copy source code
COPY . .

# Expose development port
EXPOSE 3000

# Development command
CMD ["npm", "run", "dev"]

# Build stage
FROM base AS build

# Install all dependencies for building
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM base AS production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy built application from build stage
COPY --from=build --chown=nodejs:nodejs /app/dist ./dist
COPY --from=build --chown=nodejs:nodejs /app/package*.json ./

# Copy environment files
COPY --chown=nodejs:nodejs .env.production* ./

# Install Playwright browsers in production
RUN npx playwright install chromium --with-deps || true

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Production command
CMD ["npm", "start"]