import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BaseService } from '../common/base.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { UpdateStatusDto } from './dto/update-status.dto';

@Injectable()
export class LeadsService extends BaseService {
  constructor(
    prisma: PrismaService,
    private readonly subscriptionService: SubscriptionService,
    private readonly notifications: NotificationsService,
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

    if (dto.source === 'FORM' || dto.source === 'WHATSAPP') {
      this.notifyLeadCreated(organizationId, lead).catch(() => null);
    }

    return lead;
  }

  private async notifyLeadCreated(organizationId: string, lead: { name: string; email?: string | null; phone?: string | null; source: string }) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        members: {
          where: { role: 'ADMIN' },
          include: { user: { select: { email: true } } },
          take: 5,
        },
      },
    });
    if (!org) return;
    const adminEmails = org.members.map((m) => m.user.email).filter(Boolean) as string[];
    await this.notifications.sendLeadCreated({
      to: adminEmails,
      leadName: lead.name,
      orgName: org.name,
      orgSlug: org.slug,
      source: lead.source,
      email: lead.email,
      phone: lead.phone,
    });
  }

  async findAll(organizationId: string, query: {
    status?: string; source?: string; assignedTo?: string;
    search?: string; page?: number; limit?: number;
  }) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const where: Prisma.LeadWhereInput = { organizationId };
    if (query.status) where.status = query.status as any;
    if (query.source) where.source = query.source as any;
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
    const lead = await this.findOne(organizationId, id);
    const updated = await this.prisma.lead.update({ where: { id }, data: { assignedToId } });

    if (assignedToId) {
      this.notifyLeadAssigned(organizationId, lead.name, assignedToId).catch(() => null);
    }

    return updated;
  }

  private async notifyLeadAssigned(organizationId: string, leadName: string, assignedToId: string) {
    const [org, user] = await Promise.all([
      this.prisma.organization.findUnique({ where: { id: organizationId }, select: { slug: true } }),
      this.prisma.user.findUnique({ where: { id: assignedToId }, select: { email: true } }),
    ]);
    if (!org || !user) return;
    await this.notifications.sendLeadAssigned({
      to: user.email,
      leadName,
      orgSlug: org.slug,
    });
  }

  async softDelete(organizationId: string, id: string) {
    await this.findOne(organizationId, id);
    return this.prisma.lead.update({ where: { id }, data: { status: 'DESCARTADO' } });
  }

  async exportCsv(organizationId: string, query: {
    status?: string; source?: string; search?: string;
  }): Promise<string> {
    const where: Prisma.LeadWhereInput = { organizationId };
    if (query.status) where.status = query.status as any;
    if (query.source) where.source = query.source as any;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const leads = await this.prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { assignedTo: { select: { name: true } } },
    });
    const headers = ['Nome', 'Email', 'Telefone', 'Empresa', 'Status', 'Origem', 'Responsável', 'Criado em'];
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = leads.map((l) => [
      l.name, l.email ?? '', l.phone ?? '', l.company ?? '',
      l.status, l.source, l.assignedTo?.name ?? '',
      new Date(l.createdAt).toLocaleDateString('pt-BR'),
    ].map(escape).join(','));
    return [headers.map(escape).join(','), ...rows].join('\n');
  }

  async bulkAction(organizationId: string, ids: string[], action: 'status' | 'delete', status?: string) {
    const count = await this.prisma.lead.count({ where: { id: { in: ids }, organizationId } });
    if (count !== ids.length) throw new ForbiddenException('Some leads not found or do not belong to this org');
    if (action === 'delete') {
      await this.prisma.lead.updateMany({
        where: { id: { in: ids }, organizationId },
        data: { status: 'DESCARTADO' },
      });
    } else if (action === 'status' && status) {
      const data: any = { status };
      if (status === 'CONVERTIDO') data.convertedAt = new Date();
      await this.prisma.lead.updateMany({
        where: { id: { in: ids }, organizationId, NOT: { status: 'CONVERTIDO' } },
        data,
      });
    }
    return { updated: ids.length };
  }

  async getAnalyticsTrend(organizationId: string) {
    const since = new Date();
    since.setDate(since.getDate() - 29);
    const leads = await this.prisma.lead.findMany({
      where: { organizationId, createdAt: { gte: since } },
      select: { createdAt: true },
    });
    const byDay: Record<string, number> = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      byDay[d.toISOString().slice(0, 10)] = 0;
    }
    for (const lead of leads) {
      const key = new Date(lead.createdAt).toISOString().slice(0, 10);
      if (byDay[key] !== undefined) byDay[key]++;
    }
    return Object.entries(byDay).map(([date, total]) => ({ date, total }));
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
      await this.subscriptionService.incrementUsageBy(organizationId, 'leads', valid.length);
    }
    return { imported: valid.length, skipped: rows.length - valid.length - errors.length, errors };
  }
}
