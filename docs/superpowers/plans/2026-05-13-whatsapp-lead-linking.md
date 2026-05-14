# WhatsApp Lead Linking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent right-side lead panel to the WhatsApp inbox that shows the linked lead, supports search/link/unlink, and auto-links newly created leads to the open conversation.

**Architecture:** Backend adds `linkLead(orgId, remoteJid, leadId)` to `WhatsAppService` — it bulk-updates `WhatsAppMessage.leadId` for all messages of a `remoteJid`. A new `PATCH /whatsapp/conversations/:jid/lead` route exposes it. `getConversations` gains `email` + `status` in its lead select. Frontend extends `WaInbox` to a 3-column layout (conversations | chat | lead panel) and introduces `WaLeadPanel` — a focused component with debounced lead search, link/unlink, and a shortcut to create + auto-link a new lead from a conversation.

**Tech Stack:** NestJS 11, Prisma 7, Next.js 16 App Router, TanStack Query v5, shadcn/ui, TypeScript.

---

## File Map

**Backend — modified:**
- `apps/api/src/whatsapp/whatsapp.service.ts` — add `linkLead`, update `getConversations` select
- `apps/api/src/whatsapp/whatsapp.controller.ts` — add `PATCH conversations/:jid/lead`

**Backend — new:**
- `apps/api/test/whatsapp/whatsapp.service.spec.ts` — unit tests for `linkLead`

**Frontend — modified:**
- `apps/web/lib/api/whatsapp.ts` — add `linkWaLead`, update `WaConversation.lead` type
- `apps/web/lib/api/leads.ts` — add `searchLeads`
- `apps/web/app/[orgSlug]/leads/_components/new-lead-sheet.tsx` — add `defaultPhone` + `onCreated` props
- `apps/web/app/[orgSlug]/whatsapp/_components/wa-inbox.tsx` — 3-column layout, render `WaLeadPanel`

**Frontend — new:**
- `apps/web/app/[orgSlug]/whatsapp/_components/wa-lead-panel.tsx`

---

## Task 1: Backend — `linkLead` + `getConversations` update + route

**Files:**
- Create: `apps/api/test/whatsapp/whatsapp.service.spec.ts`
- Modify: `apps/api/src/whatsapp/whatsapp.service.ts`
- Modify: `apps/api/src/whatsapp/whatsapp.controller.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/api/test/whatsapp/whatsapp.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { WhatsAppService } from '../../src/whatsapp/whatsapp.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';

const mockPrisma = {
  whatsAppInstance: { findUnique: jest.fn() },
  whatsAppMessage: { updateMany: jest.fn() },
  lead: { findFirst: jest.fn() },
};

const mockConfig = { get: jest.fn().mockReturnValue('') };

describe('WhatsAppService.linkLead', () => {
  let service: WhatsAppService;

  const instance = {
    id: 'inst-1', instanceName: 'abc', token: 'tok',
    status: 'CONNECTED', organizationId: 'org-1', phone: null,
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        WhatsAppService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get(WhatsAppService);
    jest.clearAllMocks();
  });

  it('links a lead — updates all messages of the remoteJid', async () => {
    const lead = { id: 'lead-1', name: 'João', email: 'j@ex.com', phone: '11999', status: 'NOVO', source: 'WHATSAPP' };
    mockPrisma.whatsAppInstance.findUnique.mockResolvedValueOnce(instance);
    mockPrisma.lead.findFirst.mockResolvedValueOnce(lead);
    mockPrisma.whatsAppMessage.updateMany.mockResolvedValueOnce({ count: 3 });

    const result = await service.linkLead('org-1', '11999@s.whatsapp.net', 'lead-1');

    expect(mockPrisma.lead.findFirst).toHaveBeenCalledWith({
      where: { id: 'lead-1', organizationId: 'org-1' },
    });
    expect(mockPrisma.whatsAppMessage.updateMany).toHaveBeenCalledWith({
      where: { instanceId: 'inst-1', remoteJid: '11999@s.whatsapp.net' },
      data: { leadId: 'lead-1' },
    });
    expect(result.lead).toEqual(lead);
  });

  it('unlinks — sets leadId to null without querying lead table', async () => {
    mockPrisma.whatsAppInstance.findUnique.mockResolvedValueOnce(instance);
    mockPrisma.whatsAppMessage.updateMany.mockResolvedValueOnce({ count: 2 });

    const result = await service.linkLead('org-1', '11999@s.whatsapp.net', null);

    expect(mockPrisma.lead.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.whatsAppMessage.updateMany).toHaveBeenCalledWith({
      where: { instanceId: 'inst-1', remoteJid: '11999@s.whatsapp.net' },
      data: { leadId: null },
    });
    expect(result.lead).toBeNull();
  });

  it('throws NotFoundException when leadId does not belong to org', async () => {
    mockPrisma.whatsAppInstance.findUnique.mockResolvedValueOnce(instance);
    mockPrisma.lead.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.linkLead('org-1', '11999@s.whatsapp.net', 'bad-lead'),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when WhatsApp instance is not configured', async () => {
    mockPrisma.whatsAppInstance.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.linkLead('org-1', '11999@s.whatsapp.net', 'lead-1'),
    ).rejects.toThrow(NotFoundException);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/api
pnpm test -- --testPathPatterns=whatsapp
```

