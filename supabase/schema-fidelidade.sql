-- ===========================================================================
-- Fidelidade D'Griffe (pontos por compra)
-- Aplica após o schema-segredos.sql. Idempotente.
-- Regra padrão: 1 ponto por real gasto; 100 pontos = R$ 10 de desconto.
-- ===========================================================================

-- 1) Tabela de pontos por cliente (identificado por e-mail da LI).
create table if not exists public.fidelidade (
  email        text primary key,
  pontos       integer not null default 0,
  updated_at   timestamptz not null default now()
);

-- 2) Histórico de lançamentos (crédito/resgate) — auditoria.
create table if not exists public.fidelidade_historico (
  id          bigserial primary key,
  email       text not null,
  tipo        text not null check (tipo in ('credito','resgate')),
  pontos      integer not null,
  motivo      text,
  ref         text,               -- id do pagamento MP / pedido
  created_at  timestamptz not null default now()
);

-- 3) Regras do programa (em store_config para o admin ajustar pela UI).
insert into public.store_config (key, value, is_secret) values
  ('FID_PONTOS_POR_REAL',  '1',    false),
  ('FID_PONTOS_POR_DESC',  '100',  false)
on conflict (key) do nothing;

-- 4) RLS: só o service_role (backend) manipula. O cliente NÃO acessa direto.
alter table public.fidelidade enable row level security;
alter table public.fidelidade_historico enable row level security;

drop policy if exists "svc_all_fidelidade" on public.fidelidade;
create policy "svc_all_fidelidade"
  on public.fidelidade for all to authenticated
  using (true) with check (true);

drop policy if exists "svc_all_fidelidade_hist" on public.fidelidade_historico;
create policy "svc_all_fidelidade_hist"
  on public.fidelidade_historico for all to authenticated
  using (true) with check (true);

grant select, insert, update, delete on public.fidelidade to authenticated;
grant select, insert on public.fidelidade_historico to authenticated;
