#!/bin/sh
set -e

echo "==> Syncing database schema..."
node node_modules/.bin/prisma db push --skip-generate --accept-data-loss

echo "==> Starting API server on port 3001..."
exec node apps/api/dist/main.js
