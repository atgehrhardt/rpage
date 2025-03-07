FROM node:20-slim

# Set working directory
WORKDIR /app

# Install dependencies needed for Playwright browsers
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    libglib2.0-0 \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxcb1 \
    libxkbcommon0 \
    libx11-6 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libatspi2.0-0 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci

# Install Playwright browsers
RUN npx playwright install --with-deps chromium

# Copy app files excluding data directory (handled by .dockerignore)
COPY . .

# Build the app
RUN npm run build

# Create empty data directory structure 
# (the actual data will be stored in the Docker volume)
RUN mkdir -p /app/data/outputs && \
    chown -R node:node /app/data

# Add entrypoint script and make it executable
COPY docker-entrypoint.sh /app/
RUN chmod +x /app/docker-entrypoint.sh

# Expose ports
EXPOSE 3000 3001

# Start both frontend and backend
ENTRYPOINT ["/app/docker-entrypoint.sh"]