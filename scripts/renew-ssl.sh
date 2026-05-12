#!/bin/sh
set -e

cd "$(dirname "$0")/.."

echo "[$(date)] → Renovando certificado..."
docker compose run --rm certbot renew --quiet

echo "[$(date)] → Recarregando nginx..."
docker compose exec nginx nginx -s reload

echo "[$(date)] ✓ Renovação concluída."
