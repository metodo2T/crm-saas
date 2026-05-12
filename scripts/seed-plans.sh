#!/bin/sh
set -e

# Carrega variáveis do .env
if [ -f .env ]; then
  export $(grep -v '^#' .env | grep -v '^$' | xargs)
fi

: "${STRIPE_PRICE_STARTER:?Defina STRIPE_PRICE_STARTER no .env}"
: "${STRIPE_PRICE_PRO:?Defina STRIPE_PRICE_PRO no .env}"
: "${STRIPE_PRICE_AGENCY:?Defina STRIPE_PRICE_AGENCY no .env}"

echo "→ Inserindo planos no banco..."

docker compose exec -e STRIPE_PRICE_STARTER="$STRIPE_PRICE_STARTER" \
  -e STRIPE_PRICE_PRO="$STRIPE_PRICE_PRO" \
  -e STRIPE_PRICE_AGENCY="$STRIPE_PRICE_AGENCY" \
  api node -e "
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const plans = [
  {
    name: 'STARTER',
    stripePriceId: process.env.STRIPE_PRICE_STARTER,
    maxUsers: 3, maxLeads: 500, maxWhatsapp: 1,
    features: { whiteLabel: false, api: false, prioritySupport: false, advancedReports: false },
  },
  {
    name: 'PRO',
    stripePriceId: process.env.STRIPE_PRICE_PRO,
    maxUsers: 10, maxLeads: 2000, maxWhatsapp: 3,
    features: { whiteLabel: false, api: false, prioritySupport: false, advancedReports: true },
  },
  {
    name: 'AGENCY',
    stripePriceId: process.env.STRIPE_PRICE_AGENCY,
    maxUsers: -1, maxLeads: -1, maxWhatsapp: -1,
    features: { whiteLabel: true, api: true, prioritySupport: true, advancedReports: true },
  },
];
Promise.all(
  plans.map(({ name, ...data }) =>
    prisma.plan.upsert({ where: { name }, update: data, create: { name, ...data } })
      .then(() => console.log('✓ ' + name))
  )
).then(() => pool.end()).catch(e => { console.error(e); process.exit(1); });
"

echo "✓ Seed concluído."
