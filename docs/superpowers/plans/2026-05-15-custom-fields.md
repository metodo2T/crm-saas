# Custom Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-organization custom fields (TEXT, NUMBER, DATE, SELECT, MULTI_SELECT, CHECKBOX, URL) to Leads and Deals independently, manageable by admins in Settings and preenchíveis por qualquer membro via aba "Campos extras" nos slide-overs.

**Architecture:** `CustomFieldDef` table stores typed field definitions per org+entity (LEAD/DEAL) with a `slug` key. `Lead.customData` and `Deal.customData` (JSONB) store values as `{ slug: value }`. NestJS module `/custom-fields` exposes admin-guarded CRUD; frontend has Settings pages per entity (shared `CustomFieldsManager` component) and an "Campos extras" tab in each slide-over rendered dynamically from the hook `useCustomFields(entity)`.

**Tech Stack:** Prisma 7 (PostgreSQL JSONB), NestJS 11 (ClerkAuthGuard + @CurrentOrg + @CurrentUser), Next.js App Router, React Query, Tailwind CSS 4, shadcn/ui

---

## File Map

| File | Action |
|---|---|
| `packages/db/prisma/schema.prisma` | Modify: add `CustomFieldDef`, `CustomFieldEntity`, `CustomFieldType`, `customData` on Lead + Deal, relation on Organization |
| `apps/api/src/custom-fields/custom-fields.service.ts` | Create |
| `apps/api/src/custom-fields/custom-fields.controller.ts` | Create |
| `apps/api/src/custom-fields/custom-fields.module.ts` | Create |
| `apps/api/src/custom-fields/dto/create-custom-field.dto.ts` | Create |
| `apps/api/src/custom-fields/dto/update-custom-field.dto.ts` | Create |
| `apps/api/src/app.module.ts` | Modify: import CustomFieldsModule |
| `apps/api/src/leads/dto/update-lead.dto.ts` | Modify: add customData |
| `apps/api/src/leads/leads.service.ts` | Modify: merge customData in update |
| `apps/api/src/deals/dto/update-deal.dto.ts` | Modify: add customData |
| `apps/api/src/deals/deals.service.ts` | Modify: merge customData in update |
| `apps/web/lib/api/custom-fields.ts` | Create |
| `apps/web/lib/api/leads.ts` | Modify: add customData to Lead type |
| `apps/web/lib/api/pipeline.ts` | Modify: add customData to Deal type |
| `apps/web/hooks/use-custom-fields.ts` | Create |
| `apps/web/app/[orgSlug]/_components/app-sidebar.tsx` | Modify: add Personalização group |
| `apps/web/components/custom-fields-manager.tsx` | Create |
| `apps/web/app/[orgSlug]/settings/custom-fields/leads/page.tsx` | Create |
| `apps/web/app/[orgSlug]/settings/custom-fields/deals/page.tsx` | Create |
| `apps/web/app/[orgSlug]/leads/_components/lead-slide-over.tsx` | Modify: add Campos extras tab |
| `apps/web/app/[orgSlug]/pipeline/_components/deal-slide-over.tsx` | Modify: add Campos extras tab |

---

### Task 1: Prisma Schema — CustomFieldDef model + customData on Lead and Deal

**Files:**
- Modify: `packages/db/prisma/schema.prisma`

- [ ] **Step 1: Add enums and CustomFieldDef model**

In `packages/db/prisma/schema.prisma`, add after the `WaMsgStatus` enum (around line 202):

```prisma
enum CustomFieldEntity {
  LEAD
  DEAL
}

enum CustomFieldType {
  TEXT
  NUMBER
  DATE
  SELECT
  MULTI_SELECT
  CHECKBOX
  URL
}

model CustomFieldDef {
  id             String            @id @default(uuid())
  organizationId String
  organization   Organization      @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  entity         CustomFieldEntity
  name           String
  slug           String
  type           CustomFieldType
  options        Json?
  order          Int               @default(0)
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt

  @@unique([organizationId, entity, slug])
  @@index([organizationId, entity, order])
}
```

- [ ] **Step 2: Add customData to Lead model**

In the `Lead` model (around line 118), add after the `gclid` field:

```prisma
  customData       Json?
```

- [ ] **Step 3: Add customData to Deal model**

In the `Deal` model (around line 239), add after the `lostReason` field:

```prisma
  customData       Json?
```

- [ ] **Step 4: Add inverse relation to Organization model**

In the `Organization` model, add after the `deals` field:

```prisma
  customFieldDefs CustomFieldDef[]
```

- [ ] **Step 5: Run migration**

```bash
cd C:/Users/OS/crm-saas/packages/db
npx prisma migrate dev --name add_custom_fields
```

Expected output: `Your database is now in sync with your schema.`

- [ ] **Step 6: Regenerate Prisma client**

```bash
cd C:/Users/OS/crm-saas/packages/db
npx prisma generate
```

Expected: `Generated Prisma Client`

- [ ] **Step 7: Commit**

```bash
cd C:/Users/OS/crm-saas
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/
git commit -m "feat(db): add CustomFieldDef model and customData on Lead and Deal"
```

---

### Task 2: CustomFieldsService + DTOs

**Files:**
- Create: `apps/api/src/custom-fields/dto/create-custom-field.dto.ts`
- Create: `apps/api/src/custom-fields/dto/update-custom-field.dto.ts`
- Create: `apps/api/src/custom-fields/custom-fields.service.ts`

- [ ] **Step 1: Create DTOs**

Create `apps/api/src/custom-fields/dto/create-custom-field.dto.ts`:

```typescript
export class CreateCustomFieldDto {
  name: string;
  entity: 'LEAD' | 'DEAL';
  type: 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT' | 'MULTI_SELECT' | 'CHECKBOX' | 'URL';
  options?: string[];
}
```

Create `apps/api/src/custom-fields/dto/update-custom-field.dto.ts`:

```typescript
export class UpdateCustomFieldDto {
  name?: string;
  options?: string[];
  order?: number;
}
```

