#!/bin/sh

# Create .env from the versioned template if it is missing (e.g. first run after cloning)
if [ ! -f .env ] && [ -f .env.default ]; then
  echo "Creating .env from .env.default (Docker defaults)..."
  cp .env.default .env
fi

# Install dependencies to ensure anonymous volume gets new packages on image rebuild
echo "Installing dependencies..."
npm install

echo "Waiting for database..."
until npx prisma migrate deploy; do
  echo "Database not ready yet, retrying in 3s..."
  sleep 3
done

echo "Running Prisma migrations..."
npx prisma migrate deploy

echo "Generating Prisma client..."
npx prisma generate

echo "Seeding database..."
node prisma/seed.js

echo "Starting application..."
exec npm run dev