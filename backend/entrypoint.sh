#!/bin/sh

echo "Waiting for database..."
npx prisma db push --skip-generate 2>/dev/null || {
  echo "Database not ready yet, retrying in 3s..."
  sleep 3
  npx prisma db push --skip-generate 2>/dev/null || {
    echo "Database still not ready, retrying in 5s..."
    sleep 5
    npx prisma db push --skip-generate
  }
}

echo "Running Prisma migrations..."
npx prisma migrate deploy

echo "Starting application..."
exec npm run dev
