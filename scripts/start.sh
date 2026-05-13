#!/bin/sh

echo "==> DATABASE_URL set: $([ -n "$DATABASE_URL" ] && echo yes || echo NO)"
echo "==> Working dir: $(pwd)"
echo "==> Prisma binary: $(ls node_modules/.bin/prisma 2>/dev/null && echo found || echo NOT FOUND)"

echo "==> Attempting database schema sync..."
node node_modules/.bin/prisma db push --skip-generate --accept-data-loss 2>&1 && echo "==> db push OK" || echo "==> WARNING: db push failed — continuing anyway"

echo "==> Starting API server on port 3001..."
exec node apps/api/dist/main.js
