# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN yarn build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Copy package files and node_modules from builder
COPY package.json yarn.lock ./
COPY --from=builder /app/node_modules ./node_modules

# Prune dev dependencies
RUN yarn install --frozen-lockfile --production --ignore-scripts --prefer-offline && yarn cache clean

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy storage directory if needed (for cached data)
COPY --from=builder /app/storage ./storage

# Set ownership to non-root user
RUN chown -R nestjs:nodejs /app

# Switch to non-root user
USER nestjs

# Expose the application port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production

# Health check
#HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
#    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "dist/main"]
