import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { BaseService } from '../common/base.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDealDto } from './dto/create-deal.dto';
import { UpdateDealDto } from './dto/update-deal.dto';
import { MoveDealDto } from './dto/move-deal.dto';

const DEAL_INCLUDE = {
  lead: { select: { id: true, name: true } },
  assignedTo: { select: { id: true, name: true, avatarUrl: true } },
  stage: { select: { id: true, name: true, color: true, type: true } },
};

function serializeDeal(d: any) {
  return { ...d, value: d.value ? Number(d.value) : null };
}

@Injectable()
export class DealsService extends BaseService {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  private async findPipeline(organizationId: string) {
    const pipeline = await this.prisma.pipeline.findUnique({ where: { organizationId } });
    if (!pipeline) throw new BadRequestException('Pipeline not initialized for this organization');
    return pipeline;
  }

  async create(organizationId: string, dto: CreateDealDto) {
    if (!dto.title?.trim()) throw new BadRequestException('title is required');
    const { organizationId: orgId } = this.orgFilter(organizationId);
    const pipeline = await this.findPipeline(orgId);

    const stage = await this.prisma.pipelineStage.findFirst({ where: { id: dto.stageId, pipelineId: pipeline.id } });
    if (!stage) throw new NotFoundException('Stage not found');

    const data: any = {
      organizationId: orgId,
      pipelineId: pipeline.id,
      stageId: dto.stageId,
      title: dto.title.trim(),
    };
    if (dto.leadId) data.leadId = dto.leadId;
    if (dto.value != null) data.value = dto.value;
    if (dto.probability != null) data.probability = dto.probability;
    if (dto.expectedCloseAt) data.expectedCloseAt = new Date(dto.expectedCloseAt);
    if (dto.assignedToId) data.assignedToId = dto.assignedToId;
    if (dto.notes) data.notes = dto.notes;

    if (stage.type === 'WON') data.wonAt = new Date();
    if (stage.type === 'LOST') data.lostAt = new Date();

    const deal = await this.prisma.deal.create({ data, include: DEAL_INCLUDE });
    return serializeDeal(deal);
  }

  async findAll(organizationId: string, filters: {
    stageId?: string; assignedTo?: string; search?: string; page?: number; limit?: number;
  }) {
    const { organizationId: orgId } = this.orgFilter(organizationId);
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 20, 100);
    const where: any = { organizationId: orgId };
    if (filters.stageId) where.stageId = filters.stageId;
    if (filters.assignedTo) where.assignedToId = filters.assignedTo;
    if (filters.search) where.title = { contains: filters.search, mode: 'insensitive' };

    const [items, total] = await Promise.all([
      this.prisma.deal.findMany({
        where, include: DEAL_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.deal.count({ where }),
    ]);
    return { items: items.map(serializeDeal), total, page, limit };
  }

  async findOne(organizationId: string, id: string) {
    const { organizationId: orgId } = this.orgFilter(organizationId);
    const deal = await this.prisma.deal.findFirst({ where: { id, organizationId: orgId }, include: DEAL_INCLUDE });
    if (!deal) throw new NotFoundException('Deal not found');
    return serializeDeal(deal);
  }

  async update(organizationId: string, id: string, dto: UpdateDealDto) {
    const { organizationId: orgId } = this.orgFilter(organizationId);
    const deal = await this.prisma.deal.findFirst({ where: { id, organizationId: orgId } });
    if (!deal) throw new NotFoundException('Deal not found');

    const data: any = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.leadId !== undefined) data.leadId = dto.leadId;
    if (dto.value !== undefined) data.value = dto.value;
    if (dto.probability !== undefined) data.probability = dto.probability;
    if (dto.expectedCloseAt !== undefined) data.expectedCloseAt = dto.expectedCloseAt ? new Date(dto.expectedCloseAt) : null;
    if (dto.assignedToId !== undefined) data.assignedToId = dto.assignedToId;
    if (dto.notes !== undefined) data.notes = dto.notes;

    const updated = await this.prisma.deal.update({ where: { id }, data, include: DEAL_INCLUDE });
    return serializeDeal(updated);
  }

  async move(organizationId: string, id: string, dto: MoveDealDto) {
    const { organizationId: orgId } = this.orgFilter(organizationId);
    const deal = await this.prisma.deal.findFirst({ where: { id, organizationId: orgId } });
    if (!deal) throw new NotFoundException('Deal not found');

    const pipeline = await this.findPipeline(orgId);
    const stage = await this.prisma.pipelineStage.findFirst({ where: { id: dto.stageId, pipelineId: pipeline.id } });
    if (!stage) throw new NotFoundException('Target stage not found');

    const data: any = { stageId: dto.stageId, wonAt: null, lostAt: null, lostReason: null };
    if (stage.type === 'WON') data.wonAt = new Date();
    if (stage.type === 'LOST') {
      data.lostAt = new Date();
      if (dto.lostReason) data.lostReason = dto.lostReason;
    }

    const updated = await this.prisma.deal.update({ where: { id }, data, include: DEAL_INCLUDE });
    return serializeDeal(updated);
  }

  async remove(organizationId: string, id: string) {
    const { organizationId: orgId } = this.orgFilter(organizationId);
    const deal = await this.prisma.deal.findFirst({ where: { id, organizationId: orgId } });
    if (!deal) throw new NotFoundException('Deal not found');
    await this.prisma.deal.delete({ where: { id } });
    return { deleted: id };
  }
}
