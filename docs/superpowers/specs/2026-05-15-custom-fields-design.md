# Custom Fields — Design Spec
**Data:** 2026-05-15

## Contexto

O CRM precisa permitir que cada workspace defina campos extras nos Leads e nos Deals, além dos campos nativos fixos. Os campos são gerenciados por admins em Settings e preenchidos por qualquer membro no slide-over da entidade.

---

## Decisões

| Questão | Decisão |
|---|---|
| Entidades suportadas | Leads **e** Deals — conjuntos independentes |
| Tipos de campo | TEXT, NUMBER, DATE, SELECT, MULTI_SELECT, CHECKBOX, URL |
| Quem gerencia definições | Somente admins |
| Obrigatoriedade | Sempre opcional |
| UI no lead/deal | Aba separada "Campos extras" no slide-over |
| UI em Settings | Entradas separadas no sidebar: "Campos Leads" e "Campos Deals" |
| Armazenamento | Híbrido: definições em tabela `CustomFieldDef` + valores como JSONB em Lead/Deal |
| Chave dos valores | `slug` da definição (ex: `"segmento"`) — estável mesmo se o nome mudar |

---

## 1. Modelo de Dados

### Nova tabela `CustomFieldDef`

```prisma
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
```

- `slug`: gerado em kebab-case a partir do `name` na criação, imutável após isso
- `options`: `string[]` serializado como JSON — usado apenas para SELECT e MULTI_SELECT
- `order`: controla a ordem de exibição nos forms

### Mudanças nos modelos existentes

```prisma
model Lead { ...  customData Json? }
model Deal { ...  customData Json? }
```

Formato em runtime: `{ "segmento": "B2B", "cnpj": "12.345.678/0001-90" }`.

Ao deletar uma definição, os dados órfãos no JSONB são silenciosamente ignorados na renderização — nenhuma limpeza ativa necessária.

### Relação inversa em Organization

```prisma
model Organization {
  ...
  customFieldDefs CustomFieldDef[]
}
```

### Migration

`0005_add_custom_fields` — dois passos:
1. Criar tabela `CustomFieldDef` com enums
2. `ALTER TABLE "Lead" ADD COLUMN "customData" JSONB` e `ALTER TABLE "Deal" ADD COLUMN "customData" JSONB`

---

## 2. Backend (NestJS)

### Novo módulo `apps/api/src/custom-fields/`

```
custom-fields/
  custom-fields.module.ts
  custom-fields.controller.ts
  custom-fields.service.ts
  dto/
    create-custom-field.dto.ts
    update-custom-field.dto.ts
```

**`CustomFieldsService`**

| Método | Descrição |
|---|---|
| `findAll(orgId, entity)` | Lista definições ordenadas por `order` |
| `create(orgId, dto)` | Gera slug, valida unicidade, insere |
| `update(orgId, id, dto)` | Atualiza name/options/order; slug e entity são imutáveis |
| `remove(orgId, id)` | Remove definição; valores JSONB ficam órfãos sem quebrar nada |

**`CustomFieldsController`** — prefixo `/organizations/:orgSlug/custom-fields`

| Método | Rota | Guard | Descrição |
|---|---|---|---|
| GET | `/?entity=LEAD\|DEAL` | auth | Lista definições |
| POST | `/` | admin | Cria campo |
| PATCH | `/:id` | admin | Edita campo |
| DELETE | `/:id` | admin | Remove campo |

Guard de admin: verificar `role === 'ADMIN'` no `OrganizationMember` — padrão já usado em outros controllers.

### Mudanças nos serviços existentes

**`dto/update-lead.dto.ts` e `dto/update-deal.dto.ts`** — adicionar:
```ts
@IsOptional()
customData?: Record<string, unknown>;
```

**`leads.service.ts` e `deals.service.ts`** — no `update()`, fazer merge:
```ts
customData: dto.customData
  ? { ...(existing.customData as object ?? {}), ...dto.customData }
  : undefined
```

Nenhum endpoint novo para valores — `customData` vai junto no PATCH normal da entidade.

---

## 3. Frontend (Next.js)

### 3a. Settings — Sidebar

**`app/[orgSlug]/_components/app-sidebar.tsx`** — adicionar grupo "Personalização":
- "Campos Leads" → `/[orgSlug]/settings/custom-fields/leads`
- "Campos Deals" → `/[orgSlug]/settings/custom-fields/deals`

### 3b. Páginas de Settings

