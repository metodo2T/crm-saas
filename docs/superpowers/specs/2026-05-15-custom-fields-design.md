# Campos Customizados — Design Spec

**Data:** 2026-05-15  
**Status:** Aprovado

---

## Objetivo

Permitir que cada organização defina campos extras (texto ou número) nos seus leads, visíveis e editáveis no slide-over do lead. Os campos são gerenciados na página Settings → Campos Customizados.

---

## Decisões

| Decisão | Escolha |
|---|---|
| Tipos de campo | TEXT e NUMBER |
| Onde aparecem | Só no slide-over do lead |
| Onde se configura | Settings → Campos Customizados |
| Armazenamento | JSON column em Lead + modelo CustomFieldDef |

---

## 1. Modelo de Dados

### Novo modelo `CustomFieldDef`

```prisma
model CustomFieldDef {
  id             String          @id @default(uuid())
  organizationId String
  organization   Organization    @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  name           String
  type           CustomFieldType
  order          Int             @default(0)
  createdAt      DateTime        @default(now())

  @@index([organizationId, order])
}

enum CustomFieldType {
  TEXT
  NUMBER
}
```

### Alteração no modelo `Lead`

Adicionar coluna:

```prisma
customData  Json?
```

Formato do valor em runtime:

```json
{
  "<CustomFieldDef.id>": "valor texto",
  "<CustomFieldDef.id>": 5000
}
```

Usar o `id` como chave (não o `name`) para preservar valores quando o admin renomear um campo.

### Alteração no modelo `Organization`

Adicionar relação inversa:

```prisma
customFieldDefs CustomFieldDef[]
```

### Migration

Uma migration com dois passos:
1. `CREATE TABLE "CustomFieldDef" (...)` com FK para `Organization`
2. `ALTER TABLE "Lead" ADD COLUMN "customData" JSONB`

---

## 2. Backend (NestJS)

### Novo módulo `apps/api/src/custom-fields/`

**Arquivos:**
- `custom-fields.module.ts`
- `custom-fields.controller.ts`
- `custom-fields.service.ts`
- `dto/create-custom-field.dto.ts` — `{ name: string, type: 'TEXT' | 'NUMBER' }`
- `dto/update-custom-field.dto.ts` — `{ name?: string, order?: number }`

**Endpoints:**

| Método | Rota | Descrição |
|---|---|---|
| GET | `/custom-fields` | Lista definições da org, ordenadas por `order` |
| POST | `/custom-fields` | Cria novo campo (`name`, `type`) |
| PATCH | `/custom-fields/:id` | Renomeia ou reordena campo |
| DELETE | `/custom-fields/:id` | Remove definição (valores no JSON ficam orfãos, sem erro) |

Todos os endpoints usam `ClerkAuthGuard` e filtram por `organizationId` extraído do token — padrão existente no projeto.

### Alteração em `leads.service.ts` e `leads.controller.ts`

O `PATCH /leads/:id` já existente aceita `customData` no body:

```ts
// update-lead.dto.ts — adicionar campo:
@IsOptional()
customData?: Record<string, string | number>;
```

O `GET /leads/kanban` e demais endpoints já retornam o objeto Lead completo — `customData` aparece automaticamente após a migration.

---

## 3. Frontend

### 3a. Settings Layout com sub-navegação

**Novo arquivo:** `apps/web/app/[orgSlug]/settings/layout.tsx`

```
Settings Layout
├── Sub-nav (links horizontais): Workspace | Membros | Billing | Campos
└── {children}
```

Sub-nav dark com links `text-slate-400`, ativo `text-indigo-300 border-b-2 border-indigo-500`.

### 3b. Página Settings → Campos Customizados

**Novo arquivo:** `apps/web/app/[orgSlug]/settings/custom-fields/page.tsx`

**UI:**
- Título "Campos Customizados" + subtítulo
- Card `bg-[#1e293b]` com tabela de campos existentes:
  - Colunas: Nome | Tipo (badge TEXTO/NÚMERO) | Ação (botão remover)
  - Estado vazio: "Nenhum campo ainda. Adicione o primeiro abaixo."
- Formulário inline de adição (sempre visível abaixo da tabela):
  - Input "Nome do campo" + select "Texto / Número" + botão "Adicionar"
  - Ao salvar: POST `/custom-fields` → invalida query → campo aparece na lista

**API no frontend:** `apps/web/lib/api/custom-fields.ts`

```ts
export interface CustomFieldDef {
  id: string;
  name: string;
  type: 'TEXT' | 'NUMBER';
  order: number;
}

export async function getCustomFields(token: string): Promise<CustomFieldDef[]>
export async function createCustomField(token: string, name: string, type: 'TEXT' | 'NUMBER'): Promise<CustomFieldDef>
export async function deleteCustomField(token: string, id: string): Promise<void>
```

### 3c. Seção no Lead Slide-Over

**Arquivo modificado:** `apps/web/app/[orgSlug]/leads/_components/lead-slide-over.tsx`

Adicionar seção abaixo dos campos de contato (email, phone, company, notes):

```
─────────────────────────
CAMPOS CUSTOMIZADOS          ← label indigo uppercase
Budget                       ← label cinza
[    5000         ]          ← input number, dark
Observação interna
[  Interesse anual  ]        ← input text, dark
Score
[    —             ]        ← vazio, placeholder "—"
```

**Comportamento:**
- Carrega `CustomFieldDef[]` da org via `useQuery(['custom-fields', orgId])`
- Para cada definição, renderiza input `type="text"` ou `type="number"` com valor de `lead.customData[field.id] ?? ''`
- `onBlur`: chama `PATCH /leads/:id` com `{ customData: { ...lead.customData, [field.id]: novoValor } }`
- Auto-save no blur (sem botão "Salvar" separado)
- Se a org não tem nenhum campo definido: seção oculta (não exibe nada)

---

## 4. Arquivos a Modificar / Criar

| Arquivo | Tipo |
|---|---|
| `packages/db/prisma/schema.prisma` | Modificar: novo modelo + coluna |
| `packages/db/prisma/migrations/...` | Criar: migration |
| `apps/api/src/custom-fields/custom-fields.module.ts` | Novo |
| `apps/api/src/custom-fields/custom-fields.controller.ts` | Novo |
| `apps/api/src/custom-fields/custom-fields.service.ts` | Novo |
| `apps/api/src/custom-fields/dto/create-custom-field.dto.ts` | Novo |
| `apps/api/src/custom-fields/dto/update-custom-field.dto.ts` | Novo |
| `apps/api/src/app.module.ts` | Modificar: registrar CustomFieldsModule |
| `apps/api/src/leads/dto/update-lead.dto.ts` | Modificar: adicionar customData |
| `apps/api/src/leads/leads.service.ts` | Modificar: incluir customData no update |
| `apps/web/lib/api/custom-fields.ts` | Novo |
| `apps/web/app/[orgSlug]/settings/layout.tsx` | Novo: sub-nav de settings |
| `apps/web/app/[orgSlug]/settings/custom-fields/page.tsx` | Novo |
| `apps/web/app/[orgSlug]/leads/_components/lead-slide-over.tsx` | Modificar: seção custom fields |

---

## 5. O que NÃO muda

- Lógica de kanban, status, pipeline, whatsapp
- CSV export (campos customizados não entram no export — escopo futuro)
- Filtros de leads (não filtrável por campo custom — escopo futuro)
- Campos no card do kanban (clean, sem campos custom visíveis)
