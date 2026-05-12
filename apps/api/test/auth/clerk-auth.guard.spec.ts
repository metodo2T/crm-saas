import { ClerkAuthGuard } from '../../src/auth/clerk-auth.guard';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import * as clerkBackend from '@clerk/backend';

jest.mock('@clerk/backend');

describe('ClerkAuthGuard', () => {
  let guard: ClerkAuthGuard;

  beforeEach(() => {
    guard = new ClerkAuthGuard();
  });

  function mockContext(authHeader?: string): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization: authHeader }, auth: {} }),
      }),
    } as unknown as ExecutionContext;
  }

  it('throws UnauthorizedException when no Authorization header', async () => {
    await expect(guard.canActivate(mockContext())).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when token is invalid', async () => {
    jest.spyOn(clerkBackend, 'verifyToken').mockRejectedValueOnce(new Error('invalid'));
    await expect(guard.canActivate(mockContext('Bearer bad-token'))).rejects.toThrow(UnauthorizedException);
  });

  it('sets request.auth and returns true when token is valid', async () => {
    jest.spyOn(clerkBackend, 'verifyToken').mockResolvedValueOnce({
      sub: 'user_123',
      org_id: 'org_456',
    } as any);

    const req = { headers: { authorization: 'Bearer valid-token' }, auth: {} };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(req.auth).toEqual({ userId: 'user_123', organizationId: 'org_456' });
  });
});
