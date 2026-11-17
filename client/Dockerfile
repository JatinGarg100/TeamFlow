# Stage 1: Build the React Application
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and build config
COPY . .

# Build argument allowing custom backend API URL during build (defaults to /api)
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

# Build production assets into dist/
RUN npm run build

# Stage 2: Serve production assets with lightweight Nginx
FROM nginx:alpine AS runner

# Remove default Nginx website
RUN rm -rf /usr/share/nginx/html/*

# Copy custom Nginx configuration with SPA fallback
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose HTTP port 80
EXPOSE 80

# Run Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