- [ ] **Step 2: Create CustomFieldsService**

Create `apps/api/src/custom-fields/custom-fields.service.ts`:

```typescript
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BaseService } from '../common/base.service';
import { CreateCustomFieldDto } from './dto/create-custom-field.dto';
import { UpdateCustomFieldDto } from './dto/update-custom-field.dto';

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

@Injectable()
export class CustomFieldsService extends BaseService {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  findAll(organizationId: string, entity: 'LEAD' | 'DEAL') {
    return this.prisma.customFieldDef.findMany({
      where: { organizationId, entity },
      orderBy: { order: 'asc' },
    });
  }

  async create(organizationId: string, userId: string, dto: CreateCustomFieldDto) {
    await this.requireAdmin(organizationId, userId);
    const slug = toSlug(dto.name);
    const existing = await this.prisma.customFieldDef.findMany({
      where: { organizationId, entity: dto.entity },
    });
    return this.prisma.customFieldDef.create({
      data: {
        organizationId,
        entity: dto.entity,
        name: dto.name,
        slug,
        type: dto.type,
        options: dto.options ?? null,
        order: existing.length,
      },
    });
  }

  async update(organizationId: string, userId: string, id: string, dto: UpdateCustomFieldDto) {
    await this.requireAdmin(organizationId, userId);
    await this.findOne(organizationId, id);
    return this.prisma.customFieldDef.update({ where: { id }, data: dto });
  }

  async remove(organizationId: string, userId: string, id: string) {
    await this.requireAdmin(organizationId, userId);
    await this.findOne(organizationId, id);
    return this.prisma.customFieldDef.delete({ where: { id } });
  }

  private async findOne(organizationId: string, id: string) {
    const field = await this.prisma.customFieldDef.findFirst({ where: { id, organizationId } });
    if (!field) throw new NotFoundException('Custom field not found');
    return field;
  }

  private async requireAdmin(organizationId: string, userId: string) {
    const member = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });
    if (!member || member.role !== 'ADMIN') {
      throw new ForbiddenException('Admin only');
    }
  }
}
```

- [ ] **Step 3: Build API to verify no TypeScript errors**

```bash
cd C:/Users/OS/crm-saas/apps/api
npx nest build 2>&1 | tail -15
```

Expected: build succeeds (no errors)

- [ ] **Step 4: Commit**

```bash
cd C:/Users/OS/crm-saas
git add apps/api/src/custom-fields/
git commit -m "feat(api): add CustomFieldsService with slug generation and admin guard"
```

---

### Task 3: CustomFieldsController + Module + register in AppModule

**Files:**
- Create: `apps/api/src/custom-fields/custom-fields.controller.ts`
- Create: `apps/api/src/custom-fields/custom-fields.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create CustomFieldsController**

Create `apps/api/src/custom-fields/custom-fields.controller.ts`:

```typescript
import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentOrg, CurrentUser } from '../auth/decorators';
import { CustomFieldsService } from './custom-fields.service';
import { CreateCustomFieldDto } from './dto/create-custom-field.dto';
import { UpdateCustomFieldDto } from './dto/update-custom-field.dto';

@Controller('custom-fields')
@UseGuards(ClerkAuthGuard)
export class CustomFieldsController {
  constructor(private readonly customFieldsService: CustomFieldsService) {}

  @Get()
  findAll(
    @CurrentOrg() orgId: string,
    @Query('entity') entity: 'LEAD' | 'DEAL',
  ) {
    return this.customFieldsService.findAll(orgId, entity);
  }

  @Post()
  create(
    @CurrentOrg() orgId: string,
    @CurrentUser() userId: string,
    @Body() dto: CreateCustomFieldDto,
  ) {
    return this.customFieldsService.create(orgId, userId, dto);
  }

  @Patch(':id')
  update(
    @CurrentOrg() orgId: string,
    @CurrentUser() userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCustomFieldDto,
  ) {
    return this.customFieldsService.update(orgId, userId, id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentOrg() orgId: string,
    @CurrentUser() userId: string,
    @Param('id') id: string,
  ) {
    return this.customFieldsService.remove(orgId, userId, id);
  }
}
```

- [ ] **Step 2: Create CustomFieldsModule**

Create `apps/api/src/custom-fields/custom-fields.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { CustomFieldsController } from './custom-fields.controller';
import { CustomFieldsService } from './custom-fields.service';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [CustomFieldsController],
  providers: [CustomFieldsService],
})
export class CustomFieldsModule {}
```

- [ ] **Step 3: Register in AppModule**

In `apps/api/src/app.module.ts`, add import at top:

```typescript
import { CustomFieldsModule } from './custom-fields/custom-fields.module';
```

Add `CustomFieldsModule` to the imports array (after `DealsModule`):

```typescript
imports: [
  ConfigModule.forRoot({ isGlobal: true }),
  PrismaModule, AuthModule, UsersModule, WorkspaceModule,
  SubscriptionModule, BillingModule, WebhooksModule,
  AuditModule, LeadsModule, WhatsAppModule, DealsModule,
  CustomFieldsModule,
],
```

- [ ] **Step 4: Build to verify**

```bash
cd C:/Users/OS/crm-saas/apps/api
npx nest build 2>&1 | tail -10
```

Expected: build succeeds

- [ ] **Step 5: Commit**

```bash
cd C:/Users/OS/crm-saas
git add apps/api/src/custom-fields/custom-fields.controller.ts \
        apps/api/src/custom-fields/custom-fields.module.ts \
        apps/api/src/app.module.ts
