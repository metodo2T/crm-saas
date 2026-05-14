# Pipeline/Deals Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sales pipeline with configurable stages and drag-and-drop deal cards to the CRM SaaS.

**Architecture:** Three new Prisma models (Pipeline, PipelineStage, Deal) feed a NestJS `deals` module with separate controllers for pipeline management and deal CRUD. The frontend adds a kanban page at `/[orgSlug]/pipeline` using the existing `@dnd-kit` library with optimistic React Query updates.

**Tech Stack:** NestJS 11, Prisma 7, PostgreSQL, Next.js 16, React 19, shadcn/ui, @dnd-kit/core, @dnd-kit/sortable, @tanstack/react-query, Clerk

---

## File Map

**Create (backend):**
- `apps/api/src/deals/dto/create-stage.dto.ts`
- `apps/api/src/deals/dto/update-stage.dto.ts`
- `apps/api/src/deals/dto/reorder-stages.dto.ts`
- `apps/api/src/deals/dto/create-deal.dto.ts`
- `apps/api/src/deals/dto/update-deal.dto.ts`
- `apps/api/src/deals/dto/move-deal.dto.ts`
- `apps/api/src/deals/pipeline.service.ts`
- `apps/api/src/deals/pipeline.controller.ts`
- `apps/api/src/deals/deals.service.ts`
- `apps/api/src/deals/deals.controller.ts`
- `apps/api/src/deals/deals.module.ts`

**Modify (backend):**
- `packages/db/prisma/schema.prisma` — add StageType enum + 3 models + relations
- `apps/api/src/app.module.ts` — import DealsModule
- `apps/api/src/webhooks/webhooks.module.ts` — import DealsModule
- `apps/api/src/webhooks/clerk-webhook.controller.ts` — inject PipelineService, call on org.created

**Create (frontend):**
- `apps/web/lib/api/pipeline.ts`
- `apps/web/app/[orgSlug]/pipeline/page.tsx`
- `apps/web/app/[orgSlug]/pipeline/settings/page.tsx`
- `apps/web/app/[orgSlug]/pipeline/_components/pipeline-header.tsx`
- `apps/web/app/[orgSlug]/pipeline/_components/pipeline-kanban.tsx`
- `apps/web/app/[orgSlug]/pipeline/_components/stage-column.tsx`
- `apps/web/app/[orgSlug]/pipeline/_components/deal-card.tsx`
- `apps/web/app/[orgSlug]/pipeline/_components/new-deal-sheet.tsx`
- `apps/web/app/[orgSlug]/pipeline/_components/deal-slide-over.tsx`

**Modify (frontend):**
- `apps/web/app/[orgSlug]/_components/app-nav.tsx` — add Pipeline nav item

---

## Task 1: Prisma Schema

**Files:**
- Modify: `packages/db/prisma/schema.prisma`

- [ ] **Step 1: Add the StageType enum and three new models to the schema**

Open `packages/db/prisma/schema.prisma`. After the last existing enum (`WaMsgStatus`), append:

```prisma
enum StageType {
  REGULAR
  WON
  LOST
}

model Pipeline {
  id             String          @id @default(uuid())
  organizationId String          @unique
  organization   Organization    @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  stages         PipelineStage[]
  deals          Deal[]
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
}

model PipelineStage {
  id         String    @id @default(uuid())
  pipelineId String
  pipeline   Pipeline  @relation(fields: [pipelineId], references: [id], onDelete: Cascade)
  name       String
  color      String    @default("#6366f1")
  order      Int
  type       StageType @default(REGULAR)
  deals      Deal[]
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  @@index([pipelineId, order])
}

model Deal {
  id              String        @id @default(uuid())
  organizationId  String
  organization    Organization  @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  pipelineId      String
  pipeline        Pipeline      @relation(fields: [pipelineId], references: [id])
  stageId         String
  stage           PipelineStage @relation(fields: [stageId], references: [id])
  leadId          String?
  lead            Lead?         @relation(fields: [leadId], references: [id])
  title           String
  value           Decimal?      @db.Decimal(12, 2)
  probability     Int?
  expectedCloseAt DateTime?
  assignedToId    String?
  assignedTo      User?         @relation(fields: [assignedToId], references: [id])
  notes           String?
  wonAt           DateTime?
  lostAt          DateTime?
  lostReason      String?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@index([organizationId, stageId])
  @@index([organizationId, leadId])
  @@index([assignedToId])
}
```

- [ ] **Step 2: Add back-relations to existing models**

In the `Organization` model, add after `whatsappInstance WhatsAppInstance?`:
```prisma
  pipeline        Pipeline?
```

In the `User` model, add after `leads Lead[]`:
```prisma
  deals           Deal[]
```

In the `Lead` model, add after `whatsappMessages WhatsAppMessage[]`:
```prisma
  deals           Deal[]
```

- [ ] **Step 3: Run migration**

```bash
cd C:\Users\OS\crm-saas\packages\db
pnpm db:migrate
```

When prompted for migration name, type: `add_pipeline_deals`

Expected output: `Your database is now in sync with your schema.`

- [ ] **Step 4: Regenerate Prisma client**

```bash
cd C:\Users\OS\crm-saas\packages\db
pnpm db:generate
```

Expected output ends with: `Generated Prisma Client`

- [ ] **Step 5: Commit**

```bash
cd C:\Users\OS\crm-saas
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/
git commit -m "feat: add Pipeline, PipelineStage, Deal models to schema"
```

---

## Task 2: Backend DTOs

**Files:**
- Create: `apps/api/src/deals/dto/create-stage.dto.ts`
- Create: `apps/api/src/deals/dto/update-stage.dto.ts`
- Create: `apps/api/src/deals/dto/reorder-stages.dto.ts`
- Create: `apps/api/src/deals/dto/create-deal.dto.ts`
- Create: `apps/api/src/deals/dto/update-deal.dto.ts`
- Create: `apps/api/src/deals/dto/move-deal.dto.ts`

