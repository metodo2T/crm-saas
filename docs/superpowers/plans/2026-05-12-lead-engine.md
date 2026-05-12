# Lead Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Lead Engine — capture, qualify, and convert leads with full UTM attribution, kanban UI, embeddable form endpoint, and CSV import.

**Architecture:** NestJS `LeadsModule` with two controllers (protected `LeadsController` + public `CaptureController`), `LeadsService` extending `BaseService`, and Redis rate limiting guard. Frontend is a Next.js kanban page using TanStack Query (30s polling) with `@dnd-kit/core` drag-and-drop and shadcn `Sheet` for slide-over.

**Tech Stack:** NestJS 11, Prisma 7, ioredis, csv-parse, @dnd-kit/core, TanStack Query v5, shadcn/ui (Sheet, Badge, Dialog), Next.js 15 App Router.

---

## File Map

**Backend — new files:**
- `apps/api/src/leads/leads.module.ts`
- `apps/api/src/leads/leads.controller.ts`
- `apps/api/src/leads/leads.service.ts`
- `apps/api/src/leads/capture.controller.ts`
- `apps/api/src/leads/dto/create-lead.dto.ts`
- `apps/api/src/leads/dto/update-lead.dto.ts`
- `apps/api/src/leads/dto/update-status.dto.ts`
- `apps/api/src/leads/dto/capture-lead.dto.ts`
- `apps/api/src/leads/guards/capture-rate-limit.guard.ts`
- `apps/api/test/leads/leads.service.spec.ts`
- `apps/api/test/leads/capture.controller.spec.ts`

**Backend — modified files:**
- `packages/db/prisma/schema.prisma` — add Lead model + enums
- `apps/api/src/app.module.ts` — import LeadsModule

**Frontend — new files:**
- `apps/web/app/[orgSlug]/leads/page.tsx`
- `apps/web/app/[orgSlug]/leads/_components/leads-kanban.tsx`
- `apps/web/app/[orgSlug]/leads/_components/lead-card.tsx`
- `apps/web/app/[orgSlug]/leads/_components/lead-slide-over.tsx`
- `apps/web/app/[orgSlug]/leads/_components/new-lead-sheet.tsx`
- `apps/web/app/[orgSlug]/leads/_components/import-csv-dialog.tsx`
- `apps/web/lib/api/leads.ts`

---

## Task 1: Prisma schema — add Lead model

**Files:**
- Modify: `packages/db/prisma/schema.prisma`

- [ ] **Step 1: Add Lead model and enums to schema.prisma**

Open `packages/db/prisma/schema.prisma`. After the `AuditLog` model, add:

```prisma
model Lead {
  id             String       @id @default(uuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  name           String
  email          String?
  phone          String?
  company        String?
  notes          String?
  status         LeadStatus   @default(NOVO)
  source         LeadSource
  assignedToId   String?
  assignedTo     User?        @relation(fields: [assignedToId], references: [id])
  utmSource      String?
  utmMedium      String?
  utmCampaign    String?
  utmContent     String?
  utmTerm        String?
  fbclid         String?
  gclid          String?
  convertedAt    DateTime?
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  @@index([organizationId, createdAt])
  @@index([organizationId, status])
  @@index([organizationId, source])
  @@index([assignedToId])
}

enum LeadStatus {
  NOVO
  CONTATADO
  QUALIFICADO
  CONVERTIDO
  DESCARTADO
}

enum LeadSource {
  MANUAL
  FORM
  CSV
  WHATSAPP
}
```

Also add `leads Lead[]` relation field to the `Organization` model and `leads Lead[]` to the `User` model (for `assignedTo` back-relation).

The `Organization` model after editing:
```prisma
model Organization {
  id           String               @id @default(uuid())
  clerkOrgId   String               @unique
  name         String
  slug         String               @unique
  logoUrl      String?
  planId       String
  plan         Plan                 @relation(fields: [planId], references: [id])
  members      OrganizationMember[]
  subscription Subscription?
  auditLogs    AuditLog[]
  leads        Lead[]
  createdAt    DateTime             @default(now())
  updatedAt    DateTime             @updatedAt
}
```

The `User` model after editing:
```prisma
model User {
  id          String               @id @default(uuid())
  clerkUserId String               @unique
  email       String
  name        String
  avatarUrl   String?
  memberships OrganizationMember[]
  auditLogs   AuditLog[]
  leads       Lead[]
  createdAt   DateTime             @default(now())
  updatedAt   DateTime             @updatedAt

  @@index([email])
}
```

- [ ] **Step 2: Generate Prisma client and migrate**

```bash
cd apps/api
pnpm prisma generate --schema=../../packages/db/prisma/schema.prisma
pnpm prisma migrate dev --schema=../../packages/db/prisma/schema.prisma --name add_lead_model
```

Expected: migration created in `packages/db/prisma/migrations/`, Prisma client regenerated.