git commit -m "feat(api): add CustomFieldsController, Module, register in AppModule"
```

---

### Task 4: Update Lead and Deal DTOs + merge customData in services

**Files:**
- Modify: `apps/api/src/leads/dto/update-lead.dto.ts`
- Modify: `apps/api/src/leads/leads.service.ts`
- Modify: `apps/api/src/deals/dto/update-deal.dto.ts`
- Modify: `apps/api/src/deals/deals.service.ts`

- [ ] **Step 1: Add customData to UpdateLeadDto**

Replace entire content of `apps/api/src/leads/dto/update-lead.dto.ts`:

```typescript
export class UpdateLeadDto {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  notes?: string;
  assignedToId?: string;
  customData?: Record<string, unknown>;
}
```

- [ ] **Step 2: Update LeadsService.update to merge customData**

In `apps/api/src/leads/leads.service.ts`, replace the `update` method (lines 128–131):

```typescript
async update(organizationId: string, id: string, dto: UpdateLeadDto) {
  const lead = await this.findOne(organizationId, id);
  const { customData, ...rest } = dto;
  const data: Record<string, unknown> = { ...rest };
  if (customData !== undefined) {
    data.customData = { ...(lead.customData as object ?? {}), ...customData };
  }
  return this.prisma.lead.update({ where: { id }, data: data as any });
}
```

- [ ] **Step 3: Add customData to UpdateDealDto**

Replace entire content of `apps/api/src/deals/dto/update-deal.dto.ts`:

```typescript
export class UpdateDealDto {
  title?: string;
  leadId?: string | null;
  value?: number | null;
  probability?: number | null;
  expectedCloseAt?: string | null;
  assignedToId?: string | null;
  notes?: string | null;
  customData?: Record<string, unknown>;
}
```

- [ ] **Step 4: Update DealsService.update to merge customData**

In `apps/api/src/deals/deals.service.ts`, find the `update` method. Add customData merge before the `prisma.deal.update` call:

```typescript
async update(organizationId: string, id: string, dto: UpdateDealDto) {
  const deal = await this.prisma.deal.findFirst({ where: { id, organizationId } });
  if (!deal) throw new NotFoundException('Deal not found');
  const { customData, expectedCloseAt, value, probability, ...rest } = dto;
  const data: Record<string, unknown> = { ...rest };
  if (value !== undefined) data.value = value;
  if (probability !== undefined) data.probability = probability;
  if (expectedCloseAt !== undefined) data.expectedCloseAt = expectedCloseAt ? new Date(expectedCloseAt) : null;
  if (customData !== undefined) {
    data.customData = { ...(deal.customData as object ?? {}), ...customData };
  }
  const updated = await this.prisma.deal.update({
    where: { id },
    data: data as any,
    include: DEAL_INCLUDE,
  });
  return serializeDeal(updated);
}
```

- [ ] **Step 5: Build API to verify**

```bash
cd C:/Users/OS/crm-saas/apps/api
npx nest build 2>&1 | tail -10
```

Expected: build succeeds

- [ ] **Step 6: Commit**

```bash
cd C:/Users/OS/crm-saas
git add apps/api/src/leads/dto/update-lead.dto.ts \
        apps/api/src/leads/leads.service.ts \
        apps/api/src/deals/dto/update-deal.dto.ts \
        apps/api/src/deals/deals.service.ts
git commit -m "feat(api): merge customData in Lead and Deal update endpoints"
```

---

### Task 5: Frontend API client + update Lead and Deal types

**Files:**
- Create: `apps/web/lib/api/custom-fields.ts`
- Modify: `apps/web/lib/api/leads.ts`
- Modify: `apps/web/lib/api/pipeline.ts`

- [ ] **Step 1: Create custom-fields API client**

Create `apps/web/lib/api/custom-fields.ts`:

```typescript
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function apiFetch(path: string, token: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init?.headers },
  });
  if (!res.ok) throw new Error(await res.text());
  if (res.status === 204) return undefined as any;
  return res.json();
}

export type CustomFieldType = 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT' | 'MULTI_SELECT' | 'CHECKBOX' | 'URL';
export type CustomFieldEntity = 'LEAD' | 'DEAL';

export interface CustomFieldDef {
  id: string;
  entity: CustomFieldEntity;
  name: string;
  slug: string;
  type: CustomFieldType;
  options?: string[] | null;
  order: number;
  createdAt: string;
}

export function getCustomFields(token: string, entity: CustomFieldEntity): Promise<CustomFieldDef[]> {
  return apiFetch(`/custom-fields?entity=${entity}`, token);
}

export function createCustomField(
  token: string,
  entity: CustomFieldEntity,
  name: string,
  type: CustomFieldType,
  options?: string[],
): Promise<CustomFieldDef> {
  return apiFetch('/custom-fields', token, {
    method: 'POST',
    body: JSON.stringify({ entity, name, type, options }),
  });
}