Expected: FAIL — `service.linkLead is not a function`.

- [ ] **Step 3: Add `linkLead` to `WhatsAppService` + update `getConversations` select**

In `apps/api/src/whatsapp/whatsapp.service.ts`, add the `linkLead` method at the end of the class (before `fetchRemoteStatus`):

```typescript
async linkLead(
  organizationId: string,
  remoteJid: string,
  leadId: string | null,
): Promise<{ lead: { id: string; name: string; email: string | null; phone: string | null; status: string; source: string } | null }> {
  const instance = await this.getOrFail(organizationId);

  let lead = null;
  if (leadId !== null) {
    lead = await this.prisma.lead.findFirst({ where: { id: leadId, organizationId } });
    if (!lead) throw new NotFoundException('Lead not found');
  }

  await this.prisma.whatsAppMessage.updateMany({
    where: { instanceId: instance.id, remoteJid },
    data: { leadId },
  });

  return { lead };
}
```

Also update the `include` inside `getConversations` to expose `email` and `status`:

```typescript
// Find this line in getConversations:
include: { lead: { select: { id: true, name: true, phone: true } } },

// Replace with:
include: { lead: { select: { id: true, name: true, phone: true, email: true, status: true } } },
```

- [ ] **Step 4: Add the route to `WhatsAppController`**

In `apps/api/src/whatsapp/whatsapp.controller.ts`, add `Patch` to the import and this route after `sendMessage`:

```typescript
// Add Patch to the existing import:
import {
  Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, HttpCode, Logger,
} from '@nestjs/common';

// Add this route:
@Patch('conversations/:jid/lead')
@UseGuards(ClerkAuthGuard)
linkLead(
  @CurrentOrg() orgId: string,
  @Param('jid') jid: string,
  @Body('leadId') leadId: string | null,
) {
  return this.wa.linkLead(orgId, decodeURIComponent(jid), leadId ?? null);
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd apps/api
pnpm test -- --testPathPatterns=whatsapp
```

Expected: PASS — 4 tests passing.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/whatsapp/whatsapp.service.ts apps/api/src/whatsapp/whatsapp.controller.ts apps/api/test/whatsapp/whatsapp.service.spec.ts
git commit -m "feat(whatsapp): add linkLead method + PATCH conversations/:jid/lead route"
```

---

## Task 2: Frontend API clients

**Files:**
- Modify: `apps/web/lib/api/whatsapp.ts`
- Modify: `apps/web/lib/api/leads.ts`

- [ ] **Step 1: Update `WaConversation.lead` type and add `linkWaLead` in `whatsapp.ts`**

In `apps/web/lib/api/whatsapp.ts`, replace the `WaConversation` interface:

```typescript
// Replace:
export interface WaConversation {
  remoteJid: string;
  lead: { id: string; name: string; phone: string | null } | null;
  lastMessage: string;
  lastTimestamp: string;
  unread: number;
}

