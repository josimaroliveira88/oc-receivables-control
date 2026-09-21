#!/bin/sh
set -e

# Create .env from the versioned template if it is missing (e.g. first run)
if [ ! -f .env ] && [ -f .env.default ]; then
  echo "Creating .env from .env.default..."
  cp .env.default .env
fi

echo "Waiting for database..."
until npx prisma migrate deploy; do
  echo "Database not ready yet, retrying in 3s..."
  sleep 3
done

echo "Generating Prisma client..."
npx prisma generate

echo "Seeding database..."
node prisma/seed.js

echo "Starting application (production)..."
exec node src/server.js