- [ ] **Step 1: Create stage DTOs**

`apps/api/src/deals/dto/create-stage.dto.ts`:
```ts
export class CreateStageDto {
  name: string;
  color?: string;
}
```

`apps/api/src/deals/dto/update-stage.dto.ts`:
```ts
export class UpdateStageDto {
  name?: string;
  color?: string;
}
```

`apps/api/src/deals/dto/reorder-stages.dto.ts`:
```ts
export class ReorderStagesDto {
  stageIds: string[];
}
```

- [ ] **Step 2: Create deal DTOs**

`apps/api/src/deals/dto/create-deal.dto.ts`:
```ts
export class CreateDealDto {
  title: string;
  stageId: string;
  leadId?: string;
  value?: number;
  probability?: number;
  expectedCloseAt?: string;
  assignedToId?: string;
  notes?: string;
}
```

`apps/api/src/deals/dto/update-deal.dto.ts`:
```ts
export class UpdateDealDto {
  title?: string;
  leadId?: string | null;
  value?: number | null;
  probability?: number | null;
  expectedCloseAt?: string | null;
  assignedToId?: string | null;
  notes?: string | null;
}
```

`apps/api/src/deals/dto/move-deal.dto.ts`:
```ts
export class MoveDealDto {
  stageId: string;
  lostReason?: string;
}
```

- [ ] **Step 3: Commit**

```bash
cd C:\Users\OS\crm-saas
git add apps/api/src/deals/dto/
git commit -m "feat: add Pipeline/Deal DTOs"
```

---

## Task 3: PipelineService

**Files:**
- Create: `apps/api/src/deals/pipeline.service.ts`

- [ ] **Step 1: Create the service**

`apps/api/src/deals/pipeline.service.ts`:
```ts
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
    const last = await this.prisma.pipelineStage.findFirst({
      where: { pipelineId: pipeline.id, type: 'REGULAR' },
      orderBy: { order: 'desc' },
    });
    // Insert before WON/LOST stages (which are at the end)
    const wonLost = await this.prisma.pipelineStage.findMany({
      where: { pipelineId: pipeline.id, type: { in: ['WON', 'LOST'] } },
      orderBy: { order: 'asc' },
    });
    const insertOrder = wonLost.length > 0 ? wonLost[0].order : (last ? last.order + 1 : 0);
    // Shift WON/LOST up
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

    // Find fallback stage (previous by order, or first regular if none)
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
```

- [ ] **Step 2: Manually verify the service logic**

Read through `pipeline.service.ts` and confirm:
- `createDefaultPipeline` creates 6 stages with correct types
- `getKanban` uses `Promise.all` for parallel queries (no N+1)
- `deleteStage` throws if only 1 REGULAR stage remains
- `deleteStage` migrates deals in a transaction

- [ ] **Step 3: Commit**

```bash
cd C:\Users\OS\crm-saas
git add apps/api/src/deals/pipeline.service.ts
git commit -m "feat: add PipelineService"
```

---

## Task 4: PipelineController

**Files:**
- Create: `apps/api/src/deals/pipeline.controller.ts`

- [ ] **Step 1: Create the controller**

`apps/api/src/deals/pipeline.controller.ts`:
```ts
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
```

- [ ] **Step 2: Commit**

```bash
cd C:\Users\OS\crm-saas
git add apps/api/src/deals/pipeline.controller.ts
git commit -m "feat: add PipelineController"
```

---

## Task 5: DealsService

**Files:**
- Create: `apps/api/src/deals/deals.service.ts`

- [ ] **Step 1: Create the service**

`apps/api/src/deals/deals.service.ts`:
```ts
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
```

- [ ] **Step 2: Commit**

```bash
cd C:\Users\OS\crm-saas
git add apps/api/src/deals/deals.service.ts
git commit -m "feat: add DealsService"
```

---

## Task 6: DealsController

**Files:**
- Create: `apps/api/src/deals/deals.controller.ts`

- [ ] **Step 1: Create the controller**

`apps/api/src/deals/deals.controller.ts`:
```ts
import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentOrg } from '../auth/decorators';
import { DealsService } from './deals.service';
import { CreateDealDto } from './dto/create-deal.dto';
import { UpdateDealDto } from './dto/update-deal.dto';
import { MoveDealDto } from './dto/move-deal.dto';

@Controller('deals')
@UseGuards(ClerkAuthGuard)
export class DealsController {
  constructor(private readonly dealsService: DealsService) {}

  @Get()
  findAll(
    @CurrentOrg() orgId: string,
    @Query('stageId') stageId?: string,
    @Query('assignedTo') assignedTo?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.dealsService.findAll(orgId, {
      stageId, assignedTo, search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get(':id')
  findOne(@CurrentOrg() orgId: string, @Param('id') id: string) {
    return this.dealsService.findOne(orgId, id);
  }

  @Post()
  create(@CurrentOrg() orgId: string, @Body() dto: CreateDealDto) {
    return this.dealsService.create(orgId, dto);
  }

  @Patch(':id')
  update(@CurrentOrg() orgId: string, @Param('id') id: string, @Body() dto: UpdateDealDto) {
    return this.dealsService.update(orgId, id, dto);
  }

  @Patch(':id/move')
  move(@CurrentOrg() orgId: string, @Param('id') id: string, @Body() dto: MoveDealDto) {
    return this.dealsService.move(orgId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentOrg() orgId: string, @Param('id') id: string) {
    return this.dealsService.remove(orgId, id);
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd C:\Users\OS\crm-saas
git add apps/api/src/deals/deals.controller.ts
git commit -m "feat: add DealsController"
```

