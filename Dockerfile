# Use official Puppeteer image with Node.js and Chrome pre-installed
FROM ghcr.io/puppeteer/puppeteer:21.6.1

# Set working directory
WORKDIR /usr/src/app

# Copy package.json first
COPY package.json ./

# Install dependencies with verbose logging
RUN npm install --verbose

# Copy all source files
COPY . .

# Expose port 3000
EXPOSE 3000

# Start the application
CMD ["node", "server.js"]