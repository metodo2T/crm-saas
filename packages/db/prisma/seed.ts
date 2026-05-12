import { PrismaClient, PlanTier } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const plans = [
    {
      name: PlanTier.STARTER,
      stripePriceId: process.env.STRIPE_PRICE_STARTER ?? 'price_starter_placeholder',
      maxUsers: 3,
      maxLeads: 500,
      maxWhatsapp: 1,
      features: { whiteLabel: false, api: false, prioritySupport: false, advancedReports: false },
    },
    {
      name: PlanTier.PRO,
      stripePriceId: process.env.STRIPE_PRICE_PRO ?? 'price_pro_placeholder',
      maxUsers: 10,
      maxLeads: 2000,
      maxWhatsapp: 3,
      features: { whiteLabel: false, api: false, prioritySupport: false, advancedReports: true },
    },
    {
      name: PlanTier.AGENCY,
      stripePriceId: process.env.STRIPE_PRICE_AGENCY ?? 'price_agency_placeholder',
      maxUsers: -1,
      maxLeads: -1,
      maxWhatsapp: -1,
      features: { whiteLabel: true, api: true, prioritySupport: true, advancedReports: true },
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { name: plan.name },
      update: plan,
      create: plan,
    });
    console.log(`✓ Upserted plan: ${plan.name}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
