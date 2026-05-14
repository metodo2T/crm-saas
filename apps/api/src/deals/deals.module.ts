import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PipelineService } from './pipeline.service';
import { PipelineController } from './pipeline.controller';
import { DealsService } from './deals.service';
import { DealsController } from './deals.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PipelineController, DealsController],
  providers: [PipelineService, DealsService],
  exports: [PipelineService],
})
export class DealsModule {}
