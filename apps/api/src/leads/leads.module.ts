import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { LeadsController } from './leads.controller';
import { CaptureController } from './capture.controller';
import { LeadsService } from './leads.service';
import { AuthModule } from '../auth/auth.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    MulterModule.register({ limits: { fileSize: 5 * 1024 * 1024 } }),
    AuthModule,
    SubscriptionModule,
    PrismaModule,
  ],
  controllers: [LeadsController, CaptureController],
  providers: [LeadsService],
})
export class LeadsModule {}
