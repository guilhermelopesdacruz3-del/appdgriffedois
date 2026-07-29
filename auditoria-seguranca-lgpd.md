# Auditoria de Segurança & LGPD — D'Griffe Ótica

**Data:** 2026-07-29  
**Escopo:** `C:\dgriffe-work` (frontend React+Vite, proxy Express, Supabase, deploy Netlify/Render/Cloudflare)  
**Foco:** dados sensíveis, banco, configurações inseguras, conformidade LGPD.

---

## Achados por severidade

### 🔴 CRITICAL

| # | Achado | Arquivo(s) | Impacto | Recomendação |
|---|--------|-----------|---------|--------------|
| C1 | **RLS Policies excessivamente permissivas** em `schema-fidelidade.sql`: `USING (true)` para `authenticated` em `fidelidade`, `fidelidade_historico`, `profiles`, `enderecos`. Qualquer usuário autenticado pode ler/alterar dados de **todos** os clientes (vazamento de pontos, CPF, telefone, endereço). | `supabase/schema-fidelidade.sql:36-46`, `supabase/migracao-familia-indicacoes.sql:21-45` | Vazamento massivo de PII e saldo de pontos. | Substituir `USING (true)` por policies por proprietário (`auth.uid() = user_id` ou `email = auth.uid()`) sincronizadas com `profiles`. Remover as policies broad e as `GRANT` para `authenticated`. |
| C2 | **CPF em texto puro** no Supabase (`profiles.cpf`) e na Loja Integrada, exibido no ProfilePage sem mascaramento. | `server/index.ts:1314`, `src/pages/ProfilePage.tsx:650,770-771` | Exposição direta de PII sensível (LGPD Art. 5º/7º). | Mascarar CPF na UI (`***.***.***-**` ou últimos 4 dígitos). Criptografar `cpf` no Supabase (pgcrypto/ahv). Coletar só se estritamente necessário e indicar finalidade. |
| C3 | **Token/admin e dados de cliente em localStorage sem criptografia**: `dgriffe:cliente_token` (access_token Supabase), `dgriffe:cliente` (nome, email, CPF), `dg_admin_token` (em cookie + sessionStorage). | `src/pages/ClienteCadastro.tsx:65,83-88`, `src/hooks/useCliente.tsx:47-153`, `src/utils/cookies.ts:56-61`, `src/services/cliente.ts:47` | XSS/roubo de sessão → acesso total à conta e admin. | Migrar tokens para `HttpOnly; Secure; SameSite=Strict` cookies no backend (refresh rotation). Criptografar dados sensíveis no localStorage ou evitar persistência de CPF. |

### 🟠 HIGH

| # | Achado | Arquivo(s) | Impacto | Recomendação |
|---|--------|-----------|---------|--------------|
| H1 | **CORS aberto por padrão no .env.example** (`FRONTEND_ORIGIN=*`). Em produção, se o deploy não sobrescrever, qualquer origem acessa `/api/*`. | `server/.env.example:19`, `server/index.ts:329-337` | CSRF / abuso de endpoints sensíveis (checkout, admin). | Remover `*` do exemplo. Validar `FRONTEND_ORIGIN` no startup e bloquear se for `*` em produção. |
| H2 | **Autenticação de cliente decodifica JWT sem validar assinatura** (`emailDoToken` base64-decodes payload sem verificar sig). | `server/index.ts:1482-1493` | Token forjado equivale a login de qualquer cliente. | Validar JWT com a `SUPABASE_JWT_SECRET` ou usar `sb.auth.getUser(token)`. |
| H3 | **Rate-limit de login em memória** (`Map` por IP). Em deploy multi-instância (Render/Railway), o bloqueio não é compartilhado. | `server/index.ts:113-140` | Ataques distribuídos de força bruta ao admin. | Persistir contadores em Redis/Upstash (já há `REDIS_URL` configurado). |
| H4 | **Mock data com PII real** (nomes, emails, números de pedidos fictícios mas plausíveis). | `server/index.ts:254-258` | Confusão operacional; em vazamento, parece real. | Limpar mock para dados genéricos (sem emails reais) se o arquivo for commitado. |
| H5 | **Fidelidade permite leitura por qualquer authenticated** (`schema-fidelidade.sql:36-38` → policy `svc_all_fidelidade`). Em multi-tenant por email, isso expõe saldo de pontos de terceiros. | `supabase/schema-fidelidade.sql:36-46` | Vazamento de pontos/histórico entre clientes. | Igual a C1: restringir por `email = auth.uid()` ou exigir service_role. |

### 🟡 MEDIUM

