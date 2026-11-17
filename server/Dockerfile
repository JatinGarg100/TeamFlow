# Use the official Node.js 20 LTS Alpine image for a lightweight, secure footprint
FROM node:20-alpine AS base

# Create dedicated app directory
WORKDIR /app

# Install dependencies (utilizing Docker layer caching)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source code
COPY src/ ./src/

# Create uploads directory and set ownership to built-in non-root 'node' user
RUN mkdir -p uploads/task-attachments && chown -R node:node /app

# Switch to non-root user for container security
USER node

# Expose backend service port
EXPOSE 5000

# Health check using native Node HTTP probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 5000) + '/healthz', (res) => { if (res.statusCode !== 200) process.exit(1); })"

# Start the application using standard npm start
CMD ["npm", "start"]
