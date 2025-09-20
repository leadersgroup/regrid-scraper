# Simple Dockerfile for Render
FROM ghcr.io/puppeteer/puppeteer:21.6.1

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy app source
COPY . .

# Expose port
EXPOSE 3000

# Start app
CMD ["node", "server.js"]