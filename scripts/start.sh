#!/bin/sh

echo "==> ENV: DATABASE_URL=$([ -n "$DATABASE_URL" ] && echo 'SET' || echo 'MISSING')"
echo "==> ENV: CLERK_SECRET_KEY=$([ -n "$CLERK_SECRET_KEY" ] && echo 'SET' || echo 'MISSING')"
echo "==> dist/main.js: $(ls apps/api/dist/main.js 2>&1)"
echo "==> .prisma/client: $(ls node_modules/.prisma/client/index.js 2>&1)"
echo "==> node_modules/@prisma/client: $(ls node_modules/@prisma/client/index.js 2>&1)"

echo "==> Starting node..."
node apps/api/dist/main.js 2>&1 || {
  echo "==> NODE CRASHED with exit code $?"
  echo "==> Keeping container alive for debugging..."
  sleep 3600
}
