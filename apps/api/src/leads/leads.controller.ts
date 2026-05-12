import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { PlanGuard } from '../subscription/plan.guard';
import { CheckPlanLimit } from '../subscription/check-plan-limit.decorator';
import { CurrentOrg } from '../auth/decorators';
import { LeadsService } from './leads.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { parse } from 'csv-parse/sync';

@Controller('leads')
@UseGuards(ClerkAuthGuard)
export class LeadsController {
  constructor(
    private readonly leadsService: LeadsService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  @Get()
  findAll(
    @CurrentOrg() orgId: string,
    @Query('status') status?: string,
    @Query('source') source?: string,
    @Query('assignedTo') assignedTo?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.leadsService.findAll(orgId, {
      status, source, assignedTo, search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get('kanban')
  getKanban(@CurrentOrg() orgId: string) {
    return this.leadsService.getKanban(orgId);
  }

  @Get('analytics')
  getAnalytics(@CurrentOrg() orgId: string) {
    return this.leadsService.getAnalytics(orgId);
  }

  @Get(':id')
  findOne(@CurrentOrg() orgId: string, @Param('id') id: string) {
    return this.leadsService.findOne(orgId, id);
  }

  @Post()
  @UseGuards(PlanGuard)
  @CheckPlanLimit('leads')
  create(@CurrentOrg() orgId: string, @Body() dto: CreateLeadDto) {
    return this.leadsService.create(orgId, dto);
  }

  @Patch(':id')
  update(@CurrentOrg() orgId: string, @Param('id') id: string, @Body() dto: UpdateLeadDto) {
    return this.leadsService.update(orgId, id, dto);
  }

  @Patch(':id/status')
  updateStatus(@CurrentOrg() orgId: string, @Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.leadsService.updateStatus(orgId, id, dto);
  }

  @Patch(':id/assign')
  assign(
    @CurrentOrg() orgId: string,
    @Param('id') id: string,
    @Body('assignedToId') assignedToId: string | null,
  ) {
    return this.leadsService.assign(orgId, id, assignedToId);
  }

  @Delete(':id')
  softDelete(@CurrentOrg() orgId: string, @Param('id') id: string) {
    return this.leadsService.softDelete(orgId, id);
  }

  @Post('import/csv')
  @UseGuards(PlanGuard)
  @CheckPlanLimit('leads')
  @UseInterceptors(FileInterceptor('file'))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async importCsv(@CurrentOrg() orgId: string, @UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException({ error: 'VALIDATION_ERROR', message: 'CSV file required' });
    }
    const content = file.buffer.toString('utf-8');
    const allRows = parse(content, {
      columns: (header: string[]) =>
        header.map((h) => {
          const normalized = h.toLowerCase().trim();
          const map: Record<string, string> = {
            nome: 'name', name: 'name',
            email: 'email',
            telefone: 'phone', phone: 'phone',
            empresa: 'company', company: 'company',
            'observações': 'notes', observacoes: 'notes', notes: 'notes',
          };
          return map[normalized] ?? normalized;
        }),
      skip_empty_lines: true,
    });
    if (allRows.length > 500) {
      return { imported: 0, skipped: 0, errors: [{ row: 0, reason: 'CSV_TOO_LARGE' }] };
    }
    return this.leadsService.importCsv(
      orgId,
      allRows as Array<{ name: string; email?: string; phone?: string; company?: string; notes?: string }>,
      () => this.subscriptionService.checkLimit(orgId, 'leads').then((r) => r.allowed),
    );
  }
}