---

## Task 7: Module Wiring

**Files:**
- Create: `apps/api/src/deals/deals.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/webhooks/webhooks.module.ts`
- Modify: `apps/api/src/webhooks/clerk-webhook.controller.ts`

- [ ] **Step 1: Create DealsModule**

`apps/api/src/deals/deals.module.ts`:
```ts
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
```

- [ ] **Step 2: Register DealsModule in AppModule**

In `apps/api/src/app.module.ts`, add `DealsModule` to the imports list. The final imports array:
```ts
import { DealsModule } from './deals/deals.module';

// in @Module imports array, after WhatsAppModule:
    DealsModule,
```

- [ ] **Step 3: Import DealsModule in WebhooksModule and inject PipelineService in webhook**

`apps/api/src/webhooks/webhooks.module.ts` — add `DealsModule` to imports:
```ts
import { Module } from '@nestjs/common';
import { ClerkWebhookController } from './clerk-webhook.controller';
import { StripeWebhookController } from './stripe-webhook.controller';
import { UsersModule } from '../users/users.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { DealsModule } from '../deals/deals.module';

@Module({
  imports: [UsersModule, SubscriptionModule, DealsModule],
  controllers: [ClerkWebhookController, StripeWebhookController],
})
export class WebhooksModule {}
```

- [ ] **Step 4: Call createDefaultPipeline in ClerkWebhookController**

In `apps/api/src/webhooks/clerk-webhook.controller.ts`, inject `PipelineService` and call it after org creation. The updated file:
```ts
import { Controller, Post, RawBodyRequest, Req, Body, BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import { Webhook } from 'svix';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { PipelineService } from '../deals/pipeline.service';

@Controller('webhooks/clerk')
export class ClerkWebhookController {
  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
    private readonly pipelineService: PipelineService,
  ) {}

  @Post()
  async handleClerkWebhook(
    @Req() req: any,
    @Body() _body: unknown,
  ) {
    const svixId = req.headers['svix-id'] as string;
    const svixTimestamp = req.headers['svix-timestamp'] as string;
    const svixSignature = req.headers['svix-signature'] as string;

    const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!);
    let event: any;

    try {
      event = wh.verify(req.rawBody?.toString() ?? '', {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      });
    } catch {
      throw new BadRequestException('Invalid webhook signature');
    }

    const { type, data } = event;

    if (type === 'user.created' || type === 'user.updated') {
      await this.usersService.upsertFromClerk(data);
    }

    if (type === 'organization.created') {
      const starterPlan = await this.prisma.plan.findFirstOrThrow({ where: { name: 'STARTER' } });
      const org = await this.prisma.organization.upsert({
        where: { clerkOrgId: data.id },
        update: { name: data.name, slug: data.slug },
        create: {
          clerkOrgId: data.id,
          name: data.name,
          slug: data.slug,
          planId: starterPlan.id,
        },
      });
      await this.prisma.subscription.upsert({
        where: { organizationId: org.id },
        update: {},
        create: {
          organizationId: org.id,
          planId: starterPlan.id,
          stripeSubId: `trial_${org.id}`,
          stripeCustomerId: `trial_cus_${org.id}`,
          status: 'TRIALING',
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
      await this.pipelineService.createDefaultPipeline(org.id);
    }

    if (type === 'organizationMembership.created') {
      const [org, user] = await Promise.all([
        this.prisma.organization.findFirst({ where: { clerkOrgId: data.organization.id } }),
        this.prisma.user.findUnique({ where: { clerkUserId: data.public_user_data.user_id } }),
      ]);
      if (!org || !user) {
        throw new BadRequestException('Organization or user not found — will retry');
      }
      await this.prisma.organizationMember.create({
        data: {
          organizationId: org.id,
          userId: user.id,
          role: data.role === 'org:admin' ? 'ADMIN' : 'MEMBER',
        },
      });
    }

    if (type === 'organizationMembership.deleted') {
      const [org, user] = await Promise.all([
        this.prisma.organization.findFirst({ where: { clerkOrgId: data.organization.id } }),
        this.prisma.user.findUnique({ where: { clerkUserId: data.public_user_data.user_id } }),
      ]);
      if (!org || !user) {
        return { received: true };
      }
      await this.prisma.organizationMember.deleteMany({
        where: { organizationId: org.id, userId: user.id },
      });
    }

    return { received: true };
  }
}
```

- [ ] **Step 5: Start the API and verify it compiles**

```bash
cd C:\Users\OS\crm-saas\apps\api
pnpm dev
```

Expected: server starts on port 3001 with no TypeScript errors. Ctrl+C to stop.

- [ ] **Step 6: Commit**

```bash
cd C:\Users\OS\crm-saas
git add apps/api/src/deals/deals.module.ts apps/api/src/app.module.ts apps/api/src/webhooks/
git commit -m "feat: wire DealsModule into app, provision pipeline on org creation"
```

---

## Task 8: Frontend API Client

**Files:**
- Create: `apps/web/lib/api/pipeline.ts`

- [ ] **Step 1: Create the API client**

