#!/bin/sh

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