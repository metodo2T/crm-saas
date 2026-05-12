import { Module } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { PlanGuard } from './plan.guard';

@Module({
  providers: [SubscriptionService, PlanGuard],
  exports: [SubscriptionService, PlanGuard],
})
export class SubscriptionModule {}
