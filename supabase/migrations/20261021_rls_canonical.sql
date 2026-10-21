-- ===========================================================================
-- D'Griffe — RLS CANÔNICO (LGPD P0)
-- Data: 2026-10-21
--
-- Esta é a ÚNICA migração de RLS que deve ser aplicada em produção.
-- Ela remove TODAS as policies antigas das tabelas abaixo (inclusive as
-- perigosas `USING (true)`), religa o RLS e recria apenas as policies de dono.
--
-- Modelo de acesso:
--   * O frontend/app NÃO fala direto com o Supabase (usa o backend Express).
--   * O backend usa a service_role, que BYPASSA o RLS — por isso as tabelas
--     administrativas podem ficar sem policy (acesso só pelo backend).
--   * `authenticated` recebe apenas leitura/escrita dos próprios dados.
--   * `anon` não recebe acesso a nenhuma tabela.
--
-- Idempotente: pode ser executada mais de uma vez.
-- ===========================================================================

begin;

-- 1) Remove todas as policies existentes nas tabelas gerenciadas.
--    (Evita conflito com `USING (true)` e com policies duplicadas de scripts
--    antigos como migracao-familia-indicacoes.sql e fix_rls_security.sql.)
do $$
declare
  r record;
  tabelas text[] := array[
    'profiles', 'enderecos', 'fidelidade', 'fidelidade_historico', 'pedidos',
    'notificacoes', 'receitas', 'favoritos', 'cupons', 'cupons_usuarios',
    'familia', 'indicacoes', 'afiliados', 'afiliado_vendas', 'admin_logs',
    'admin_users', 'store_config', 'estoque', 'estoque_movimentos'
  ];
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any(tabelas)
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- 2) Liga o RLS em tudo que guarda dado pessoal. Tabelas opcionais usam
--    IF EXISTS para a migração não falhar em bases que ainda não as têm.
alter table public.profiles enable row level security;
alter table public.enderecos enable row level security;
alter table public.fidelidade enable row level security;
alter table public.fidelidade_historico enable row level security;
alter table public.pedidos enable row level security;
alter table public.notificacoes enable row level security;
alter table public.receitas enable row level security;
alter table public.favoritos enable row level security;
alter table public.cupons enable row level security;
alter table public.cupons_usuarios enable row level security;
alter table if exists public.familia enable row level security;
alter table if exists public.indicacoes enable row level security;
alter table if exists public.afiliados enable row level security;
alter table if exists public.afiliado_vendas enable row level security;
alter table if exists public.admin_logs enable row level security;
alter table if exists public.admin_users enable row level security;
alter table if exists public.store_config enable row level security;
alter table if exists public.estoque enable row level security;
alter table if exists public.estoque_movimentos enable row level security;

-- 3) Permissões: anon perde tudo. authenticated só recebe o necessário para
--    as policies de dono abaixo. service_role continua com bypass.
revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.enderecos to authenticated;
grant select, insert, update, delete on public.receitas to authenticated;
grant select, insert, update, delete on public.favoritos to authenticated;
grant select, update on public.notificacoes to authenticated;
grant select on public.fidelidade to authenticated;
grant select on public.fidelidade_historico to authenticated;
grant select on public.pedidos to authenticated;
grant select on public.cupons to authenticated;
grant select on public.cupons_usuarios to authenticated;
grant select on public.admin_users to authenticated; -- necessário para is_admin()

grant usage on schema public to authenticated;

-- 4) Policies de dono (menor privilégio).
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy enderecos_own on public.enderecos
  for all to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'))
  with check (lower(email) = lower(auth.jwt() ->> 'email'));

create policy fidelidade_select_own on public.fidelidade
  for select to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));

create policy fidelidade_historico_select_own on public.fidelidade_historico
  for select to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));

create policy pedidos_select_own on public.pedidos
  for select to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));

create policy notificacoes_select_own on public.notificacoes
  for select to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));

create policy notificacoes_update_own on public.notificacoes
  for update to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'))
  with check (lower(email) = lower(auth.jwt() ->> 'email'));

create policy receitas_own on public.receitas
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy favoritos_own on public.favoritos
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy cupons_select_active on public.cupons
  for select to authenticated
  using (ativo = true);

create policy cupons_usuarios_select_own on public.cupons_usuarios
  for select to authenticated
  using (user_id = auth.uid());

-- Permite que is_admin() leia a própria linha. Não expõe a lista de admins.
create policy admin_users_select_own on public.admin_users
  for select to authenticated
  using (user_id = auth.uid());

-- 5) Sem policy = negado para authenticated/anon (service_role continua).
--    Isso vale para: familia, indicacoes, afiliados, afiliado_vendas,
--    admin_logs, store_config, estoque, estoque_movimentos.
--    O backend acessa essas tabelas com a service_role.

commit;
