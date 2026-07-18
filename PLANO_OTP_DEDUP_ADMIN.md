# D'Griffe — Plano de Implementação: Login OTP · Cadastro sem duplicar na LI · Detalhe do Cliente no Admin

> **Status:** PLANEJAMENTO (nada foi editado). Data: 2026-07-16.
> **Repositório:** `D:\loja-integrada-conectada\loja-integrada-conectada`
> **Princípios:** não quebrar o app atual · não expor segredos no front · OTP atrás de feature flag (`VITE_AUTH_MODE`, default `none`) · manter `DEMO_MODE` funcionando · seguir os padrões dos hooks existentes (`useCliente`, `usePedidos`, `useFidelidade`).

---

## 0. Decisões de arquitetura (resumo)

| Item | Decisão | Por quê |
|---|---|---|
| 1. Anti-duplicação na LI | **Server-side** em `server/index.mjs` (`POST /api/clientes/upsert`) usando `chamarLI` + service_role (`server/db.ts`). | A LI não tem upsert por e-mail. Rodar no servidor centraliza a lógica, reusa as credenciais da LI que já estão só no backend, e não vaza nada para o front. |
| 2. Criação do `profiles` | **Trigger Postgres** `handle_new_user` em `auth.users` (padrão Supabase) + preenchimento dos campos extras via rota server-side. | Garante que toda conta OTP nasce com `profiles` antes do cadastro. Evita "row not found" na RLS. |
| 3. OTP | `supabase.auth.signInWithOtp` com `emailRedirectTo` para a rota `/perfil`. Feature flag `VITE_AUTH_MODE=otp|none`. | Deixa "pronto mas desligado" até o usuário configurar SMTP no Supabase. |
| 4. Detalhe do cliente no Admin | Nova aba "Clientes" no `AdminPage` + componente `AdminClientDetail` que lê do Supabase com **service_role** (server). | O admin já é HMAC; só adicionar um endpoint `/api/admin/cliente` que busca `profiles`, `fidelidade` e `pedidos` (tabela do Supabase) pelo `email`/`li_cliente_id`. |

---

## (a) Arquivos a criar / modificar

### Criar
| Caminho | Conteúdo |
|---|---|
| `src/hooks/useClienteSupabase.ts` | Hook de login OTP + estado de sessão (espelha assinatura de `useCliente`). |
| `src/components/admin/AdminClientDetail.tsx` | Tela de detalhe: dados do `profiles`, pedidos e saldo de fidelidade. |
| `src/services/adminCliente.ts` | Função `buscarClienteAdmin` (mesmo padrão de `src/services/admin.ts`). |
| `supabase/02-profiles-trigger.sql` | Trigger `handle_new_user` + função `public.handle_new_user`. |
| `src/lib/flags.ts` | Helper central da feature flag `VITE_AUTH_MODE`. |

### Modificar
| Caminho | O que muda |
|---|---|
| `src/vite-env.d.ts` | Adiciona `VITE_AUTH_MODE: string` e `VITE_LOJA_INTEGRADA_PROXY_URL` na `ImportMetaEnv`. |
| `.env` (raiz) | Adiciona `VITE_AUTH_MODE=none`. |
| `.env.example` | Documenta `VITE_AUTH_MODE`. |
| `src/pages/ProfilePage.tsx` | Gate por feature flag: se `otp`, usa `useClienteSupabase` + formulário de cadastro; senão mantém `useCliente` atual. |
| `src/pages/AdminPage.tsx` | Nova aba "Clientes" + integração com `AdminClientDetail`. |
| `server/index.mjs` | Novo endpoint `POST /api/clientes/upsert` (público, validado) + `GET /api/admin/cliente` (requireAdmin). |
| `supabase/schema.sql` | (conferir) garantir colunas `cpf` e `endereco` em `profiles`. |

---

## (b) Trechos de código-chave

### 1. Feature flag