export function updateCustomField(
  token: string,
  id: string,
  data: { name?: string; options?: string[]; order?: number },
): Promise<CustomFieldDef> {
  return apiFetch(`/custom-fields/${id}`, token, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteCustomField(token: string, id: string): Promise<void> {
  return apiFetch(`/custom-fields/${id}`, token, { method: 'DELETE' });
}
```

- [ ] **Step 2: Add customData to Lead interface**

In `apps/web/lib/api/leads.ts`, add `customData` to the `Lead` interface after `convertedAt`:

```typescript
  convertedAt?: string;
  customData?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
```

- [ ] **Step 3: Add customData to Deal interface**

In `apps/web/lib/api/pipeline.ts`, find the `Deal` interface and add `customData` after `lostReason`:

```typescript
  lostReason?: string | null;
  customData?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
```

- [ ] **Step 4: Build web to verify types**

```bash
cd C:/Users/OS/crm-saas/apps/web
npx tsc --noEmit 2>&1 | head -20
```

Expected: no new type errors

- [ ] **Step 5: Commit**

```bash
cd C:/Users/OS/crm-saas
git add apps/web/lib/api/custom-fields.ts \
        apps/web/lib/api/leads.ts \
        apps/web/lib/api/pipeline.ts
git commit -m "feat(web): add custom-fields API client and customData to Lead/Deal types"
```

---

### Task 6: useCustomFields hook

**Files:**
- Create: `apps/web/hooks/use-custom-fields.ts`

- [ ] **Step 1: Create the hook**

Create `apps/web/hooks/use-custom-fields.ts`:

```typescript
'use client';
import { useAuth, useOrganization } from '@clerk/nextjs';
import { useQuery } from '@tanstack/react-query';
import { getCustomFields, CustomFieldDef, CustomFieldEntity } from '@/lib/api/custom-fields';

export function useCustomFields(entity: CustomFieldEntity) {
  const { getToken } = useAuth();
  const { organization } = useOrganization();

  const { data: fields = [], isLoading } = useQuery<CustomFieldDef[]>({
    queryKey: ['custom-fields', organization?.id, entity],
    queryFn: async () => {
      const token = await getToken();
      return getCustomFields(token!, entity);
    },
    enabled: !!organization?.id,
  });

  return { fields, isLoading };
}
```

- [ ] **Step 2: Build to verify no errors**

```bash
cd C:/Users/OS/crm-saas/apps/web
npx tsc --noEmit 2>&1 | head -10
```

Expected: no new errors

- [ ] **Step 3: Commit**

```bash
cd C:/Users/OS/crm-saas
git add apps/web/hooks/use-custom-fields.ts
git commit -m "feat(web): add useCustomFields hook"
```

---

### Task 7: Sidebar — add Personalização group with Campos Leads + Campos Deals

**Files:**
- Modify: `apps/web/app/[orgSlug]/_components/app-sidebar.tsx`

- [ ] **Step 1: Add Sliders icon import and personalização links**

In `apps/web/app/[orgSlug]/_components/app-sidebar.tsx`, add `Sliders` to the lucide-react import:

```typescript
import {
  LayoutDashboard, Users, Kanban, MessageCircle, Settings, Sliders,
} from 'lucide-react';
```

- [ ] **Step 2: Add the Personalização section to the nav JSX**

After the closing `</nav>` tag (line 65), add a new section before the `{/* User */}` block:

```tsx
      {/* Personalização */}
      <div className="px-2 pb-2">
        <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest px-3 mb-1">
          Personalização
        </p>
        {[
          { label: 'Campos Leads', href: `${base}/settings/custom-fields/leads` },
          { label: 'Campos Deals', href: `${base}/settings/custom-fields/deals` },
        ].map(({ label, href }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                active
                  ? 'bg-indigo-500/15 text-indigo-300 border-l-2 border-indigo-500'
                  : 'text-slate-500 hover:bg-[#334155]/60 hover:text-slate-300'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 shrink-0" />
              {label}
            </Link>
          );
        })}
      </div>
```

- [ ] **Step 3: Build to verify**

```bash
cd C:/Users/OS/crm-saas/apps/web
npx tsc --noEmit 2>&1 | head -10
```

Expected: no new errors

- [ ] **Step 4: Commit**

```bash
cd C:/Users/OS/crm-saas
git add "apps/web/app/[orgSlug]/_components/app-sidebar.tsx"
git commit -m "feat(web): add Personalização group to sidebar with Campos Leads and Campos Deals links"
```

---

### Task 8: CustomFieldsManager shared component

**Files:**
- Create: `apps/web/components/custom-fields-manager.tsx`

- [ ] **Step 1: Create the component**

Create `apps/web/components/custom-fields-manager.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrganization } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  CustomFieldDef, CustomFieldEntity, CustomFieldType,
  createCustomField, updateCustomField, deleteCustomField,
} from '@/lib/api/custom-fields';
import { useCustomFields } from '@/hooks/use-custom-fields';

const TYPE_LABELS: Record<CustomFieldType, string> = {
  TEXT: 'Texto', NUMBER: 'Número', DATE: 'Data',
  SELECT: 'Seleção', MULTI_SELECT: 'Multi-seleção',
  CHECKBOX: 'Checkbox', URL: 'URL',
};

const TYPE_COLORS: Record<CustomFieldType, string> = {
  TEXT: 'bg-blue-950 text-blue-300',
  NUMBER: 'bg-indigo-950 text-indigo-300',
  DATE: 'bg-violet-950 text-violet-300',
  SELECT: 'bg-amber-950 text-amber-300',
  MULTI_SELECT: 'bg-orange-950 text-orange-300',
  CHECKBOX: 'bg-emerald-950 text-emerald-300',
  URL: 'bg-cyan-950 text-cyan-300',
};

interface Props {
  entity: CustomFieldEntity;
}

