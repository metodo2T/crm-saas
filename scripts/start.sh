#!/bin/sh
set -e

echo "→ Running database migrations..."
cd /app/packages/db
../../apps/api/node_modules/.bin/prisma migrate deploy
cd /app

echo "→ Starting API server..."
exec node apps/api/dist/main