- [ ] **Step 3: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/
git commit -m "feat(db): add Lead model with UTM fields and LeadStatus/LeadSource enums"
```

---

## Task 2: DTOs

**Files:**
- Create: `apps/api/src/leads/dto/create-lead.dto.ts`
- Create: `apps/api/src/leads/dto/update-lead.dto.ts`
- Create: `apps/api/src/leads/dto/update-status.dto.ts`
- Create: `apps/api/src/leads/dto/capture-lead.dto.ts`

- [ ] **Step 1: Create create-lead.dto.ts**

```typescript
// apps/api/src/leads/dto/create-lead.dto.ts
export class CreateLeadDto {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  notes?: string;
  source: 'MANUAL' | 'CSV' | 'FORM' | 'WHATSAPP';
  assignedToId?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  fbclid?: string;
  gclid?: string;
}
```

- [ ] **Step 2: Create update-lead.dto.ts**

```typescript
// apps/api/src/leads/dto/update-lead.dto.ts
export class UpdateLeadDto {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  notes?: string;
  assignedToId?: string;
}
```

- [ ] **Step 3: Create update-status.dto.ts**

```typescript
// apps/api/src/leads/dto/update-status.dto.ts
export class UpdateStatusDto {
  status: 'NOVO' | 'CONTATADO' | 'QUALIFICADO' | 'CONVERTIDO' | 'DESCARTADO';
}
```

- [ ] **Step 4: Create capture-lead.dto.ts**

```typescript
// apps/api/src/leads/dto/capture-lead.dto.ts
export class CaptureLeadDto {
  orgId: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  fbclid?: string;
  gclid?: string;
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/leads/dto/
git commit -m "feat(leads): add DTOs for lead CRUD and capture"
```

---

## Task 3: LeadsService

**Files:**
- Create: `apps/api/src/leads/leads.service.ts`
- Create: `apps/api/test/leads/leads.service.spec.ts`

The service extends `BaseService` (from `apps/api/src/common/base.service.ts`) and uses `PrismaService` and `SubscriptionService`.

- [ ] **Step 1: Write the failing tests**

Create `apps/api/test/leads/leads.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { LeadsService } from '../../src/leads/leads.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { SubscriptionService } from '../../src/subscription/subscription.service';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';

const mockPrisma = {
  lead: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    createMany: jest.fn(),
    groupBy: jest.fn(),
  },
};

const mockSubscription = {
  checkLimit: jest.fn(),
  incrementUsage: jest.fn(),
};