export function CustomFieldsManager({ entity }: Props) {
  const { getToken } = useAuth();
  const { organization } = useOrganization();
  const queryClient = useQueryClient();
  const { fields, isLoading } = useCustomFields(entity);

  const [name, setName] = useState('');
  const [type, setType] = useState<CustomFieldType>('TEXT');
  const [optionsInput, setOptionsInput] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['custom-fields', organization?.id, entity] });

  const createMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      const options =
        (type === 'SELECT' || type === 'MULTI_SELECT') && optionsInput.trim()
          ? optionsInput.split(',').map((o) => o.trim()).filter(Boolean)
          : undefined;
      return createCustomField(token!, entity, name.trim(), type, options);
    },
    onSuccess: () => { invalidate(); setName(''); setOptionsInput(''); },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const token = await getToken();
      return updateCustomField(token!, id, { name });
    },
    onSuccess: () => { invalidate(); setEditingId(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      return deleteCustomField(token!, id);
    },
    onSuccess: invalidate,
  });

  const needsOptions = type === 'SELECT' || type === 'MULTI_SELECT';

  return (
    <div className="max-w-xl">
      <div className="bg-[#1e293b] border border-[#334155] rounded-xl overflow-hidden mb-3">
        <div className="flex items-center px-4 py-2 border-b border-[#334155]">
          <span className="flex-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Nome</span>
          <span className="w-28 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Tipo</span>
          <span className="w-16" />
        </div>

        {isLoading && (
          <p className="px-4 py-6 text-sm text-slate-500 text-center">Carregando...</p>
        )}

        {!isLoading && fields.length === 0 && (
          <p className="px-4 py-6 text-sm text-slate-500 text-center">
            Nenhum campo definido. Adicione o primeiro abaixo.
          </p>
        )}

        {fields.map((field) => (
          <div
            key={field.id}
            className="flex items-center px-4 py-3 border-b border-[#334155]/50 last:border-0"
          >
            <div className="flex-1 pr-2">
              {editingId === field.id ? (
                <div className="flex gap-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-7 text-xs bg-[#0f172a] border-[#334155] text-slate-100"
                    autoFocus
                  />
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700"
                    onClick={() => updateMutation.mutate({ id: field.id, name: editName })}
                    disabled={updateMutation.isPending}
                  >
                    OK
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-[#334155]"
                    onClick={() => setEditingId(null)}
                  >
                    ✕
                  </Button>
                </div>
              ) : (
                <span
                  className="text-sm font-medium text-slate-200 cursor-pointer hover:text-indigo-300"
                  onClick={() => { setEditingId(field.id); setEditName(field.name); }}
                >
                  {field.name}
                </span>
              )}
            </div>
            <span className="w-28">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${TYPE_COLORS[field.type]}`}>
                {TYPE_LABELS[field.type]}
              </span>
            </span>
            <button
              onClick={() => { if (confirm(`Remover campo "${field.name}"?`)) deleteMutation.mutate(field.id); }}
              disabled={deleteMutation.isPending}
              className="w-16 text-right text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
            >
              Remover
            </button>
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); if (name.trim()) createMutation.mutate(); }}
        className="bg-[#1e293b] border border-dashed border-indigo-500/40 rounded-xl p-4 space-y-3"
      >
        <p className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider">Novo campo</p>
        <div className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do campo..."
            className="flex-1 h-8 text-sm bg-[#0f172a] border-[#334155] text-slate-100 placeholder:text-slate-600"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as CustomFieldType)}
            className="h-8 rounded-md border border-[#334155] bg-[#0f172a] text-slate-100 text-sm px-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {(Object.keys(TYPE_LABELS) as CustomFieldType[]).map((t) => (
              <option key={t} value={t}>{TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
        {needsOptions && (
          <Input
            value={optionsInput}
            onChange={(e) => setOptionsInput(e.target.value)}
            placeholder="Opções separadas por vírgula: B2B, B2C, Outro"
            className="h-8 text-sm bg-[#0f172a] border-[#334155] text-slate-100 placeholder:text-slate-600"
          />
        )}
        <Button
          type="submit"
          disabled={!name.trim() || createMutation.isPending}
          className="h-8 w-full text-sm bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
        >
          {createMutation.isPending ? 'Salvando...' : '+ Adicionar campo'}
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Build to verify**

```bash
cd C:/Users/OS/crm-saas/apps/web
npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors

- [ ] **Step 3: Commit**

```bash
cd C:/Users/OS/crm-saas
git add apps/web/components/custom-fields-manager.tsx
git commit -m "feat(web): add CustomFieldsManager shared component"
```

---

### Task 9: Settings pages — Campos Leads and Campos Deals

**Files:**
- Create: `apps/web/app/[orgSlug]/settings/custom-fields/leads/page.tsx`
- Create: `apps/web/app/[orgSlug]/settings/custom-fields/deals/page.tsx`

- [ ] **Step 1: Create Campos Leads page**

Create `apps/web/app/[orgSlug]/settings/custom-fields/leads/page.tsx`:

```tsx
import { CustomFieldsManager } from '@/components/custom-fields-manager';

export default function CustomFieldsLeadsPage() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-slate-100 mb-1">Campos Leads</h1>
      <p className="text-sm text-slate-500 mb-6">
        Campos extras exibidos na aba "Campos extras" de cada lead.
      </p>
      <CustomFieldsManager entity="LEAD" />
    </div>
  );
}
```

- [ ] **Step 2: Create Campos Deals page**

Create `apps/web/app/[orgSlug]/settings/custom-fields/deals/page.tsx`:

```tsx
import { CustomFieldsManager } from '@/components/custom-fields-manager';

export default function CustomFieldsDealsPage() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-slate-100 mb-1">Campos Deals</h1>
      <p className="text-sm text-slate-500 mb-6">
        Campos extras exibidos na aba "Campos extras" de cada deal.
      </p>
      <CustomFieldsManager entity="DEAL" />
    </div>
  );
}
```

- [ ] **Step 3: Build to verify**

```bash
cd C:/Users/OS/crm-saas/apps/web
npx tsc --noEmit 2>&1 | head -10
```

Expected: no new errors

- [ ] **Step 4: Commit**

```bash
cd C:/Users/OS/crm-saas
git add "apps/web/app/[orgSlug]/settings/custom-fields/"
git commit -m "feat(web): add Settings pages for Campos Leads and Campos Deals"
```

---

### Task 10: Lead slide-over — add "Campos extras" tab

**Files:**
- Modify: `apps/web/app/[orgSlug]/leads/_components/lead-slide-over.tsx`

- [ ] **Step 1: Add imports**

In `apps/web/app/[orgSlug]/leads/_components/lead-slide-over.tsx`, update the import block:

```typescript
import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Lead, LeadStatus, updateLeadStatus, deleteLead, updateLead } from '@/lib/api/leads';
import { useAuth, useOrganization } from '@clerk/nextjs';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCustomFields } from '@/hooks/use-custom-fields';
```

- [ ] **Step 2: Add tab state and customData save mutation inside the component**

Inside the `LeadSlideOver` function body, after the existing `deleteMutation`, add:

```typescript
  const [activeTab, setActiveTab] = useState<'detalhes' | 'campos'>('detalhes');
  const { fields: customFields } = useCustomFields('LEAD');
  const [customValues, setCustomValues] = useState<Record<string, unknown>>({});

  // Sync customValues when lead changes
  useState(() => {
    if (lead?.customData) setCustomValues(lead.customData as Record<string, unknown>);
  });

  const saveCustomMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return updateLead(token!, lead!.id, { customData: customValues });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads', 'kanban', organization?.id] });
    },
  });
```

- [ ] **Step 3: Replace JSX content with tabbed layout**

Replace everything inside the `<SheetContent>` tag from `<SheetHeader>` onwards with the following tabbed layout. The key sections are: header with tabs, "Detalhes" tab content (existing fields), and "Campos extras" tab content (dynamic form).

```tsx
      <SheetContent className="w-[420px] bg-[#1e293b] border-[#334155] text-slate-100 overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-slate-100 text-xl">{lead.name}</SheetTitle>
          <div className="flex gap-2 mt-1">
            <span className={`text-xs px-2 py-1 rounded font-semibold ${STATUS_COLORS[lead.status]}`}>
              {STATUS_LABELS[lead.status]}
            </span>
          </div>
        </SheetHeader>

        {/* Tabs */}
        <div className="flex border-b border-[#334155] mt-4 px-6">
          {(['detalhes', 'campos'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-2 mr-4 text-xs font-semibold uppercase tracking-wide transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? 'text-indigo-300 border-indigo-500'
                  : 'text-slate-500 border-transparent hover:text-slate-300'
              }`}
            >
              {tab === 'detalhes' ? 'Detalhes' : 'Campos extras'}
            </button>
          ))}
        </div>

        {activeTab === 'detalhes' && (
          <>
            <div className="mt-6 space-y-2 text-sm text-slate-300 px-6">
              {lead.email && <p className="flex items-center gap-2"><span className="text-slate-500">Email</span>{lead.email}</p>}
              {lead.phone && <p className="flex items-center gap-2"><span className="text-slate-500">Telefone</span>{lead.phone}</p>}
              {lead.company && <p className="flex items-center gap-2"><span className="text-slate-500">Empresa</span>{lead.company}</p>}
              {lead.notes && (
                <p className="text-slate-400 text-xs mt-3 bg-[#0f172a] rounded-lg p-3 border border-[#334155]">{lead.notes}</p>
              )}
            </div>

            {hasUtms && (
              <div className="mt-4 px-6">
                <button
                  onClick={() => setShowUtms(!showUtms)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                >
                  {showUtms ? '▲ Ocultar rastreamento' : '▼ Ver UTMs / rastreamento'}
                </button>
                {showUtms && (
                  <div className="mt-2 bg-[#0f172a] rounded-lg p-3 text-xs text-slate-500 space-y-1 font-mono border border-[#334155]">
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

            <div className="mt-6 px-6">
              <p className="text-xs text-slate-500 mb-2 uppercase tracking-wide font-medium">Mover para</p>
              <div className="flex flex-wrap gap-2">
                {ALL_STATUSES.filter((s) => s !== lead.status && lead.status !== 'CONVERTIDO').map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant="outline"
                    className="text-xs border-[#334155] bg-transparent text-slate-300 hover:bg-[#334155] hover:text-slate-100"
                    onClick={() => statusMutation.mutate(s)}
                    disabled={statusMutation.isPending}
                  >
                    {STATUS_LABELS[s]}
                  </Button>
                ))}
              </div>
            </div>

            {lead.phone && (
              <div className="mt-4 px-6">
                <p className="text-xs text-slate-500 mb-2 uppercase tracking-wide font-medium">WhatsApp</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs border-emerald-800 text-emerald-400 hover:bg-emerald-950 bg-transparent"
                  onClick={() => {
                    const jid = `${lead.phone!.replace(/\D/g, '')}@s.whatsapp.net`;
                    router.push(`/${orgSlug}/whatsapp?jid=${encodeURIComponent(jid)}`);
                    onClose();
                  }}
                >
                  <svg className="w-3.5 h-3.5 mr-1.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                  Conversar no WhatsApp
                </Button>
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-[#334155] px-6">
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
          </>
        )}

        {activeTab === 'campos' && (
          <div className="mt-6 px-6">
            {customFields.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">
                Nenhum campo customizado definido.{' '}
                <span className="text-indigo-400">Configure em Configurações → Campos Leads.</span>
              </p>
            ) : (
              <>
                <div className="space-y-4">
                  {customFields.map((field) => {
                    const value = customValues[field.slug] ?? lead.customData?.[field.slug] ?? '';
                    return (
                      <div key={field.id}>
                        <p className="text-xs text-slate-500 mb-1">{field.name}</p>
                        {field.type === 'CHECKBOX' ? (
                          <input
                            type="checkbox"
                            checked={!!value}
                            onChange={(e) => setCustomValues((prev) => ({ ...prev, [field.slug]: e.target.checked }))}
                            className="w-4 h-4 accent-indigo-500"
                          />
                        ) : field.type === 'SELECT' ? (
                          <select
                            value={String(value)}
                            onChange={(e) => setCustomValues((prev) => ({ ...prev, [field.slug]: e.target.value }))}
                            className="w-full h-8 px-3 rounded-md bg-[#0f172a] border border-[#334155] text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            <option value="">— Selecionar —</option>
                            {(field.options ?? []).map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : field.type === 'MULTI_SELECT' ? (
                          <div className="flex flex-wrap gap-1.5">
                            {(field.options ?? []).map((opt) => {
                              const selected = Array.isArray(value) ? (value as string[]).includes(opt) : false;
                              return (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => {
                                    const current = Array.isArray(value) ? (value as string[]) : [];
                                    const next = selected ? current.filter((v) => v !== opt) : [...current, opt];
                                    setCustomValues((prev) => ({ ...prev, [field.slug]: next }));
                                  }}
                                  className={`text-xs px-2 py-1 rounded border transition-colors ${
                                    selected
                                      ? 'bg-indigo-600 border-indigo-500 text-white'
                                      : 'bg-[#0f172a] border-[#334155] text-slate-400 hover:text-slate-200'
                                  }`}
                                >
                                  {opt}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <input
                            type={field.type === 'NUMBER' ? 'number' : field.type === 'DATE' ? 'date' : field.type === 'URL' ? 'url' : 'text'}
                            value={String(value)}
                            onChange={(e) => setCustomValues((prev) => ({ ...prev, [field.slug]: e.target.value }))}
                            placeholder="—"
                            className="w-full h-8 px-3 rounded-md bg-[#0f172a] border border-[#334155] text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
                <Button
                  onClick={() => saveCustomMutation.mutate()}
                  disabled={saveCustomMutation.isPending}
                  className="mt-4 w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {saveCustomMutation.isPending ? 'Salvando...' : 'Salvar campos'}
                </Button>
              </>
            )}
          </div>
        )}
      </SheetContent>
```

- [ ] **Step 4: Build to verify**

```bash
cd C:/Users/OS/crm-saas/apps/web
npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors

- [ ] **Step 5: Commit**

```bash
cd C:/Users/OS/crm-saas
git add "apps/web/app/[orgSlug]/leads/_components/lead-slide-over.tsx"
git commit -m "feat(web): add Campos extras tab to lead slide-over"
```

---

### Task 11: Deal slide-over — add "Campos extras" tab

**Files:**
- Modify: `apps/web/app/[orgSlug]/pipeline/_components/deal-slide-over.tsx`

- [ ] **Step 1: Add imports**

In `apps/web/app/[orgSlug]/pipeline/_components/deal-slide-over.tsx`, add to existing imports:

```typescript
import { useCustomFields } from '@/hooks/use-custom-fields';
import { updateDeal } from '@/lib/api/pipeline';  // already imported — no change needed
```

Add the hook import line after the existing imports:

```typescript
import { useCustomFields } from '@/hooks/use-custom-fields';
```

- [ ] **Step 2: Add tab state and custom fields state inside the component**

Inside `DealSlideOver`, after the existing state declarations, add:

```typescript
  const [activeTab, setActiveTab] = useState<'detalhes' | 'campos'>('detalhes');
  const { fields: customFields } = useCustomFields('DEAL');
  const [customValues, setCustomValues] = useState<Record<string, unknown>>({});

  const saveCustomMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return updateDeal(token!, deal!.id, { customData: customValues });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline', 'kanban', organization?.id] });
    },
  });
```

Also update the `useEffect` that syncs deal state to also reset customValues:

```typescript
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
      setCustomValues((deal.customData as Record<string, unknown>) ?? {});
      setActiveTab('detalhes');
    }
  }, [deal]);
```

- [ ] **Step 3: Add tabs to JSX**

Replace the opening of the `<SheetContent>` inner div with a tabbed version. After `<SheetHeader>` and title, add tabs and wrap existing content in `{activeTab === 'detalhes' && ...}`. Add "Campos extras" tab content after it.

Replace the entire content inside `<SheetContent>` with:

```tsx
        <SheetHeader>
          <SheetTitle className="text-slate-100 truncate">{deal.title}</SheetTitle>
        </SheetHeader>

        {/* Tabs */}
        <div className="flex border-b border-slate-700 mt-4 px-1">
          {(['detalhes', 'campos'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-2 mr-4 text-xs font-semibold uppercase tracking-wide transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? 'text-indigo-300 border-indigo-500'
                  : 'text-slate-500 border-transparent hover:text-slate-300'
              }`}
            >
              {tab === 'detalhes' ? 'Detalhes' : 'Campos extras'}
            </button>
          ))}
        </div>

        {activeTab === 'detalhes' && (
          <div className="mt-6 space-y-4 px-1">
            <div>
              <Label className="text-slate-400 text-xs">Título</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 bg-slate-800 border-slate-600 text-slate-100" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-400 text-xs">Valor (R$)</Label>
                <Input value={value} onChange={(e) => setValue(e.target.value)} type="number" min="0" step="0.01" className="mt-1 bg-slate-800 border-slate-600 text-slate-100" />
              </div>
              <div>
                <Label className="text-slate-400 text-xs">Probabilidade (%)</Label>
                <Input value={probability} onChange={(e) => setProbability(e.target.value)} type="number" min="0" max="100" className="mt-1 bg-slate-800 border-slate-600 text-slate-100" />
              </div>
            </div>
            <div>
              <Label className="text-slate-400 text-xs">Data de fechamento prevista</Label>
              <Input value={expectedCloseAt} onChange={(e) => setExpectedCloseAt(e.target.value)} type="date" className="mt-1 bg-slate-800 border-slate-600 text-slate-100" />
            </div>
            <div>
              <Label className="text-slate-400 text-xs">Notas</Label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-1 w-full rounded-md bg-slate-800 border border-slate-600 text-slate-100 text-sm px-3 py-2 resize-none outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white">
              {updateMutation.isPending ? 'Salvando...' : 'Salvar alterações'}
            </Button>
            <div className="border-t border-slate-700 pt-4">
              <Label className="text-slate-400 text-xs">Mover para estágio</Label>
              <select value={targetStageId} onChange={(e) => setTargetStageId(e.target.value)} className="mt-1 w-full rounded-md bg-slate-800 border border-slate-600 text-slate-100 text-sm px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-500">
                {stages.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
              </select>
              {targetStage?.type === 'LOST' && (
                <div className="mt-2">
                  <Label className="text-slate-400 text-xs">Motivo da perda</Label>
                  <Input value={lostReason} onChange={(e) => setLostReason(e.target.value)} className="mt-1 bg-slate-800 border-slate-600 text-slate-100" placeholder="Ex: Preço, Concorrente..." />
                </div>
              )}
              {stageChanged && (
                <Button onClick={() => moveMutation.mutate()} disabled={moveMutation.isPending} className="mt-2 w-full bg-slate-700 hover:bg-slate-600 text-white">
                  {moveMutation.isPending ? 'Movendo...' : `Mover para "${targetStage?.name}"`}
                </Button>
              )}
            </div>
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <div className="border-t border-slate-700 pt-4">
              {deal.lead && <p className="text-xs text-slate-500 mb-2">Lead: {deal.lead.name}</p>}
              {deal.wonAt && <p className="text-xs text-green-400 mb-2">Ganho em {new Date(deal.wonAt).toLocaleDateString('pt-BR')}</p>}
              {deal.lostAt && <p className="text-xs text-red-400 mb-2">Perdido em {new Date(deal.lostAt).toLocaleDateString('pt-BR')}{deal.lostReason ? ` — ${deal.lostReason}` : ''}</p>}
              <Button variant="outline" onClick={() => { if (confirm('Excluir este deal?')) deleteMutation.mutate(); }} disabled={deleteMutation.isPending} className="w-full border-red-800 text-red-400 hover:bg-red-950">
                {deleteMutation.isPending ? 'Excluindo...' : 'Excluir deal'}
              </Button>
            </div>
          </div>
        )}

        {activeTab === 'campos' && (
          <div className="mt-6 px-1">
            {customFields.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">
                Nenhum campo customizado definido.{' '}
                <span className="text-indigo-400">Configure em Configurações → Campos Deals.</span>
              </p>
            ) : (
              <>
                <div className="space-y-4">
                  {customFields.map((field) => {
                    const value = customValues[field.slug] ?? deal.customData?.[field.slug] ?? '';
                    return (
                      <div key={field.id}>
                        <Label className="text-slate-400 text-xs">{field.name}</Label>
                        {field.type === 'CHECKBOX' ? (
                          <input type="checkbox" checked={!!value} onChange={(e) => setCustomValues((prev) => ({ ...prev, [field.slug]: e.target.checked }))} className="mt-1 w-4 h-4 accent-indigo-500" />
                        ) : field.type === 'SELECT' ? (
                          <select value={String(value)} onChange={(e) => setCustomValues((prev) => ({ ...prev, [field.slug]: e.target.value }))} className="mt-1 w-full h-8 px-3 rounded-md bg-slate-800 border border-slate-600 text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
                            <option value="">— Selecionar —</option>
                            {(field.options ?? []).map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
                          </select>
                        ) : field.type === 'MULTI_SELECT' ? (
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {(field.options ?? []).map((opt) => {
                              const selected = Array.isArray(value) ? (value as string[]).includes(opt) : false;
                              return (
                                <button key={opt} type="button" onClick={() => { const current = Array.isArray(value) ? (value as string[]) : []; const next = selected ? current.filter((v) => v !== opt) : [...current, opt]; setCustomValues((prev) => ({ ...prev, [field.slug]: next })); }} className={`text-xs px-2 py-1 rounded border transition-colors ${selected ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400 hover:text-slate-200'}`}>
                                  {opt}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <Input type={field.type === 'NUMBER' ? 'number' : field.type === 'DATE' ? 'date' : field.type === 'URL' ? 'url' : 'text'} value={String(value)} onChange={(e) => setCustomValues((prev) => ({ ...prev, [field.slug]: e.target.value }))} placeholder="—" className="mt-1 bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500" />
                        )}
                      </div>
                    );
                  })}
                </div>
                <Button onClick={() => saveCustomMutation.mutate()} disabled={saveCustomMutation.isPending} className="mt-4 w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                  {saveCustomMutation.isPending ? 'Salvando...' : 'Salvar campos'}
                </Button>
              </>
            )}
          </div>
        )}
```

- [ ] **Step 4: Build to verify**

```bash
cd C:/Users/OS/crm-saas/apps/web
npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors

- [ ] **Step 5: Commit**

```bash
cd C:/Users/OS/crm-saas
git add "apps/web/app/[orgSlug]/pipeline/_components/deal-slide-over.tsx"
git commit -m "feat(web): add Campos extras tab to deal slide-over"
```

---

### Task 12: Push and deploy

- [ ] **Step 1: Push all commits to GitHub**

```bash
cd C:/Users/OS/crm-saas
git push origin master
```

Expected: all commits pushed

- [ ] **Step 2: Trigger deploy in Easypanel**

In the Easypanel dashboard at `http://srv1663592.hstgr.cloud:3000/projects/crm-saas/compose/crm`, click **Implantar** (Deploy).

Wait for the build to complete (~3–5 minutes). The spinner will stop and services will show as Healthy.

- [ ] **Step 3: Apply migration in production**

The migration must be run against the Supabase DB. From the `packages/db` directory with the production `DATABASE_URL`:

```bash
cd C:/Users/OS/crm-saas/packages/db
DATABASE_URL="postgresql://postgres.ysdfuujyybgeykednhjc:..." npx prisma migrate deploy
```

Use the Supabase connection string from `apps/api/.env`.

- [ ] **Step 4: Verify in browser**

Open `https://srv1663592.hstgr.cloud`, navigate to Configurações → Campos Leads, create a test field, open a lead and verify the "Campos extras" tab appears and saves correctly.

---

## Self-Review

**Spec coverage:**
- [x] CustomFieldDef with entity (LEAD/DEAL), slug, all 7 types — Task 1
- [x] customData JSONB on Lead and Deal — Task 1
- [x] Admin-only create/update/delete — Task 2 (requireAdmin in service)
- [x] GET open to all members — Task 3 (only POST/PATCH/DELETE require admin)
- [x] slug generated from name, immutable — Task 2 (toSlug, not exposed in UpdateDto)
- [x] options for SELECT/MULTI_SELECT — Task 2 + 5 + 8
- [x] merge customData (not overwrite) — Task 4
- [x] Frontend API client with entity param — Task 5
- [x] useCustomFields hook — Task 6
- [x] Sidebar Personalização group — Task 7
- [x] CustomFieldsManager with all types — Task 8
- [x] Settings pages for Leads and Deals — Task 9
- [x] Lead slide-over: tabs + all input types — Task 10
- [x] Deal slide-over: tabs + all input types — Task 11
- [x] Tab hidden shows empty state with link to settings — Tasks 10+11
- [x] Deploy + migration — Task 12

**Type consistency:**
- `CustomFieldDef.slug` used as key in slide-overs ✓
- `createCustomField(token, entity, name, type, options?)` matches API client ✓
- `useCustomFields(entity)` returns `{ fields, isLoading }` used consistently ✓
- `saveCustomMutation` calls `updateLead(token, id, { customData })` / `updateDeal(token, id, { customData })` ✓
