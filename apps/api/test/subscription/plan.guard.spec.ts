import { PlanGuard } from '../../src/subscription/plan.guard';
import { SubscriptionService } from '../../src/subscription/subscription.service';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

const mockSubscriptionService = {
  checkLimit: jest.fn(),
};

const mockReflector = {
  get: jest.fn(),
};

describe('PlanGuard', () => {
  let guard: PlanGuard;

  beforeEach(() => {
    guard = new PlanGuard(
      mockSubscriptionService as any,
      mockReflector as any,
    );
    jest.clearAllMocks();
  });

  function mockContext(orgId = 'org-1'): ExecutionContext {
    return {
      switchToHttp: () => ({ getRequest: () => ({ auth: { organizationId: orgId } }) }),
      getHandler: () => ({}),
    } as unknown as ExecutionContext;
  }

  it('passes through when no limit decorator', async () => {
    mockReflector.get.mockReturnValueOnce(undefined);
    const result = await guard.canActivate(mockContext());
    expect(result).toBe(true);
    expect(mockSubscriptionService.checkLimit).not.toHaveBeenCalled();
  });

  it('passes when within limit', async () => {
    mockReflector.get.mockReturnValueOnce('leads');
    mockSubscriptionService.checkLimit.mockResolvedValueOnce({ allowed: true });
    const result = await guard.canActivate(mockContext());
    expect(result).toBe(true);
  });

  it('throws ForbiddenException when limit exceeded', async () => {
    mockReflector.get.mockReturnValueOnce('leads');
    mockSubscriptionService.checkLimit.mockResolvedValueOnce({ allowed: false });
    await expect(guard.canActivate(mockContext())).rejects.toThrow(ForbiddenException);
  });

  it('throws UnauthorizedException when auth context is missing', async () => {
    mockReflector.get.mockReturnValueOnce('leads');
    const ctx = {
      switchToHttp: () => ({ getRequest: () => ({ auth: undefined }) }),
      getHandler: () => ({}),
    } as unknown as ExecutionContext;
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });
});