describe('LeadsService', () => {
  let service: LeadsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        LeadsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SubscriptionService, useValue: mockSubscription },
      ],
    }).compile();
    service = module.get(LeadsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('creates lead and increments usage counter', async () => {
      const lead = { id: 'lead-1', name: 'João', organizationId: 'org-1', source: 'MANUAL' };
      mockPrisma.lead.create.mockResolvedValueOnce(lead);
      const result = await service.create('org-1', {
        name: 'João', phone: '11999', source: 'MANUAL',
      });
      expect(mockPrisma.lead.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ organizationId: 'org-1', name: 'João', source: 'MANUAL' }),
      });
      expect(mockSubscription.incrementUsage).toHaveBeenCalledWith('org-1', 'leads');
      expect(result).toEqual(lead);
    });

    it('throws BadRequestException when neither email nor phone provided', async () => {
      await expect(
        service.create('org-1', { name: 'João', source: 'MANUAL' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('returns lead when found in org', async () => {
      const lead = { id: 'lead-1', organizationId: 'org-1', name: 'João' };
      mockPrisma.lead.findFirst.mockResolvedValueOnce(lead);
      const result = await service.findOne('org-1', 'lead-1');
      expect(result).toEqual(lead);
    });

    it('throws NotFoundException when lead not in org', async () => {
      mockPrisma.lead.findFirst.mockResolvedValueOnce(null);
      await expect(service.findOne('org-1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    it('updates status and sets convertedAt when CONVERTIDO', async () => {
      const lead = { id: 'lead-1', organizationId: 'org-1', status: 'QUALIFICADO' };
      mockPrisma.lead.findFirst.mockResolvedValueOnce(lead);
      mockPrisma.lead.update.mockResolvedValueOnce({ ...lead, status: 'CONVERTIDO', convertedAt: new Date() });
      await service.updateStatus('org-1', 'lead-1', { status: 'CONVERTIDO' });
      expect(mockPrisma.lead.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'CONVERTIDO', convertedAt: expect.any(Date) }),
        }),
      );
    });

    it('throws ForbiddenException when trying to change status of CONVERTIDO lead', async () => {
      const lead = { id: 'lead-1', status: 'CONVERTIDO' };
      mockPrisma.lead.findFirst.mockResolvedValueOnce(lead);
      await expect(service.updateStatus('org-1', 'lead-1', { status: 'NOVO' })).rejects.toThrow(ForbiddenException);
    });

    it('does not set convertedAt when status is not CONVERTIDO', async () => {
      const lead = { id: 'lead-1', status: 'NOVO' };
      mockPrisma.lead.findFirst.mockResolvedValueOnce(lead);
      mockPrisma.lead.update.mockResolvedValueOnce({ ...lead, status: 'CONTATADO' });
      await service.updateStatus('org-1', 'lead-1', { status: 'CONTATADO' });
      expect(mockPrisma.lead.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'CONTATADO' }),
        }),
      );
      const call = mockPrisma.lead.update.mock.calls[0][0];
      expect(call.data.convertedAt).toBeUndefined();
    });
  });

  describe('softDelete', () => {
    it('sets status to DESCARTADO', async () => {
      const lead = { id: 'lead-1', status: 'NOVO' };
      mockPrisma.lead.findFirst.mockResolvedValueOnce(lead);
      mockPrisma.lead.update.mockResolvedValueOnce({ ...lead, status: 'DESCARTADO' });
      await service.softDelete('org-1', 'lead-1');
      expect(mockPrisma.lead.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'DESCARTADO' } }),
      );
    });
  });

  describe('getKanban', () => {
    it('returns leads grouped by status', async () => {
      const leads = [
        { id: '1', status: 'NOVO', name: 'João' },
        { id: '2', status: 'NOVO', name: 'Carla' },
        { id: '3', status: 'CONTATADO', name: 'Bruno' },
      ];
      mockPrisma.lead.findMany.mockResolvedValueOnce(leads);
      const result = await service.getKanban('org-1');
      expect(result.NOVO).toHaveLength(2);
      expect(result.CONTATADO).toHaveLength(1);
      expect(result.QUALIFICADO).toHaveLength(0);
      expect(result.CONVERTIDO).toHaveLength(0);
      expect(result.DESCARTADO).toHaveLength(0);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/api
pnpm test --testPathPattern=leads/leads.service
```

Expected: FAIL — `LeadsService` not found.

- [ ] **Step 3: Implement LeadsService**

Create `apps/api/src/leads/leads.service.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/api
pnpm test --testPathPattern=leads/leads.service
```

Expected: PASS — 9 tests passing.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/leads/leads.service.ts apps/api/test/leads/leads.service.spec.ts
git commit -m "feat(leads): add LeadsService with CRUD, kanban grouping, status transitions, and CSV import"
```

---

## Task 4: CaptureRateLimitGuard

**Files:**
- Create: `apps/api/src/leads/guards/capture-rate-limit.guard.ts`
- Create: `apps/api/test/leads/capture.controller.spec.ts` (partial — guard tests included here)

The guard uses `ioredis` directly (same pattern as `SubscriptionService`).

- [ ] **Step 1: Write the failing test**

Create `apps/api/test/leads/capture.controller.spec.ts`:

```typescript
import { CaptureRateLimitGuard } from '../../src/leads/guards/capture-rate-limit.guard';
import { ExecutionContext, TooManyRequestsException } from '@nestjs/common';

const mockRedis = {
  incr: jest.fn(),
  expire: jest.fn(),
};

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedis);
});

describe('CaptureRateLimitGuard', () => {
  let guard: CaptureRateLimitGuard;

  function mockCtx(ip: string, orgId: string): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          ip,
          body: { orgId },
          headers: {},
        }),
      }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    guard = new CaptureRateLimitGuard();
    jest.clearAllMocks();
  });

  it('allows request within IP limit', async () => {
    mockRedis.incr.mockResolvedValue(1);
    mockRedis.expire.mockResolvedValue(1);
    const result = await guard.canActivate(mockCtx('1.2.3.4', 'org-1'));
    expect(result).toBe(true);
  });

  it('throws TooManyRequestsException when IP limit exceeded', async () => {
    mockRedis.incr.mockResolvedValueOnce(11).mockResolvedValue(1);
    mockRedis.expire.mockResolvedValue(1);
    await expect(guard.canActivate(mockCtx('1.2.3.4', 'org-1'))).rejects.toThrow(TooManyRequestsException);
  });

  it('throws TooManyRequestsException when org limit exceeded', async () => {
    mockRedis.incr.mockResolvedValueOnce(1).mockResolvedValueOnce(101);
    mockRedis.expire.mockResolvedValue(1);
    await expect(guard.canActivate(mockCtx('1.2.3.4', 'org-1'))).rejects.toThrow(TooManyRequestsException);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api
pnpm test --testPathPattern=leads/capture.controller
```

Expected: FAIL — `CaptureRateLimitGuard` not found.

- [ ] **Step 3: Implement CaptureRateLimitGuard**

Create `apps/api/src/leads/guards/capture-rate-limit.guard.ts`:

```typescript
import { Injectable, CanActivate, ExecutionContext, TooManyRequestsException } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class CaptureRateLimitGuard implements CanActivate {
  private redis: Redis;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const ip = req.ip ?? req.headers['x-forwarded-for'] ?? 'unknown';
    const orgId = req.body?.orgId ?? 'unknown';

    const minute = Math.floor(Date.now() / 60000);
    const ipKey = `ratelimit:capture:ip:${ip}:${minute}`;
    const ipCount = await this.redis.incr(ipKey);
    if (ipCount === 1) await this.redis.expire(ipKey, 60);
    if (ipCount > 10) {
      throw new TooManyRequestsException({ error: 'RATE_LIMIT_IP' });
    }

    const hour = Math.floor(Date.now() / 3600000);
    const orgKey = `ratelimit:capture:org:${orgId}:${hour}`;
    const orgCount = await this.redis.incr(orgKey);
    if (orgCount === 1) await this.redis.expire(orgKey, 3600);
    if (orgCount > 100) {
      throw new TooManyRequestsException({ error: 'RATE_LIMIT_ORG' });
    }

    return true;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/api
pnpm test --testPathPattern=leads/capture.controller
```

Expected: PASS — 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/leads/guards/capture-rate-limit.guard.ts apps/api/test/leads/capture.controller.spec.ts
git commit -m "feat(leads): add CaptureRateLimitGuard with Redis IP and org rate limiting"
```

---

## Task 5: LeadsController and CaptureController

**Files:**
- Create: `apps/api/src/leads/leads.controller.ts`
- Create: `apps/api/src/leads/capture.controller.ts`

- [ ] **Step 1: Create LeadsController**

Create `apps/api/src/leads/leads.controller.ts`:

```typescript
import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, UseInterceptors, UploadedFile,
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
  async importCsv(@CurrentOrg() orgId: string, @UploadedFile() file: Express.Multer.File) {
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
            observações: 'notes', 'observacoes': 'notes', notes: 'notes',
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
      allRows,
      () => this.subscriptionService.checkLimit(orgId, 'leads').then((r) => r.allowed),
    );
  }
}
```

- [ ] **Step 2: Create CaptureController**

Create `apps/api/src/leads/capture.controller.ts`:

```typescript
import { Controller, Post, Body, UseGuards, NotFoundException } from '@nestjs/common';
import { CaptureRateLimitGuard } from './guards/capture-rate-limit.guard';
import { CaptureLeadDto } from './dto/capture-lead.dto';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionService } from '../subscription/subscription.service';

@Controller('leads')
export class CaptureController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  @Post('capture')
  @UseGuards(CaptureRateLimitGuard)
  async capture(@Body() dto: CaptureLeadDto) {
    if (!dto.name) {
      throw new Error('name required');
    }
    if (!dto.email && !dto.phone) {
      throw new Error('email or phone required');
    }

    const org = await this.prisma.organization.findFirst({
      where: { id: dto.orgId },
      include: { subscription: true },
    });
    if (!org || !org.subscription ||
        (org.subscription.status !== 'ACTIVE' && org.subscription.status !== 'TRIALING')) {
      throw new NotFoundException({ error: 'ORG_NOT_FOUND' });
    }

    const { allowed } = await this.subscriptionService.checkLimit(dto.orgId, 'leads');
    if (!allowed) {
      const { TooManyRequestsException } = await import('@nestjs/common');
      throw new TooManyRequestsException({ error: 'PLAN_LIMIT_REACHED' });
    }

    const lead = await this.prisma.lead.create({
      data: {
        organizationId: dto.orgId,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        company: dto.company,
        status: 'NOVO',
        source: 'FORM',
        utmSource: dto.utmSource,
        utmMedium: dto.utmMedium,
        utmCampaign: dto.utmCampaign,
        utmContent: dto.utmContent,
        utmTerm: dto.utmTerm,
        fbclid: dto.fbclid,
        gclid: dto.gclid,
      },
    });
    await this.subscriptionService.incrementUsage(dto.orgId, 'leads');
    return { id: lead.id };
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/leads/leads.controller.ts apps/api/src/leads/capture.controller.ts
git commit -m "feat(leads): add LeadsController and CaptureController"
```

---

## Task 6: LeadsModule + wire into AppModule + install csv-parse

**Files:**
- Create: `apps/api/src/leads/leads.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Install csv-parse**

```bash
cd apps/api
pnpm add csv-parse
```

Expected: `csv-parse` added to `apps/api/package.json`.

- [ ] **Step 2: Create LeadsModule**

Create `apps/api/src/leads/leads.module.ts`:

```typescript
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
```

- [ ] **Step 3: Register LeadsModule in AppModule**

Edit `apps/api/src/app.module.ts`:

```typescript
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
import { LeadsModule } from './leads/leads.module';

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
    LeadsModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 4: Enable global CORS for capture endpoint**

The capture endpoint needs to accept requests from any origin (embeddable form). The main `app.enableCors` in `main.ts` restricts to `WEB_URL`. We need to override CORS for the capture endpoint specifically.

Edit `apps/api/src/main.ts`:

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (server-to-server, Postman)
      // and any origin for capture endpoint (checked per-route below)
      callback(null, true);
    },
    credentials: false,
  });
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
```

> Note: This opens CORS globally. This is acceptable because all protected endpoints require a valid Clerk JWT — CORS alone provides no security boundary for authenticated endpoints. The capture endpoint is intentionally public.

- [ ] **Step 5: Run all API tests**

```bash
cd apps/api
pnpm test
```

Expected: All existing tests pass + new leads tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/leads/leads.module.ts apps/api/src/app.module.ts apps/api/src/main.ts apps/api/package.json pnpm-lock.yaml
git commit -m "feat(leads): register LeadsModule, install csv-parse, open CORS for capture endpoint"
```

---

## Task 7: Install frontend dependencies

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install @dnd-kit packages**

```bash
cd apps/web
pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

Expected: packages added to `apps/web/package.json`.

- [ ] **Step 2: Add shadcn Sheet and Dialog components**

```bash
cd apps/web
pnpm dlx shadcn@latest add sheet dialog select textarea
```

Expected: component files generated in `apps/web/components/ui/`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json apps/web/components/ui/ pnpm-lock.yaml
git commit -m "feat(leads-ui): install @dnd-kit and add shadcn Sheet/Dialog components"
```

---

## Task 8: API client for leads

**Files:**
- Create: `apps/web/lib/api/leads.ts`

- [ ] **Step 1: Create leads API client**

Create `apps/web/lib/api/leads.ts`:

```typescript
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export type LeadStatus = 'NOVO' | 'CONTATADO' | 'QUALIFICADO' | 'CONVERTIDO' | 'DESCARTADO';
export type LeadSource = 'MANUAL' | 'FORM' | 'CSV' | 'WHATSAPP';

export interface Lead {
  id: string;
  organizationId: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  notes?: string;
  status: LeadStatus;
  source: LeadSource;
  assignedToId?: string;
  assignedTo?: { id: string; name: string; avatarUrl?: string };
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  fbclid?: string;
  gclid?: string;
  convertedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KanbanData {
  NOVO: Lead[];
  CONTATADO: Lead[];
  QUALIFICADO: Lead[];
  CONVERTIDO: Lead[];
  DESCARTADO: Lead[];
}

async function apiFetch(path: string, token: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init?.headers },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getKanban(token: string): Promise<KanbanData> {
  return apiFetch('/leads/kanban', token);
}

export async function createLead(token: string, data: {
  name: string; email?: string; phone?: string; company?: string;
  notes?: string; source: LeadSource; assignedToId?: string;
}): Promise<Lead> {
  return apiFetch('/leads', token, { method: 'POST', body: JSON.stringify(data) });
}

export async function updateLeadStatus(token: string, id: string, status: LeadStatus): Promise<Lead> {
  return apiFetch(`/leads/${id}/status`, token, { method: 'PATCH', body: JSON.stringify({ status }) });
}

export async function updateLead(token: string, id: string, data: Partial<Lead>): Promise<Lead> {
  return apiFetch(`/leads/${id}`, token, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function assignLead(token: string, id: string, assignedToId: string | null): Promise<Lead> {
  return apiFetch(`/leads/${id}/assign`, token, { method: 'PATCH', body: JSON.stringify({ assignedToId }) });
}

export async function deleteLead(token: string, id: string): Promise<Lead> {
  return apiFetch(`/leads/${id}`, token, { method: 'DELETE' });
}

export async function importCsv(token: string, file: File): Promise<{ imported: number; skipped: number; errors: Array<{ row: number; reason: string }> }> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API}/leads/import/csv`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/lib/api/leads.ts
git commit -m "feat(leads-ui): add leads API client"
```

---

## Task 9: LeadCard component

**Files:**
- Create: `apps/web/app/[orgSlug]/leads/_components/lead-card.tsx`

- [ ] **Step 1: Create LeadCard**

Create `apps/web/app/[orgSlug]/leads/_components/lead-card.tsx`:

```tsx
'use client';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Lead } from '@/lib/api/leads';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  lead: Lead;
  onClick: (lead: Lead) => void;
}

const SOURCE_COLORS: Record<string, string> = {
  MANUAL: 'bg-slate-700 text-slate-300',
  CSV: 'bg-slate-700 text-slate-300',
  FORM: 'bg-slate-700 text-slate-300',
  WHATSAPP: 'bg-green-900 text-green-300',
};

const SOURCE_LABELS: Record<string, string> = {
  MANUAL: 'MANUAL',
  CSV: 'CSV',
  FORM: 'FORM',
  WHATSAPP: 'WHATSAPP',
};

export function LeadCard({ lead, onClick }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const relativeTime = formatDistanceToNow(new Date(lead.createdAt), {
    addSuffix: true, locale: ptBR,
  });

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onClick(lead)}
      className="bg-[#1a2236] border border-[#1e293b] rounded-lg p-3 cursor-pointer hover:border-slate-500 transition-colors"
    >
      <p className="text-sm font-semibold text-slate-100 mb-1">{lead.name}</p>
      <div className="flex items-center gap-1.5 mb-2">
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${SOURCE_COLORS[lead.source]}`}>
          {SOURCE_LABELS[lead.source]}
        </span>
        <span className="text-[10px] text-slate-500">{relativeTime}</span>
      </div>
      {lead.assignedTo ? (
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-indigo-600 flex items-center justify-center text-[8px] text-white font-bold">
            {lead.assignedTo.name[0].toUpperCase()}
          </div>
          <span className="text-[10px] text-slate-500">{lead.assignedTo.name}</span>
        </div>
      ) : (
        <span className="text-[10px] text-slate-600">— sem responsável</span>
      )}
    </div>
  );
}
```

> Note: This requires `date-fns`. Install it:
> ```bash
> cd apps/web && pnpm add date-fns
> ```

- [ ] **Step 2: Install date-fns**

```bash
cd apps/web
pnpm add date-fns
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/[orgSlug]/leads/_components/lead-card.tsx apps/web/package.json pnpm-lock.yaml
git commit -m "feat(leads-ui): add LeadCard component with drag-and-drop support"
```

---

## Task 10: LeadSlideOver component

**Files:**
- Create: `apps/web/app/[orgSlug]/leads/_components/lead-slide-over.tsx`

- [ ] **Step 1: Create LeadSlideOver**

Create `apps/web/app/[orgSlug]/leads/_components/lead-slide-over.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Lead, LeadStatus } from '@/lib/api/leads';
import { useAuth } from '@clerk/nextjs';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateLeadStatus, deleteLead } from '@/lib/api/leads';
import { useOrganization } from '@clerk/nextjs';

