-- ===========================================================================
-- Loja Integrada Conectada · Schema Supabase (integração de segredos)
-- Aplicar no SQL Editor do Supabase (https://app.supabase.com > projeto > SQL).
-- ===========================================================================

-- 1) store_config: admin cola as chaves das APIs (LI + Mercado Pago) pela UI.
create table if not exists public.store_config (
  key         text primary key,
  value       text,
  is_secret   boolean not null default false,
  updated_at  timestamptz not null default now()
);

-- 2) profiles: cliente logado (espelha cliente da Loja Integrada).
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  nome          text,
  email         text,
  telefone      text,
  li_cliente_id integer,
  created_at    timestamptz not null default now()
);

-- 3) pedidos: espelha os pedidos do Mercado Pago (webhook/checkout do app).
create table if not exists public.pedidos (
  mp_payment_id      text primary key,
  email              text,
  valor              numeric(12,2) default 0,
  status             text,
  external_reference text,
  pontos_creditados  boolean not null default false,
  li_pedido          text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Reparos idempotentes: a tabela pode ter sido criada por uma versão antiga.
alter table public.pedidos add column if not exists li_pedido text;
alter table public.pedidos add column if not exists external_reference text;
alter table public.pedidos add column if not exists pontos_creditados boolean not null default false;
alter table public.pedidos add column if not exists updated_at timestamptz not null default now();

-- 4) admin_users: quem tem acesso ao painel admin.
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- 5) is_admin(): SECURITY INVOKER (não DEFINER) + checagem de uid no corpo.
create or replace function public.is_admin()
returns boolean
language sql
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users where user_id = (select auth.uid())
  );
$$;

-- ====================== RLS ======================
alter table public.store_config enable row level security;
alter table public.profiles     enable row level security;
alter table public.pedidos      enable row level security;
alter table public.admin_users  enable row level security;

drop policy if exists "admin_all_store_config" on public.store_config;
create policy "admin_all_store_config"
  on public.store_config for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "profiles_self" on public.profiles;
create policy "profiles_self"
  on public.profiles for all
  to authenticated
  using ((select auth.uid()) = id or public.is_admin())
  with check ((select auth.uid()) = id or public.is_admin());

drop policy if exists "pedidos_self_or_admin" on public.pedidos;
create policy "pedidos_self_or_admin"
  on public.pedidos for all
  to authenticated
  using (email = (select email from public.profiles where id = (select auth.uid())))
  with check (email = (select email from public.profiles where id = (select auth.uid())));

drop policy if exists "admin_users_read" on public.admin_users;
create policy "admin_users_read"
  on public.admin_users for select
  to authenticated
  using (public.is_admin());

-- ====================== Data API exposure ======================
grant select, insert, update, delete on public.store_config to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.pedidos to authenticated;
grant select on public.admin_users to authenticated;

-- ====================== Seed inicial ======================
-- ATENÇÃO: a senha do admin NÃO fica no banco. Ela é definida só via
-- ADMIN_PASSWORD no .env do servidor (server/.env). Aqui só as chaves de API.
insert into public.store_config (key, value, is_secret) values
  ('LI_APP_KEY',       '', true),
  ('LI_API_KEY',       '', true),
  ('MP_ACCESS_TOKEN',  '', true)
on conflict (key) do nothing;
