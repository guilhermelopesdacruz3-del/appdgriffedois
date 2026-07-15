# 📁 hermes app — Arquivos criados nesta sessão

Pasta de backup/pesquisa de tudo que o Hermes gerou para o projeto
**loja-integrada-conectada** (D'Griffe ótica) na migração para
**Supabase + Mercado Pago**.

> Projeto original: `C:\Users\yasmi\Downloads\loja-integrada-conectada\loja-integrada-conectada\`
> Gerado em: 15/07/2026

---

## 🔍 ÍNDICE RÁPIDO (busque por palavra-chave)

| Palavra-chave | Arquivo | O que é |
|---|---|---|
| `schema` `tabelas` `sql` `RLS` | `supabase/schema.sql` | Cria tabelas no Postgres (store_config, pedidos, profiles, admin_users) + RLS |
| `proxy` `loja integrada` `LI` `api` | `supabase/functions/li-proxy/index.ts` | Edge Function que substitui o Express local (proxy da API da LI) |
| `checkout` `pagamento` `pix` `mercado pago` `mp` | `supabase/functions/checkout-mp/index.ts` | Edge Function que cria pedido + cobrança PIX no Mercado Pago |
| `config` `chaves` `admin` `salvar api` | `supabase/functions/config/index.ts` | Edge Function GET/PUT das chaves das APIs (admin cola pela UI) |
| `cliente supabase` `createClient` `fetch fn` | `src/lib/supabase.ts` | Cliente Supabase do front (anon) + helper `callFn` |
| `apiConfig` `getApiConfigStatus` `saveApiConfig` `iniciarCheckout` | `src/services/apiConfig.ts` | Serviço do front que chama as Edge Functions |
| `CheckoutDrawer` `tela pagamento` `qr` `copia e cola` | `src/components/CheckoutDrawer.tsx` | Drawer de checkout DENTRO do app (PIX/cartão, não sai da tela) |
| `CartDrawer` `finalizar compra` `onCheckout` | `src/components/CartDrawer.tsx` | Editado: botão Finalizar Compra agora chama o checkout |
| `App` `estado checkout` | `src/App.tsx` | Editado: estado `checkoutOpen` + render do CheckoutDrawer |
| `AdminPage` `APIs` `ApiConfigPanel` | `src/pages/AdminPage.tsx` | Editado: botão "APIs" + painel onde admin cola as chaves |
| `env` `VITE_SUPABASE` `url` `anon` | `.env.front` | Variáveis do front (URL + publishable key do Supabase) |
| `mcp` `supabase mcp` | `.mcp.json` | Config do MCP Supabase (NÃO carregou nesta sessão) |
| `tipos` `ImportMetaEnv` | `src/vite-env.d.ts` | Tipagem das env vars do Vite |

---

## 📋 STATUS DE VERIFICAÇÃO

| Arquivo | Verificado? | Como |
|---|---|---|
| `src/lib/supabase.ts` | ✅ compila | `npm run build` (102 modules) |
| `src/services/apiConfig.ts` | ✅ compila | `npm run build` |
| `src/components/CheckoutDrawer.tsx` | ✅ compila | `npm run build` |
| `src/components/CartDrawer.tsx` | ✅ compila | `npm run build` |
| `src/App.tsx` | ✅ compila | `npm run build` |
| `src/pages/AdminPage.tsx` | ✅ compila | `npm run build` |
| `supabase/schema.sql` | ⚠️ NÃO aplicado | depende de você rodar no SQL Editor |
| `supabase/functions/*` | ⚠️ NÃO deployado | depende de `supabase functions deploy` |
| `supabase/schema.sql` (sintaxe) | ✅ válido | inspeção + guia oficial Supabase skill |

**Build final:** `✓ built in 6.31s` · 102 modules · dist 586 kB (gzip 154 kB)

---

## 🚀 PRÓXIMOS PASSOS (PENDENTES SUAS)

1. **Aplicar SQL** — cole `supabase/schema.sql` no SQL Editor do Supabase → Run
2. **Criar admin** — Authentication → Users → Add user (me passa o e-mail)
3. **Definir Secrets** — Settings → Edge Functions:
   - `SUPABASE_URL` = https://unpbvztvscuisqnzofqp.supabase.co
   - `SUPABASE_SERVICE_ROLE_KEY` = [secret key do painel]
   - `LI_APP_KEY`, `LI_API_KEY`, `MP_ACCESS_TOKEN` = (vazios; preenche pela UI ou aqui)
4. **Deploy das Edge Functions**:
   ```
   supabase functions deploy li-proxy
   supabase functions deploy checkout-mp
   supabase functions deploy config
   ```
5. **Testar** no celular: http://192.168.2.102:5173/

---

## 🔑 DADOS DO PROJETO (não sensíveis)

- Supabase URL: `https://unpbvztvscuisqnzofqp.supabase.co`
- Publishable key (pública, vai no front): `sb_publishable_olC8FxBz8o2jlTNgQmT9vw_Q_UhfDOY`
- Secret key: **NUNCA** vai pro código — só no painel como Secret.
- IP local do PC (p/ celular): `192.168.2.102`
- Portas: Vite `5173`, proxy antigo `8787`

---

## 🧠 DECISÕES DE ARQUITETURA

- **Modo demo mantido**: `li-proxy` cai no demo se as chaves da LI estiverem vazias.
- **Segurança (segundo skill oficial Supabase)**:
  - `is_admin()` é `SECURITY INVOKER` (não `DEFINER`) → evita função pública privilegiada.
  - Policies usam `TO authenticated` + predicado de posse (`auth.uid()`).
  - `GRANT` explícito pros roles (Data API exposure).
- **Pagamento dentro do app**: `CheckoutDrawer` mostra QR do PIX / form de cartão sem redirecionar.
- **Chaves pela UI**: admin cola LI + MP no painel; `config` Edge salva em `store_config` (RLS).
