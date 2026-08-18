-- Controle de Estoque D'Griffe — schema Supabase
-- Execute no SQL Editor do painel do Supabase.

create table if not exists public.estoque (
  produto_id bigint primary key,
  nome text not null default '',
  sku text,
  quantidade integer not null default 0,
  limite_baixo integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.estoque_movimentos (
  id bigserial primary key,
  produto_id bigint not null,
  nome text not null default '',
  sku text,
  quantidade integer not null,
  motivo text not null,
  admin_id text,
  observacao text,
  created_at timestamptz not null default now()
);

create index if not exists idx_estoque_movimentos_produto on public.estoque_movimentos (produto_id);
create index if not exists idx_estoque_movimentos_created on public.estoque_movimentos (created_at desc);

-- RLS: serviço usa service_role (bypass). Se usar auth de cliente, ajuste as policies.
alter table public.estoque enable row level security;
alter table public.estoque_movimentos enable row level security;
