# ---------- STAGE 1: Build ----------
FROM node:20-slim AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy only package files first for better caching
COPY package*.json ./
RUN npm install

# Copy the rest of the source
COPY . .

# Build the app
RUN npm run build


# ---------- STAGE 2: Production ----------
FROM node:20-slim as production

# Install Playwright + Chromium dependencies
RUN apt-get update && apt-get install -y \
    wget \
    curl \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgdk-pixbuf2.0-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    libu2f-udev \
    libvulkan1 \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create non-root user
RUN useradd -m nodejs

# Copy app files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Set env so Playwright installs to the nodejs user's home
ENV HOME=/home/nodejs

# Install Playwright and browsers as root, but into nodejs's home
RUN npm install playwright && \
    npx playwright install chromium

# Switch to the nodejs user
USER nodejs

# Expose app port
EXPOSE 3000
ENV PORT=3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start app
CMD ["node", "dist/server"]
