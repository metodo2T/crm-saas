# Dark Premium Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign visual completo do CRM para tema Dark Premium com sidebar lateral, fonte Inter e acento violeta/índigo.

**Architecture:** Full Sweep — todos os arquivos em um único PR. Sem mudanças de lógica, apenas substituição de classes Tailwind e estrutura de layout. A top bar (`app-nav.tsx`) é substituída por sidebar lateral (`app-sidebar.tsx`). O layout shell muda de `min-h-screen` para `flex h-screen`.

**Tech Stack:** Next.js 16, Tailwind CSS 4, shadcn/ui, lucide-react (já instalado v1.14), next/font/google (Inter)

---

## Paleta de referência

| Nome | Valor | Uso |
|---|---|---|
| background | `#0f172a` | Fundo da página |
| surface | `#1e293b` | Cards, sidebar |
| border | `#334155` | Bordas |
| foreground | `#f1f5f9` | Texto principal |
| muted | `#94a3b8` | Texto secundário |
| primary | `#6366f1` | Botões, item ativo |
| accent | `#8b5cf6` | Destaques secundários |

---

## Task 1: Design tokens + Inter font

**Files:**
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/app/layout.tsx`

- [ ] **Step 1: Atualizar globals.css com paleta dark**

```css
/* apps/web/app/globals.css */
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

:root {
  --background: oklch(0.13 0.03 264);
  --foreground: oklch(0.94 0.01 264);
  --card: oklch(0.19 0.03 264);
  --card-foreground: oklch(0.94 0.01 264);
  --popover: oklch(0.19 0.03 264);
  --popover-foreground: oklch(0.94 0.01 264);
  --primary: oklch(0.59 0.2 264);
  --primary-foreground: oklch(1 0 0);
  --secondary: oklch(0.25 0.03 264);
  --secondary-foreground: oklch(0.94 0.01 264);
  --muted: oklch(0.25 0.03 264);
  --muted-foreground: oklch(0.63 0.04 264);
  --accent: oklch(0.25 0.03 264);
  --accent-foreground: oklch(0.94 0.01 264);
  --destructive: oklch(0.577 0.245 27.325);
  --destructive-foreground: oklch(0.985 0 0);
  --border: oklch(0.28 0.03 264);
  --input: oklch(0.28 0.03 264);
  --ring: oklch(0.59 0.2 264);
  --radius: 0.625rem;
  --chart-1: oklch(0.59 0.2 264);
  --chart-2: oklch(0.65 0.18 300);
  --chart-3: oklch(0.7 0.15 200);
  --chart-4: oklch(0.75 0.18 150);
  --chart-5: oklch(0.7 0.2 30);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}

body {
  background: var(--background);
  color: var(--foreground);
}
```

- [ ] **Step 2: Atualizar layout.tsx para usar Inter**

```tsx
// apps/web/app/layout.tsx
import { ClerkProvider } from '@clerk/nextjs';
import { QueryProvider } from '@/lib/query-client';
import { Inter } from 'next/font/google';
import type { Metadata } from 'next';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'CRM — Tráfego Pago',
  description: 'CRM para agências de tráfego pago',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="pt-BR">
        <body className={inter.className}>
          <QueryProvider>{children}</QueryProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
```

- [ ] **Step 3: Verificar**

```bash
cd C:/Users/OS/crm-saas/apps/web && pnpm dev
```

Abrir http://localhost:3000 — fundo deve estar dark, fonte Inter aplicada.

- [ ] **Step 4: Commit**

```bash
cd C:/Users/OS/crm-saas
git add apps/web/app/globals.css apps/web/app/layout.tsx
git commit -m "feat: apply dark premium design tokens and Inter font"
```

---

## Task 2: AppSidebar + Layout Shell

**Files:**
- Create: `apps/web/app/[orgSlug]/_components/app-sidebar.tsx`
- Modify: `apps/web/app/[orgSlug]/layout.tsx`
- Delete logic from: `apps/web/app/[orgSlug]/_components/app-nav.tsx` (substituído)

- [ ] **Step 1: Criar app-sidebar.tsx**

```tsx
// apps/web/app/[orgSlug]/_components/app-sidebar.tsx
'use client';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { OrganizationSwitcher, UserButton } from '@clerk/nextjs';
import {
  LayoutDashboard, Users, Kanban, MessageCircle, Settings,
} from 'lucide-react';