| # | Achado | Arquivo(s) | Impacto | Recomendação |
|---|--------|-----------|---------|--------------|
| M1 | **Cookie/admin sem `HttpOnly`** (`dg_admin_token`). Acessível via JavaScript (XSS). | `src/utils/cookies.ts:21-24` | Roubo de token admin via XSS. | Usar `HttpOnly; Secure; SameSite=Strict`. Movido para server-side session ou armazenar JWT em cookie HttpOnly. |
| M2 | **Logs no servidor contêm emails, IPs, dados de pagamento** (`webhook.ts:150`, `index.ts:415,1210,1357`). | `server/webhook.ts:150`, `server/index.ts:415,1210,1357` | PII ficando em logs; risco em vazamento/forense. | Sanitizar logs (não logar email completo; mascarar valores de pagamento; manter IP só para auditoria com retenção definida). |
| M3 | **Exclusão LGPD exige Supabase online**; se `sb` for `null`, o endpoint retorna 503 e o usuário não consegue excluir a conta. | `server/index.ts:1378-1474` |Descumprimento do direito à exclusão (LGPD Art. 18 III). | Permitir fluxo de exclusão mesmo em modo fallback (salvar solicitação para processamento posterior) ou nunca responder 503 para esse endpoint. |
| M4 | **Armazenamento local de `cliente_token` (access_token Supabase) sem rotação**. Se o token vazar, vale até expiração sem forma de revogar no cliente. | `src/pages/ClienteCadastro.tsx:64-66`, `src/utils/cookies.ts:70-72` | Sessão longa indevida após vazamento. | Implementar refresh token server-side + rotação automática. Revogar `sessionStorage` no logout. |
| M5 | **CSV de admin exporta PII bruto** (email, nome, CPF indireto) sem criptografia. | `server/index.ts:1597-1615` | Vazamento em download/forwarding. | Adicionar banner de classificação no CSV; opção de exportar sem PII para relatórios externos. |
| M6 | **`.env.front` commitado/referenciado** com `VITE_SUPABASE_ANON`. Não é secreto crítico, mas expõe o projeto Supabase. | `hermes app/.env.front:4`, `ENV_PRODUCAO_CHECKLIST.md:23` | Enumeração do alvo. | Manter anon em `.env.example` e injetar via painel CI (já é feito). Remover do `.env.front` se estiver versionado. |

### 🟢 LOW

| # | Achado | Arquivo(s) | Impacto | Recomendação |
|---|--------|-----------|---------|--------------|
| L1 | **CSP com `unsafe-inline`** (necessário para single-file build). | `server/index.ts:352-363` | XSS mais grave se houver injeção. | Planejar migração para nonce; enquanto isso, manter `X-XSS-Protection` e input sanitization. |
| L2 | **Fallback local `.store-config.json` / `.fidelidade.json`** no servidor com `chmod 0o600`. | `server/db.ts:48-58,139-151` | Se o host for compromise, arquivos locais expõem segredos. | Garantir que `.gitignore` cobre esses arquivos; em produção, banco é obrigatório. |
| L3 | **ADMIN_SECRET com fallback hardcoded** no código-fonte. | `server/index.ts:52,69`, `server/.env.example:26-28` | Se esquecer de configurar, tokens são forjáveis. | Já há bloqueio em produção; ok se mantido. |
| L4 | **Cookies de cliente sem `Secure` em HTTP** (apenas adiciona Secure quando https). | `src/utils/cookies.ts:21-24` | Transmissão em texto puro em HTTP. | Forçar HTTPS em produção (já há HSTS). Em dev, manter comportamento atual. |
| L5 | **`/api/mp-public-key` público** — chave pública do MP (esperado). | `server/index.ts:730-743` | Nenhum risco direto. | Manter como está; é comportamento correto do MP. |

---

## Visão LGPD

- **Base legal & consentimento:** cadastro pede aceite explícito dos Termos + Política (mockado como `true` no body). 👍
- **Minimização:** CPF e telefone são opcionais no cadastro, mas CPF é enviado para Loja Integrada e armazenado em texto puro. ⚠️
- **Retenção:** não há política TTL/expiração para `profiles`, `enderecos`, `notificacoes`, `fidelidade_historico`. Dados são mantidos indefinidamente. ⚠️
- **Direito à exclusão:** implementado (`/api/cliente/excluir-solicitar` + `/api/cliente/excluir-confirmar` com OTP), mas falha quando Supabase está indisponível (503). ⚠️
- **Portabilidade:** não identificado endpoint de exportação de dados do usuário (além do CSV admin). ⚠️
- **Segurança:** háHSTS, CSP, helmet, rate-limit e log de auditoria, mas coexistem com falhas de criptografia em repouso e transporte de tokens.

---

## Recomendações prioritárias (roadmap)

1. **Corrigir RLS imediatamente** — migrar policies broad por owner em todas as tabelas. Esse é o maior risco.
2. **Mascarar/criptografar CPF** e remover do localStorage.
3. **Forçar `HttpOnly` para cookies** no backend (`Set-Cookie: HttpOnly; Secure; SameSite=Strict`).
4. **Validar JWT corretamente** (`sb.auth.getUser`) no backend.
5. **Persistir rate-limit em Redis** (usar `REDIS_URL` já configurada).
6. **Sanitizar logs** e definir retenção (ex.: 90 dias).
7. **Garantir exclusão LGPD** sem dependência de Supabase online.
8. **Adicionar endpoint de exportação de dados** para o próprio usuário direto no app.

---

## Arquivos auditados (principais)

- `server/index.ts`, `server/db.ts`, `server/webhook.ts`, `server/.env.example`
- `src/services/cliente.ts`, `src/services/admin.ts`, `src/services/apiConfig.ts`
- `src/pages/ClienteCadastro.tsx`, `src/pages/ProfilePage.tsx`
- `src/utils/cookies.ts`, `src/types.ts`
- `supabase/schema.sql`, `supabase/schema-segredos.sql`, `supabase/schema-fidelidade.sql`, `supabase/migracao-familia-indicacoes.sql`
- `functions/api/[[path]].js`, `vite.config.ts`, `_routes.json`, `vercel.json`, `netlify.toml`, `railway.json`, `ENV_PRODUCAO_CHECKLIST.md`
