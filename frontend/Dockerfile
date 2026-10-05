FROM node:18-alpine

WORKDIR /app

# Install dependencies from the lockfile for a reproducible, CI-style layer.
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Start the application with host binding for Docker.
# Run npm install first to ensure anonymous volume gets new dependencies on image rebuild.
CMD ["sh", "-c", "npm install && npm run dev -- --host 0.0.0.0 --port 3000"]
