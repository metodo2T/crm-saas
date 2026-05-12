import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SubscriptionService } from './subscription.service';
import { CHECK_PLAN_LIMIT_KEY } from './check-plan-limit.decorator';

@Injectable()
export class PlanGuard implements CanActivate {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const resource = this.reflector.get<string>(CHECK_PLAN_LIMIT_KEY, context.getHandler());
    if (!resource) return true;

    const req = context.switchToHttp().getRequest();
    const organizationId = req.auth?.organizationId;
    if (!organizationId) throw new UnauthorizedException('Organization context required');

    const { allowed } = await this.subscriptionService.checkLimit(organizationId, resource as any);
    if (!allowed) {
      throw new ForbiddenException({
        error: 'PLAN_LIMIT_REACHED',
        upgrade_url: '/billing',
      });
    }
    return true;
  }
}
