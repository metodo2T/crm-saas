import { CaptureRateLimitGuard } from '../../src/leads/guards/capture-rate-limit.guard';
import { ExecutionContext, TooManyRequestsException } from '@nestjs/common';

const mockRedis = {
  incr: jest.fn(),
  expire: jest.fn(),
};

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedis);
});

describe('CaptureRateLimitGuard', () => {
  let guard: CaptureRateLimitGuard;

  function mockCtx(ip: string, orgId: string): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          ip,
          body: { orgId },
          headers: {},
        }),
      }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    guard = new CaptureRateLimitGuard();
    jest.clearAllMocks();
  });

  it('allows request within IP limit', async () => {
    mockRedis.incr.mockResolvedValue(1);
    mockRedis.expire.mockResolvedValue(1);
    const result = await guard.canActivate(mockCtx('1.2.3.4', 'org-1'));
    expect(result).toBe(true);
  });

  it('throws TooManyRequestsException when IP limit exceeded', async () => {
    mockRedis.incr.mockResolvedValueOnce(11).mockResolvedValue(1);
    mockRedis.expire.mockResolvedValue(1);
    await expect(guard.canActivate(mockCtx('1.2.3.4', 'org-1'))).rejects.toThrow(TooManyRequestsException);
  });

  it('throws TooManyRequestsException when org limit exceeded', async () => {
    mockRedis.incr.mockResolvedValueOnce(1).mockResolvedValueOnce(101);
    mockRedis.expire.mockResolvedValue(1);
    await expect(guard.canActivate(mockCtx('1.2.3.4', 'org-1'))).rejects.toThrow(TooManyRequestsException);
  });
});
