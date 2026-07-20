-- Cupons (admin cria + define regras)
create table if not exists public.cupons (
  id uuid primary key default gen_random_uuid(),
  codigo text unique not null,
  tipo text not null check (tipo in ('percentual','fixo')),
  valor numeric not null,
  valor_minimo numeric,
  max_usos integer,
  usos integer not null default 0,
  data_inicio timestamptz not null default now(),
  data_fim timestamptz not null,
  created_at timestamptz default now(),
  created_by text,
  ativo boolean not null default true
);

-- Cupons atribuídos a usuários específicos (envio seletivo)
create table if not exists public.cupons_usuarios (
  id uuid primary key default gen_random_uuid(),
  cupom_id uuid not null references public.cupons(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  usado boolean not null default false,
  usado_em timestamptz,
  created_at timestamptz default now(),
  unique (cupom_id, user_id)
);

-- Índices
create index if not exists idx_cupons_codigo on public.cupons (codigo);
create index if not exists idx_cupons_usuarios_user on public.cupons_usuarios (user_id);

-- RLS
alter table public.cupons enable row level security;
alter table public.cupons_usuarios enable row level security;

-- Admin GERencia cupons
drop policy if exists "cupons_admin_all" on public.cupons;
create policy "cupons_admin_all"
  on public.cupons for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "cupons_usuarios_admin_all" on public.cupons_usuarios;
create policy "cupons_usuarios_admin_all"
  on public.cupons_usuarios for all
  to service_role
  using (true)
  with check (true);

-- Usuário vê SEUS cupons (sem precisar de RLS complexa: o backend filtra por user_id)
drop policy if exists "cupons_usuarios_self" on public.cupons_usuarios;
create policy "cupons_usuarios_self"
  on public.cupons_usuarios for select
  to authenticated
  using (user_id = auth.uid());

-- Cupom por código (validar)
drop policy if exists "cupons_select_publico" on public.cupons;
create policy "cupons_select_publico"
  on public.cupons for select
  to anon, authenticated
  using (ativo = true);
