#!/bin/sh
set -e

echo "→ Running database migrations..."
./apps/api/node_modules/.bin/prisma migrate deploy --schema=packages/db/prisma/schema.prisma

echo "→ Starting API server..."
exec node apps/api/dist/main
