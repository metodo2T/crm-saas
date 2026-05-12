import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { BillingService } from './billing.service';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentOrg } from '../auth/decorators';
import { PrismaService } from '../prisma/prisma.service';

@Controller('billing')
@UseGuards(ClerkAuthGuard)
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('checkout')
  async createCheckout(
    @CurrentOrg() orgId: string,
    @Body() body: { priceId: string; successUrl: string; cancelUrl: string },
  ) {
    return this.billingService.createCheckoutSession({
      organizationId: orgId,
      stripePriceId: body.priceId,
      successUrl: body.successUrl,
      cancelUrl: body.cancelUrl,
    });
  }

  @Post('portal')
  async createPortal(@CurrentOrg() orgId: string, @Body() body: { returnUrl: string }) {
    const sub = await this.prisma.subscription.findUnique({ where: { organizationId: orgId } });
    if (!sub) return { url: null };
    return this.billingService.createPortalSession(sub.stripeCustomerId, body.returnUrl);
  }
}
