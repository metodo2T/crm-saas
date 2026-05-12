#!/bin/sh
set -e

echo "→ Pulling latest code..."
git pull origin master

echo "→ Rebuilding and restarting services..."
docker compose up -d --build --remove-orphans

echo "→ Removing unused images..."
docker image prune -f

echo "✓ Deploy concluído."
docker compose ps
