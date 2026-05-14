import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentOrg } from '../auth/decorators';
import { PipelineService } from './pipeline.service';
import { CreateStageDto } from './dto/create-stage.dto';
import { UpdateStageDto } from './dto/update-stage.dto';
import { ReorderStagesDto } from './dto/reorder-stages.dto';

@Controller('pipeline')
@UseGuards(ClerkAuthGuard)
export class PipelineController {
  constructor(private readonly pipelineService: PipelineService) {}

  @Get()
  getKanban(@CurrentOrg() orgId: string) {
    return this.pipelineService.getKanban(orgId);
  }

  @Post('stages')
  createStage(@CurrentOrg() orgId: string, @Body() dto: CreateStageDto) {
    return this.pipelineService.createStage(orgId, dto);
  }

  @Patch('stages/reorder')
  reorderStages(@CurrentOrg() orgId: string, @Body() dto: ReorderStagesDto) {
    return this.pipelineService.reorderStages(orgId, dto);
  }

  @Patch('stages/:id')
  updateStage(@CurrentOrg() orgId: string, @Param('id') id: string, @Body() dto: UpdateStageDto) {
    return this.pipelineService.updateStage(orgId, id, dto);
  }

  @Delete('stages/:id')
  deleteStage(@CurrentOrg() orgId: string, @Param('id') id: string) {
    return this.pipelineService.deleteStage(orgId, id);
  }
}
