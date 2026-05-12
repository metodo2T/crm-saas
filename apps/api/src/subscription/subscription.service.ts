import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Redis from 'ioredis';

type LimitResource = 'leads' | 'users' | 'whatsapp';

@Injectable()
export class SubscriptionService {
  private redis: Redis;

  constructor(private readonly prisma: PrismaService) {
    this.redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
  }

  async checkLimit(organizationId: string, resource: LimitResource): Promise<{ allowed: boolean }> {
    const cacheKey = `plan:${organizationId}`;
    let planJson = await this.redis.get(cacheKey);

    if (!planJson) {
      const sub = await this.prisma.subscription.findUnique({
        where: { organizationId },
        include: { plan: true },
      });
      if (!sub || (sub.status !== 'ACTIVE' && sub.status !== 'TRIALING')) return { allowed: false };
      planJson = JSON.stringify(sub.plan);
      await this.redis.set(cacheKey, planJson, 'EX', 300);
    }

    const planData = JSON.parse(planJson);
    const maxMap: Record<LimitResource, number> = {
      leads: planData.maxLeads,
      users: planData.maxUsers,
      whatsapp: planData.maxWhatsapp,
    };

    const max = maxMap[resource];
    if (max === -1) return { allowed: true };

    const yearMonth = new Date().toISOString().slice(0, 7);
    const usageKey = `usage:${resource}:${organizationId}:${yearMonth}`;
    const current = parseInt((await this.redis.get(usageKey)) ?? '0', 10);

    return { allowed: current < max };
  }

  async incrementUsage(organizationId: string, resource: LimitResource) {
    const yearMonth = new Date().toISOString().slice(0, 7);
    const usageKey = `usage:${resource}:${organizationId}:${yearMonth}`;
    await this.redis.incr(usageKey);
    await this.redis.expireat(usageKey, this.endOfMonthTimestamp());
  }

  async incrementUsageBy(organizationId: string, resource: LimitResource, count: number) {
    if (count <= 0) return;
    const yearMonth = new Date().toISOString().slice(0, 7);
    const usageKey = `usage:${resource}:${organizationId}:${yearMonth}`;
    await this.redis.incrby(usageKey, count);
    await this.redis.expireat(usageKey, this.endOfMonthTimestamp());
  }

  async invalidatePlanCache(organizationId: string) {
    await this.redis.del(`plan:${organizationId}`);
  }

  private endOfMonthTimestamp(): number {
    const d = new Date();
    return Math.floor(new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime() / 1000);
  }
}
