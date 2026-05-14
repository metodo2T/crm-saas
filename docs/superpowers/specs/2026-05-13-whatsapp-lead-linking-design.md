# WhatsApp Inbox — Lead Linking (Sub-projeto 3)

**Goal:** Allow agents to see, link, and navigate between WhatsApp conversations and CRM leads. Add a persistent right-side lead panel inside the conversation view, plus a "Ver no WhatsApp" shortcut from the lead slide-over.

---

## 1. Context

The WhatsApp Inbox (`/[orgSlug]/whatsapp`) already supports: Z-API connection, QR code setup, conversation list (5s polling), message send/receive, and automatic lead creation when an unknown number messages in. The current UI has 2 columns (conversation list + chat area).

**Gap being solved:** Agents cannot see which lead is linked to a conversation without leaving the page, and cannot manually link/unlink/create a lead from the inbox.

---

## 2. Data Model

No schema changes required. `WhatsAppMessage` already has `leadId String?` which is set per-message. A "conversation→lead" link is represented by the `leadId` shared across all messages of the same `remoteJid`.

The manual link/unlink operation bulk-updates `WhatsAppMessage.leadId` for all records matching `{ instanceId, remoteJid }`.

---

## 3. Backend

### 3.1 New endpoint

```
PATCH /whatsapp/conversations/:jid/lead
Authorization: Bearer <clerk-jwt>
Body: { leadId: string | null }
Response: { lead: { id, name, email, phone, status, source } | null }
```

**Service method** `WhatsAppService.linkLead(orgId, remoteJid, leadId)`:
1. Look up the org's WhatsApp instance (`getOrFail`)
2. If `leadId` is not null: verify `prisma.lead.findFirst({ where: { id: leadId, organizationId: orgId } })` — throw `NotFoundException` if not found
3. `prisma.whatsAppMessage.updateMany({ where: { instanceId: instance.id, remoteJid }, data: { leadId } })`
4. Return `{ lead }` (the lead record, or null if unlinking)

**Modified files:**
- `apps/api/src/whatsapp/whatsapp.service.ts` — add `linkLead` method
- `apps/api/src/whatsapp/whatsapp.controller.ts` — add `@Patch('conversations/:jid/lead')` route

---

## 4. Frontend

### 4.1 Layout change — `wa-inbox.tsx`

WaInbox changes from 2-column to 3-column when a conversation is selected:

```
┌──────────────┬──────────────────────────┬───────────────┐
│ Conversas    │       Chat               │  Lead Panel   │
│ w-72         │    flex-1                │  w-64         │
└──────────────┴──────────────────────────┴───────────────┘
```

When no conversation is selected, the lead panel is not rendered (2-column layout unchanged).

The chat header keeps the contact name and phone as-is. No clickable link is added to the header — the lead panel handles all lead navigation.

### 4.2 New component — `wa-lead-panel.tsx`

**Props:** `{ jid: string; orgSlug: string; lead: WaConversation['lead'] | null; onLinkChange: () => void }`

**State A — Lead vinculado:**
- Lead name, email, phone, status badge
- Button "↗ Ver no kanban" → `router.push(`/${orgSlug}/leads`)`
- Button "Desvincular" → calls `linkWaLead(token, jid, null)`, then `onLinkChange()`

**State B — Sem lead vinculado:**
- Search input (debounce 300ms) → `GET /leads?search=...&limit=5`
- Results list with "Vincular" button per result → calls `linkWaLead(token, jid, leadId)`, then `onLinkChange()`
- "＋ Criar lead desta conversa" button → opens `NewLeadSheet` with `phone` pre-filled from `jid.split('@')[0]`

**Lead search:** Uses existing `GET /leads?search=query&limit=5` endpoint (already implemented in `LeadsController`). The API client function `getKanban` already exists; add a simple `searchLeads(token, query)` function to `apps/web/lib/api/leads.ts`.

**WaConversation type update:** The `getConversations` endpoint currently returns `{ id, name, phone }` per lead. The panel also needs `email` and `status`. Update `WhatsAppService.getConversations` to include `select: { id: true, name: true, phone: true, email: true, status: true }`. Update `WaConversation.lead` type accordingly in `whatsapp.ts`.

### 4.3 API client addition — `whatsapp.ts`

```typescript
export async function linkWaLead(
  token: string,
  jid: string,
  leadId: string | null
): Promise<{ lead: Lead | null }>
```

Calls `PATCH /whatsapp/conversations/:jid/lead` with `{ leadId }`.

### 4.4 Lead search in leads API client — `leads.ts`

```typescript
export async function searchLeads(
  token: string,
  search: string
): Promise<{ items: Lead[]; total: number }>
```

Calls `GET /leads?search=...&limit=5` (already implemented endpoint).

### 4.5 Bonus — `lead-slide-over.tsx`

Add a "💬 Ver conversa no WhatsApp" button below the lead's contact info section, visible only when `lead.phone` is set:

```tsx
<Link href={`/${orgSlug}/whatsapp?jid=${encodeURIComponent(lead.phone + '@s.whatsapp.net')}`}>
  💬 Ver conversa no WhatsApp
</Link>
```

The `orgSlug` is obtained from `useParams()`. The WaInbox already reads `initialJid` from `searchParams`, so no additional frontend changes are needed there.

---

## 5. Files

**Backend — modified:**
- `apps/api/src/whatsapp/whatsapp.service.ts` — add `linkLead`
- `apps/api/src/whatsapp/whatsapp.controller.ts` — add `PATCH conversations/:jid/lead`

**Frontend — new:**
- `apps/web/app/[orgSlug]/whatsapp/_components/wa-lead-panel.tsx`

**Frontend — modified:**
- `apps/web/app/[orgSlug]/whatsapp/_components/wa-inbox.tsx` — 3-column layout, pass `lead` + `onLinkChange` to panel
- `apps/web/app/[orgSlug]/leads/_components/lead-slide-over.tsx` — "Ver no WhatsApp" button
- `apps/web/lib/api/whatsapp.ts` — add `linkWaLead`
- `apps/web/lib/api/leads.ts` — add `searchLeads`

---

## 6. Error Handling

- `linkLead` with a `leadId` that doesn't belong to the org → `NotFoundException` (backend) → show toast "Lead não encontrado" (frontend)
- `linkLead` when instance is not configured → `NotFoundException` (backend) → show toast "Instância WhatsApp não configurada"
- Search returns empty → show "Nenhum lead encontrado" inside the panel
- Network error during link → revert optimistic update (if any), show toast "Erro ao vincular lead"

---

## 7. Testing

- Unit test `WhatsAppService.linkLead`:
  - Links lead when found in org
  - Throws NotFoundException when lead not found in org
  - Sets leadId to null on unlink (updateMany called with `{ leadId: null }`)
- No new frontend tests (no existing frontend test suite for WA components)

---

## 8. Out of Scope

- Real-time updates (WebSockets/SSE) — polling remains unchanged
- Media messages (images, audio, documents)
- Webhook authentication/security
- New conversation initiation (outbound to new numbers)
- Message read receipts / "mark as read"
