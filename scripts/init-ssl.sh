#!/bin/sh
set -e

# Carrega variáveis do .env
if [ -f .env ]; then
  export $(grep -v '^#' .env | grep -v '^$' | xargs)
fi

DOMAIN="${DOMAIN:?Defina DOMAIN no arquivo .env}"
SSL_EMAIL="${SSL_EMAIL:?Defina SSL_EMAIL no arquivo .env}"

echo "Domínio : $DOMAIN"
echo "Email   : $SSL_EMAIL"
echo ""

# ── 1. Garante que o nginx está rodando (para servir o ACME challenge) ────────
echo "→ Iniciando nginx..."
docker compose up -d nginx
sleep 5

# ── 2. Obtém o certificado via certbot ────────────────────────────────────────
echo "→ Solicitando certificado Let's Encrypt para $DOMAIN..."
docker compose run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "$SSL_EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN"

# ── 3. Gera a config nginx com SSL ────────────────────────────────────────────
echo "→ Gerando nginx/nginx.conf com SSL..."
cat > nginx/nginx.conf << NGINX
upstream api {
    server api:3001;
}

upstream web {
    server web:3000;
}

# Redireciona HTTP → HTTPS
server {
    listen 80;
    server_name $DOMAIN;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

# HTTPS
server {
    listen 443 ssl;
    server_name $DOMAIN;

    ssl_certificate     /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache   shared:SSL:10m;
    ssl_session_timeout 1d;
    add_header Strict-Transport-Security "max-age=63072000" always;

    location /api/ {
        proxy_pass http://api/;
        proxy_http_version 1.1;
        proxy_set_header Host              \$host;
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        client_max_body_size 10M;
    }

    location / {
        proxy_pass http://web;
        proxy_http_version 1.1;
        proxy_set_header Upgrade           \$http_upgrade;
        proxy_set_header Connection        'upgrade';
        proxy_set_header Host              \$host;
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass                 \$http_upgrade;
    }
}
NGINX

# ── 4. Recarrega nginx com a nova config ──────────────────────────────────────
echo "→ Recarregando nginx..."
docker compose exec nginx nginx -s reload

# ── 5. Configura renovação automática via cron (3h da manhã, todo dia) ────────
echo "→ Configurando cron de renovação..."
CRON_JOB="0 3 * * * cd $(pwd) && sh scripts/renew-ssl.sh >> /var/log/certbot-renew.log 2>&1"
( crontab -l 2>/dev/null | grep -v "renew-ssl.sh"; echo "$CRON_JOB" ) | crontab -

echo ""
echo "✓ SSL ativo! Acesse: https://$DOMAIN"
echo ""
echo "IMPORTANTE: atualize NEXT_PUBLIC_API_URL no .env para usar https://"
echo "  NEXT_PUBLIC_API_URL=https://$DOMAIN/api"
echo "Depois rode: docker compose up -d --build web"
