import { Controller, Post, Headers, RawBodyRequest, Req, BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionService } from '../subscription/subscription.service';

@Controller('webhooks/stripe')
export class StripeWebhookController {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private stripe: any;

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionService: SubscriptionService,
  ) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder', {
      apiVersion: '2026-04-22.dahlia' as any,
    });
  }

  @Post()
  async handleStripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') sig: string,
  ) {
    let event: any;

    try {
      event = this.stripe.webhooks.constructEvent(
        req.rawBody!,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!,
      );
    } catch {
      throw new BadRequestException('Invalid Stripe signature');
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any;
      const orgId = session.client_reference_id!;
      const subId = session.subscription as string;
      const customerId = session.customer as string;

      const stripeSub = await this.stripe.subscriptions.retrieve(subId);
      const priceId = stripeSub.items.data[0].price.id;
      const plan = await this.prisma.plan.findFirstOrThrow({ where: { stripePriceId: priceId } });

      await this.prisma.$transaction([
        this.prisma.subscription.upsert({
          where: { organizationId: orgId },
          update: {
            planId: plan.id,
            stripeSubId: subId,
            stripeCustomerId: customerId,
            status: 'ACTIVE',
            currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
          },
          create: {
            organizationId: orgId,
            planId: plan.id,
            stripeSubId: subId,
            stripeCustomerId: customerId,
            status: 'ACTIVE',
            currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
          },
        }),
        this.prisma.organization.update({ where: { id: orgId }, data: { planId: plan.id } }),
      ]);
    }

    if (event.type === 'customer.subscription.updated') {
      const sub = event.data.object as any;
      const priceId = sub.items.data[0].price.id;
      const plan = await this.prisma.plan.findFirst({ where: { stripePriceId: priceId } });
      if (!plan) return { received: true };

      const existing = await this.prisma.subscription.findUnique({ where: { stripeSubId: sub.id } });
      if (existing) {
        await this.prisma.$transaction([
          this.prisma.subscription.update({
            where: { stripeSubId: sub.id },
            data: {
              planId: plan.id,
              status: sub.status.toUpperCase() as any,
              currentPeriodEnd: new Date(sub.current_period_end * 1000),
            },
          }),
          this.prisma.organization.update({ where: { id: existing.organizationId }, data: { planId: plan.id } }),
        ]);
        await this.subscriptionService.invalidatePlanCache(existing.organizationId);
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as any;
      const existing = await this.prisma.subscription.findUnique({ where: { stripeSubId: sub.id } });
      if (existing) {
        await this.prisma.subscription.update({ where: { stripeSubId: sub.id }, data: { status: 'CANCELED' } });
        await this.subscriptionService.invalidatePlanCache(existing.organizationId);
      }
    }

    return { received: true };
  }
}
