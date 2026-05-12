import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { BaseService } from '../common/base.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { UpdateStatusDto } from './dto/update-status.dto';

@Injectable()
export class LeadsService extends BaseService {
  constructor(
    prisma: PrismaService,
    private readonly subscriptionService: SubscriptionService,
  ) {
    super(prisma);
  }

  async create(organizationId: string, dto: CreateLeadDto) {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException({ error: 'VALIDATION_ERROR', message: 'email or phone required' });
    }
    const lead = await this.prisma.lead.create({
      data: { ...dto, organizationId, status: 'NOVO' },
    });
    await this.subscriptionService.incrementUsage(organizationId, 'leads');
    return lead;
  }

  async findAll(organizationId: string, query: {
    status?: string; source?: string; assignedTo?: string;
    search?: string; page?: number; limit?: number;
  }) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const where: any = { organizationId };
    if (query.status) where.status = query.status;
    if (query.source) where.source = query.source;
    if (query.assignedTo) where.assignedToId = query.assignedTo;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.lead.findMany({
        where, skip: (page - 1) * limit, take: limit,
        orderBy: { createdAt: 'desc' },
        include: { assignedTo: { select: { id: true, name: true, avatarUrl: true } } },
      }),
      this.prisma.lead.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async getKanban(organizationId: string) {
    const leads = await this.prisma.lead.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      include: { assignedTo: { select: { id: true, name: true, avatarUrl: true } } },
    });
    const grouped: Record<string, typeof leads> = {
      NOVO: [], CONTATADO: [], QUALIFICADO: [], CONVERTIDO: [], DESCARTADO: [],
    };
    for (const lead of leads) {
      grouped[lead.status].push(lead);
    }
    return grouped;
  }

  async getAnalytics(organizationId: string) {
    const [byStatus, bySource] = await Promise.all([
      this.prisma.lead.groupBy({
        by: ['status'], where: { organizationId }, _count: { id: true },
      }),
      this.prisma.lead.groupBy({
        by: ['source'], where: { organizationId }, _count: { id: true },
      }),
    ]);
    return {
      byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r._count.id])),
      bySource: Object.fromEntries(bySource.map((r) => [r.source, r._count.id])),
    };
  }

  async findOne(organizationId: string, id: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, organizationId },
      include: { assignedTo: { select: { id: true, name: true, avatarUrl: true } } },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  async update(organizationId: string, id: string, dto: UpdateLeadDto) {
    await this.findOne(organizationId, id);
    return this.prisma.lead.update({ where: { id }, data: dto });
  }

  async updateStatus(organizationId: string, id: string, dto: UpdateStatusDto) {
    const lead = await this.findOne(organizationId, id);
    if (lead.status === 'CONVERTIDO') {
      throw new ForbiddenException({ error: 'LEAD_ALREADY_CONVERTED', message: 'Cannot change status of a converted lead' });
    }
    const data: any = { status: dto.status };
    if (dto.status === 'CONVERTIDO') data.convertedAt = new Date();
    return this.prisma.lead.update({ where: { id }, data });
  }

  async assign(organizationId: string, id: string, assignedToId: string | null) {
    await this.findOne(organizationId, id);
    return this.prisma.lead.update({ where: { id }, data: { assignedToId } });
  }

  async softDelete(organizationId: string, id: string) {
    await this.findOne(organizationId, id);
    return this.prisma.lead.update({ where: { id }, data: { status: 'DESCARTADO' } });
  }

  async importCsv(organizationId: string, rows: Array<{
    name: string; email?: string; phone?: string; company?: string; notes?: string;
  }>, planCheck: () => Promise<boolean>): Promise<{ imported: number; skipped: number; errors: Array<{ row: number; reason: string }> }> {
    const allowed = await planCheck();
    if (!allowed) {
      return { imported: 0, skipped: rows.length, errors: [{ row: 0, reason: 'PLAN_LIMIT_REACHED' }] };
    }
    const valid: typeof rows = [];
    const errors: Array<{ row: number; reason: string }> = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.name) { errors.push({ row: i + 1, reason: 'name required' }); continue; }
      if (!row.email && !row.phone) { errors.push({ row: i + 1, reason: 'email or phone required' }); continue; }
      valid.push(row);
    }
    if (valid.length > 0) {
      await this.prisma.lead.createMany({
        data: valid.map((r) => ({ ...r, organizationId, status: 'NOVO', source: 'CSV' })),
      });
      for (let i = 0; i < valid.length; i++) {
        await this.subscriptionService.incrementUsage(organizationId, 'leads');
      }
    }
    return { imported: valid.length, skipped: rows.length - valid.length - errors.length, errors };
  }
}