**`src/vite-env.d.ts`** — adicionar à interface:
```ts
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON: string;
  readonly VITE_SUPABASE_FUNCTIONS: string;
  readonly VITE_LOJA_INTEGRADA_PROXY_URL: string;
  /** "otp" liga login por e-mail OTP (Supabase Auth). Qualquer outro valor = desligado. Default "none". */
  readonly VITE_AUTH_MODE: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

**Helper central de flag** (`src/lib/flags.ts`):
```ts
export const AUTH_MODE_OTP = (import.meta.env.VITE_AUTH_MODE ?? "none") === "otp";
```

**`.env`** (raiz) — adicionar:
```env
VITE_AUTH_MODE=none
```
> Quando o usuário configurar SMTP no Supabase, basta trocar para `VITE_AUTH_MODE=otp` (e rebuildar). Nada mais no front precisa mudar.

---

### 2. Hook `useClienteSupabase` (novo — `src/hooks/useClienteSupabase.ts`)

Segue o padrão de `useCliente.ts` (`useState`/`useCallback`), mas usa Supabase Auth OTP.

```ts
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export interface ClienteSupabase {
  id: string;            // auth.users.id === profiles.id
  email: string;
  nome?: string | null;
  telefone?: string | null;
  cpf?: string | null;
  li_cliente_id?: number | null;
  endereco?: Record<string, string> | null;
  precisaCompletarCadastro: boolean; // true na 1ª confirmação (profile sem nome)
}