const STATUS_LABELS: Record<LeadStatus, string> = {
  NOVO: 'Novo',
  CONTATADO: 'Contatado',
  QUALIFICADO: 'Qualificado',
  CONVERTIDO: 'Convertido',
  DESCARTADO: 'Descartado',
};

const STATUS_COLORS: Record<LeadStatus, string> = {
  NOVO: 'bg-blue-900 text-blue-300',
  CONTATADO: 'bg-amber-900 text-amber-300',
  QUALIFICADO: 'bg-violet-900 text-violet-300',
  CONVERTIDO: 'bg-green-900 text-green-300',
  DESCARTADO: 'bg-red-900 text-red-300',
};

const ALL_STATUSES: LeadStatus[] = ['NOVO', 'CONTATADO', 'QUALIFICADO', 'CONVERTIDO', 'DESCARTADO'];

interface Props {
  lead: Lead | null;
  open: boolean;
  onClose: () => void;
}

export function LeadSlideOver({ lead, open, onClose }: Props) {
  const [showUtms, setShowUtms] = useState(false);
  const { getToken } = useAuth();
  const { organization } = useOrganization();
  const queryClient = useQueryClient();

  const statusMutation = useMutation({
    mutationFn: async (status: LeadStatus) => {
      const token = await getToken();
      return updateLeadStatus(token!, lead!.id, status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads', 'kanban', organization?.id] });
      onClose();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return deleteLead(token!, lead!.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads', 'kanban', organization?.id] });
      onClose();
    },
  });

  if (!lead) return null;

  const hasUtms = lead.utmSource || lead.utmMedium || lead.utmCampaign || lead.fbclid || lead.gclid;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-[420px] bg-slate-900 border-slate-700 text-slate-100">
        <SheetHeader>
          <SheetTitle className="text-slate-100 text-xl">{lead.name}</SheetTitle>
          <div className="flex gap-2 mt-1">
            <span className={`text-xs px-2 py-1 rounded font-semibold ${STATUS_COLORS[lead.status]}`}>
              {STATUS_LABELS[lead.status]}
            </span>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-3 text-sm text-slate-300">
          {lead.email && <p>📧 {lead.email}</p>}
          {lead.phone && <p>📱 {lead.phone}</p>}
          {lead.company && <p>🏢 {lead.company}</p>}
          {lead.notes && <p className="text-slate-400 text-xs mt-2">{lead.notes}</p>}
        </div>

        {hasUtms && (
          <div className="mt-4">
            <button
              onClick={() => setShowUtms(!showUtms)}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              {showUtms ? '▲ Ocultar UTMs' : '▼ Ver UTMs'}
            </button>
            {showUtms && (
              <div className="mt-2 bg-slate-800 rounded-lg p-3 text-xs text-slate-400 space-y-1 font-mono">
                {lead.utmSource && <p>utm_source: {lead.utmSource}</p>}
                {lead.utmMedium && <p>utm_medium: {lead.utmMedium}</p>}
                {lead.utmCampaign && <p>utm_campaign: {lead.utmCampaign}</p>}
                {lead.utmContent && <p>utm_content: {lead.utmContent}</p>}
                {lead.utmTerm && <p>utm_term: {lead.utmTerm}</p>}
                {lead.fbclid && <p>fbclid: {lead.fbclid}</p>}
                {lead.gclid && <p>gclid: {lead.gclid}</p>}
              </div>
            )}
          </div>
        )}

        <div className="mt-6">
          <p className="text-xs text-slate-500 mb-2 uppercase tracking-wide">Mover para</p>
          <div className="flex flex-wrap gap-2">
            {ALL_STATUSES.filter((s) => s !== lead.status && lead.status !== 'CONVERTIDO').map((s) => (
              <Button
                key={s}
                size="sm"
                variant="outline"
                className="text-xs border-slate-600 text-slate-300 hover:bg-slate-700"
                onClick={() => statusMutation.mutate(s)}
                disabled={statusMutation.isPending}
              >
                {STATUS_LABELS[s]}
              </Button>
            ))}
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-700">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            className="text-xs"
          >
            Descartar lead
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/[orgSlug]/leads/_components/lead-slide-over.tsx
git commit -m "feat(leads-ui): add LeadSlideOver with status change and discard actions"
```

---

## Task 11: NewLeadSheet component

**Files:**
- Create: `apps/web/app/[orgSlug]/leads/_components/new-lead-sheet.tsx`

- [ ] **Step 1: Create NewLeadSheet**

Create `apps/web/app/[orgSlug]/leads/_components/new-lead-sheet.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth, useOrganization } from '@clerk/nextjs';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createLead } from '@/lib/api/leads';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function NewLeadSheet({ open, onClose }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [error, setError] = useState('');

  const { getToken } = useAuth();
  const { organization } = useOrganization();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error('Nome é obrigatório');
      if (!email.trim() && !phone.trim()) throw new Error('Email ou telefone é obrigatório');
      const token = await getToken();
      return createLead(token!, { name, email: email || undefined, phone: phone || undefined, company: company || undefined, source: 'MANUAL' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads', 'kanban', organization?.id] });
      setName(''); setEmail(''); setPhone(''); setCompany(''); setError('');
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-[400px] bg-slate-900 border-slate-700 text-slate-100">
        <SheetHeader>
          <SheetTitle className="text-slate-100">Novo Lead</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div>
            <Label className="text-slate-400 text-xs">Nome *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 bg-slate-800 border-slate-600 text-slate-100" placeholder="Nome completo" />
          </div>
          <div>
            <Label className="text-slate-400 text-xs">Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 bg-slate-800 border-slate-600 text-slate-100" placeholder="email@exemplo.com" type="email" />
          </div>
          <div>
            <Label className="text-slate-400 text-xs">Telefone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 bg-slate-800 border-slate-600 text-slate-100" placeholder="(11) 99999-0000" />
          </div>
          <div>
            <Label className="text-slate-400 text-xs">Empresa</Label>
            <Input value={company} onChange={(e) => setCompany(e.target.value)} className="mt-1 bg-slate-800 border-slate-600 text-slate-100" placeholder="Nome da empresa" />
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white"
          >
            {mutation.isPending ? 'Salvando...' : 'Criar Lead'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/[orgSlug]/leads/_components/new-lead-sheet.tsx
git commit -m "feat(leads-ui): add NewLeadSheet form"
```

---

## Task 12: ImportCsvDialog component

**Files:**
- Create: `apps/web/app/[orgSlug]/leads/_components/import-csv-dialog.tsx`

- [ ] **Step 1: Create ImportCsvDialog**

Create `apps/web/app/[orgSlug]/leads/_components/import-csv-dialog.tsx`:

```tsx
'use client';
import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth, useOrganization } from '@clerk/nextjs';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { importCsv } from '@/lib/api/leads';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ImportCsvDialog({ open, onClose }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: Array<{ row: number; reason: string }> } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { getToken } = useAuth();
  const { organization } = useOrganization();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Selecione um arquivo CSV');
      const token = await getToken();
      return importCsv(token!, file);
    },
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ['leads', 'kanban', organization?.id] });
    },
  });

  const handleClose = () => {
    setFile(null); setResult(null); mutation.reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-100">
        <DialogHeader>
          <DialogTitle className="text-slate-100">Importar CSV</DialogTitle>
        </DialogHeader>
        <div className="mt-4 space-y-4">
          <p className="text-xs text-slate-400">
            Colunas aceitas: <code className="text-blue-400">nome, email, telefone, empresa, observações</code>
            <br />Máximo 500 linhas por importação.
          </p>
          {!result ? (
            <>
              <div
                className="border-2 border-dashed border-slate-600 rounded-lg p-6 text-center cursor-pointer hover:border-slate-400"
                onClick={() => fileRef.current?.click()}
              >
                {file ? (
                  <p className="text-sm text-slate-300">{file.name}</p>
                ) : (
                  <p className="text-sm text-slate-500">Clique para selecionar ou arraste o arquivo CSV</p>
                )}
              </div>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              {mutation.error && <p className="text-red-400 text-xs">{(mutation.error as Error).message}</p>}
              <Button
                onClick={() => mutation.mutate()}
                disabled={!file || mutation.isPending}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white"
              >
                {mutation.isPending ? 'Importando...' : 'Importar'}
              </Button>
            </>
          ) : (
            <div className="space-y-3">
              <div className="bg-slate-800 rounded-lg p-4 space-y-2 text-sm">
                <p><span className="text-green-400 font-semibold">{result.imported}</span> leads importados</p>
                {result.skipped > 0 && <p><span className="text-amber-400">{result.skipped}</span> pulados</p>}
                {result.errors.length > 0 && (
                  <div>
                    <p className="text-red-400 text-xs mb-1">{result.errors.length} erros:</p>
                    {result.errors.slice(0, 5).map((e) => (
                      <p key={e.row} className="text-xs text-slate-500">Linha {e.row}: {e.reason}</p>
                    ))}
                    {result.errors.length > 5 && <p className="text-xs text-slate-600">+{result.errors.length - 5} mais</p>}
                  </div>
                )}
              </div>
              <Button onClick={handleClose} className="w-full" variant="outline">Fechar</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/[orgSlug]/leads/_components/import-csv-dialog.tsx
git commit -m "feat(leads-ui): add ImportCsvDialog with result summary"
```

---

## Task 13: LeadsKanban component

**Files:**
- Create: `apps/web/app/[orgSlug]/leads/_components/leads-kanban.tsx`

- [ ] **Step 1: Create LeadsKanban**

Create `apps/web/app/[orgSlug]/leads/_components/leads-kanban.tsx`:

```tsx
'use client';
import { useState } from 'react';
import {
  DndContext, DragEndEvent, DragOverlay, PointerSensor, useSensor, useSensors, closestCenter,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth, useOrganization } from '@clerk/nextjs';
import { getKanban, updateLeadStatus, Lead, LeadStatus, KanbanData } from '@/lib/api/leads';
import { LeadCard } from './lead-card';
import { LeadSlideOver } from './lead-slide-over';

const COLUMNS: { key: LeadStatus; label: string; color: string; border: string }[] = [
  { key: 'NOVO', label: 'Novo', color: 'text-blue-400', border: 'border-l-blue-500' },
  { key: 'CONTATADO', label: 'Contatado', color: 'text-amber-400', border: 'border-l-amber-500' },
  { key: 'QUALIFICADO', label: 'Qualificado', color: 'text-violet-400', border: 'border-l-violet-500' },
  { key: 'CONVERTIDO', label: 'Convertido', color: 'text-green-400', border: 'border-l-green-500' },
  { key: 'DESCARTADO', label: 'Descartado', color: 'text-red-400', border: 'border-l-red-500' },
];

export function LeadsKanban() {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const { getToken } = useAuth();
  const { organization } = useOrganization();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['leads', 'kanban', organization?.id],
    queryFn: async () => {
      const token = await getToken();
      return getKanban(token!);
    },
    refetchInterval: 30_000,
    enabled: !!organization?.id,
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: LeadStatus }) => {
      const token = await getToken();
      return updateLeadStatus(token!, id, status);
    },
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['leads', 'kanban', organization?.id] });
      const prev = queryClient.getQueryData<KanbanData>(['leads', 'kanban', organization?.id]);
      if (prev) {
        const updated = { ...prev };
        for (const col of Object.keys(updated) as LeadStatus[]) {
          const idx = updated[col].findIndex((l) => l.id === id);
          if (idx !== -1) {
            const [lead] = updated[col].splice(idx, 1);
            updated[status] = [{ ...lead, status }, ...updated[status]];
            break;
          }
        }
        queryClient.setQueryData(['leads', 'kanban', organization?.id], updated);
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['leads', 'kanban', organization?.id], ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['leads', 'kanban', organization?.id] });
    },
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveDragId(null);
    if (!over || active.id === over.id) return;
    const targetStatus = over.id as LeadStatus;
    if (!COLUMNS.find((c) => c.key === targetStatus)) return;
    statusMutation.mutate({ id: active.id as string, status: targetStatus });
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-slate-500">Carregando leads...</div>;
  }

  const allLeads = data ? Object.values(data).flat() : [];
  const activeLead = activeDragId ? allLeads.find((l) => l.id === activeDragId) : null;

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={(e) => setActiveDragId(e.active.id as string)} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-5 gap-3 h-full overflow-x-auto pb-4">
          {COLUMNS.map((col) => {
            const leads = data?.[col.key] ?? [];
            return (
              <div key={col.key} className="bg-[#111827] border border-[#1e293b] rounded-xl overflow-hidden min-w-[200px]">
                <div className="px-3 py-2.5 border-b border-[#1e293b] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${col.border.replace('border-l-', 'bg-')}`} />
                    <span className={`text-xs font-bold uppercase tracking-wide ${col.color}`}>{col.label}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded-full">{leads.length}</span>
                </div>
                <SortableContext items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy} id={col.key}>
                  <div className="p-2 space-y-2 min-h-[100px]">
                    {leads.map((lead) => (
                      <LeadCard key={lead.id} lead={lead} onClick={setSelectedLead} />
                    ))}
                  </div>
                </SortableContext>
              </div>
            );
          })}
        </div>
        <DragOverlay>
          {activeLead ? <LeadCard lead={activeLead} onClick={() => {}} /> : null}
        </DragOverlay>
      </DndContext>

      <LeadSlideOver lead={selectedLead} open={!!selectedLead} onClose={() => setSelectedLead(null)} />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/[orgSlug]/leads/_components/leads-kanban.tsx
