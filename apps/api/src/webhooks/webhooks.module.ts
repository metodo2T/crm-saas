import { Module } from '@nestjs/common';
import { ClerkWebhookController } from './clerk-webhook.controller';
import { StripeWebhookController } from './stripe-webhook.controller';
import { UsersModule } from '../users/users.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { DealsModule } from '../deals/deals.module';

@Module({
  imports: [UsersModule, SubscriptionModule, DealsModule],
  controllers: [ClerkWebhookController, StripeWebhookController],
})
export class WebhooksModule {}
