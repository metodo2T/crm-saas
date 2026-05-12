# Lead Engine — Design Spec

**Sub-project:** 2 of 7  
**Date:** 2026-05-12  
**Status:** Approved

---

## 1. Overview

The Lead Engine is the capture-and-qualification layer of the CRM. It receives leads from multiple sources (manual entry, CSV import, embeddable web form), tracks their progression through a 5-status funnel, and converts qualified leads into Pipeline Deals. All data is scoped to an `organizationId` for multi-tenant isolation.

**Goal:** Allow agencies to capture, track, and qualify leads from paid traffic campaigns — with full UTM attribution — and push converted leads to the sales pipeline.

---

## 2. Architecture

**Backend:** NestJS module (`LeadModule`) with two controllers:
- `LeadsController` — protected by `ClerkAuthGuard` + `@CurrentOrg()`, handles all CRUD operations
- `CaptureController` — public endpoint (no auth), with Redis-based rate limiting, for embeddable forms

**Frontend:** Next.js App Router page at `app/[orgSlug]/leads/page.tsx`. Kanban board using TanStack Query with 30-second polling (`GET /leads/kanban`). Drag-and-drop via `@dnd-kit/core` with optimistic updates.

**Data store:** PostgreSQL (Prisma), Redis for rate limiting and plan usage counters (already in `SubscriptionService`).

---

## 3. Data Model

### Lead (new Prisma model)

```prisma
model Lead {
  id             String     @id @default(uuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  name           String
  email          String?
  phone          String?
  company        String?
  notes          String?
  status         LeadStatus @default(NOVO)
  source         LeadSource
  assignedToId   String?
  assignedTo     User?      @relation(fields: [assignedToId], references: [id])
  utmSource      String?
  utmMedium      String?
  utmCampaign    String?
  utmContent     String?
  utmTerm        String?
  fbclid         String?
  gclid          String?
  convertedAt    DateTime?
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt

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

### Validation rules
- `name` is required
- At least one of `email` or `phone` must be provided
- `convertedAt` is set automatically when `status` transitions to `CONVERTIDO`
- Valid status transitions: any status → any status (no forced order, agencies need flexibility), except CONVERTIDO → any (locked once converted)

### Plan limits (existing Redis counter — `SubscriptionService.incrementUsage`)
| Plan    | Max leads/month |
|---------|----------------|
| Starter | 500            |
| Pro     | 2,000          |
| Agency  | Unlimited (-1) |

---

## 4. API Endpoints

### LeadsController — `GET|POST|PATCH|DELETE /leads` (auth required)

All endpoints require `ClerkAuthGuard`. Organization is extracted via `@CurrentOrg()`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/leads` | Paginated list. Query params: `status`, `source`, `assignedTo`, `search`, `page` (default 1), `limit` (default 20, max 100) |
| GET | `/leads/kanban` | Returns leads grouped by status: `{ NOVO: Lead[], CONTATADO: Lead[], … }` |
| GET | `/leads/analytics` | Totals by status and by source |
| GET | `/leads/:id` | Single lead |
| POST | `/leads` | Create lead. Decorated with `@CheckPlanLimit('leads')`. Increments Redis usage counter on success. |
| PATCH | `/leads/:id` | Update fields (name, email, phone, company, notes, assignedToId) |
| PATCH | `/leads/:id/status` | Update status only. Sets `convertedAt` automatically. |
| PATCH | `/leads/:id/assign` | Assign to user |
| DELETE | `/leads/:id` | Soft-delete (set `status = DESCARTADO`) — hard delete not exposed |
| POST | `/leads/import/csv` | Multipart upload. Max 500 rows. Returns `{ imported, skipped, errors }` |

### CaptureController — `POST /leads/capture` (no auth)

Public endpoint for embeddable forms.

**Request body:**
```json
{
  "orgId": "uuid",
  "name": "string (required)",
  "email": "string?",
  "phone": "string?",
  "company": "string?",
  "utmSource": "string?",
  "utmMedium": "string?",
  "utmCampaign": "string?",
  "utmContent": "string?",
  "utmTerm": "string?",
  "fbclid": "string?",
  "gclid": "string?"
}
```

**Protections (in order):**
1. Rate limit: 10 req/min per IP (Redis key: `ratelimit:capture:ip:{ip}:{minute}`, TTL 60s)
2. Rate limit: 100 req/hour per orgId (Redis key: `ratelimit:capture:org:{orgId}:{hour}`, TTL 3600s)
3. Validate `orgId` exists and org has active/trialing subscription
4. Check plan lead limit via `SubscriptionService.checkLimit`
5. CORS: open (`*`) — intentional, form is embedded on client sites
6. On success: create lead with `source = FORM`, increment usage counter, return `{ id }` only (no sensitive data)

