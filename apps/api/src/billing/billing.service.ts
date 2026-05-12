import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';

interface CheckoutParams {
  organizationId: string;
  stripePriceId: string;
  successUrl: string;
  cancelUrl: string;
  stripeCustomerId?: string;
}

@Injectable()
export class BillingService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private stripe: any;

  constructor(private readonly prisma: PrismaService) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder', {
      apiVersion: '2026-04-22.dahlia' as any,
    });
  }

  async createCheckoutSession(params: CheckoutParams) {
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: params.stripePriceId, quantity: 1 }],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      client_reference_id: params.organizationId,
      ...(params.stripeCustomerId && { customer: params.stripeCustomerId }),
    });
    return { url: session.url };
  }

  async createPortalSession(stripeCustomerId: string, returnUrl: string) {
    const session = await this.stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    });
    return { url: session.url };
  }

  async getPortalSession(organizationId: string, returnUrl: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { organizationId } });
    if (!sub) return { url: null };
    return this.createPortalSession(sub.stripeCustomerId, returnUrl);
  }
}