// With:
export interface WaConversation {
  remoteJid: string;
  lead: { id: string; name: string; phone: string | null; email: string | null; status: string } | null;
  lastMessage: string;
  lastTimestamp: string;
  unread: number;
}
```

Then add `linkWaLead` at the end of the file:

```typescript
export async function linkWaLead(
  token: string,
  jid: string,
  leadId: string | null,
): Promise<{ lead: { id: string; name: string; phone: string | null; email: string | null; status: string; source: string } | null }> {
  return apiFetch(`/whatsapp/conversations/${encodeURIComponent(jid)}/lead`, token, {
    method: 'PATCH',
    body: JSON.stringify({ leadId }),
  });
}
```

- [ ] **Step 2: Add `searchLeads` to `leads.ts`**

In `apps/web/lib/api/leads.ts`, add at the end:

```typescript
export async function searchLeads(
  token: string,
  search: string,
  limit = 5,
): Promise<{ items: Lead[]; total: number }> {
  const params = new URLSearchParams({ search, limit: String(limit) });
  return apiFetch(`/leads?${params}`, token);
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/api/whatsapp.ts apps/web/lib/api/leads.ts
git commit -m "feat(whatsapp): add linkWaLead API client and searchLeads"
```

---

## Task 3: `NewLeadSheet` — add `defaultPhone` and `onCreated` props

**Files:**
- Modify: `apps/web/app/[orgSlug]/leads/_components/new-lead-sheet.tsx`

- [ ] **Step 1: Update props interface and state**

In `apps/web/app/[orgSlug]/leads/_components/new-lead-sheet.tsx`, update the `Props` interface and component signature:

```typescript
// Replace:
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

// With:
interface Props {
  open: boolean;
  onClose: () => void;
  defaultPhone?: string;
  onCreated?: (lead: Lead) => void;
}

export function NewLeadSheet({ open, onClose, defaultPhone, onCreated }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) setPhone(defaultPhone ?? '');
  }, [open, defaultPhone]);
```

Also add `useEffect` to the existing React import:

```typescript
// Replace:
import { useState } from 'react';
// With:
import { useState, useEffect } from 'react';
```

Also add `Lead` to the import from `@/lib/api/leads`:

```typescript
// Replace:
import { createLead } from '@/lib/api/leads';
// With:
import { createLead, Lead } from '@/lib/api/leads';
```

- [ ] **Step 2: Call `onCreated` in mutation `onSuccess`**

Find the `mutation` definition and update `onSuccess`:

```typescript
// Replace:
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads', 'kanban', organization?.id] });
      setName(''); setEmail(''); setPhone(''); setCompany(''); setError('');
      onClose();
    },

// With:
    onSuccess: (lead) => {
      queryClient.invalidateQueries({ queryKey: ['leads', 'kanban', organization?.id] });
      onCreated?.(lead);
      setName(''); setEmail(''); setPhone(defaultPhone ?? ''); setCompany(''); setError('');
      onClose();
    },
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/[orgSlug]/leads/_components/new-lead-sheet.tsx
git commit -m "feat(leads): add defaultPhone and onCreated props to NewLeadSheet"
```

---

## Task 4: `WaLeadPanel` component

**Files:**
- Create: `apps/web/app/[orgSlug]/whatsapp/_components/wa-lead-panel.tsx`

- [ ] **Step 1: Create `wa-lead-panel.tsx`**

Create `apps/web/app/[orgSlug]/whatsapp/_components/wa-lead-panel.tsx`:

```typescript
'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth, useOrganization } from '@clerk/nextjs';
import { useParams, useRouter } from 'next/navigation';
import { linkWaLead, WaConversation } from '@/lib/api/whatsapp';
import { searchLeads, Lead } from '@/lib/api/leads';
import { NewLeadSheet } from '@/app/[orgSlug]/leads/_components/new-lead-sheet';

type LinkedLead = NonNullable<WaConversation['lead']>;

interface Props {
  jid: string;
  lead: LinkedLead | null;
  onLinkChange: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  NOVO: 'Novo', CONTATADO: 'Contatado', QUALIFICADO: 'Qualificado',
  CONVERTIDO: 'Convertido', DESCARTADO: 'Descartado',
};

const STATUS_COLORS: Record<string, string> = {
  NOVO: 'bg-blue-50 text-blue-700',
  CONTATADO: 'bg-amber-50 text-amber-700',
  QUALIFICADO: 'bg-violet-50 text-violet-700',
  CONVERTIDO: 'bg-green-50 text-green-700',
  DESCARTADO: 'bg-slate-100 text-slate-500',
};