export function useClienteSupabase() {
  const [cliente, setCliente] = useState<ClienteSupabase | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) carregarPerfil(data.session.user.id);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) carregarPerfil(session.user.id);
      else setCliente(null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const carregarPerfil = useCallback(async (uid: string) => {
    setLoading(true);
    try {
      const { data, error: e } = await supabase
        .from("profiles")
        .select("id,email,nome,telefone,cpf,li_cliente_id,endereco")
        .eq("id", uid)
        .single();
      if (e) throw e;
      setCliente({ ...(data as any), precisaCompletarCadastro: !data?.nome });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Passo 1: envia o código OTP para o e-mail. */
  const enviarCodigo = useCallback(async (email: string) => {
    setLoading(true); setError(null);
    try {
      const { error: e } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/#/perfil` },
      });
      if (e) throw e;
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Passo 2 (após o redirect do e-mail): conclui o cadastro na 1ª vez. */
  const completarCadastro = useCallback(
    async (dados: { nome: string; cpf?: string; telefone?: string; endereco?: Record<string, string> }) => {
      setLoading(true); setError(null);
      try {
        const uid = (await supabase.auth.getUser()).data.user?.id;
        if (!uid) throw new Error("Sessão não encontrada.");
        const email = cliente?.email ?? "";
        const res = await fetch(
          `${import.meta.env.VITE_LOJA_INTEGRADA_PROXY_URL?.replace(/\/api\/loja-integrada\/?$/, "")}/api/clientes/upsert`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uid, email, ...dados }),
          }
        );
        if (!res.ok) throw new Error(`Falha no cadastro (${res.status})`);
        await carregarPerfil(uid);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [cliente]
  );

  const sair = useCallback(async () => {
    await supabase.auth.signOut();
    setCliente(null);
  }, []);

  return { cliente, loading, error, enviarCodigo, completarCadastro, sair };
}
```

> **Compatibilidade:** `useCliente` (LI) continua existindo para `VITE_AUTH_MODE !== "otp"`. O `ProfilePage` escolhe o hook conforme a flag.

---

### 3. Rota server-side de deduplicação (`server/index.mjs`)

Adicionar **antes** de `app.listen(...)`. Reusa `chamarLI` (já existe) e `sb` (service_role, em `db.ts`).

```js
// CADASTRO DE CLIENTE COM DEDUPLICAÇÃO NA LOJA INTEGRADA (regra rígida)
// Busca por e-mail -> se achar, reaproveita li_cliente_id; senão cria.
// Tudo server-side: nenhuma chave da LI ou service_role vai ao front.
app.post("/api/clientes/upsert", async (req, res) => {
  const { uid, email, nome, cpf, telefone, endereco } = req.body || {};
  const e = String(email || "").trim().toLowerCase();
  if (!uid || !e || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) {
    return res.status(400).json({ erro: "uid e e-mail válidos são obrigatórios." });
  }
  if (DEMO) return res.json({ ok: true, li_cliente_id: 1, duplicado: false });
  if (!sb) {
    return res.status(503).json({ erro: "Backend sem Supabase configurado (SUPABASE_SERVICE_ROLE)." });
  }

  try {
    let liClienteId = null;
    const busca = await chamarLI("GET", "cliente", undefined, { email: e, limit: 1 });
    if (busca.status === 200 && Array.isArray(busca.payload?.objects) && busca.payload.objects.length > 0) {
      liClienteId = busca.payload.objects[0].id;
    } else if (!LOJA_INTEGRADA_APP_KEY || !LOJA_INTEGRADA_API_KEY) {
      liClienteId = null; // sem credenciais da LI: segue só com profile do Supabase
    } else {
      const payload = {
        tipo: "PF",
        nome: nome || e,
        email: e,
        ...(cpf ? { cpf: cpf.replace(/\D/g, "") } : {}),
        ...(telefone ? { telefone_celular: telefone } : {}),
      };
      const criado = await chamarLI("POST", "cliente", undefined, {}, payload);
      if (criado.status === 201 || criado.status === 200) liClienteId = criado.payload?.id ?? null;
    }

    const { error } = await sb.from("profiles").upsert(
      {
        id: uid, email: e, nome: nome || null, telefone: telefone || null,
        cpf: cpf || null, li_cliente_id: liClienteId, endereco: endereco || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
    if (error) throw error;
    return res.json({ ok: true, li_cliente_id: liClienteId, duplicado: liClienteId !== null });
  } catch (err) {
    console.error("[clientes/upsert] erro:", err);
    return res.status(502).json({ erro: "Falha ao sincronizar o cliente com a loja." });
  }
});
```

> **DEMO:** o branch `if (DEMO)` retorna fictício para não quebrar o fluxo de testes.

---

### 4. Backend do Detalhe do Cliente no Admin (`server/index.mjs`)

```js
// DETALHE DO CLIENTE (admin) — lê do Supabase com service_role.
app.get("/api/admin/cliente", requireAdmin, async (req, res) => {
  const email = String(req.query.email || "").trim().toLowerCase();
  const liId = req.query.li_cliente_id ? Number(req.query.li_cliente_id) : null;
  if (!email && !liId) return res.status(400).json({ erro: "Informe email ou li_cliente_id." });
  if (!sb) return res.status(503).json({ erro: "Supabase não configurado." });

  try {
    let perfilQ = sb.from("profiles").select("*");
    perfilQ = email ? perfilQ.eq("email", email) : perfilQ.eq("li_cliente_id", liId);
    const { data: perfil, error: ep } = await perfilQ.maybeSingle();
    if (ep) throw ep;

    const emailKey = perfil?.email || email;
    const [pontos, regras] = await Promise.all([
      segredos.getPontos(emailKey),
      segredos.getRegrasFidelidade(),
    ]);

    let pedidosSupa = [];
    if (perfil?.id) {
      const { data } = await sb.from("pedidos").select("*")
        .eq("cliente_id", perfil.id).order("created_at", { ascending: false });
      pedidosSupa = data || [];
    }

    return res.json({
      perfil: perfil || null,
      fidelidade: { pontos, regras, desconto_max: Math.floor((pontos / regras.pontosPorDesconto) * 10) },
      pedidos_supabase: pedidosSupa,
      fonte_pedidos: pedidosSupa.length ? "supabase" : "li",
    });
  } catch (err) {
    console.error("[admin/cliente] erro:", err);
    return res.status(502).json({ erro: "Falha ao carregar o cliente." });
  }
});
```

---

### 5. Front: `adminCliente.ts` + `AdminClientDetail.tsx`

**`src/services/adminCliente.ts`** (espelha `src/services/admin.ts`):
```ts
import { getAdminToken } from "./admin";

const PROXY_BASE_URL =
  (import.meta.env.VITE_LOJA_INTEGRADA_PROXY_URL as string | undefined)?.replace(/\/api\/loja-integrada\/?$/, "") || "";
const ADMIN_BASE_URL = `${PROXY_BASE_URL}/api/admin`;

export interface ClienteAdminDetalhe {
  perfil: {
    id: string; email: string; nome: string | null; telefone: string | null;
    cpf: string | null; li_cliente_id: number | null; endereco: any;
  } | null;
  fidelidade: { pontos: number; regras: { pontosPorReal: number; pontosPorDesconto: number }; desconto_max: number };
  pedidos_supabase: any[];
  fonte_pedidos: "supabase" | "li";
}

export async function buscarClienteAdmin(opts: { email?: string; li_cliente_id?: number }): Promise<ClienteAdminDetalhe> {
  const params = new URLSearchParams();
  if (opts.email) params.set("email", opts.email);
  if (opts.li_cliente_id) params.set("li_cliente_id", String(opts.li_cliente_id));
  const token = getAdminToken();
  const res = await fetch(`${ADMIN_BASE_URL}/cliente?${params.toString()}`, {
    headers: { Authorization: token ? `Bearer ${token}` : "" },
  });
  if (!res.ok) throw new Error(`Admin ${res.status}`);
  return res.json();
}
```

**`src/components/admin/AdminClientDetail.tsx`** (usa `formatPrice` de `../utils`, padrão visual do `AdminPage`):
```tsx
import { useEffect, useState } from "react";
import { formatPrice } from "../../utils";
import { buscarClienteAdmin, type ClienteAdminDetalhe } from "../../services/adminCliente";

export default function AdminClientDetail({ email, li_cliente_id, onClose }: {
  email?: string; li_cliente_id?: number; onClose: () => void;
}) {
  const [d, setD] = useState<ClienteAdminDetalhe | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    buscarClienteAdmin({ email, li_cliente_id })
      .then((r) => !cancel && setD(r))
      .catch((e) => !cancel && setErro(e.message))
      .finally(() => !cancel && setLoading(false));
    return () => { cancel = true; };
  }, [email, li_cliente_id]);

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-end justify-center" onClick={onClose}>
      <div className="w-full max-w-lg bg-white rounded-t-3xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white px-5 py-3 flex items-center justify-between border-b border-gray-100">
          <h3 className="text-sm font-bold text-luxury-black">Detalhe do Cliente</h3>
          <button onClick={onClose} className="text-gray-400 text-xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-4">
          {loading && <div className="text-center text-xs text-gray-400 py-4">Carregando...</div>}
          {erro && <div className="text-[11px] text-red-500">{erro}</div>}
          {d && (
            <>
              <section className="bg-ice rounded-2xl p-3">
                <p className="text-[11px] font-semibold text-luxury-black mb-2">Dados</p>
                <Linha k="Nome" v={d.perfil?.nome || "—"} />
                <Linha k="E-mail" v={d.perfil?.email || email || "—"} />
                <Linha k="Telefone" v={d.perfil?.telefone || "—"} />
                <Linha k="CPF" v={d.perfil?.cpf || "—"} />
                <Linha k="ID Loja Integrada" v={d.perfil?.li_cliente_id != null ? String(d.perfil.li_cliente_id) : "—"} />
                {d.perfil?.endereco && <Linha k="Endereço" v={Object.values(d.perfil.endereco).filter(Boolean).join(", ")} />}
              </section>
              <section className="bg-white border border-gray-100 rounded-2xl p-3">
                <p className="text-[11px] font-semibold text-luxury-black mb-1">Fidelidade</p>
                <p className="text-[11px] text-gray-600">{d.fidelidade.pontos} pts · {formatPrice(d.fidelidade.desconto_max)} de desconto</p>
              </section>
              <section className="bg-white border border-gray-100 rounded-2xl p-3">
                <p className="text-[11px] font-semibold text-luxury-black mb-2">Pedidos ({d.pedidos_supabase.length})</p>
                {d.pedidos_supabase.length === 0 && <p className="text-[11px] text-gray-400">Nenhum pedido.</p>}
                {d.pedidos_supabase.map((p: any) => (
                  <div key={p.id} className="flex justify-between text-[11px] py-1 border-b border-gray-50 last:border-0">
                    <span className="text-gray-600 truncate">{p.numero || p.id}</span>
                    <span className="text-luxury-black font-medium">{formatPrice(Number(p.total) || 0)}</span>
                  </div>
                ))}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Linha({ k, v }: { k: string; v?: string | null }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-400">{k}</span>
      <span className="text-xs font-semibold text-luxury-black text-right max-w-[60%] truncate">{v || "—"}</span>
    </div>
  );
}
```

**`src/pages/AdminPage.tsx`** — adicionar `"clientes"` em `type Aba`; reaproveitar o padrão de `selecionado`/`detalhe` usado para pedidos:
```tsx
const [clienteSelecionado, setClienteSelecionado] = useState<{ email?: string; li_cliente_id?: number } | null>(null);
// na lista de clientes do relatório:
<button onClick={() => setClienteSelecionado({ email: c.email })}>Ver detalhe</button>
// montar <AdminClientDetail .../> quando clienteSelecionado !== null (mesmo padrão do drawer de pedido)
```

---

### 6. Trigger de `profiles` (`supabase/02-profiles-trigger.sql`)

```sql
-- Garante que toda conta OTP (auth.users) nasce com um profiles.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, created_at)
  values (new.id, new.email, now())
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

> O `schema.sql` já cria `profiles(id, nome, email, telefone, li_cliente_id, created_at)`. **Verificar** se `cpf` e `endereco` existem; se não:
> ```sql
> alter table public.profiles add column if not exists cpf text;
> alter table public.profiles add column if not exists endereco jsonb;
> ```

---

## (c) Ordem de execução

1. **SQL (Supabase):** aplicar `02-profiles-trigger.sql` + `alter table` de `cpf`/`endereco`. RLS (`profiles_self`) já existe; trigger usa `security definer`, ok.
2. **Backend dedup:** adicionar `POST /api/clientes/upsert` em `server/index.mjs` (com branch `DEMO`).
3. **Backend detalhe admin:** adicionar `GET /api/admin/cliente` em `server/index.mjs`.
4. **Front flag:** `src/vite-env.d.ts` + `src/lib/flags.ts` + `.env`/`.env.example` (`VITE_AUTH_MODE=none`).
5. **Hook OTP:** criar `src/hooks/useClienteSupabase.ts`.
6. **ProfilePage:** gate por flag — `otp` usa `useClienteSupabase` + formulário de cadastro (nome, CPF, telefone, endereço) que chama `completarCadastro`; `none` mantém `useCliente` atual (LI).
7. **Admin detalhe:** `src/services/adminCliente.ts` + `src/components/admin/AdminClientDetail.tsx` + aba no `AdminPage`.
8. **Validar** (seção d).

---

## (d) Como validar

### TypeScript (sem quebrar)
```bash
cd D:\loja-integrada-conectada\loja-integrada-conectada
npx tsc --noEmit
```

### Build (atenção ao VS Code / handles do dist)
Renomear `dist/` antes do build (VS Code trava handles):
```bash
mv dist dist-old-$(date +%s) 2>/dev/null
npm run build
```

### Servidor + curl do proxy (dedup)
```bash
# terminal 1
ADMIN_PASSWORD=demo123 ADMIN_MOCK=1 npm run server   # ou DEMO_MODE=true

# terminal 2 — dedup
curl -s -X POST http://localhost:8787/api/clientes/upsert \
  -H "Content-Type: application/json" \
  -d '{"uid":"00000000-0000-0000-0000-000000000000","email":"cliente@demo.com.br","nome":"Maria Cliente Demo","cpf":"12345678900","telefone":"11999990000"}'
# Demo esperado: {"ok":true,"li_cliente_id":1,"duplicado":false}

# detalhe do cliente no admin
TOKEN=$(curl -s -X POST http://localhost:8787/api/admin/login -H "Content-Type: application/json" -d '{"senha":"demo123"}' | sed -E 's/.*"token":"([^"]+)".*/\1/')
curl -s "http://localhost:8787/api/admin/cliente?email=cliente@demo.com.br" -H "Authorization: Bearer $TOKEN"
```

### Fluxos funcionais (manual)
- **Flag off (`none`):** `ProfilePage` continua usando `useCliente` (LI) — app inalterado.
- **Flag on (`otp`) + sem SMTP:** `signInWithOtp` falha; UI mostra erro (esperado — "pronto mas desligado").
- **Flag on (`otp`) + SMTP OK:** envia código → redirect `/#/perfil` → `precisaCompletarCadastro=true` → formulário → `completarCadastro` → `POST /api/clientes/upsert` grava `li_cliente_id` sem duplicar.
- **Admin:** aba "Clientes" → buscar por e-mail → `AdminClientDetail` mostra dados + fidelidade + pedidos.

---

## (e) O que o usuário precisa configurar no painel do Supabase para ligar o OTP

1. **Auth → Providers → Email:** garantir "Email" habilitado (padrão ligado).
2. **SMTP (obrigatório):** `Authentication → Providers → Email → SMTP Settings`.
   - Opção A (recomendada): usar o **SMTP nativo do Supabase** (toggle "Use Supabase's SMTP server").
   - Opção B: SMTP próprio (Host, Port, User, Password, Sender). Sem SMTP válido, `signInWithOtp` falha — exatamente o que a flag `VITE_AUTH_MODE=none` protege hoje.
3. **Redirect URLs (importante):** `Authentication → URL Configuration → Redirect URLs`:
   - `http://localhost:5173/#/perfil` (dev Vite)
   - `http://localhost:8787/#/perfil` (via proxy)
   - URL de produção + `/#/perfil` (ex.: `https://seudominio.com/#/perfil`)
   - Confirmar `Site URL` correta.
4. **Depois de tudo OK:** trocar `VITE_AUTH_MODE=none` → `VITE_AUTH_MODE=otp` no `.env` da raiz e **rebuildar**. Nada no Supabase precisa de novo deploy para isso.
5. **(Opcional) Templates:** `Authentication → Templates → Magic Link / Confirmation` em pt-BR.

> **RLS:** `profiles` já tem `profiles_self` (próprio ou admin). O `POST /api/clientes/upsert` escreve com **service_role** (bypass RLS) — seguro pois roda só no servidor. O front lê o próprio `profiles` via anon + sessão (RLS isola).

---

## Riscos / pontos de atenção
- **Email Redirect + SPA hash:** o Supabase adiciona `?code=...` na query. Como o app usa hash routing (`#/perfil`), garantir `emailRedirectTo` terminando em `#/perfil` e que `supabase.auth` processe o token ao montar `ProfilePage`. Testar no navegador é obrigatório.
- **DEMO_MODE:** manter `if (DEMO) return ...` no `/api/clientes/upsert`.
- **CPF/endereco em profiles:** confirmar colunas antes de aplicar o trigger.
- **VS Code handles:** renomear `dist/` antes de `npm run build`.
