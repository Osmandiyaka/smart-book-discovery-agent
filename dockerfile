
FROM node:18-alpine AS dev

# Install dependencies required for development and Playwright
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    curl \
    bash

# Install Ollama CLI
RUN curl -fsSL https://ollama.ai/install.sh | sh

# Use the system Chromium for Playwright
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Set the working directory
WORKDIR /app

# Copy and install all dependencies (including dev)
COPY package*.json ./
RUN npm ci && npm cache clean --force

# Copy application source code
COPY . .

# Prepare Ollama config directory
RUN mkdir -p /root/.ollama

# Expose ports: 3000 for the app, 11434 for Ollama
EXPOSE 3000 11434

# Add and make the custom entrypoint script executable
COPY docker-entrypoint-dev.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint-dev.sh

# Use the entrypoint to start the app and Ollama
CMD ["/usr/local/bin/docker-entrypoint-dev.sh"]