export function WaLeadPanel({ jid, lead, onLinkChange }: Props) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const { getToken } = useAuth();
  const { organization } = useOrganization();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { orgSlug } = useParams<{ orgSlug: string }>();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: searchResults } = useQuery({
    queryKey: ['leads', 'search', debouncedSearch],
    queryFn: async () => {
      const token = await getToken();
      return searchLeads(token!, debouncedSearch);
    },
    enabled: debouncedSearch.length > 1 && !lead,
  });

  const linkMutation = useMutation({
    mutationFn: async (leadId: string | null) => {
      const token = await getToken();
      return linkWaLead(token!, jid, leadId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wa', 'conversations', organization?.id] });
      setSearch('');
      onLinkChange();
    },
  });

  const phone = jid.split('@')[0];

  return (
    <div className="w-64 border-l border-slate-200 bg-white flex flex-col shrink-0">
      <div className="px-4 py-3 border-b border-slate-100">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Lead</p>
      </div>

      {lead ? (
        <div className="p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">{lead.name}</p>
            <span className={`inline-block mt-1 text-[11px] px-2 py-0.5 rounded font-medium ${STATUS_COLORS[lead.status] ?? 'bg-slate-100 text-slate-500'}`}>
              {STATUS_LABELS[lead.status] ?? lead.status}
            </span>
          </div>
          {lead.email && (
            <p className="text-xs text-slate-500 truncate">{lead.email}</p>
          )}
          {lead.phone && (
            <p className="text-xs text-slate-500">{lead.phone}</p>
          )}
          <div className="pt-2 space-y-2">
            <button
              onClick={() => router.push(`/${orgSlug}/leads`)}
              className="w-full text-left text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
            >
              <span>↗</span> Ver no kanban
            </button>
            <button
              onClick={() => linkMutation.mutate(null)}
              disabled={linkMutation.isPending}
              className="w-full text-left text-xs px-3 py-2 rounded-lg border border-red-100 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              Desvincular lead
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4 space-y-3 flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar lead..."
            className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />

          {searchResults && searchResults.items.length > 0 && (
            <div className="space-y-1">
              {searchResults.items.map((l: Lead) => (
                <div key={l.id} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-900 truncate">{l.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">{l.phone ?? l.email ?? ''}</p>
                  </div>
                  <button
                    onClick={() => linkMutation.mutate(l.id)}
                    disabled={linkMutation.isPending}
                    className="ml-2 text-[11px] px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 shrink-0 disabled:opacity-50"
                  >
                    Vincular
                  </button>
                </div>
              ))}
            </div>
          )}

          {debouncedSearch.length > 1 && searchResults?.items.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-2">Nenhum lead encontrado</p>
          )}

          <button
            onClick={() => setNewLeadOpen(true)}
            className="w-full text-xs px-3 py-2 rounded-lg border border-dashed border-blue-300 text-blue-600 hover:bg-blue-50 transition-colors"
          >
            + Criar lead desta conversa
          </button>
        </div>
      )}

      <NewLeadSheet
        open={newLeadOpen}
        onClose={() => setNewLeadOpen(false)}
        defaultPhone={phone}
        onCreated={(newLead) => linkMutation.mutate(newLead.id)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/[orgSlug]/whatsapp/_components/wa-lead-panel.tsx
git commit -m "feat(whatsapp): add WaLeadPanel component with search, link, unlink, and create-lead"
```

---

## Task 5: `WaInbox` — 3-column layout

**Files:**
- Modify: `apps/web/app/[orgSlug]/whatsapp/_components/wa-inbox.tsx`

- [ ] **Step 1: Add `WaLeadPanel` import and update the layout**

In `apps/web/app/[orgSlug]/whatsapp/_components/wa-inbox.tsx`, add the import at the top:

```typescript
// Add after the existing imports:
import { WaLeadPanel } from './wa-lead-panel';
```

Find the outer `<div className="flex h-full">` and add `WaLeadPanel` as the third column. Replace the entire return of `WaInbox` with:

```tsx
  return (
    <div className="flex h-full">
      {/* Sidebar — conversations list */}
      <aside className="w-72 border-r border-slate-200 bg-white flex flex-col shrink-0">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm font-semibold text-slate-900">
              {instance.phone ? `+${instance.phone}` : 'WhatsApp'}
            </span>
          </div>
          <button
            onClick={() => disconnectMutation.mutate()}
            className="text-xs text-slate-400 hover:text-red-500 transition-colors"
            title="Desconectar"
          >
            Desconectar
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-4 text-xs text-slate-400 text-center mt-8">
              Nenhuma conversa ainda.<br />As mensagens recebidas aparecerão aqui.
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.remoteJid}
                onClick={() => setSelectedJid(conv.remoteJid)}
                className={`w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors ${
                  selectedJid === conv.remoteJid ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {conv.lead?.name ?? conv.remoteJid.split('@')[0]}
                  </p>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    {formatDistanceToNow(new Date(conv.lastTimestamp), { addSuffix: false, locale: ptBR })}
                  </span>
                </div>
                <p className="text-xs text-slate-500 truncate">{conv.lastMessage}</p>
                {conv.unread > 0 && (
                  <span className="inline-block mt-1 bg-green-500 text-white text-[10px] rounded-full px-1.5 py-0.5 font-bold">
                    {conv.unread}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Main chat area */}
      <main className="flex-1 flex flex-col bg-slate-50 min-w-0">
        {!selectedJid ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">
            Selecione uma conversa
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="px-5 py-3 bg-white border-b border-slate-200 shrink-0">
              <p className="text-sm font-semibold text-slate-900">{displayName(selectedJid)}</p>
              {selectedConv?.lead && (
                <p className="text-xs text-slate-400">{selectedJid.split('@')[0]}</p>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] px-3 py-2 rounded-2xl text-sm ${
                      msg.fromMe
                        ? 'bg-green-500 text-white rounded-br-sm'
                        : 'bg-white border border-slate-200 text-slate-900 rounded-bl-sm'
                    }`}
                  >
                    <p>{msg.body}</p>
                    <p className={`text-[10px] mt-1 ${msg.fromMe ? 'text-green-100' : 'text-slate-400'}`}>
                      {formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Message input */}
            <form onSubmit={handleSend} className="px-4 py-3 bg-white border-t border-slate-200 flex gap-2 shrink-0">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Digite uma mensagem..."
                className="flex-1 text-sm px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
              />
              <Button
                type="submit"
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white shrink-0"
                disabled={!text.trim() || sendMutation.isPending}
              >
                Enviar
              </Button>
            </form>
          </>
        )}
      </main>

      {/* Lead panel — only visible when a conversation is selected */}
      {selectedJid && (
        <WaLeadPanel
          jid={selectedJid}
          lead={selectedConv?.lead ?? null}
          onLinkChange={() =>
            queryClient.invalidateQueries({ queryKey: ['wa', 'conversations', organization?.id] })
          }
        />
      )}
    </div>
  );
