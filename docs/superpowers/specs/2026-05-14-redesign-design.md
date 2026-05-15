# Redesign Visual — CRM Dark Premium

**Data:** 2026-05-14  
**Abordagem:** Full Sweep (A) — tudo em um único PR  
**Status:** Aprovado

---

## Decisões Visuais

| Decisão | Escolha |
|---|---|
| Navegação | Sidebar lateral fixa (224px, ícones + texto) |
| Tema | Dark Premium |
| Tipografia | Inter (Google Fonts) |
| Cor de destaque | Violeta/Índigo (`#6366f1` → `#8b5cf6`) |

---

## 1. Design Tokens (`globals.css`)

Substituir o tema atual por paleta dark completa como padrão:

```css
--background:      #0f172a   /* fundo da página */
--card:            #1e293b   /* cards, sidebar */
--border:          #334155   /* bordas */
--foreground:      #f1f5f9   /* texto principal */
--muted-foreground:#94a3b8   /* texto secundário */
--primary:         #6366f1   /* botões, item ativo */
--ring:            #6366f1   /* focus ring */
--accent:          #8b5cf6   /* destaques secundários */
```

**Padrão de uso:** nas páginas e componentes usar valores Tailwind arbitrários diretamente (`bg-[#1e293b]`, `border-[#334155]`) — consistente com o padrão já adotado no projeto. Os tokens CSS ficam no `globals.css` como referência central.

Fonte Inter adicionada via `<link>` no `app/layout.tsx` e aplicada no `body`.

---

## 2. Componente `AppSidebar`

**Arquivo:** `apps/web/app/[orgSlug]/_components/app-sidebar.tsx`  
**Substitui:** `app-nav.tsx` (top bar removida)

### Estrutura

```
Sidebar (224px, bg #1e293b, border-r #334155, h-screen sticky)
├── Header
│   ├── Logo (ícone gradiente violeta + texto "CRM")
│   └── OrganizationSwitcher (compacto, tema dark)
├── Nav (flex-1, overflow-y-auto)
│   └── NavItem × 5 (Dashboard, Leads, Pipeline, WhatsApp, Configurações)
└── Footer
    └── UserButton (avatar + nome)
```

### Estilo dos itens de nav

- **Default:** `text-slate-400`, hover `bg-slate-700/50 text-slate-200`
- **Ativo:** `bg-indigo-500/15 text-indigo-300`, borda esquerda `2px solid #6366f1`
- **Ícones:** `lucide-react` — `LayoutDashboard`, `Users`, `Kanban`, `MessageCircle`, `Settings`

### Layout shell (`app/[orgSlug]/layout.tsx`)

```tsx
<div className="flex h-screen bg-[#0f172a]">
  <AppSidebar />
  <main className="flex-1 overflow-y-auto">
    {children}
  </main>
</div>
```

---

## 3. Páginas

### Padrão comum a todas as páginas

- Fundo herdado do layout (`#0f172a`)
- Cards: `bg-[#1e293b] border border-[#334155] rounded-xl`
- Títulos: `text-slate-100`
- Labels/subtítulos: `text-slate-400 uppercase tracking-wide text-xs font-semibold`
- Inputs: `bg-[#0f172a] border-[#334155] text-slate-100 placeholder:text-slate-500`
- Botão primário: `bg-indigo-600 hover:bg-indigo-700 text-white`
- Divisores: `border-[#334155]`

### Dashboard (`app/[orgSlug]/dashboard/page.tsx`)

- Cards de métricas: dark com label colorido em violeta/accent
- Gráfico de barras: barras `#6366f1` com hover `#4f46e5`
- Tabela de atividade recente: linhas com `divide-[#334155]`, hover `bg-[#1e293b]`
- Badges de status: versões dark (ex: `bg-blue-950 text-blue-300`, `bg-emerald-950 text-emerald-300`)

### Leads (`app/[orgSlug]/leads/`)

- Kanban: colunas `bg-[#1e293b]/50`, cabeçalho `text-slate-300`
- Cards de lead: `bg-[#1e293b] border-[#334155]`, hover `border-indigo-500/50`
- Botões de ação (import, export, bulk): tema dark
- LeadSlideOver: fundo `#1e293b`, campos dark

### Pipeline (`app/[orgSlug]/pipeline/`)

- Mesma lógica do kanban de leads
- DealCard: `bg-[#1e293b]`, valor monetário em `text-indigo-300`
- StageColumn: header com count badge dark

### WhatsApp (`app/[orgSlug]/whatsapp/`)

- Inbox: lista de conversas `bg-[#1e293b]`, conversa ativa `bg-indigo-500/15`
- Chat: fundo `#0f172a`, bolhas enviadas `bg-indigo-600`, recebidas `bg-[#1e293b]`
- Setup screen: dark

### Settings (`app/[orgSlug]/settings/`)

- Formulários: inputs dark, labels `text-slate-300`
- Cards de plano: border violeta no plano ativo
- Tabela de membros: dark

---

## Arquivos a Modificar

| Arquivo | Tipo de mudança |
|---|---|
| `apps/web/app/globals.css` | Novos tokens dark + font-family Inter |
| `apps/web/app/layout.tsx` | Adicionar link Google Fonts (Inter) |
| `apps/web/app/[orgSlug]/layout.tsx` | Flex layout com sidebar |
| `apps/web/app/[orgSlug]/_components/app-nav.tsx` | Substituir por `app-sidebar.tsx` |
| `apps/web/app/[orgSlug]/_components/app-sidebar.tsx` | **Novo arquivo** |
| `apps/web/app/[orgSlug]/dashboard/page.tsx` | Tema dark |
| `apps/web/app/[orgSlug]/leads/page.tsx` + `_components/*` | Tema dark |
| `apps/web/app/[orgSlug]/pipeline/page.tsx` + `_components/*` | Tema dark |
| `apps/web/app/[orgSlug]/whatsapp/page.tsx` + `_components/*` | Tema dark |
| `apps/web/app/[orgSlug]/settings/**` | Tema dark |

---

## O que NÃO muda

- Lógica de negócio, queries, hooks, tipos
- Estrutura de rotas e componentes
- Backend (zero alterações)
- Clerk/Stripe/Z-API integrations
