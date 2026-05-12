import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { BillingModule } from './billing/billing.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    WorkspaceModule,
    SubscriptionModule,
    BillingModule,
    WebhooksModule,
    AuditModule,
  ],
})
export class AppModule {}