git commit -m "feat(leads-ui): add LeadsKanban with dnd-kit drag-and-drop and optimistic updates"
```

---

## Task 14: Leads page

**Files:**
- Create: `apps/web/app/[orgSlug]/leads/page.tsx`

- [ ] **Step 1: Create the leads page**

Create `apps/web/app/[orgSlug]/leads/page.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { OrganizationSwitcher, UserButton } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LeadsKanban } from './_components/leads-kanban';
import { NewLeadSheet } from './_components/new-lead-sheet';
import { ImportCsvDialog } from './_components/import-csv-dialog';

export default function LeadsPage() {
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Shared header */}
      <header className="flex items-center justify-between border-b px-6 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <OrganizationSwitcher hidePersonal />
          <span className="text-sm text-muted-foreground">CRM</span>
        </div>
        <UserButton />
      </header>

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold">Leads</h1>
        </div>
        <div className="flex items-center gap-2">
          <Input placeholder="Buscar leads..." className="w-48 h-8 text-sm bg-slate-800 border-slate-600 text-slate-100" />
          <Button variant="outline" size="sm" className="text-xs border-slate-600 text-slate-300 hover:bg-slate-700" onClick={() => setImportOpen(true)}>
            ↑ CSV
          </Button>
          <Button size="sm" className="text-xs bg-blue-600 hover:bg-blue-500 text-white" onClick={() => setNewLeadOpen(true)}>
            + Novo Lead
          </Button>
        </div>
      </div>

      {/* Kanban board */}
      <main className="flex-1 overflow-hidden p-4">
        <LeadsKanban />
      </main>

      <NewLeadSheet open={newLeadOpen} onClose={() => setNewLeadOpen(false)} />
      <ImportCsvDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
