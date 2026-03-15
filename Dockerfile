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

# Build the application (Vite + esbuild)
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built frontend assets
COPY --from=build /app/dist ./dist

# Copy built backend assets
COPY --from=build /app/dist-server ./dist-server

# Create a volume for the SQLite database so settings persist across container restarts
VOLUME ["/app/data"]

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5173

# Expose the single port Express is running on
EXPOSE 5173

# Start the application directly with node for better signal handling
CMD ["node", "dist-server/index.js"]
