# Use the official Bun image (Debian-based) to keep Bun available out of the box
FROM node:22-bullseye-slim

# Install ffmpeg (system package) and other helpers
USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg ca-certificates curl gnupg build-essential git \
    && rm -rf /var/lib/apt/lists/*

# Set a working directory
WORKDIR /app

# Copy package metadata first and install deps (layer caching)
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy the rest of the application files
COPY . .

# Build the project
RUN npm run build

# Expose port used by Next.js
EXPOSE 30000

# Default environment
ENV NODE_ENV=production
ENV PORT=30000

# Use start for container run
CMD ["npm", "start"]
