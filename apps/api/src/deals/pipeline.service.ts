import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { BaseService } from '../common/base.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStageDto } from './dto/create-stage.dto';
import { UpdateStageDto } from './dto/update-stage.dto';
import { ReorderStagesDto } from './dto/reorder-stages.dto';

const DEFAULT_STAGES = [
  { name: 'Prospecção',  color: '#94a3b8', order: 0, type: 'REGULAR' as const },
  { name: 'Qualificação', color: '#3b82f6', order: 1, type: 'REGULAR' as const },
  { name: 'Proposta',    color: '#a855f7', order: 2, type: 'REGULAR' as const },
  { name: 'Negociação',  color: '#f59e0b', order: 3, type: 'REGULAR' as const },
  { name: 'Ganho',       color: '#22c55e', order: 4, type: 'WON'     as const },
  { name: 'Perdido',     color: '#ef4444', order: 5, type: 'LOST'    as const },
];

@Injectable()
export class PipelineService extends BaseService {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async createDefaultPipeline(organizationId: string) {
    const pipeline = await this.prisma.pipeline.create({ data: { organizationId } });
    await this.prisma.pipelineStage.createMany({
      data: DEFAULT_STAGES.map((s) => ({ ...s, pipelineId: pipeline.id })),
    });
    return pipeline;
  }

  private async getPipeline(organizationId: string) {
    let pipeline = await this.prisma.pipeline.findUnique({ where: { organizationId } });
    if (!pipeline) pipeline = await this.createDefaultPipeline(organizationId);
    return pipeline;
  }

  async getKanban(organizationId: string) {
    this.orgFilter(organizationId);
    const pipeline = await this.getPipeline(organizationId);

    const [stages, sums] = await Promise.all([
      this.prisma.pipelineStage.findMany({
        where: { pipelineId: pipeline.id },
        orderBy: { order: 'asc' },
        include: {
          deals: {
            orderBy: { createdAt: 'desc' },
            include: {
              lead: { select: { id: true, name: true } },
              assignedTo: { select: { id: true, name: true, avatarUrl: true } },
            },
          },
        },
      }),
      this.prisma.deal.groupBy({
        by: ['stageId'],
        where: { pipelineId: pipeline.id },
        _sum: { value: true },
      }),
    ]);

    const sumMap = new Map(sums.map((s) => [s.stageId, Number(s._sum.value ?? 0)]));

    return {
      id: pipeline.id,
      stages: stages.map((stage) => ({
        id: stage.id,
        name: stage.name,
        color: stage.color,
        order: stage.order,
        type: stage.type,
        totalValue: sumMap.get(stage.id) ?? 0,
        deals: stage.deals.map((d) => ({
          ...d,
          value: d.value ? Number(d.value) : null,
        })),
      })),
    };
  }

  async createStage(organizationId: string, dto: CreateStageDto) {
    this.orgFilter(organizationId);
    const pipeline = await this.getPipeline(organizationId);
    const wonLost = await this.prisma.pipelineStage.findMany({
      where: { pipelineId: pipeline.id, type: { in: ['WON', 'LOST'] } },
      orderBy: { order: 'asc' },
    });
    const last = await this.prisma.pipelineStage.findFirst({
      where: { pipelineId: pipeline.id, type: 'REGULAR' },
      orderBy: { order: 'desc' },
    });
    const insertOrder = wonLost.length > 0 ? wonLost[0].order : (last ? last.order + 1 : 0);
    if (wonLost.length > 0) {
      await Promise.all(
        wonLost.map((s) =>
          this.prisma.pipelineStage.update({ where: { id: s.id }, data: { order: s.order + 1 } })
        )
      );
    }
    return this.prisma.pipelineStage.create({
      data: { pipelineId: pipeline.id, name: dto.name, color: dto.color ?? '#6366f1', order: insertOrder, type: 'REGULAR' },
    });
  }

  async updateStage(organizationId: string, stageId: string, dto: UpdateStageDto) {
    this.orgFilter(organizationId);
    const pipeline = await this.getPipeline(organizationId);
    const stage = await this.prisma.pipelineStage.findFirst({ where: { id: stageId, pipelineId: pipeline.id } });
    if (!stage) throw new NotFoundException('Stage not found');
    return this.prisma.pipelineStage.update({
      where: { id: stageId },
      data: { ...(dto.name && { name: dto.name }), ...(dto.color && { color: dto.color }) },
    });
  }

  async deleteStage(organizationId: string, stageId: string) {
    this.orgFilter(organizationId);
    const pipeline = await this.getPipeline(organizationId);
    const stage = await this.prisma.pipelineStage.findFirst({ where: { id: stageId, pipelineId: pipeline.id } });
    if (!stage) throw new NotFoundException('Stage not found');
    if (stage.type !== 'REGULAR') throw new BadRequestException('Cannot delete terminal stages');

    const regularStages = await this.prisma.pipelineStage.findMany({
      where: { pipelineId: pipeline.id, type: 'REGULAR' },
      orderBy: { order: 'asc' },
    });
    if (regularStages.length <= 1) {
      throw new BadRequestException({ error: 'CANNOT_DELETE_LAST_STAGE', message: 'Cannot delete the only regular stage' });
    }

    const prev = regularStages.filter((s) => s.order < stage.order).pop();
    const fallback = prev ?? regularStages.find((s) => s.id !== stageId)!;

    await this.prisma.$transaction([
      this.prisma.deal.updateMany({ where: { stageId, pipelineId: pipeline.id }, data: { stageId: fallback.id } }),
      this.prisma.pipelineStage.delete({ where: { id: stageId } }),
    ]);

    return { deleted: stageId, migratedTo: fallback.id };
  }

  async reorderStages(organizationId: string, dto: ReorderStagesDto) {
    this.orgFilter(organizationId);
    const pipeline = await this.getPipeline(organizationId);
    const stages = await this.prisma.pipelineStage.findMany({ where: { pipelineId: pipeline.id } });
    const stageMap = new Map(stages.map((s) => [s.id, s]));

    for (const id of dto.stageIds) {
      if (!stageMap.has(id)) throw new BadRequestException(`Stage ${id} not found in pipeline`);
    }

    await Promise.all(
      dto.stageIds.map((id, idx) =>
        this.prisma.pipelineStage.update({ where: { id }, data: { order: idx } })
      )
    );
    return { reordered: true };
  }
}