**Embeddable snippet** (served from Settings → Formulário page):
```html
<form id="crm-form">
  <input name="name" required>
  <input name="phone">
  <button type="submit">Enviar</button>
</form>
<script>
  const p = new URLSearchParams(location.search);
  document.getElementById('crm-form').addEventListener('submit', e => {
    e.preventDefault();
    fetch('https://api.seucrm.com/leads/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orgId: 'ORG_ID',
        name: e.target.name.value,
        phone: e.target.phone.value,
        utmSource: p.get('utm_source'),
        utmMedium: p.get('utm_medium'),
        utmCampaign: p.get('utm_campaign'),
        fbclid: p.get('fbclid'),
        gclid: p.get('gclid'),
      })
    });
  });
</script>
```

---

## 5. Frontend

### Route: `app/[orgSlug]/leads/page.tsx`

**Layout:**
- Top bar: title "Leads" + total badge, search input, filter dropdowns (Origem, Responsável, Período), CSV import button, "+ Novo Lead" button
- Kanban board: 5 columns (Novo, Contatado, Qualificado, Convertido, Descartado), each with count badge
- Each card shows: name, source badge (color-coded), relative time, assigned user avatar

**Source badge colors:**
- META → red (`#ff6b6b` bg)
- GOOGLE → green (`#4ade80` bg)  
- MANUAL / CSV → slate (`#94a3b8` bg)
- WHATSAPP → green (future)

**Drag-and-drop:** `@dnd-kit/core`. On drop: optimistic update in TanStack Query cache → `PATCH /leads/:id/status` → rollback on error.

**Polling:** TanStack Query `useQuery` with `refetchInterval: 30_000` on `GET /leads/kanban`.

**Slide-over (Sheet from shadcn/ui):** Opens on card click. Shows all fields + UTM section (collapsed by default, expandable). Action buttons: "Mover status", "Atribuir", "Editar", "Descartar".

**Forms:**
- "Novo Lead" → Sheet with form (name required, email or phone required, company optional, source selector, assign to user)
- "Importar CSV" → Dialog with file upload + column mapping preview + import result summary

**TanStack Query keys:**
- `['leads', 'kanban', orgId]` — polled every 30s
- `['leads', orgId, filters]` — list view (not used in kanban, but exists for future table view)
- `['leads', orgId, 'analytics']` — analytics widget

---

## 6. CSV Import

**Accepted columns (case-insensitive, Portuguese or English headers):**
`nome/name`, `email`, `telefone/phone`, `empresa/company`, `observações/notes`

**Process:**
1. Parse with `csv-parse` (streaming, max 500 rows, abort at 501)
2. Validate each row (name required, email or phone required)
3. Bulk insert valid rows with `prisma.lead.createMany`
4. Return `{ imported: N, skipped: M, errors: [{row, reason}] }`
5. Increment usage counter by `imported` count
6. Check plan limit before inserting; if limit would be exceeded, import only up to the limit and return partial result

---

## 7. NestJS Module Structure

```
apps/api/src/leads/
  leads.module.ts          — imports PrismaModule, SubscriptionModule, CaptureModule
  leads.controller.ts      — protected endpoints
  leads.service.ts         — business logic (CRUD, status transitions, CSV)
  capture.controller.ts    — public POST /leads/capture
  dto/
    create-lead.dto.ts
    update-lead.dto.ts
    update-status.dto.ts
    capture-lead.dto.ts
    import-csv.dto.ts
  guards/
    capture-rate-limit.guard.ts  — Redis rate limiting for capture endpoint
```

---

## 8. Error Handling

| Scenario | HTTP Status | Error code |
|----------|-------------|------------|
| Plan limit reached (protected) | 403 | `PLAN_LIMIT_REACHED` |
| Plan limit reached (capture) | 429 | `PLAN_LIMIT_REACHED` |
| IP rate limit exceeded | 429 | `RATE_LIMIT_IP` |
| Org rate limit exceeded | 429 | `RATE_LIMIT_ORG` |
| orgId not found / inactive | 404 | `ORG_NOT_FOUND` |
| name missing | 400 | `VALIDATION_ERROR` |
| neither email nor phone | 400 | `VALIDATION_ERROR` |
| CSV > 500 rows | 400 | `CSV_TOO_LARGE` |
| Lead not in org | 404 | standard not found |

---

## 9. Future Scope (not in this spec)

- Meta Ads / Google Ads API direct integration (sub-project TBD)
- Custom lead fields
- Lead-to-Deal automatic pipeline stage selection
- Webhook notifications on lead creation
- WhatsApp source ingestion (sub-project 4)
