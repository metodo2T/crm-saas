import { Test } from '@nestjs/testing';
import { BillingService } from '../../src/billing/billing.service';
import { PrismaService } from '../../src/prisma/prisma.service';

jest.mock('stripe');

const mockPrisma = {
  subscription: {
    findUnique: jest.fn(),
  },
};

describe('BillingService', () => {
  let service: BillingService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(BillingService);
    jest.clearAllMocks();
  });

  describe('createCheckoutSession', () => {
    it('returns url from Stripe session', async () => {
      const mockStripe = (service as any).stripe;
      mockStripe.checkout = {
        sessions: {
          create: jest.fn().mockResolvedValueOnce({ url: 'https://checkout.stripe.com/pay/abc' }),
        },
      };

      const result = await service.createCheckoutSession({
        organizationId: 'org-1',
        stripePriceId: 'price_pro',
        successUrl: 'http://localhost:3000/success',
        cancelUrl: 'http://localhost:3000/cancel',
      });

      expect(result.url).toBe('https://checkout.stripe.com/pay/abc');
    });
  });

  describe('getPortalSession', () => {
    it('returns { url: null } when no subscription found', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValueOnce(null);
      const result = await service.getPortalSession('org-1', 'http://localhost:3000');
      expect(result).toEqual({ url: null });
    });

    it('returns portal url when subscription exists', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValueOnce({ stripeCustomerId: 'cus_123' });
      const mockStripe = (service as any).stripe;
      mockStripe.billingPortal = {
        sessions: {
          create: jest.fn().mockResolvedValueOnce({ url: 'https://billing.stripe.com/portal/abc' }),
        },
      };
      const result = await service.getPortalSession('org-1', 'http://localhost:3000');
      expect(result).toEqual({ url: 'https://billing.stripe.com/portal/abc' });
    });
  });
});