const NAV = [
  { label: 'Dashboard',     seg: 'dashboard', Icon: LayoutDashboard },
  { label: 'Leads',         seg: 'leads',     Icon: Users },
  { label: 'Pipeline',      seg: 'pipeline',  Icon: Kanban },
  { label: 'WhatsApp',      seg: 'whatsapp',  Icon: MessageCircle },
  { label: 'Configurações', seg: 'settings',  Icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const base = `/${orgSlug}`;

  return (
    <aside className="w-56 shrink-0 h-screen sticky top-0 flex flex-col bg-[#1e293b] border-r border-[#334155]">
      {/* Logo */}
      <div className="px-4 py-5 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-bold leading-none">C</span>
        </div>
        <span className="text-slate-100 text-sm font-bold tracking-tight">CRM</span>
      </div>

      {/* Org switcher */}
      <div className="px-3 mb-4">
        <OrganizationSwitcher
          hidePersonal
          appearance={{
            elements: {
              organizationSwitcherTrigger:
                'w-full justify-start py-1.5 px-2 text-xs text-slate-300 hover:bg-[#334155] rounded-md transition-colors',
            },
          }}
        />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 space-y-0.5">
        {NAV.map(({ label, seg, Icon }) => {
          const href = seg === 'settings' ? `${base}/settings/workspace` : `${base}/${seg}`;
          const active = pathname.startsWith(`${base}/${seg}`);
          return (
            <Link
              key={seg}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-indigo-500/15 text-indigo-300 border-l-2 border-indigo-500'
                  : 'text-slate-400 hover:bg-[#334155]/60 hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-[#334155]">
        <UserButton
          appearance={{
            elements: {
              userButtonBox: 'flex items-center gap-2',
              userButtonOuterIdentifier: 'text-xs text-slate-400',
            },
          }}
          showName
        />
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Atualizar layout.tsx do orgSlug**

```tsx
// apps/web/app/[orgSlug]/layout.tsx
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { AppSidebar } from './_components/app-sidebar';

export default async function OrgLayout({ children, params }: { children: React.ReactNode; params: Promise<{ orgSlug: string }> }) {
  const { orgId, orgSlug: authOrgSlug } = await auth();
  if (!orgId) redirect('/onboarding/workspace');

  const { orgSlug } = await params;
  if (authOrgSlug && authOrgSlug !== orgSlug) redirect(`/${authOrgSlug}/dashboard`);

  return (
    <div className="flex h-screen bg-[#0f172a]">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Verificar**

Abrir http://localhost:3000/[orgSlug]/dashboard — sidebar dark visível à esquerda, conteúdo à direita.

- [ ] **Step 4: Commit**

```bash
cd C:/Users/OS/crm-saas
git add apps/web/app/[orgSlug]/_components/app-sidebar.tsx apps/web/app/[orgSlug]/layout.tsx
git commit -m "feat: replace top nav with dark sidebar"
```

---

## Task 3: Dashboard

**Files:**
- Modify: `apps/web/app/[orgSlug]/dashboard/page.tsx`

- [ ] **Step 1: Atualizar dashboard/page.tsx**

```tsx
// apps/web/app/[orgSlug]/dashboard/page.tsx
'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth, useOrganization } from '@clerk/nextjs';
import { getKanban, getAnalytics, KanbanData, Lead, LeadStatus, AnalyticsTrend } from '@/lib/api/leads';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_CFG: Record<LeadStatus, { label: string; color: string; bg: string }> = {
  NOVO:        { label: 'Novos',        color: 'text-blue-400',   bg: 'bg-blue-950'   },
  CONTATADO:   { label: 'Contatados',   color: 'text-amber-400',  bg: 'bg-amber-950'  },
  QUALIFICADO: { label: 'Qualificados', color: 'text-violet-400', bg: 'bg-violet-950' },
  CONVERTIDO:  { label: 'Convertidos',  color: 'text-emerald-400', bg: 'bg-emerald-950' },
  DESCARTADO:  { label: 'Descartados',  color: 'text-slate-500',  bg: 'bg-slate-800'  },
};

function TrendChart({ trend }: { trend: Array<{ date: string; total: number }> }) {
  const last7 = trend.slice(-7);
  const max = Math.max(...last7.map((d) => d.total), 1);
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div>
      <div className="flex items-end gap-1.5 h-20 mb-2">
        {last7.map((d) => {
          const pct = Math.round((d.total / max) * 100);
          const dayName = days[new Date(d.date + 'T12:00:00').getDay()];
          return (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group">
              <div className="relative w-full flex items-end justify-center" style={{ height: 64 }}>
                <div
                  className="w-full rounded-t-sm bg-indigo-500 group-hover:bg-indigo-400 transition-colors"
                  style={{ height: `${Math.max(pct, 4)}%` }}
                  title={`${d.total} lead${d.total !== 1 ? 's' : ''}`}
                />
                {d.total > 0 && (
                  <span className="absolute -top-4 text-[9px] text-slate-500 font-medium">{d.total}</span>
                )}
              </div>
              <span className="text-[9px] text-slate-600">{dayName}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { getToken } = useAuth();
  const { organization } = useOrganization();

  const { data: kanban, isLoading: kanbanLoading } = useQuery<KanbanData>({
    queryKey: ['leads', 'kanban', organization?.id],
    queryFn: async () => getKanban(await getToken() as string),
    enabled: !!organization?.id,
  });

  const { data: analytics } = useQuery<AnalyticsTrend>({
    queryKey: ['leads', 'analytics', organization?.id],
    queryFn: async () => getAnalytics(await getToken() as string),
    enabled: !!organization?.id,
  });

  const allLeads: Lead[] = kanban ? (Object.values(kanban).flat() as Lead[]) : [];
  const total = allLeads.length;
  const converted = kanban?.CONVERTIDO.length ?? 0;
  const discarded = kanban?.DESCARTADO.length ?? 0;
  const active = total - discarded;
  const conversionRate = active > 0 ? Math.round((converted / active) * 100) : 0;

  const recentLeads = [...allLeads]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);

  const sourceLabels: Record<string, string> = { MANUAL: 'Manual', FORM: 'Formulário', CSV: 'CSV', WHATSAPP: 'WhatsApp' };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-100">Dashboard</h1>
        <p className="text-sm text-slate-500">{organization?.name}</p>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {(['NOVO', 'CONTATADO', 'QUALIFICADO', 'CONVERTIDO'] as LeadStatus[]).map((s) => {
          const cfg = STATUS_CFG[s];
          const count = kanban?.[s].length ?? 0;
          return (
            <div key={s} className="bg-[#1e293b] rounded-xl border border-[#334155] p-4">
              <p className={`text-xs font-semibold uppercase tracking-wide ${cfg.color}`}>{cfg.label}</p>
              <p className="text-3xl font-bold text-slate-100 mt-1">{kanbanLoading ? '—' : count}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-[#1e293b] rounded-xl border border-[#334155] p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Taxa de conversão</p>
          <p className="text-4xl font-bold text-slate-100 mt-1">{kanbanLoading ? '—' : `${conversionRate}%`}</p>
          <p className="text-xs text-slate-500 mt-1">{converted} convertidos de {active} ativos</p>
        </div>

        <div className="bg-[#1e293b] rounded-xl border border-[#334155] p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total de leads</p>
          <p className="text-4xl font-bold text-slate-100 mt-1">{kanbanLoading ? '—' : total}</p>
          <Link href={`/${orgSlug}/leads`} className="text-xs text-indigo-400 hover:text-indigo-300 mt-1 inline-block">
            Abrir kanban →
          </Link>
        </div>

        <div className="bg-[#1e293b] rounded-xl border border-[#334155] p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Por origem</p>
          {analytics?.bySource ? (
            <div className="space-y-1.5">
              {Object.entries(analytics.bySource).map(([src, count]) => (
                <div key={src} className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">{sourceLabels[src] ?? src}</span>
                  <span className="font-semibold text-slate-200">{count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-600 text-sm">—</p>
          )}
        </div>
      </div>

      <div className="bg-[#1e293b] rounded-xl border border-[#334155] p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-200">Leads nos últimos 7 dias</h2>
        </div>
        {analytics?.trend ? (
          <TrendChart trend={analytics.trend} />
        ) : (
          <div className="h-20 flex items-center justify-center text-slate-600 text-sm">Carregando...</div>
        )}
      </div>

      <div className="bg-[#1e293b] rounded-xl border border-[#334155]">
        <div className="px-5 py-4 border-b border-[#334155] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-200">Atividade recente</h2>
          <Link href={`/${orgSlug}/leads`} className="text-xs text-indigo-400 hover:text-indigo-300">
            Ver todos os leads →
          </Link>
        </div>
        {kanbanLoading ? (
          <div className="p-5 text-sm text-slate-600">Carregando...</div>
        ) : recentLeads.length === 0 ? (
          <div className="p-5 flex items-center gap-3">
            <span className="text-sm text-slate-500">Nenhum lead ainda.</span>
            <Link href={`/${orgSlug}/leads`} className="text-sm text-indigo-400 hover:text-indigo-300 font-medium">
              Adicionar primeiro lead →
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-[#334155]">
            {recentLeads.map((lead) => {
              const cfg = STATUS_CFG[lead.status];
              return (
                <li key={lead.id} className="px-5 py-3 flex items-center justify-between gap-4 hover:bg-[#334155]/30 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">{lead.name}</p>
                    <p className="text-xs text-slate-500 truncate">{lead.company || lead.email || '—'}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                      {cfg.label}
                    </span>
                    <span className="text-xs text-slate-600 hidden sm:block">
                      {formatDistanceToNow(new Date(lead.createdAt), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar**

Abrir http://localhost:3000/[orgSlug]/dashboard — cards dark, gráfico de barras violeta.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/OS/crm-saas
git add apps/web/app/[orgSlug]/dashboard/page.tsx
git commit -m "feat: apply dark theme to dashboard"
```

---

## Task 4: Leads

**Files:**
- Modify: `apps/web/app/[orgSlug]/leads/page.tsx`
- Modify: `apps/web/app/[orgSlug]/leads/_components/lead-card.tsx`
- Modify: `apps/web/app/[orgSlug]/leads/_components/leads-kanban.tsx`
- Modify: `apps/web/app/[orgSlug]/leads/_components/lead-slide-over.tsx`
- Modify: `apps/web/app/[orgSlug]/leads/_components/new-lead-sheet.tsx`
- Modify: `apps/web/app/[orgSlug]/leads/_components/import-csv-dialog.tsx`

- [ ] **Step 1: Atualizar leads/page.tsx**

```tsx
// apps/web/app/[orgSlug]/leads/page.tsx
'use client';
import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { LeadsKanban } from './_components/leads-kanban';
import { NewLeadSheet } from './_components/new-lead-sheet';
import { ImportCsvDialog } from './_components/import-csv-dialog';
import { exportLeadsCsv } from '@/lib/api/leads';

export default function LeadsPage() {
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { getToken } = useAuth();

  async function handleExport() {
    setExporting(true);
    try {
      const token = await getToken();
      await exportLeadsCsv(token!);
    } catch {
      alert('Erro ao exportar. Tente novamente.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-3 border-b border-[#334155] bg-[#1e293b] shrink-0">
        <h1 className="text-base font-semibold text-slate-100">Leads</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className={`text-xs border-[#334155] bg-transparent text-slate-300 hover:bg-[#334155] hover:text-slate-100 ${
              selectionMode ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300' : ''
            }`}
            onClick={() => setSelectionMode((v) => !v)}
          >
            {selectionMode ? '✓ Selecionando' : 'Selecionar'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs border-[#334155] bg-transparent text-slate-300 hover:bg-[#334155] hover:text-slate-100"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? 'Exportando...' : '↓ Exportar CSV'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs border-[#334155] bg-transparent text-slate-300 hover:bg-[#334155] hover:text-slate-100"
            onClick={() => setImportOpen(true)}
          >
            ↑ Importar CSV
          </Button>
          <Button
            size="sm"
            className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
            onClick={() => setNewLeadOpen(true)}
          >
            + Novo Lead
          </Button>
        </div>
      </div>

      <main className="flex-1 overflow-auto p-4 bg-[#0f172a]">
        <LeadsKanban selectionMode={selectionMode} />
      </main>

      <NewLeadSheet open={newLeadOpen} onClose={() => setNewLeadOpen(false)} />
      <ImportCsvDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
```

- [ ] **Step 2: Atualizar lead-card.tsx**

```tsx
// apps/web/app/[orgSlug]/leads/_components/lead-card.tsx
'use client';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Lead } from '@/lib/api/leads';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  lead: Lead;
  onClick: (lead: Lead) => void;
  selected?: boolean;
  onSelect?: (id: string, selected: boolean) => void;
}

const SOURCE_COLORS: Record<string, string> = {
  MANUAL: 'bg-slate-800 text-slate-400',
  CSV:    'bg-slate-800 text-slate-400',
  FORM:   'bg-indigo-950 text-indigo-400',
  WHATSAPP: 'bg-emerald-950 text-emerald-400',
};

export function LeadCard({ lead, onClick, selected = false, onSelect }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
    disabled: !!onSelect,
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
      {...(onSelect ? {} : { ...attributes, ...listeners })}
      onClick={() => onSelect ? onSelect(lead.id, !selected) : onClick(lead)}
      className={`relative bg-[#1e293b] border rounded-lg p-3 cursor-pointer transition-all ${
        selected
          ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-sm'
          : 'border-[#334155] hover:border-indigo-500/50 hover:shadow-sm'
      }`}
    >
      {onSelect && (
        <div className="absolute top-2.5 right-2.5">
          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
            selected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-600 bg-[#0f172a]'
          }`}>
            {selected && (
              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8">
                <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </div>
        </div>
      )}
      <p className={`text-sm font-semibold text-slate-200 mb-1 ${onSelect ? 'pr-6' : ''}`}>{lead.name}</p>
      <div className="flex items-center gap-1.5 mb-2">
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${SOURCE_COLORS[lead.source] ?? 'bg-slate-800 text-slate-400'}`}>
          {lead.source}
        </span>
        <span className="text-[10px] text-slate-600">{relativeTime}</span>
      </div>
      {lead.assignedTo ? (
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-indigo-600 flex items-center justify-center text-[8px] text-white font-bold">
            {lead.assignedTo.name[0].toUpperCase()}
          </div>
          <span className="text-[10px] text-slate-500">{lead.assignedTo.name}</span>
        </div>
      ) : (
        <span className="text-[10px] text-slate-600">sem responsável</span>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Atualizar leads-kanban.tsx**

```tsx
// apps/web/app/[orgSlug]/leads/_components/leads-kanban.tsx
'use client';
import { useState } from 'react';
import {
  DndContext, DragEndEvent, DragOverlay,
  PointerSensor, useSensor, useSensors, closestCenter,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth, useOrganization } from '@clerk/nextjs';
import { getKanban, updateLeadStatus, bulkAction, Lead, LeadStatus, KanbanData } from '@/lib/api/leads';
import { LeadCard } from './lead-card';
import { LeadSlideOver } from './lead-slide-over';

const COLUMNS: { key: LeadStatus; label: string; color: string; dot: string }[] = [
  { key: 'NOVO',        label: 'Novo',        color: 'text-blue-400',    dot: 'bg-blue-500'    },
  { key: 'CONTATADO',   label: 'Contatado',   color: 'text-amber-400',   dot: 'bg-amber-500'   },
  { key: 'QUALIFICADO', label: 'Qualificado', color: 'text-violet-400',  dot: 'bg-violet-500'  },
  { key: 'CONVERTIDO',  label: 'Convertido',  color: 'text-emerald-400', dot: 'bg-emerald-500' },
  { key: 'DESCARTADO',  label: 'Descartado',  color: 'text-slate-500',   dot: 'bg-slate-600'   },
];

const STATUS_LABELS: Record<LeadStatus, string> = {
  NOVO: 'Novo', CONTATADO: 'Contatado', QUALIFICADO: 'Qualificado',
  CONVERTIDO: 'Convertido', DESCARTADO: 'Descartado',
};

interface Props {
  selectionMode: boolean;
}

export function LeadsKanban({ selectionMode }: Props) {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
        const updated: KanbanData = {
          NOVO: [...prev.NOVO], CONTATADO: [...prev.CONTATADO],
          QUALIFICADO: [...prev.QUALIFICADO], CONVERTIDO: [...prev.CONVERTIDO], DESCARTADO: [...prev.DESCARTADO],
        };
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

  const bulkMutation = useMutation({
    mutationFn: async ({ action, status }: { action: 'status' | 'delete'; status?: LeadStatus }) => {
      const token = await getToken();
      return bulkAction(token!, Array.from(selectedIds), action, status);
    },
    onSuccess: () => {
      setSelectedIds(new Set());
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

  function toggleSelect(id: string, selected: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      selected ? next.add(id) : next.delete(id);
      return next;
    });
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-slate-600 text-sm">Carregando leads...</div>;
  }

  const allLeads = data ? Object.values(data).flat() : [];
  const activeLead = activeDragId ? allLeads.find((l) => l.id === activeDragId) ?? null : null;

  return (
    <>
      {selectedIds.size > 0 && (
        <div className="mx-4 mb-3 bg-indigo-600 text-white rounded-xl px-4 py-2.5 flex items-center gap-3 text-sm flex-wrap">
          <span className="font-semibold">{selectedIds.size} selecionado{selectedIds.size > 1 ? 's' : ''}</span>
          <div className="flex items-center gap-2 flex-wrap">
            {(['NOVO', 'CONTATADO', 'QUALIFICADO', 'CONVERTIDO'] as LeadStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => bulkMutation.mutate({ action: 'status', status: s })}
                disabled={bulkMutation.isPending}
                className="bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
              >
                → {STATUS_LABELS[s]}
              </button>
            ))}
            <button
              onClick={() => bulkMutation.mutate({ action: 'delete' })}
              disabled={bulkMutation.isPending}
              className="bg-red-500/80 hover:bg-red-500 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ml-1"
            >
              Descartar
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="ml-auto text-white/70 hover:text-white text-xs underline"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={(e) => setActiveDragId(e.active.id as string)}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-5 gap-3 h-full min-w-[900px]">
          {COLUMNS.map((col) => {
            const leads = data?.[col.key] ?? [];
            return (
              <div key={col.key} className="bg-[#1e293b] border border-[#334155] rounded-xl overflow-hidden flex flex-col">
                <div className="px-3 py-2.5 border-b border-[#334155] flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${col.dot}`} />
                    <span className={`text-xs font-bold uppercase tracking-wide ${col.color}`}>{col.label}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 bg-[#0f172a] px-1.5 py-0.5 rounded-full font-medium">
                    {leads.length}
                  </span>
                </div>
                <SortableContext items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy} id={col.key}>
                  <div className="p-2 space-y-2 flex-1 overflow-y-auto min-h-[120px]">
                    {leads.map((lead) => (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        onClick={setSelectedLead}
                        selected={selectedIds.has(lead.id)}
                        onSelect={selectionMode ? toggleSelect : undefined}
                      />
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

      <LeadSlideOver
        lead={selectedLead}
        open={!!selectedLead}
        onClose={() => setSelectedLead(null)}
      />
    </>
  );
}
```

- [ ] **Step 4: Atualizar lead-slide-over.tsx**

```tsx
// apps/web/app/[orgSlug]/leads/_components/lead-slide-over.tsx
'use client';
import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Lead, LeadStatus, updateLeadStatus, deleteLead } from '@/lib/api/leads';
import { useAuth, useOrganization } from '@clerk/nextjs';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const STATUS_LABELS: Record<LeadStatus, string> = {
  NOVO: 'Novo', CONTATADO: 'Contatado', QUALIFICADO: 'Qualificado',
  CONVERTIDO: 'Convertido', DESCARTADO: 'Descartado',
};

const STATUS_COLORS: Record<LeadStatus, string> = {
  NOVO:        'bg-blue-950 text-blue-400',
  CONTATADO:   'bg-amber-950 text-amber-400',
  QUALIFICADO: 'bg-violet-950 text-violet-400',
  CONVERTIDO:  'bg-emerald-950 text-emerald-400',
  DESCARTADO:  'bg-slate-800 text-slate-500',
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
  const router = useRouter();
  const { orgSlug } = useParams<{ orgSlug: string }>();

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
      <SheetContent className="w-[420px] bg-[#1e293b] border-[#334155] text-slate-100">
        <SheetHeader>
          <SheetTitle className="text-slate-100 text-xl">{lead.name}</SheetTitle>
          <div className="flex gap-2 mt-1">
            <span className={`text-xs px-2 py-1 rounded font-semibold ${STATUS_COLORS[lead.status]}`}>
              {STATUS_LABELS[lead.status]}
            </span>
          </div>
        </SheetHeader>

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
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 5: Atualizar new-lead-sheet.tsx** (atualizar acento azul → índigo)

No arquivo `apps/web/app/[orgSlug]/leads/_components/new-lead-sheet.tsx`, alterar:
- `bg-blue-600 hover:bg-blue-500` → `bg-indigo-600 hover:bg-indigo-500`

```tsx
// Linha do Button (único change necessário):
<Button
  onClick={() => mutation.mutate()}
  disabled={mutation.isPending}
  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white"
>
  {mutation.isPending ? 'Salvando...' : 'Criar Lead'}
</Button>
```

- [ ] **Step 6: Atualizar import-csv-dialog.tsx** (atualizar acento azul → índigo)

No arquivo `apps/web/app/[orgSlug]/leads/_components/import-csv-dialog.tsx`, alterar:
- `bg-blue-600 hover:bg-blue-500` → `bg-indigo-600 hover:bg-indigo-500`
- `text-blue-400` → `text-indigo-400`

```tsx
// Alterar code span color (linha ~57):
<code className="text-indigo-400">nome, email, telefone, empresa, observações</code>

// Alterar Button de importar (linha ~87):
<Button
  onClick={() => mutation.mutate()}
  disabled={!file || mutation.isPending}
  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white"
>
```

- [ ] **Step 7: Verificar**

Abrir http://localhost:3000/[orgSlug]/leads — kanban dark, cards dark, botões violeta.

- [ ] **Step 8: Commit**

```bash
cd C:/Users/OS/crm-saas
git add apps/web/app/[orgSlug]/leads/
git commit -m "feat: apply dark theme to leads module"
```

---

## Task 5: Pipeline

**Files:**
- Modify: `apps/web/app/[orgSlug]/pipeline/page.tsx`
- Modify: `apps/web/app/[orgSlug]/pipeline/_components/pipeline-header.tsx`
- Modify: `apps/web/app/[orgSlug]/pipeline/_components/stage-column.tsx`
- Modify: `apps/web/app/[orgSlug]/pipeline/_components/deal-card.tsx`
- Modify: `apps/web/app/[orgSlug]/pipeline/_components/deal-slide-over.tsx`
- Modify: `apps/web/app/[orgSlug]/pipeline/_components/new-deal-sheet.tsx`

- [ ] **Step 1: Atualizar pipeline/page.tsx** (corrigir altura + fundo)

```tsx
// apps/web/app/[orgSlug]/pipeline/page.tsx
'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { useAuth, useOrganization } from '@clerk/nextjs';
import { getKanban } from '@/lib/api/pipeline';
import { PipelineHeader } from './_components/pipeline-header';
import { NewDealSheet } from './_components/new-deal-sheet';

const PipelineKanban = dynamic(
  () => import('./_components/pipeline-kanban').then((m) => m.PipelineKanban),
  { ssr: false }
);

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
    <div className="flex flex-col h-full">
      <PipelineHeader onNewDeal={() => setNewDealOpen(true)} />
      <main className="flex-1 overflow-hidden p-4 bg-[#0f172a]">
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

- [ ] **Step 2: Atualizar pipeline-header.tsx**

```tsx
// apps/web/app/[orgSlug]/pipeline/_components/pipeline-header.tsx
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
    <div className="flex items-center justify-between px-6 py-3 border-b border-[#334155] bg-[#1e293b] shrink-0">
      <h1 className="text-base font-semibold text-slate-100">Pipeline</h1>
      <div className="flex items-center gap-2">
        <Link
          href={`/${orgSlug}/pipeline/settings`}
          className="text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-md border border-[#334155] hover:border-[#475569] transition-colors"
        >
          Gerenciar estágios
        </Link>
        <Button
          size="sm"
          className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
          onClick={onNewDeal}
        >
          + Novo Deal
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Atualizar stage-column.tsx**

```tsx
// apps/web/app/[orgSlug]/pipeline/_components/stage-column.tsx
'use client';
import { useDroppable } from '@dnd-kit/core';
import { type KanbanStage, type Deal } from '@/lib/api/pipeline';
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
        <span className="text-sm font-semibold text-slate-300 truncate">{stage.name}</span>
        <span className="ml-auto text-xs text-slate-600 shrink-0">{stage.deals.length}</span>
      </div>
      {stage.totalValue > 0 && (
        <p className="text-xs text-indigo-400 px-1 mb-2 font-medium">{formatBRL(stage.totalValue)}</p>
      )}
      <div
        ref={setNodeRef}
        className={`flex-1 flex flex-col gap-2 min-h-[200px] rounded-lg p-2 transition-colors ${
          isOver
            ? 'bg-indigo-500/10 border-2 border-indigo-500/40 border-dashed'
            : 'bg-[#1e293b]/60 border border-[#334155]'
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

- [ ] **Step 4: Atualizar deal-card.tsx**

```tsx
// apps/web/app/[orgSlug]/pipeline/_components/deal-card.tsx
'use client';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { type Deal } from '@/lib/api/pipeline';

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
      className="bg-[#1e293b] border border-[#334155] rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/5 transition-all select-none"
    >
      <p className="text-sm font-medium text-slate-200 leading-snug">{deal.title}</p>
      {deal.lead && (
        <p className="text-xs text-slate-500 mt-1">{deal.lead.name}</p>
      )}
      <div className="flex items-center justify-between mt-2">
        {deal.value != null ? (
          <span className="text-xs font-semibold text-indigo-400">{formatBRL(deal.value)}</span>
        ) : (
          <span />
        )}
        {deal.assignedTo && (
          <span
            className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0"
            title={deal.assignedTo.name}
          >
            {deal.assignedTo.name.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      {deal.probability != null && (
        <div className="mt-2 h-1 bg-[#334155] rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full"
            style={{ width: `${deal.probability}%` }}
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Atualizar deal-slide-over.tsx** (azul → índigo nos focus rings e botões)

No arquivo `apps/web/app/[orgSlug]/pipeline/_components/deal-slide-over.tsx`, fazer as seguintes substituições:
- `focus:ring-blue-500` → `focus:ring-indigo-500`
- `bg-blue-600 hover:bg-blue-500` → `bg-indigo-600 hover:bg-indigo-500`

- [ ] **Step 6: Atualizar new-deal-sheet.tsx** (azul → índigo)

No arquivo `apps/web/app/[orgSlug]/pipeline/_components/new-deal-sheet.tsx`, fazer as seguintes substituições:
- `focus:ring-blue-500` → `focus:ring-indigo-500`
- `bg-blue-600 hover:bg-blue-500` → `bg-indigo-600 hover:bg-indigo-500`

- [ ] **Step 7: Verificar**

Abrir http://localhost:3000/[orgSlug]/pipeline — kanban dark com colunas escuras, cards com valor em índigo.

- [ ] **Step 8: Commit**

```bash
cd C:/Users/OS/crm-saas
git add apps/web/app/[orgSlug]/pipeline/
git commit -m "feat: apply dark theme to pipeline module"
```

---

## Task 6: WhatsApp

**Files:**
- Modify: `apps/web/app/[orgSlug]/whatsapp/page.tsx`
- Modify: `apps/web/app/[orgSlug]/whatsapp/_components/wa-inbox.tsx`
- Modify: `apps/web/app/[orgSlug]/whatsapp/_components/wa-setup.tsx`
- Modify: `apps/web/app/[orgSlug]/whatsapp/_components/wa-lead-panel.tsx`

- [ ] **Step 1: Atualizar whatsapp/page.tsx** (corrigir altura)

```tsx
// apps/web/app/[orgSlug]/whatsapp/page.tsx
'use client';
import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth, useOrganization } from '@clerk/nextjs';
import { getWaInstance, WaInstance } from '@/lib/api/whatsapp';
import { WaSetup } from './_components/wa-setup';
import { WaInbox } from './_components/wa-inbox';

function WhatsAppPageInner() {
  const { getToken } = useAuth();
  const { organization } = useOrganization();
  const [forceSetup, setForceSetup] = useState(false);
  const searchParams = useSearchParams();
  const initialJid = searchParams.get('jid');

  const { data: instance, isLoading } = useQuery<WaInstance | null>({
    queryKey: ['wa', 'instance', organization?.id],
    queryFn: async () => {
      const token = await getToken();
      return getWaInstance(token!);
    },
    enabled: !!organization?.id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-600 text-sm">
        Carregando...
      </div>
    );
  }

  const isConnected = instance?.status === 'CONNECTED' && !forceSetup;

  if (!isConnected) {
    return (
      <div className="p-6">
        <WaSetup onConnected={() => setForceSetup(false)} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <WaInbox instance={instance} onDisconnect={() => setForceSetup(true)} initialJid={initialJid} />
    </div>
  );
}

export default function WhatsAppPage() {
  return (
    <Suspense>
      <WhatsAppPageInner />
    </Suspense>
  );
}
```

- [ ] **Step 2: Atualizar wa-inbox.tsx**

```tsx
// apps/web/app/[orgSlug]/whatsapp/_components/wa-inbox.tsx
'use client';
import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth, useOrganization } from '@clerk/nextjs';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  getWaConversations, getWaMessages, sendWaMessage, deleteWaInstance,
  WaConversation, WaMessage, WaInstance,
} from '@/lib/api/whatsapp';
import { Button } from '@/components/ui/button';
import { WaLeadPanel } from './wa-lead-panel';

interface Props {
  instance: WaInstance;
  onDisconnect: () => void;
  initialJid?: string | null;
}

export function WaInbox({ instance, onDisconnect, initialJid }: Props) {
  const { getToken } = useAuth();
  const { organization } = useOrganization();
  const queryClient = useQueryClient();
  const [selectedJid, setSelectedJid] = useState<string | null>(initialJid ?? null);
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: conversations = [] } = useQuery<WaConversation[]>({
    queryKey: ['wa', 'conversations', organization?.id],
    queryFn: async () => {
      const token = await getToken();
      return getWaConversations(token!);
    },
    enabled: !!organization?.id,
    refetchInterval: 5000,
  });

  const { data: messages = [] } = useQuery<WaMessage[]>({
    queryKey: ['wa', 'messages', organization?.id, selectedJid],
    queryFn: async () => {
      const token = await getToken();
      return getWaMessages(token!, selectedJid!);
    },
    enabled: !!selectedJid && !!organization?.id,
    refetchInterval: 3000,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMutation = useMutation({
    mutationFn: async (msg: string) => {
      const token = await getToken();
      return sendWaMessage(token!, selectedJid!, msg);
    },
    onSuccess: () => {
      setText('');
      queryClient.invalidateQueries({ queryKey: ['wa', 'messages', organization?.id, selectedJid] });
      queryClient.invalidateQueries({ queryKey: ['wa', 'conversations', organization?.id] });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return deleteWaInstance(token!);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wa', 'instance', organization?.id] });
      onDisconnect();
    },
  });

  const selectedConv = conversations.find((c) => c.remoteJid === selectedJid);
  const displayName = (jid: string) => {
    const conv = conversations.find((c) => c.remoteJid === jid);
    return conv?.lead?.name ?? jid.split('@')[0];
  };

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !selectedJid) return;
    sendMutation.mutate(text.trim());
  }

  return (
    <div className="flex h-full">
      {/* Sidebar conversations */}
      <aside className="w-72 border-r border-[#334155] bg-[#1e293b] flex flex-col shrink-0">
        <div className="px-4 py-3 border-b border-[#334155] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-sm font-semibold text-slate-200">
              {instance.phone ? `+${instance.phone}` : 'WhatsApp'}
            </span>
          </div>
          <button
            onClick={() => disconnectMutation.mutate()}
            className="text-xs text-slate-600 hover:text-red-400 transition-colors"
            title="Desconectar"
          >
            Desconectar
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-4 text-xs text-slate-600 text-center mt-8">
              Nenhuma conversa ainda.<br />As mensagens recebidas aparecerão aqui.
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.remoteJid}
                onClick={() => setSelectedJid(conv.remoteJid)}
                className={`w-full text-left px-4 py-3 border-b border-[#334155]/50 transition-colors ${
                  selectedJid === conv.remoteJid
                    ? 'bg-indigo-500/15 border-l-2 border-l-indigo-500'
                    : 'hover:bg-[#334155]/40'
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <p className="text-sm font-medium text-slate-200 truncate">
                    {conv.lead?.name ?? conv.remoteJid.split('@')[0]}
                  </p>
                  <span className="text-[10px] text-slate-600 shrink-0">
                    {formatDistanceToNow(new Date(conv.lastTimestamp), { addSuffix: false, locale: ptBR })}
                  </span>
                </div>
                <p className="text-xs text-slate-500 truncate">{conv.lastMessage}</p>
                {conv.unread > 0 && (
                  <span className="inline-block mt-1 bg-emerald-600 text-white text-[10px] rounded-full px-1.5 py-0.5 font-bold">
                    {conv.unread}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Main chat */}
      <main className="flex-1 flex flex-col bg-[#0f172a] min-w-0">
        {!selectedJid ? (
          <div className="flex items-center justify-center h-full text-slate-600 text-sm">
            Selecione uma conversa
          </div>
        ) : (
          <>
            <div className="px-5 py-3 bg-[#1e293b] border-b border-[#334155] shrink-0">
              <p className="text-sm font-semibold text-slate-200">{displayName(selectedJid)}</p>
              {selectedConv?.lead && (
                <p className="text-xs text-slate-500">{selectedJid.split('@')[0]}</p>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] px-3 py-2 rounded-2xl text-sm ${
                    msg.fromMe
                      ? 'bg-indigo-600 text-white rounded-br-sm'
                      : 'bg-[#1e293b] border border-[#334155] text-slate-200 rounded-bl-sm'
                  }`}>
                    <p>{msg.body}</p>
                    <p className={`text-[10px] mt-1 ${msg.fromMe ? 'text-indigo-200' : 'text-slate-600'}`}>
                      {formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={handleSend} className="px-4 py-3 bg-[#1e293b] border-t border-[#334155] flex gap-2 shrink-0">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Digite uma mensagem..."
                className="flex-1 text-sm px-3 py-2 rounded-lg border border-[#334155] bg-[#0f172a] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <Button
                type="submit"
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
                disabled={!text.trim() || sendMutation.isPending}
              >
                Enviar
              </Button>
            </form>
          </>
        )}
      </main>

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
}
```

- [ ] **Step 3: Atualizar wa-setup.tsx**

```tsx
// apps/web/app/[orgSlug]/whatsapp/_components/wa-setup.tsx
'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth, useOrganization } from '@clerk/nextjs';
import { getWaInstance, saveWaInstance, getWaQrCode, refreshWaStatus, WaInstance } from '@/lib/api/whatsapp';
import { Button } from '@/components/ui/button';

interface Props {
  onConnected: () => void;
}

export function WaSetup({ onConnected }: Props) {
  const { getToken } = useAuth();
  const { organization } = useOrganization();
  const queryClient = useQueryClient();
  const [instanceId, setInstanceId] = useState('');
  const [instanceToken, setInstanceToken] = useState('');
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);

  const webhookUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/whatsapp/webhook`;

  function copyWebhook() {
    navigator.clipboard.writeText(webhookUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const { data: instance } = useQuery<WaInstance | null>({
    queryKey: ['wa', 'instance', organization?.id],
    queryFn: async () => {
      const token = await getToken();
      return getWaInstance(token!);
    },
    enabled: !!organization?.id,
    refetchInterval: showQr ? 5000 : false,
    select: (d) => {
      if (d?.status === 'CONNECTED') onConnected();
      return d;
    },
  });

  const { data: qr, isLoading: qrLoading } = useQuery({
    queryKey: ['wa', 'qr', organization?.id],
    queryFn: async () => {
      const token = await getToken();
      return getWaQrCode(token!);
    },
    enabled: showQr && !!instance && instance.status !== 'CONNECTED',
    refetchInterval: 20000,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return saveWaInstance(token!, instanceId.trim(), instanceToken.trim());
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['wa', 'instance', organization?.id], data);
      if (data.status === 'CONNECTED') {
        onConnected();
      } else {
        setShowQr(true);
      }
    },
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return refreshWaStatus(token!);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['wa', 'instance', organization?.id], data);
      if (data.status === 'CONNECTED') onConnected();
    },
  });

  const isConfigured = !!instance?.instanceName && !!instance?.token;
  const canSave = (instanceId.trim() || instance?.instanceName) && (instanceToken.trim() || instance?.token);

  return (
    <div className="max-w-lg mx-auto mt-12 pb-12">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-emerald-950 flex items-center justify-center">
          <svg className="w-6 h-6 text-emerald-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-100">Conectar WhatsApp</h2>
          <p className="text-sm text-slate-500">Integração via Z-API</p>
        </div>
      </div>

      <div className="space-y-3 mb-6">
        <div className="flex gap-3 bg-[#1e293b] border border-[#334155] rounded-xl p-4">
          <div className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</div>
          <div>
            <p className="text-sm font-semibold text-slate-200">Crie uma conta na Z-API</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Acesse{' '}
              <a href="https://app.z-api.io" target="_blank" rel="noreferrer" className="text-indigo-400 underline font-medium">
                app.z-api.io
              </a>{' '}
              → crie conta gratuita → crie uma instância → copie o <strong className="text-slate-300">Instance ID</strong> e o <strong className="text-slate-300">Token</strong>.
            </p>
          </div>
        </div>

        <div className="flex gap-3 bg-[#1e293b] border border-[#334155] rounded-xl p-4">
          <div className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-200">Configure o Webhook na Z-API</p>
            <p className="text-xs text-slate-500 mt-0.5 mb-2">
              Na sua instância Z-API → <strong className="text-slate-300">Webhooks</strong> → cole a URL abaixo:
            </p>
            <div className="flex items-center gap-2 bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-2">
              <code className="text-xs text-slate-400 flex-1 truncate">{webhookUrl}</code>
              <button
                onClick={copyWebhook}
                className="text-xs px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 shrink-0 transition-colors"
              >
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-3 bg-[#1e293b] border border-[#334155] rounded-xl p-4">
          <div className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-200">Cole as credenciais e salve</p>
            <div className="mt-3 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Instance ID</label>
                <input
                  type="text"
                  value={instanceId || instance?.instanceName || ''}
                  onChange={(e) => setInstanceId(e.target.value)}
                  placeholder="Ex: 3A6C6215-39A1-4990-873B..."
                  className="w-full text-sm px-3 py-2 rounded-lg border border-[#334155] bg-[#0f172a] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Instance Token</label>
                <input
                  type="password"
                  value={instanceToken || (instance?.token ? '••••••••' : '')}
                  onChange={(e) => setInstanceToken(e.target.value)}
                  placeholder="Token da instância Z-API"
                  className="w-full text-sm px-3 py-2 rounded-lg border border-[#334155] bg-[#0f172a] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1"
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending || !canSave}
                >
                  {saveMutation.isPending ? 'Verificando...' : 'Salvar e conectar'}
                </Button>
                {isConfigured && (
                  <Button
                    variant="outline"
                    onClick={() => refreshMutation.mutate()}
                    disabled={refreshMutation.isPending}
                    className="text-xs border-[#334155] bg-transparent text-slate-400 hover:bg-[#334155]"
                  >
                    {refreshMutation.isPending ? '...' : 'Atualizar'}
                  </Button>
                )}
              </div>
              {saveMutation.isError && (
                <p className="text-xs text-red-400 bg-red-950 border border-red-900 rounded-lg px-3 py-2">
                  Erro ao verificar credenciais. Verifique se o Instance ID e o Token estão corretos e tente novamente.
                </p>
              )}
            </div>
          </div>
        </div>

        {(showQr || isConfigured) && instance?.status !== 'CONNECTED' && (
          <div className="flex gap-3 bg-[#1e293b] border border-[#334155] rounded-xl p-4">
            <div className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">4</div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-200">Escaneie o QR Code</p>
              <p className="text-xs text-slate-500 mt-0.5 mb-3">
                No WhatsApp do seu celular: <strong className="text-slate-300">Menu (⋮) → Aparelhos conectados → Conectar um aparelho</strong>
              </p>
              {!showQr ? (
                <Button size="sm" variant="outline" onClick={() => setShowQr(true)} className="text-xs border-[#334155] bg-transparent text-slate-400 hover:bg-[#334155]">
                  Ver QR Code
                </Button>
              ) : qrLoading ? (
                <div className="w-48 h-48 bg-[#0f172a] rounded-xl flex items-center justify-center text-slate-600 text-xs">
                  Carregando QR...
                </div>
              ) : qr?.base64 ? (
                <div className="flex flex-col items-center gap-2 max-w-[220px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qr.base64} alt="QR Code WhatsApp" className="w-52 h-52 rounded-xl border border-[#334155]" />
                  <p className="text-xs text-slate-600">Atualiza automaticamente a cada 20s</p>
                </div>
              ) : (
                <p className="text-xs text-slate-600">
                  QR code não disponível. Clique em <strong>Atualizar</strong> acima ou aguarde.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {isConfigured && !showQr && instance?.status !== 'CONNECTED' && (
        <div className="flex items-center justify-between bg-amber-950 border border-amber-900 rounded-xl px-4 py-3 mt-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-sm text-amber-400">WhatsApp desconectado</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="text-xs border-amber-800 text-amber-400 hover:bg-amber-900 bg-transparent"
            onClick={() => setShowQr(true)}
          >
            Ver QR Code
          </Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Atualizar wa-lead-panel.tsx**

```tsx
// apps/web/app/[orgSlug]/whatsapp/_components/wa-lead-panel.tsx
'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';
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
  NOVO:        'bg-blue-950 text-blue-400',
  CONTATADO:   'bg-amber-950 text-amber-400',
  QUALIFICADO: 'bg-violet-950 text-violet-400',
  CONVERTIDO:  'bg-emerald-950 text-emerald-400',
  DESCARTADO:  'bg-slate-800 text-slate-500',
};

export function WaLeadPanel({ jid, lead, onLinkChange }: Props) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const { getToken } = useAuth();
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
      setSearch('');
      onLinkChange();
    },
  });

  const phone = jid.split('@')[0];

  return (
    <div className="w-64 border-l border-[#334155] bg-[#1e293b] flex flex-col shrink-0">
      <div className="px-4 py-3 border-b border-[#334155]">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Lead</p>
      </div>

      {lead ? (
        <div className="p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-slate-200">{lead.name}</p>
            <span className={`inline-block mt-1 text-[11px] px-2 py-0.5 rounded font-medium ${STATUS_COLORS[lead.status] ?? 'bg-slate-800 text-slate-500'}`}>
              {STATUS_LABELS[lead.status] ?? lead.status}
            </span>
          </div>
          {lead.email && <p className="text-xs text-slate-500 truncate">{lead.email}</p>}
          {lead.phone && <p className="text-xs text-slate-500">{lead.phone}</p>}
          <div className="pt-2 space-y-2">
            <button
              onClick={() => router.push(`/${orgSlug}/leads`)}
              className="w-full text-left text-xs px-3 py-2 rounded-lg border border-[#334155] text-slate-400 hover:bg-[#334155] transition-colors flex items-center gap-1.5"
            >
              <span>↗</span> Ver no kanban
            </button>
            <button
              onClick={() => linkMutation.mutate(null)}
              disabled={linkMutation.isPending}
              className="w-full text-left text-xs px-3 py-2 rounded-lg border border-red-900 text-red-400 hover:bg-red-950 transition-colors disabled:opacity-50"
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
            className="w-full text-xs px-3 py-2 rounded-lg border border-[#334155] bg-[#0f172a] text-slate-300 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          {searchResults && searchResults.items.length > 0 && (
            <div className="space-y-1">
              {searchResults.items.map((l: Lead) => (
                <div key={l.id} className="flex items-center justify-between py-1.5 border-b border-[#334155]/50 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-300 truncate">{l.name}</p>
                    <p className="text-[11px] text-slate-600 truncate">{l.phone ?? l.email ?? ''}</p>
                  </div>
                  <button
                    onClick={() => linkMutation.mutate(l.id)}
                    disabled={linkMutation.isPending}
                    className="ml-2 text-[11px] px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700 shrink-0 disabled:opacity-50"
                  >
                    Vincular
                  </button>
                </div>
              ))}
            </div>
          )}

          {debouncedSearch.length > 1 && searchResults?.items.length === 0 && (
            <p className="text-xs text-slate-600 text-center py-2">Nenhum lead encontrado</p>
          )}

          <button
            onClick={() => setNewLeadOpen(true)}
            className="w-full text-xs px-3 py-2 rounded-lg border border-dashed border-indigo-800 text-indigo-400 hover:bg-indigo-950 transition-colors"
          >
            + Criar lead desta conversa
          </button>
        </div>
      )}

      <NewLeadSheet
        open={newLeadOpen}
        onClose={() => setNewLeadOpen(false)}
        defaultPhone={phone}
        defaultSource="WHATSAPP"
        onCreated={(newLead) => linkMutation.mutate(newLead.id)}
      />
    </div>
  );
}
```

- [ ] **Step 5: Verificar**

Abrir http://localhost:3000/[orgSlug]/whatsapp — inbox dark, chat com bolhas índigo.

- [ ] **Step 6: Commit**

```bash
cd C:/Users/OS/crm-saas
git add apps/web/app/[orgSlug]/whatsapp/
git commit -m "feat: apply dark theme to whatsapp module"
```

---

## Task 7: Settings

**Files:**
- Modify: `apps/web/app/[orgSlug]/settings/workspace/page.tsx`
- Modify: `apps/web/app/[orgSlug]/settings/billing/page.tsx`
- Modify: `apps/web/app/[orgSlug]/settings/members/page.tsx`

- [ ] **Step 1: Atualizar settings/workspace/page.tsx**

```tsx
// apps/web/app/[orgSlug]/settings/workspace/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { useOrganization } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function WorkspaceSettingsPage() {
  const { organization, isLoaded } = useOrganization();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (organization?.name) setName(organization.name);
  }, [organization?.name]);

  if (!isLoaded || !organization) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await organization!.update({ name });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-lg">
      <h1 className="mb-6 text-xl font-bold text-slate-100">Configurações do Workspace</h1>
      <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-6">
        <h2 className="text-sm font-semibold text-slate-200 mb-4">Informações gerais</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="orgName" className="text-slate-400 text-xs">Nome da agência</Label>
            <Input
              id="orgName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-[#0f172a] border-[#334155] text-slate-100 placeholder:text-slate-600 focus:ring-indigo-500"
            />
          </div>
          <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            {loading ? 'Salvando...' : 'Salvar alterações'}
          </Button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Atualizar settings/billing/page.tsx**

```tsx
// apps/web/app/[orgSlug]/settings/billing/page.tsx
'use client';
import { useState } from 'react';
import { useApiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';

export default function BillingSettingsPage() {
  const api = useApiClient();
  const [loading, setLoading] = useState(false);

  async function openPortal() {
    setLoading(true);
    try {
      const { url } = await api.post<{ url: string }>('/billing/portal', {
        returnUrl: window.location.href,
      });
      if (url) window.location.href = url;
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-lg">
      <h1 className="mb-6 text-xl font-bold text-slate-100">Billing</h1>
      <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-6">
        <h2 className="text-sm font-semibold text-slate-200 mb-1">Gerenciar assinatura</h2>
        <p className="text-xs text-slate-500 mb-4">Altere seu plano, atualize o cartão ou cancele pelo portal Stripe.</p>
        <Button onClick={openPortal} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
          {loading ? 'Abrindo...' : 'Abrir portal de cobrança'}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Atualizar settings/members/page.tsx**

```tsx
// apps/web/app/[orgSlug]/settings/members/page.tsx
'use client';
import { OrganizationProfile } from '@clerk/nextjs';

export default function MembersSettingsPage() {
  return (
    <div className="p-6">
      <h1 className="mb-6 text-xl font-bold text-slate-100">Membros</h1>
      <OrganizationProfile
        routing="hash"
        appearance={{
          elements: {
            card: 'bg-[#1e293b] border-[#334155] shadow-none',
            navbar: 'bg-[#1e293b]',
            navbarButton: 'text-slate-400',
            navbarButtonActive: 'text-indigo-400',
          },
        }}
      />
    </div>
  );
}
```

- [ ] **Step 4: Verificar**

Abrir http://localhost:3000/[orgSlug]/settings/workspace — página dark, inputs dark, botão índigo.

- [ ] **Step 5: Commit final**

```bash
cd C:/Users/OS/crm-saas
git add apps/web/app/[orgSlug]/settings/
git commit -m "feat: apply dark theme to settings pages"
```

---

## Task 8: Deploy

- [ ] **Step 1: Build de verificação**

```bash
cd C:/Users/OS/crm-saas/apps/web && pnpm build
```

Esperado: build sem erros de TypeScript ou CSS.

- [ ] **Step 2: Push para produção**

```bash
cd C:/Users/OS/crm-saas && git push origin master
```

Easypanel detecta automaticamente e rebuilda os containers. Aguardar ~3 minutos e verificar https://srv1663592.hstgr.cloud.
