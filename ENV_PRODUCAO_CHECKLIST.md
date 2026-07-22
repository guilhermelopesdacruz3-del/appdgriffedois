# ============================================================
# VARIÁVEIS DE AMBIENTE — PRODUÇÃO (NUNCA COMITE VALORES REAIS)
# ============================================================
# Preencha estes valores nos PAINÉIS de cada serviço (não neste arquivo).
# Este é só o CHECKLIST do que cada provedor precisa.

# ---- Render (proxy / backend) ----
# Painel: https://dashboard.render.com > dgriffe-proxy > Environment
LI_APP_KEY=                  # chave real da Loja Integrada
LI_API_KEY=                  # chave real da Loja Integrada
SUPABASE_URL=                # https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE=       # SERVICE_ROLE (server-only, NUNCA no front)
ADMIN_PASSWORD=              # senha FORTE do admin (não use demo123)
ADMIN_SECRET=                # string aleatória longa (ex.: openssl rand -hex 32)
DEMO_MODE=false
FRONTEND_ORIGIN=https://SEU-SITE.netlify.app   # CORS do front
PORT=10000                   # o Render injeta em runtime

# ---- Netlify (front) ----
# Painel: Site settings > Environment variables
# OBRIGATÓRIAS (sem elas o app abre em branco: "supabaseUrl is required"):
VITE_SUPABASE_URL=https://unpbvztvscuisqnzofqp.supabase.co
VITE_SUPABASE_ANON=sb_publishable_olC8FxBz8o2jlTNgQmT9vw_Q_UhfDOY
VITE_SUPABASE_FUNCTIONS=https://unpbvztvscuisqnzofqp.supabase.co/functions/v1
VITE_LOJA_INTEGRADA_PROXY_URL=https://appdgriffedois.onrender.com/api/loja-integrada

# ---- Mercado Pago ----
# Vão pelo PAINEL ADMIN do app (aba APIs) -> gravados no Supabase (store_config):
#   MP_ACCESS_TOKEN   (produção, após aprovação de conta com CNPJ)
#   MP_PUBLIC_KEY     (para o SDK de cartão no front)
# NÃO coloque o access_token em variáveis de ambiente do Render.

# ============================================================
# COMO ATUALIZAR QUANDO VOCÊ QUISER
# ============================================================
# 1) Edite o código (ou peça à IA) e faça commit na branch main.
# 2) O GitHub Actions (deploy.yml) roda: type-check + build + deploy.
# 3) Netlify publica o front; Render publica o proxy. Sem passos manuais.
# Para forçar um deploy sem mudar código: Actions > Deploy D'Griffe > Run workflow.
