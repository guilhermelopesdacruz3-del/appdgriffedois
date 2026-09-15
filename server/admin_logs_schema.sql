-- Tabela de logs administrativos D'Griffe (auditoria)
-- Execute no SQL Editor do painel do Supabase.

create table if not exists public.admin_logs (
  id bigserial primary key,
  admin_email text,
  acao text not null,
  nivel text not null default 'INFO',
  detalhes jsonb,
  ip text,
  created_at timestamptz not null default now()
);

create index if not exists admin_logs_created_at_idx on public.admin_logs (created_at desc);
create index if not exists admin_logs_admin_email_idx on public.admin_logs (admin_email);
create index if not exists admin_logs_acao_idx on public.admin_logs (acao);

-- RLS: só o service role (backend) escreve/le; cliente não acessa.
alter table public.admin_logs enable row level security;
drop policy if exists "service_role_all_admin_logs" on public.admin_logs;
create policy "service_role_all_admin_logs"
  on public.admin_logs for all
  to service_role
  using (true)
  with check (true);
