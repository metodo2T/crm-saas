# Guia de Setup Completo — CRM SaaS

## Como subir o app localmente

```bash
# Terminal 1 — API
cd C:\Users\OS\crm-saas\apps\api
pnpm dev

# Terminal 2 — Frontend
cd C:\Users\OS\crm-saas\apps\web
pnpm dev

# Acesse: http://localhost:3000
```

---

## Passo 1 — Webhook do Clerk (CRÍTICO)

Sem isso: usuários criados no Clerk não são salvos no banco → app quebra.

1. Acesse https://dashboard.clerk.com
2. Selecione seu app → **Webhooks** → **Add Endpoint**
3. URL: `https://srv1663592.hstgr.cloud/api/webhooks/clerk` (produção)
   - Para teste local com ngrok: `https://SEU-NGROK.ngrok.io/webhooks/clerk`
4. Marque estes eventos:
   - `user.created`
   - `user.updated`
   - `organization.created`
   - `organization.membership.created`
   - `organization.membership.deleted`
5. Salve e copie o **Signing Secret** (começa com `whsec_...`)
6. Cole em `apps/api/.env`:
   ```
   CLERK_WEBHOOK_SECRET=whsec_SEU_SECRET_AQUI
   ```

---

## Passo 2 — Webhook do Stripe (CRÍTICO)

Sem isso: pagamentos não ativam assinatura no banco.

1. Acesse https://dashboard.stripe.com → **Developers** → **Webhooks**
2. Clique **Add endpoint**
3. URL: `https://srv1663592.hstgr.cloud/api/webhooks/stripe`
4. Marque estes eventos:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
5. Salve e copie o **Signing secret**
6. Cole em `apps/api/.env`:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_SEU_SECRET_AQUI
   ```

---

## Passo 3 — Email com Resend

1. Acesse https://resend.com → crie conta
2. Vá em **API Keys** → **Create API Key**
3. Cole em `apps/api/.env`:
   ```
   RESEND_API_KEY=re_SEU_KEY_AQUI
   EMAIL_FROM_DOMAIN=seudominio.com
   ```
4. Em **Domains** → adicione e verifique seu domínio de envio

---

## Passo 4 — Deploy na VPS (Easypanel)

### Opção A — Via Easypanel (recomendado)

1. Acesse o painel do Easypanel na sua VPS
2. Crie um novo **App** → tipo **Docker Compose**
3. Cole o conteúdo do `docker-compose.yml` do projeto
4. Configure as variáveis de ambiente (copie do `.env`):

```env
# Copie os valores do arquivo .env.easypanel (não commitado no git)
DATABASE_URL=SEU_DATABASE_URL_SUPABASE
REDIS_URL=SEU_REDIS_URL_UPSTASH
CLERK_SECRET_KEY=SEU_CLERK_SECRET_KEY
CLERK_WEBHOOK_SECRET=SEU_CLERK_WEBHOOK_SECRET
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=SEU_CLERK_PUBLISHABLE_KEY
STRIPE_SECRET_KEY=SEU_STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET=SEU_STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_STARTER=SEU_PRICE_STARTER
STRIPE_PRICE_PRO=SEU_PRICE_PRO
STRIPE_PRICE_AGENCY=SEU_PRICE_AGENCY
ZAPI_CLIENT_TOKEN=SEU_ZAPI_TOKEN
RESEND_API_KEY=SEU_RESEND_KEY
EMAIL_FROM_DOMAIN=noreply.seudominio.com
DOMAIN=srv1663592.hstgr.cloud
NEXT_PUBLIC_API_URL=https://srv1663592.hstgr.cloud/api
WEB_URL=https://srv1663592.hstgr.cloud
```

5. Deploy → aguardar build
6. Atualizar webhooks do Clerk e Stripe para `https://srv1663592.hstgr.cloud/api/webhooks/...`

### Opção B — Via SSH direto

```bash
ssh root@srv1663592.hstgr.cloud
git clone https://github.com/SEU-REPO/crm-saas.git
cd crm-saas
cp .env.example .env
# editar .env com os valores acima
docker compose up -d --build
```

---

## Checklist final antes de ir ao ar

- [ ] Webhook Clerk configurado e testado
- [ ] Webhook Stripe configurado e testado  
- [ ] RESEND_API_KEY preenchida
- [ ] Deploy na VPS feito
- [ ] Clerk e Stripe em modo PRODUÇÃO (trocar sk_test_ por sk_live_)
- [ ] Domínio apontando para a VPS

---

## Retomar com Claude

Quando voltar, diga: **"vamos continuar o CRM"** — o Claude vai recuperar o contexto automaticamente.

Features que ainda faltam implementar:
1. Módulo Pipeline/Deals
2. Campos customizados nos leads
3. Deduplicação de leads
4. Viewer do Audit Log