`apps/web/lib/api/pipeline.ts`:
```ts
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export type StageType = 'REGULAR' | 'WON' | 'LOST';

export interface DealLead {
  id: string;
  name: string;
}

export interface DealAssignee {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface DealStage {
  id: string;
  name: string;
  color: string;
  type: StageType;
}

export interface Deal {
  id: string;
  organizationId: string;
  pipelineId: string;
  stageId: string;
  stage: DealStage;
  leadId?: string;
  lead?: DealLead;
  title: string;
  value?: number | null;
  probability?: number | null;
  expectedCloseAt?: string | null;
  assignedToId?: string | null;
  assignedTo?: DealAssignee | null;
  notes?: string | null;
  wonAt?: string | null;
  lostAt?: string | null;
  lostReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KanbanStage {
  id: string;
  name: string;
  color: string;
  order: number;
  type: StageType;
  totalValue: number;
  deals: Deal[];
}

export interface PipelineKanban {
  id: string;
  stages: KanbanStage[];
}

async function apiFetch(path: string, token: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init?.headers },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getKanban(token: string): Promise<PipelineKanban> {
  return apiFetch('/pipeline', token);
}

export async function createDeal(token: string, data: {
  title: string;
  stageId: string;
  leadId?: string;
  value?: number;
  probability?: number;
  expectedCloseAt?: string;
  assignedToId?: string;
  notes?: string;
}): Promise<Deal> {
  return apiFetch('/deals', token, { method: 'POST', body: JSON.stringify(data) });
}

export async function updateDeal(token: string, id: string, data: {
  title?: string;
  leadId?: string | null;
  value?: number | null;
  probability?: number | null;
  expectedCloseAt?: string | null;
  assignedToId?: string | null;
  notes?: string | null;
}): Promise<Deal> {
  return apiFetch(`/deals/${id}`, token, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function moveDeal(token: string, id: string, stageId: string, lostReason?: string): Promise<Deal> {
  return apiFetch(`/deals/${id}/move`, token, { method: 'PATCH', body: JSON.stringify({ stageId, lostReason }) });
}

export async function deleteDeal(token: string, id: string): Promise<{ deleted: string }> {
  return apiFetch(`/deals/${id}`, token, { method: 'DELETE' });
}

export async function createStage(token: string, data: { name: string; color?: string }) {
  return apiFetch('/pipeline/stages', token, { method: 'POST', body: JSON.stringify(data) });
}

export async function updateStage(token: string, id: string, data: { name?: string; color?: string }) {
  return apiFetch(`/pipeline/stages/${id}`, token, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteStage(token: string, id: string) {
  return apiFetch(`/pipeline/stages/${id}`, token, { method: 'DELETE' });
}

export async function reorderStages(token: string, stageIds: string[]) {
  return apiFetch('/pipeline/stages/reorder', token, { method: 'PATCH', body: JSON.stringify({ stageIds }) });
}
```

- [ ] **Step 2: Commit**

```bash
cd C:\Users\OS\crm-saas
git add apps/web/lib/api/pipeline.ts
git commit -m "feat: add pipeline API client"
```

---

## Task 9: DealCard + StageColumn

**Files:**
- Create: `apps/web/app/[orgSlug]/pipeline/_components/deal-card.tsx`
- Create: `apps/web/app/[orgSlug]/pipeline/_components/stage-column.tsx`

- [ ] **Step 1: Create DealCard**

`apps/web/app/[orgSlug]/pipeline/_components/deal-card.tsx`:
```tsx
'use client';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Deal } from '@/lib/api/pipeline';

function formatBRL(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
}

interface Props {
  deal: Deal;
  onClick: (deal: Deal) => void;
}

export function DealCard({ deal, onClick }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: deal.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onClick(deal)}
      className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm cursor-grab active:cursor-grabbing hover:border-slate-300 hover:shadow-md transition-all select-none"
    >
      <p className="text-sm font-medium text-slate-800 leading-snug">{deal.title}</p>
      {deal.lead && (
        <p className="text-xs text-slate-500 mt-1">{deal.lead.name}</p>
      )}
      <div className="flex items-center justify-between mt-2">
        {deal.value != null ? (
          <span className="text-xs font-semibold text-green-700">{formatBRL(deal.value)}</span>
        ) : (
          <span />
        )}
        {deal.assignedTo && (
          <span
            className="w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0"
            title={deal.assignedTo.name}
          >
            {deal.assignedTo.name.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      {deal.probability != null && (
        <div className="mt-2 h-1 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-400 rounded-full"
            style={{ width: `${deal.probability}%` }}
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create StageColumn**

`apps/web/app/[orgSlug]/pipeline/_components/stage-column.tsx`:
```tsx
'use client';
import { useDroppable } from '@dnd-kit/core';
import { KanbanStage, Deal } from '@/lib/api/pipeline';
import { DealCard } from './deal-card';

function formatBRL(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
}

interface Props {
  stage: KanbanStage;
  onDealClick: (deal: Deal) => void;
}

