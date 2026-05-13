#!/bin/sh

echo "==> ENV CHECK: DATABASE_URL=$([ -n "$DATABASE_URL" ] && echo 'SET' || echo 'MISSING')"
echo "==> ENV CHECK: PORT=$PORT"
echo "==> Checking dist/main.js..."
ls -la apps/api/dist/main.js 2>&1 || echo "MISSING main.js!"
echo "==> Node version: $(node --version)"

echo "==> Starting API (no prisma push)..."
exec node apps/api/dist/main.js