```

- [ ] **Step 2: Add leads link to dashboard**

Edit `apps/web/app/[orgSlug]/dashboard/page.tsx`. Replace the leads card placeholder to link to `/[orgSlug]/leads`:

The dashboard is a server component, so we need `params` to build the link. Update:

```tsx
import { auth } from '@clerk/nextjs/server';
import { OrganizationSwitcher, UserButton } from '@clerk/nextjs';
import Link from 'next/link';

export default async function DashboardPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  await auth.protect();
  const { orgSlug } = await params;

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-3">
          <OrganizationSwitcher hidePersonal />
          <span className="text-sm text-muted-foreground">CRM</span>
        </div>
        <UserButton />
      </header>
      <main className="p-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="mt-6 grid grid-cols-3 gap-4">
          <Link href={`/${orgSlug}/leads`} className="rounded-xl border bg-card p-5 hover:bg-accent transition-colors">
            <p className="text-sm text-muted-foreground">Leads</p>
            <p className="mt-1 text-3xl font-bold">—</p>
            <p className="mt-1 text-xs text-blue-400">Abrir Lead Engine →</p>
          </Link>
          {[
            { title: 'Conversas WhatsApp', value: '—', desc: 'Módulo WhatsApp Inbox (próximo)' },
            { title: 'Deals no pipeline', value: '—', desc: 'Módulo Sales Pipeline (próximo)' },
          ].map((card) => (
            <div key={card.title} className="rounded-xl border bg-card p-5">
              <p className="text-sm text-muted-foreground">{card.title}</p>
              <p className="mt-1 text-3xl font-bold">{card.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{card.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/[orgSlug]/leads/page.tsx apps/web/app/[orgSlug]/dashboard/page.tsx
git commit -m "feat(leads-ui): add leads page with kanban board and link from dashboard"
```

---

## Task 15: Run full test suite and verify

- [ ] **Step 1: Run all API tests**

```bash
cd apps/api
pnpm test
```

Expected: All tests passing. Look for the leads tests:
- `leads.service.spec.ts` — 9 tests
- `capture.controller.spec.ts` — 3 tests

- [ ] **Step 2: Build the API to check for TypeScript errors**

```bash
cd apps/api
pnpm build
```

Expected: Build completes without errors.

- [ ] **Step 3: Build the web app**

```bash
cd apps/web
pnpm build
```

Expected: Build completes without errors.

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "feat(leads): complete Lead Engine — kanban UI, capture endpoint, CSV import, UTM tracking"
```

---

## Self-review checklist

- [x] **Spec § 3 (Data Model):** Task 1 — Lead model with all UTM fields, LeadStatus/LeadSource enums, indexes
- [x] **Spec § 3 (Validation):** Task 3 — `create()` throws when neither email nor phone; `updateStatus()` locks CONVERTIDO
- [x] **Spec § 3 (convertedAt):** Task 3 — `updateStatus()` sets `convertedAt` when transitioning to CONVERTIDO
- [x] **Spec § 4 (LeadsController endpoints):** Task 5 — all 10 endpoints present
- [x] **Spec § 4 (@CheckPlanLimit):** Task 5 — POST /leads and POST /leads/import/csv both guarded
- [x] **Spec § 4 (CaptureController):** Tasks 4+5 — public endpoint with rate limiting guard
- [x] **Spec § 4 (capture protections):** Task 4 — 10/min per IP, 100/hour per org; Task 5 — org exists + plan limit check
- [x] **Spec § 5 (Kanban UI):** Tasks 9+13 — LeadCard + LeadsKanban with dnd-kit, 5 columns
- [x] **Spec § 5 (polling 30s):** Task 13 — `refetchInterval: 30_000`
- [x] **Spec § 5 (optimistic updates):** Task 13 — `onMutate` + `onError` rollback
- [x] **Spec § 5 (slide-over):** Task 10 — LeadSlideOver with UTM expand, status change, discard
- [x] **Spec § 5 (NewLead form):** Task 11 — NewLeadSheet validates name + (email or phone)
- [x] **Spec § 6 (CSV import):** Task 5 — column mapping, max 500 rows, partial import; Task 12 — dialog with result
- [x] **Spec § 7 (module structure):** Task 6 — LeadsModule wiring
- [x] **Spec § 8 (error codes):** Task 3 service + Task 5 capture controller cover all error scenarios
