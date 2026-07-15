# Plano: Loja Integrada Conectada → Supabase + Mercado Pago

## Objetivo
Substituir o servidor Express local por **Supabase** (Edge Functions + Postgres + Auth)
e fechar o ciclo de venda com **Mercado Pago** transparente, ficando 100% dentro do app
(sem redirecionar o usuário para sites externos). O admin poderá colar as chaves das APIs
(Loja Integrada + Mercado Pago) pela própria interface.

## Princípios
- Chaves secretas NUNCA vão pro front. Ficam em: (a) Secrets das Edge Functions, OU
  (b) tabela `store_config` no Postgres (preenchida pelo admin via UI, protegida por RLS).
- Front conecta só com URL + anon key do Supabase.
- Manter compatibilidade: o front continua chamando `/api/loja-integrada/*` e `/api/admin/*`,
  mas agora esses paths são as Edge Functions do Supabase.

## Etapa 0 — Inputs do usuário (obrigatórios, não inventáveis)
- SUPABASE_URL (ex.: https://xxxx.supabase.co)
- SUPABASE_ANON_KEY
- Os segredos a seguir o usuário preenche no painel do Supabase (Settings → Secrets),
  NÃO precisam ser compartilhados com o agente:
  - SUPABASE_SERVICE_ROLE_KEY
  - MERCADO_PAGO_ACCESS_TOKEN
  - LI_APP_KEY / LI_API_KEY (também podem ser setados pelo admin na UI)

## Etapa 1 — Esquema Postgres (SQL a rodar no Supabase SQL Editor)
- `store_config` (chave/valor tipado): guarda LI_APP_KEY, LI_API_KEY, MP_TOKEN, ADMIN_PASSWORD.
  RLS: leitura pública p/ valores não-secretos; escrita só para role admin (via is_admin()).
- `profiles` (id uuid PK = auth.users.id, nome, email, telefone, li_cliente_id).
- `pedidos` (id, numero, cliente_id, status, total, verificado bool, verificado_em timestamptz,
  payload jsonb) — substitui o .admin-state.json e o mock em memória.
- `admin_users` (user_id uuid) + função SQL `is_admin()` para RLS.
- Habilitar Supabase Auth (Email/Password) para admins.

## Etapa 2 — Edge Functions (Deno, deploy via Supabase CLI)
- `li-proxy`: faz proxy da Loja Integrada lendo LI_APP_KEY/LI_API_KEY de store_config
  (ou Secrets). Suporta GET/POST de produto/categoria/marca/cliente/pedido. Mantém modo demo
  se as chaves estiverem vazias (usa fixtures).
- `admin`: login (verifica ADMIN_PASSWORD de store_config e gera JWT próprio OU usa Supabase
  Auth admin), listar/buscar pedidos, mudar status, marcar verificado (persiste em `pedidos`).
- `config`: GET/PUT de store_config (salvar chaves das APIs pela UI do admin — RLS admin only).
- `checkout-mp`: recebe carrinho + cliente; cria pedido na Loja Integrada (se chaves presentes)
  E cria pagamento PIX/cartão no Mercado Pago via API backend; devolve ao app:
  `{ pix_qr_base64, pix_copia_cola, init_point (cartão), pedido_id }`.
  → app mostra QR Code de PIX ou formulário de cartão DENTRO do app (sem sair).

## Etapa 3 — Front-end (React/Vite)
- Adicionar `@supabase/supabase-js`; criar `src/lib/supabase.ts` com URL+anon das env vars
  (VITE_SUPABASE_URL / VITE_SUPABASE_ANON).
- Criar cliente Supabase e apontar serviços para as Edge Functions:
  - `src/services/lojaIntegrada/client.ts`: BASE_URL vira `<SUPABASE_URL>/functions/v1/li-proxy`.
  - `src/services/admin.ts`: BASE_URL vira `<SUPABASE_URL>/functions/v1/admin`.
- **Admin "Configurações de API"**: nova tela no AdminPage para colar LI_APP_KEY, LI_API_KEY,
  MP token, ADMIN_PASSWORD → chama Edge `config` (salva em store_config).
- **Checkout dentro do app**: CartDrawer "Finalizar Compra" → abre `CheckoutDrawer` que chama
  `checkout-mp`; mostra PIX (QR + copia-e-cola) ou cartão transparente. Sem sair do app.
- Login admin: migrar de senha HMAC local para Supabase Auth (ou manter via store_config).

## Etapa 4 — Deploy e verificação
- `supabase init` + link ao projeto; `supabase db push` (SQL); `supabase functions deploy`.
- Setar Secrets no painel. Testar: produtos carregam, login admin, salvar chaves pela UI,
  checkout PIX gera QR dentro do app.
- Manter o `server/` Express como fallback local opcional (não remover ainda).

## Riscos / honestidade
- Mercado Pago cartão transparente exige dados de PCI no front (MP SDK cuida tokenização).
- Loja Integrada pode não aceitar criar pedido pago direto; pode ser necessário criar pedido
  na LI e pagar via MP separado (pedido fica "aguardando" até MP confirmar via webhook).
- Webhook MP → confirmar pedido na LI e marcar `pedidos.verificado` (Etapa futura).

## Ordem de execução
1. Coletar SUPABASE_URL + ANON do usuário.
2. Escrever + aplicar SQL (Etapa 1).
3. Escrever Edge Functions (Etapa 2) e fazer deploy.
4. Ajustar front (Etapa 3).
5. Verificar ponta a ponta (Etapa 4).
