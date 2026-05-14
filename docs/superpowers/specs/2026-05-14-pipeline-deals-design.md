# Pipeline/Deals Module — Design Spec

**Date:** 2026-05-14  
**Status:** Approved  
**Stack:** NestJS 11 + Prisma 7 + PostgreSQL / Next.js 16 + shadcn/ui + @dnd-kit

---

## Overview

Add a sales pipeline module to the CRM SaaS. Each workspace gets one pipeline with configurable stages (template-based: starts with defaults, user can rename/reorder/add/remove). Deals are created independently and optionally linked to existing Leads (1 Lead → N Deals).

---

## Schema

Three new Prisma models added to `packages/db/prisma/schema.prisma`:

### Pipeline

```prisma
model Pipeline {
  id             String          @id @default(uuid())
  organizationId String          @unique
  organization   Organization    @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  stages         PipelineStage[]
  deals          Deal[]
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
}
```

One pipeline per organization (enforced by `@unique` on `organizationId`). Created automatically when the organization is provisioned (workspace setup flow).

### PipelineStage

```prisma
model PipelineStage {
  id         String            @id @default(uuid())
  pipelineId String
  pipeline   Pipeline          @relation(fields: [pipelineId], references: [id], onDelete: Cascade)
  name       String
  color      String            @default("#6366f1")
  order      Int
  type       StageType         @default(REGULAR)
  deals      Deal[]
  createdAt  DateTime          @default(now())
  updatedAt  DateTime          @updatedAt

  @@index([pipelineId, order])
}

enum StageType {
  REGULAR
  WON      // sets Deal.wonAt on move
  LOST     // sets Deal.lostAt on move, prompts lostReason
}
```

**Default stages** (seeded on pipeline creation):

| order | name | color | type |
|-------|------|-------|------|
| 0 | Prospecção | #94a3b8 | `REGULAR` |
| 1 | Qualificação | #3b82f6 | `REGULAR` |
| 2 | Proposta | #a855f7 | `REGULAR` |
| 3 | Negociação | #f59e0b | `REGULAR` |
| 4 | Ganho | #22c55e | `WON` |
| 5 | Perdido | #ef4444 | `LOST` |

`WON` and `LOST` stages are terminal: the backend sets `Deal.wonAt` or `Deal.lostAt` when a deal is moved there. Terminal stages cannot be deleted. Their `type` cannot be changed. The user can rename them and change their color.

Deleting a `REGULAR` stage moves its deals to the stage immediately before it (by order); if there is no preceding regular stage, deals move to the first regular stage. Cannot delete a stage if it is the only `REGULAR` stage.

### Deal

```prisma
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
  probability     Int?          // 0–100
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

`Lead` model gains: `deals Deal[]`  
`Organization` model gains: `pipeline Pipeline?`  
`User` model gains: `deals Deal[]`

---

## Backend (NestJS)

### Module structure

```
apps/api/src/deals/
  deals.module.ts
  deals.controller.ts       — CRUD for deals
  deals.service.ts
  pipeline.controller.ts    — pipeline stage management
  pipeline.service.ts
  dto/
    create-deal.dto.ts
    update-deal.dto.ts
    move-deal.dto.ts          { stageId: string }
    create-stage.dto.ts
    update-stage.dto.ts
    reorder-stages.dto.ts     { stageIds: string[] }
```

`DealsModule` imports `PrismaModule`. Registered in `AppModule`.

### Endpoints

#### Pipeline / Stage management

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/pipeline` | Full kanban payload: pipeline + stages (ordered) + deals per stage |
| `POST` | `/pipeline/stages` | Create new stage |
| `PATCH` | `/pipeline/stages/reorder` | Reorder stages `{ stageIds }` |
| `PATCH` | `/pipeline/stages/:id` | Rename or recolor a stage |
| `DELETE` | `/pipeline/stages/:id` | Delete stage, migrate its deals to previous stage |

#### Deals

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/deals` | List deals (filter: stageId, assignedTo, search, page, limit) |
| `POST` | `/deals` | Create deal |
| `GET` | `/deals/:id` | Get single deal |
| `PATCH` | `/deals/:id` | Update deal fields |
| `PATCH` | `/deals/:id/move` | Move deal to another stage |
| `DELETE` | `/deals/:id` | Delete deal |

All endpoints protected by `ClerkAuthGuard`. `organizationId` injected via `@CurrentOrg()` decorator (same as leads module).

### Kanban response shape

```ts
GET /pipeline →
{
  id: string;
  stages: Array<{
    id: string;
    name: string;
    color: string;
    order: number;
    deals: Deal[];
    totalValue: number;    // sum of deal values in stage
  }>;
}
```

`totalValue` computed server-side via Prisma `_sum` aggregate to avoid N+1.

### Pipeline provisioning

When a new organization is created (Clerk webhook handler), the existing `workspace.service.ts` provisioning logic gains a call to `pipeline.service.createDefaultPipeline(orgId)` which creates the Pipeline record and 6 default stages.

---

## Frontend (Next.js)

### File structure

```
apps/web/app/[orgSlug]/pipeline/
  page.tsx                          — kanban view
  settings/page.tsx                 — manage stages
  _components/
    pipeline-kanban.tsx             — DnD context + columns
    stage-column.tsx                — single kanban column
    deal-card.tsx                   — deal card (value, lead name, assignee avatar)
    deal-slide-over.tsx             — edit panel (right sheet, mirrors lead-slide-over)
    new-deal-sheet.tsx              — create deal (Sheet component)
    pipeline-header.tsx             — page header with "New Deal" button
apps/web/lib/api/pipeline.ts        — fetch helpers (mirrors lib/api/leads.ts pattern)
```

### UX flow

1. User navigates to `/[orgSlug]/pipeline` → kanban loads via `GET /pipeline`
2. Columns rendered in `order` sequence; each column header shows stage name, deal count, and total value (BRL formatted)
3. Drag a deal card between columns → optimistic UI update → `PATCH /deals/:id/move`
4. Click a deal card → `deal-slide-over` opens; user edits title, value, probability, close date, notes, assignee, linked lead
5. "New Deal" button → `new-deal-sheet` with required `title`, optional lead search (typeahead against `GET /leads?search=`), stage selector, and other fields
6. Moving to Ganho/Perdido stages: if Perdido, prompt for `lostReason` in the slide-over

### Drag-and-drop

Uses `@dnd-kit/core` + `@dnd-kit/sortable` (already in `apps/web/package.json`).  
`DndContext` wraps the kanban; each column is a droppable, each card is a draggable. On `onDragEnd`, call move API and invalidate React Query cache.

### Navigation

`app-nav.tsx` gains a **Pipeline** entry between Leads and WhatsApp:

```ts
{ label: 'Pipeline', seg: 'pipeline' },
```

### Data fetching

Same pattern as `lib/api/leads.ts`: plain `fetch` with Bearer token. Pages use React Query (`useQuery`/`useMutation`) for cache + optimistic updates.

---

## Error handling

- Move to deleted stage: 404 from backend, toast error on frontend
- Delete last stage: backend returns 400 `CANNOT_DELETE_LAST_STAGE`; frontend shows error toast
- Deal with no title: frontend validates before submit; backend also validates via class-validator

---

## Out of scope

- Deal activity log / comments
- Multiple pipelines per workspace
- Pipeline analytics / forecasting charts
- Email notifications on deal stage change
- Deal import via CSV

These can be added in future iterations.
