import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { BillingService } from './billing.service';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentOrg } from '../auth/decorators';

@Controller('billing')
@UseGuards(ClerkAuthGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

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
    return this.billingService.getPortalSession(orgId, body.returnUrl);
  }
}
