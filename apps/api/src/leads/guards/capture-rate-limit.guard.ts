import { Injectable, CanActivate, ExecutionContext, TooManyRequestsException } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class CaptureRateLimitGuard implements CanActivate {
  private redis: Redis;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const ip = req.ip ?? req.headers['x-forwarded-for'] ?? 'unknown';
    const orgId = req.body?.orgId ?? 'unknown';

    const minute = Math.floor(Date.now() / 60000);
    const ipKey = `ratelimit:capture:ip:${ip}:${minute}`;
    const ipCount = await this.redis.incr(ipKey);
    if (ipCount === 1) await this.redis.expire(ipKey, 60);
    if (ipCount > 10) {
      throw new TooManyRequestsException({ error: 'RATE_LIMIT_IP' });
    }

    const hour = Math.floor(Date.now() / 3600000);
    const orgKey = `ratelimit:capture:org:${orgId}:${hour}`;
    const orgCount = await this.redis.incr(orgKey);
    if (orgCount === 1) await this.redis.expire(orgKey, 3600);
    if (orgCount > 100) {
      throw new TooManyRequestsException({ error: 'RATE_LIMIT_ORG' });
    }

    return true;
  }
}
