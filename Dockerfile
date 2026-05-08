# Use official Puppeteer image which has Chrome and all dependencies pre-installed
FROM ghcr.io/puppeteer/puppeteer:22.6.0

# Set working directory
WORKDIR /app

# Copy package files first to leverage Docker layer caching
COPY package*.json ./

# Install dependencies
# Note: The puppeteer image uses a non-root user 'pptruser' for security
USER root
RUN npm install
USER pptruser

# Copy the rest of the application code
COPY --chown=pptruser:pptruser . .

# Environment variables for Puppeteer
# The official image has the browser at a known location
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome

EXPOSE 3001

CMD ["node", "server.js"]