```
app/[orgSlug]/settings/custom-fields/
  leads/page.tsx
  deals/page.tsx
```

Ambas usam o componente `CustomFieldsManager` passando `entity="LEAD"` ou `entity="DEAL"`.

**Componente `CustomFieldsManager`:**
- Tabela: Nome | Tipo (badge) | Opções | Ações (editar, remover)
- Botão "+ Novo campo" abre Sheet/Drawer
- Drawer de criar/editar:
  - Input nome, select tipo
  - Se tipo SELECT ou MULTI_SELECT: área para adicionar/remover opções (tags)
  - Setas up/down para reordenar (ou drag-and-drop futuro)
- Estado vazio: "Nenhum campo definido. Crie o primeiro."
- Acesso restrito: só renderiza se o usuário for admin

### 3c. Lead slide-over

**`app/[orgSlug]/leads/_components/lead-slide-over.tsx`**

- Adicionar aba **"Campos extras"** nas tabs existentes
- Conteúdo da aba: form dinâmico gerado a partir de `useCustomFields('LEAD')`
- Renderização por tipo:

| Tipo | Componente |
|---|---|
| TEXT / URL | `<Input>` |
| NUMBER | `<Input type="number">` |
| DATE | `<DatePicker>` (shadcn Popover + Calendar) |
| SELECT | `<Select>` com `options` da definição |
| MULTI_SELECT | badges removíveis + dropdown para adicionar |
| CHECKBOX | `<Checkbox>` |

- Valor inicial: `lead.customData?.[slug] ?? ''`
- Salvar: botão "Salvar campos" faz `PATCH /leads/:id` com `{ customData: { [slug]: valor } }`
- Se a org não tem campos definidos: aba "Campos extras" fica oculta

### 3d. Deal slide-over

**`app/[orgSlug]/pipeline/_components/deal-slide-over.tsx`**

Mesma estrutura usando `useCustomFields('DEAL')` e `PATCH /deals/:id`.

### 3e. Hook compartilhado

**`apps/web/hooks/use-custom-fields.ts`**

```ts
function useCustomFields(entity: 'LEAD' | 'DEAL'): {
  fields: CustomFieldDef[]
  isLoading: boolean
}
```

React Query com cache por `['custom-fields', orgId, entity]`.

---

## 4. Arquivos a Criar / Modificar

| Arquivo | Ação |
|---|---|
| `packages/db/prisma/schema.prisma` | Modificar: novo modelo + colunas + enums |
| `packages/db/prisma/migrations/0005_add_custom_fields/` | Criar: migration SQL |
| `apps/api/src/custom-fields/custom-fields.module.ts` | Novo |
| `apps/api/src/custom-fields/custom-fields.controller.ts` | Novo |
| `apps/api/src/custom-fields/custom-fields.service.ts` | Novo |
| `apps/api/src/custom-fields/dto/create-custom-field.dto.ts` | Novo |
| `apps/api/src/custom-fields/dto/update-custom-field.dto.ts` | Novo |
| `apps/api/src/app.module.ts` | Modificar: registrar CustomFieldsModule |
| `apps/api/src/leads/dto/update-lead.dto.ts` | Modificar: adicionar customData |
| `apps/api/src/leads/leads.service.ts` | Modificar: merge customData no update |
| `apps/api/src/deals/dto/update-deal.dto.ts` | Modificar: adicionar customData |
| `apps/api/src/deals/deals.service.ts` | Modificar: merge customData no update |
| `apps/web/hooks/use-custom-fields.ts` | Novo |
| `apps/web/app/[orgSlug]/_components/app-sidebar.tsx` | Modificar: grupo Personalização |
| `apps/web/app/[orgSlug]/settings/custom-fields/leads/page.tsx` | Novo |
| `apps/web/app/[orgSlug]/settings/custom-fields/deals/page.tsx` | Novo |
| `apps/web/components/custom-fields-manager.tsx` | Novo |
| `apps/web/app/[orgSlug]/leads/_components/lead-slide-over.tsx` | Modificar: aba Campos extras |
| `apps/web/app/[orgSlug]/pipeline/_components/deal-slide-over.tsx` | Modificar: aba Campos extras |

---

## 5. Fora do escopo (v1)

- Campos obrigatórios
- Filtros/busca por valor de campo customizado
- Export CSV com campos customizados
- Lookup para outra entidade
- Reordenação por drag-and-drop (setas up/down suficiente)
