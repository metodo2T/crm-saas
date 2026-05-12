import { Test } from '@nestjs/testing';
import { BillingService } from '../../src/billing/billing.service';

jest.mock('stripe');

describe('BillingService', () => {
  let service: BillingService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [BillingService],
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
});