```

- [ ] **Step 2: Verify the build**

```bash
cd apps/web
pnpm build
```

Expected: Build completes without TypeScript errors. Check that the `/[orgSlug]/whatsapp` route is present in the output.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/[orgSlug]/whatsapp/_components/wa-inbox.tsx
git commit -m "feat(whatsapp): 3-column layout with WaLeadPanel in WaInbox"
```

---

## Task 6: Run full test suite + final verification

- [ ] **Step 1: Run all API tests**

```bash
cd apps/api
pnpm test
```

Expected: 4 new whatsapp tests pass. Pre-existing failures in `auth/clerk-auth.guard.spec.ts` and `users/users.service.spec.ts` are unrelated — they may remain.

- [ ] **Step 2: Build API**

```bash
cd apps/api
pnpm build
```

Expected: Exit 0, no TypeScript errors.

- [ ] **Step 3: Build web**

```bash
cd apps/web
pnpm build
```

Expected: Exit 0, `/[orgSlug]/whatsapp` route listed.

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "feat(whatsapp): complete lead linking — panel, search, link/unlink, auto-link on create"
```

---

## Self-Review

**Spec coverage:**
- § 3 (Backend linkLead) → Task 1 steps 3-4 ✓
- § 3 (NotFoundException for bad leadId/no instance) → Task 1 test + implementation ✓
- § 4.1 (3-column layout) → Task 5 ✓
- § 4.2 (WaLeadPanel — linked state) → Task 4 (lead name, status, email, "Ver no kanban", "Desvincular") ✓
- § 4.2 (WaLeadPanel — unlinked state) → Task 4 (search input, results list, "Criar lead") ✓
- § 4.2 (WaConversation.lead type update) → Task 2 step 1 — WaConversation updated with `email` + `status` ✓
- § 4.3 (linkWaLead API client) → Task 2 step 1 ✓
- § 4.4 (searchLeads API client) → Task 2 step 2 ✓
- § 4.5 (lead-slide-over "Ver no WhatsApp") → Already implemented in existing code — no task needed ✓
- § 6 (Error handling) → NotFoundException in service propagates as 404; frontend shows disabled state via `disabled={linkMutation.isPending}`; empty search shows "Nenhum lead encontrado" ✓
- § 7 (Tests) → Task 1, 4 unit tests for linkLead ✓

**Type consistency check:**
- `WaConversation.lead` defined in Task 2 as `{ id, name, phone, email, status }` — used in `WaLeadPanel` via `NonNullable<WaConversation['lead']>` ✓
- `linkWaLead` returns `{ lead: { id, name, phone, email, status, source } | null }` — consistent with `linkLead` service return ✓
- `NewLeadSheet` gains `onCreated?: (lead: Lead) => void` — `WaLeadPanel` calls `linkMutation.mutate(newLead.id)` using `newLead.id` from the `Lead` type ✓
- `searchLeads` returns `{ items: Lead[]; total: number }` — `WaLeadPanel` accesses `searchResults.items` and iterates as `Lead` ✓