export function StageColumn({ stage, onDealClick }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <div className="flex flex-col w-64 shrink-0">
      <div className="flex items-center gap-2 mb-2 px-1">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
        <span className="text-sm font-semibold text-slate-700 truncate">{stage.name}</span>
        <span className="ml-auto text-xs text-slate-400 shrink-0">{stage.deals.length}</span>
      </div>
      {stage.totalValue > 0 && (
        <p className="text-xs text-slate-400 px-1 mb-2">{formatBRL(stage.totalValue)}</p>
      )}
      <div
        ref={setNodeRef}
        className={`flex-1 flex flex-col gap-2 min-h-[200px] rounded-lg p-2 transition-colors ${
          isOver ? 'bg-blue-50 border-2 border-blue-200 border-dashed' : 'bg-slate-100'
        }`}
      >
        {stage.deals.map((deal) => (
          <DealCard key={deal.id} deal={deal} onClick={onDealClick} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
cd C:\Users\OS\crm-saas
git add apps/web/app/\[orgSlug\]/pipeline/_components/deal-card.tsx
git add apps/web/app/\[orgSlug\]/pipeline/_components/stage-column.tsx
git commit -m "feat: add DealCard and StageColumn components"
```

---

## Task 10: PipelineKanban

**Files:**
- Create: `apps/web/app/[orgSlug]/pipeline/_components/pipeline-kanban.tsx`

- [ ] **Step 1: Create the kanban component**

`apps/web/app/[orgSlug]/pipeline/_components/pipeline-kanban.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { DndContext, DragEndEvent, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth, useOrganization } from '@clerk/nextjs';
import { getKanban, moveDeal, PipelineKanban, Deal } from '@/lib/api/pipeline';
import { StageColumn } from './stage-column';
import { DealCard } from './deal-card';
import { DealSlideOver } from './deal-slide-over';

export function PipelineKanban() {
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);

  const { getToken } = useAuth();
  const { organization } = useOrganization();
  const queryClient = useQueryClient();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const { data, isLoading } = useQuery({
    queryKey: ['pipeline', 'kanban', organization?.id],
    queryFn: async () => {
      const token = await getToken();
      return getKanban(token!);
    },
    enabled: !!organization?.id,
    refetchInterval: 30_000,
  });

  const moveMutation = useMutation({
    mutationFn: async ({ dealId, stageId }: { dealId: string; stageId: string }) => {
      const token = await getToken();
      return moveDeal(token!, dealId, stageId);
    },
    onMutate: async ({ dealId, stageId }) => {
      await queryClient.cancelQueries({ queryKey: ['pipeline', 'kanban', organization?.id] });
      const prev = queryClient.getQueryData<PipelineKanban>(['pipeline', 'kanban', organization?.id]);
      if (prev) {
        const updated: PipelineKanban = {
          ...prev,
          stages: prev.stages.map((s) => ({
            ...s,
            deals: s.deals.filter((d) => d.id !== dealId),
          })),
        };
        let movedDeal: Deal | undefined;
        for (const s of prev.stages) {
          const d = s.deals.find((d) => d.id === dealId);
          if (d) { movedDeal = d; break; }
        }
        if (movedDeal) {
          updated.stages = updated.stages.map((s) =>
            s.id === stageId ? { ...s, deals: [{ ...movedDeal!, stageId }, ...s.deals] } : s
          );
        }
        queryClient.setQueryData(['pipeline', 'kanban', organization?.id], updated);
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['pipeline', 'kanban', organization?.id], ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline', 'kanban', organization?.id] });
    },
  });

  function findDealInKanban(dealId: string): Deal | undefined {
    for (const stage of data?.stages ?? []) {
      const d = stage.deals.find((d) => d.id === dealId);
      if (d) return d;
    }
  }

  function handleDragStart(event: { active: { id: string | number } }) {
    const deal = findDealInKanban(String(event.active.id));
    if (deal) setActiveDeal(deal);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDeal(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const dealId = String(active.id);
    const targetStageId = String(over.id);
    const deal = findDealInKanban(dealId);
    if (!deal) return;
    if (deal.stageId === targetStageId) return;
    moveMutation.mutate({ dealId, stageId: targetStageId });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 text-sm">
        Carregando pipeline...
      </div>
    );
  }

  if (!data) return null;

  return (
    <>
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 h-full overflow-x-auto pb-4">
          {data.stages.map((stage) => (
            <StageColumn key={stage.id} stage={stage} onDealClick={setSelectedDeal} />
          ))}
        </div>
        <DragOverlay>
          {activeDeal ? <DealCard deal={activeDeal} onClick={() => {}} /> : null}
        </DragOverlay>
      </DndContext>

      <DealSlideOver
        deal={selectedDeal}
        open={!!selectedDeal}
        stages={data.stages}
        onClose={() => setSelectedDeal(null)}
      />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd C:\Users\OS\crm-saas
git add apps/web/app/\[orgSlug\]/pipeline/_components/pipeline-kanban.tsx
git commit -m "feat: add PipelineKanban with DnD"
```

---

## Task 11: NewDealSheet

**Files:**
- Create: `apps/web/app/[orgSlug]/pipeline/_components/new-deal-sheet.tsx`

- [ ] **Step 1: Create the sheet**

`apps/web/app/[orgSlug]/pipeline/_components/new-deal-sheet.tsx`:
```tsx
'use client';
import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth, useOrganization } from '@clerk/nextjs';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createDeal, KanbanStage } from '@/lib/api/pipeline';
import { searchLeads } from '@/lib/api/leads';

interface Props {
  open: boolean;
  onClose: () => void;
  stages: KanbanStage[];
  defaultStageId?: string;
}

export function NewDealSheet({ open, onClose, stages, defaultStageId }: Props) {
  const regularStages = stages.filter((s) => s.type === 'REGULAR');
  const [title, setTitle] = useState('');
  const [stageId, setStageId] = useState('');
  const [value, setValue] = useState('');
  const [leadSearch, setLeadSearch] = useState('');
  const [leadId, setLeadId] = useState('');
  const [leadResults, setLeadResults] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState('');

  const { getToken } = useAuth();
  const { organization } = useOrganization();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      setStageId(defaultStageId ?? regularStages[0]?.id ?? '');
    }
  }, [open, defaultStageId]);

  useEffect(() => {
    if (!leadSearch.trim()) { setLeadResults([]); return; }
    let active = true;
    getToken().then((token) => {
      if (!token) return;
      searchLeads(token, leadSearch, 5).then((res) => {
        if (active) setLeadResults(res.items.map((l: any) => ({ id: l.id, name: l.name })));
      }).catch(() => {});
    });
    return () => { active = false; };
  }, [leadSearch]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error('Título é obrigatório');
      if (!stageId) throw new Error('Selecione um estágio');
      const token = await getToken();
      return createDeal(token!, {
        title: title.trim(),
        stageId,
        leadId: leadId || undefined,
        value: value ? parseFloat(value) : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline', 'kanban', organization?.id] });
      handleClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  function handleClose() {
    setTitle(''); setStageId(''); setValue('');
    setLeadSearch(''); setLeadId(''); setLeadResults([]);
    setError(''); mutation.reset(); onClose();
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent className="w-[400px] bg-slate-900 border-slate-700 text-slate-100">
        <SheetHeader>
          <SheetTitle className="text-slate-100">Novo Deal</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4 px-1">
          <div>
            <Label className="text-slate-400 text-xs">Título *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500"
              placeholder="Nome do negócio"
            />
          </div>

          <div>
            <Label className="text-slate-400 text-xs">Estágio *</Label>
            <select
              value={stageId}
              onChange={(e) => setStageId(e.target.value)}
              className="mt-1 w-full rounded-md bg-slate-800 border border-slate-600 text-slate-100 text-sm px-3 py-2 outline-none focus:ring-1 focus:ring-blue-500"
            >
              {regularStages.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <Label className="text-slate-400 text-xs">Valor (R$)</Label>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              type="number"
              min="0"
              step="0.01"
              className="mt-1 bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500"
              placeholder="0,00"
            />
          </div>

          <div className="relative">
            <Label className="text-slate-400 text-xs">Lead vinculado</Label>
            {leadId ? (
              <div className="mt-1 flex items-center gap-2 bg-slate-800 border border-slate-600 rounded-md px-3 py-2">
                <span className="text-sm text-slate-100 flex-1">
                  {leadResults.find((l) => l.id === leadId)?.name ?? leadSearch}
                </span>
                <button onClick={() => { setLeadId(''); setLeadSearch(''); }} className="text-slate-400 hover:text-slate-200 text-xs">✕</button>
              </div>
            ) : (
              <>
                <Input
                  value={leadSearch}
                  onChange={(e) => setLeadSearch(e.target.value)}
                  className="mt-1 bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500"
                  placeholder="Buscar lead..."
                />
                {leadResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-slate-800 border border-slate-600 rounded-md shadow-lg">
                    {leadResults.map((l) => (
                      <button
                        key={l.id}
                        onClick={() => { setLeadId(l.id); setLeadSearch(l.name); setLeadResults([]); }}
                        className="w-full text-left px-3 py-2 text-sm text-slate-100 hover:bg-slate-700"
                      >
                        {l.name}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white"
          >
            {mutation.isPending ? 'Criando...' : 'Criar Deal'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd C:\Users\OS\crm-saas
git add apps/web/app/\[orgSlug\]/pipeline/_components/new-deal-sheet.tsx
git commit -m "feat: add NewDealSheet"
```

---

## Task 12: DealSlideOver

**Files:**
- Create: `apps/web/app/[orgSlug]/pipeline/_components/deal-slide-over.tsx`

- [ ] **Step 1: Create the slide-over**

`apps/web/app/[orgSlug]/pipeline/_components/deal-slide-over.tsx`:
```tsx
'use client';
import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth, useOrganization } from '@clerk/nextjs';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Deal, KanbanStage, updateDeal, moveDeal, deleteDeal } from '@/lib/api/pipeline';

interface Props {
  deal: Deal | null;
  open: boolean;
  stages: KanbanStage[];
  onClose: () => void;
}

function formatDateInput(iso?: string | null) {
  if (!iso) return '';
  return iso.slice(0, 10);
}

export function DealSlideOver({ deal, open, stages, onClose }: Props) {
  const [title, setTitle] = useState('');
  const [value, setValue] = useState('');
  const [probability, setProbability] = useState('');
  const [expectedCloseAt, setExpectedCloseAt] = useState('');
  const [notes, setNotes] = useState('');
  const [targetStageId, setTargetStageId] = useState('');
  const [lostReason, setLostReason] = useState('');
  const [error, setError] = useState('');

  const { getToken } = useAuth();
  const { organization } = useOrganization();
  const queryClient = useQueryClient();

  const targetStage = stages.find((s) => s.id === targetStageId);

  useEffect(() => {
    if (deal) {
      setTitle(deal.title);
      setValue(deal.value != null ? String(deal.value) : '');
      setProbability(deal.probability != null ? String(deal.probability) : '');
      setExpectedCloseAt(formatDateInput(deal.expectedCloseAt));
      setNotes(deal.notes ?? '');
      setTargetStageId(deal.stageId);
      setLostReason(deal.lostReason ?? '');
      setError('');
    }
  }, [deal]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return updateDeal(token!, deal!.id, {
        title: title.trim() || undefined,
        value: value ? parseFloat(value) : null,
        probability: probability ? parseInt(probability, 10) : null,
        expectedCloseAt: expectedCloseAt || null,
        notes: notes || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline', 'kanban', organization?.id] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const moveMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return moveDeal(token!, deal!.id, targetStageId, lostReason || undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline', 'kanban', organization?.id] });
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return deleteDeal(token!, deal!.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline', 'kanban', organization?.id] });
      onClose();
    },
  });

  const stageChanged = deal && targetStageId !== deal.stageId;

  if (!deal) return null;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-[420px] bg-slate-900 border-slate-700 text-slate-100 overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-slate-100 truncate">{deal.title}</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4 px-1">
          <div>
            <Label className="text-slate-400 text-xs">Título</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 bg-slate-800 border-slate-600 text-slate-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-slate-400 text-xs">Valor (R$)</Label>
              <Input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                type="number"
                min="0"
                step="0.01"
                className="mt-1 bg-slate-800 border-slate-600 text-slate-100"
              />
            </div>
            <div>
              <Label className="text-slate-400 text-xs">Probabilidade (%)</Label>
              <Input
                value={probability}
                onChange={(e) => setProbability(e.target.value)}
                type="number"
                min="0"
                max="100"
                className="mt-1 bg-slate-800 border-slate-600 text-slate-100"
              />
            </div>
          </div>

          <div>
            <Label className="text-slate-400 text-xs">Data de fechamento prevista</Label>
            <Input
              value={expectedCloseAt}
              onChange={(e) => setExpectedCloseAt(e.target.value)}
              type="date"
              className="mt-1 bg-slate-800 border-slate-600 text-slate-100"
            />
          </div>

          <div>
            <Label className="text-slate-400 text-xs">Notas</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md bg-slate-800 border border-slate-600 text-slate-100 text-sm px-3 py-2 resize-none outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <Button
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white"
          >
            {updateMutation.isPending ? 'Salvando...' : 'Salvar alterações'}
          </Button>

          <div className="border-t border-slate-700 pt-4">
            <Label className="text-slate-400 text-xs">Mover para estágio</Label>
            <select
              value={targetStageId}
              onChange={(e) => setTargetStageId(e.target.value)}
              className="mt-1 w-full rounded-md bg-slate-800 border border-slate-600 text-slate-100 text-sm px-3 py-2 outline-none focus:ring-1 focus:ring-blue-500"
            >
              {stages.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            {targetStage?.type === 'LOST' && (
              <div className="mt-2">
                <Label className="text-slate-400 text-xs">Motivo da perda</Label>
                <Input
                  value={lostReason}
                  onChange={(e) => setLostReason(e.target.value)}
                  className="mt-1 bg-slate-800 border-slate-600 text-slate-100"
                  placeholder="Ex: Preço, Concorrente..."
                />
              </div>
            )}

            {stageChanged && (
              <Button
                onClick={() => moveMutation.mutate()}
                disabled={moveMutation.isPending}
                className="mt-2 w-full bg-slate-700 hover:bg-slate-600 text-white"
              >
                {moveMutation.isPending ? 'Movendo...' : `Mover para "${targetStage?.name}"`}
              </Button>
            )}
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <div className="border-t border-slate-700 pt-4">
            {deal.lead && (
              <p className="text-xs text-slate-500 mb-2">Lead: {deal.lead.name}</p>
            )}
            {deal.wonAt && <p className="text-xs text-green-400 mb-2">Ganho em {new Date(deal.wonAt).toLocaleDateString('pt-BR')}</p>}
            {deal.lostAt && <p className="text-xs text-red-400 mb-2">Perdido em {new Date(deal.lostAt).toLocaleDateString('pt-BR')}{deal.lostReason ? ` — ${deal.lostReason}` : ''}</p>}
            <Button
              variant="outline"
              onClick={() => { if (confirm('Excluir este deal?')) deleteMutation.mutate(); }}
              disabled={deleteMutation.isPending}
              className="w-full border-red-800 text-red-400 hover:bg-red-950"
            >
              {deleteMutation.isPending ? 'Excluindo...' : 'Excluir deal'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd C:\Users\OS\crm-saas
git add apps/web/app/\[orgSlug\]/pipeline/_components/deal-slide-over.tsx
git commit -m "feat: add DealSlideOver"
```

---

## Task 13: Pipeline Page + Header

**Files:**
- Create: `apps/web/app/[orgSlug]/pipeline/_components/pipeline-header.tsx`
- Create: `apps/web/app/[orgSlug]/pipeline/page.tsx`

- [ ] **Step 1: Create PipelineHeader**

`apps/web/app/[orgSlug]/pipeline/_components/pipeline-header.tsx`:
```tsx
'use client';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface Props {
  onNewDeal: () => void;
}

export function PipelineHeader({ onNewDeal }: Props) {
  const { orgSlug } = useParams<{ orgSlug: string }>();

  return (
    <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 bg-white shrink-0">
      <h1 className="text-base font-semibold text-slate-900">Pipeline</h1>
      <div className="flex items-center gap-2">
        <Link
          href={`/${orgSlug}/pipeline/settings`}
          className="text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-md border border-slate-200 hover:border-slate-300 transition-colors"
        >
          Gerenciar estágios
        </Link>
        <Button
          size="sm"
          className="text-xs bg-blue-600 hover:bg-blue-700 text-white"
          onClick={onNewDeal}
        >
          + Novo Deal
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the pipeline page**

`apps/web/app/[orgSlug]/pipeline/page.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth, useOrganization } from '@clerk/nextjs';
import { getKanban } from '@/lib/api/pipeline';
import { PipelineHeader } from './_components/pipeline-header';
import { PipelineKanban } from './_components/pipeline-kanban';
import { NewDealSheet } from './_components/new-deal-sheet';

export default function PipelinePage() {
  const [newDealOpen, setNewDealOpen] = useState(false);
  const { getToken } = useAuth();
  const { organization } = useOrganization();

  const { data } = useQuery({
    queryKey: ['pipeline', 'kanban', organization?.id],
    queryFn: async () => {
      const token = await getToken();
      return getKanban(token!);
    },
    enabled: !!organization?.id,
  });

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 56px)' }}>
      <PipelineHeader onNewDeal={() => setNewDealOpen(true)} />
      <main className="flex-1 overflow-hidden p-4 bg-slate-50">
        <PipelineKanban />
      </main>
      <NewDealSheet
        open={newDealOpen}
        onClose={() => setNewDealOpen(false)}
        stages={data?.stages ?? []}
      />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
cd C:\Users\OS\crm-saas
git add apps/web/app/\[orgSlug\]/pipeline/_components/pipeline-header.tsx
git add apps/web/app/\[orgSlug\]/pipeline/page.tsx
git commit -m "feat: add Pipeline page and header"
```

---

## Task 14: Pipeline Settings Page

**Files:**
- Create: `apps/web/app/[orgSlug]/pipeline/settings/page.tsx`

- [ ] **Step 1: Create the settings page**

`apps/web/app/[orgSlug]/pipeline/settings/page.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth, useOrganization } from '@clerk/nextjs';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getKanban, createStage, updateStage, deleteStage, reorderStages, KanbanStage } from '@/lib/api/pipeline';

const PRESET_COLORS = ['#94a3b8','#3b82f6','#a855f7','#f59e0b','#ef4444','#22c55e','#ec4899','#14b8a6'];

export default function PipelineSettingsPage() {
  const [newStageName, setNewStageName] = useState('');
  const [newStageColor, setNewStageColor] = useState('#6366f1');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState('');

  const { getToken } = useAuth();
  const { organization } = useOrganization();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { orgSlug } = useParams<{ orgSlug: string }>();

  const { data } = useQuery({
    queryKey: ['pipeline', 'kanban', organization?.id],
    queryFn: async () => {
      const token = await getToken();
      return getKanban(token!);
    },
    enabled: !!organization?.id,
  });

  const stages = data?.stages ?? [];

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!newStageName.trim()) throw new Error('Nome é obrigatório');
      const token = await getToken();
      return createStage(token!, { name: newStageName.trim(), color: newStageColor });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline', 'kanban', organization?.id] });
      setNewStageName('');
    },
    onError: (e: Error) => setError(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const token = await getToken();
      return updateStage(token!, id, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline', 'kanban', organization?.id] });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      return deleteStage(token!, id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline', 'kanban', organization?.id] });
    },
    onError: (e: Error) => setError(e.message),
  });

  function startEdit(stage: KanbanStage) {
    setEditingId(stage.id);
    setEditName(stage.name);
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push(`/${orgSlug}/pipeline`)} className="text-slate-400 hover:text-slate-600 text-sm">
          ← Voltar ao Pipeline
        </button>
        <h1 className="text-lg font-semibold text-slate-900">Gerenciar estágios</h1>
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      <div className="space-y-2 mb-8">
        {stages.map((stage) => (
          <div key={stage.id} className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-4 py-3">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
            {editingId === stage.id ? (
              <>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 h-7 text-sm"
                  autoFocus
                />
                <Button
                  size="sm"
                  className="text-xs h-7 bg-blue-600 text-white"
                  onClick={() => updateMutation.mutate({ id: stage.id, name: editName })}
                  disabled={updateMutation.isPending}
                >
                  Salvar
                </Button>
                <button onClick={() => setEditingId(null)} className="text-slate-400 text-xs hover:text-slate-600">Cancelar</button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm text-slate-700">{stage.name}</span>
                {stage.type === 'REGULAR' ? (
                  <>
                    <button onClick={() => startEdit(stage)} className="text-xs text-slate-400 hover:text-slate-600">Renomear</button>
                    <button
                      onClick={() => { if (confirm(`Excluir "${stage.name}"? Os deals serão movidos.`)) deleteMutation.mutate(stage.id); }}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      Excluir
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => startEdit(stage)} className="text-xs text-slate-400 hover:text-slate-600">Renomear</button>
                    <span className="text-xs text-slate-300">{stage.type === 'WON' ? 'Terminal (Ganho)' : 'Terminal (Perdido)'}</span>
                  </>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Adicionar estágio</h2>
        <div className="flex gap-2 flex-wrap mb-3">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setNewStageColor(c)}
              className={`w-6 h-6 rounded-full border-2 transition-all ${newStageColor === c ? 'border-slate-700 scale-110' : 'border-transparent'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={newStageName}
            onChange={(e) => setNewStageName(e.target.value)}
            placeholder="Nome do estágio"
            className="flex-1"
            onKeyDown={(e) => e.key === 'Enter' && createMutation.mutate()}
          />
          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            {createMutation.isPending ? '...' : 'Adicionar'}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd C:\Users\OS\crm-saas
git add apps/web/app/\[orgSlug\]/pipeline/settings/page.tsx
git commit -m "feat: add Pipeline settings page"
```

---

## Task 15: Nav Update + Smoke Test

**Files:**
- Modify: `apps/web/app/[orgSlug]/_components/app-nav.tsx`

- [ ] **Step 1: Add Pipeline to navigation**

In `apps/web/app/[orgSlug]/_components/app-nav.tsx`, update the `NAV` array:
```ts
const NAV = [
  { label: 'Dashboard', seg: 'dashboard' },
  { label: 'Leads', seg: 'leads' },
  { label: 'Pipeline', seg: 'pipeline' },
  { label: 'WhatsApp', seg: 'whatsapp' },
  { label: 'Configurações', seg: 'settings' },
];
```

- [ ] **Step 2: Start backend and frontend**

Terminal 1:
```bash
cd C:\Users\OS\crm-saas\apps\api
pnpm dev
```
Expected: `NestJS application is listening on port 3001`

Terminal 2:
```bash
cd C:\Users\OS\crm-saas\apps\web
pnpm dev
```
Expected: `Next.js ready on http://localhost:3000`

- [ ] **Step 3: Smoke test — golden path**

Open `http://localhost:3000` and verify each item:

1. Log in and navigate to a workspace.
2. "Pipeline" appears in the top navigation between Leads and WhatsApp.
3. Clicking Pipeline loads the kanban with 6 columns (Prospecção → Perdido).
4. Click "+ Novo Deal" → sheet opens → fill Title + select a stage + click Criar Deal → deal card appears in the correct column.
5. Drag the deal card to a different column → card moves with optimistic update.
6. Click the deal card → slide-over opens → edit title + click Salvar alterações → title updates.
7. In slide-over, change stage to "Perdido" → lost reason field appears → fill it in → click Mover para "Perdido" → deal moves to Perdido column, slide-over closes.
8. Navigate to "Gerenciar estágios" → create a new stage with a custom name and color → it appears in the kanban.
9. Rename and delete the new stage → deals migrate to the previous stage without errors.

- [ ] **Step 4: Commit**

```bash
cd C:\Users\OS\crm-saas
git add apps/web/app/\[orgSlug\]/_components/app-nav.tsx
git commit -m "feat: add Pipeline nav item"
```
