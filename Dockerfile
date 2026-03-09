# Build stage
FROM node:20-alpine AS build

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies cleanly
RUN npm ci

# Copy the rest of the application code
COPY . .

# Build the Vite application for production
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy custom nginx configuration for SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built assets from the build stage to nginx web root
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
