# Migrações de segurança — D'Griffe

## Aplicar o RLS canônico (obrigatório — LGPD P0)

No Supabase Dashboard → SQL Editor, execute **apenas**:

```
supabase/migrations/20261021_rls_canonical.sql
```

O que ele faz:

1. Remove **todas** as policies antigas das tabelas de dados pessoais,
   incluindo as `USING (true)` criadas por scripts legados.
2. Religa o RLS em `profiles`, `enderecos`, `receitas`, `favoritos`,
   `fidelidade`, `fidelidade_historico`, `pedidos`, `notificacoes`,
   `cupons`, `cupons_usuarios`, `familia`, `indicacoes`, `afiliados`,
   `afiliado_vendas`, `admin_logs`, `admin_users`, `store_config`,
   `estoque` e `estoque_movimentos`.
3. Remove o acesso do role `anon` e recria policies apenas para o dono
   (`auth.uid()` ou e-mail do JWT).
4. Deixa tabelas administrativas sem policy: só a `service_role` (backend)
   acessa.

## Scripts que NÃO devem ser executados

Estes arquivos foram mantidos só como histórico e agora têm aviso de
depreciação no topo:

- `server/fix_rls_security.sql`
- `server/afiliados_schema.sql`
- `supabase/migracao-familia-indicacoes.sql`
- `supabase/fix-rls-c1.sql`

`supabase/schema-fidelidade.sql` é exceção: o workflow ainda o usa **apenas
para DDL** (criar tabelas). Ele não cria mais policies permissivas e é seguido
pela migração canônica no mesmo deploy. Não rode esse arquivo sozinho para
configurar RLS.

## Verificação pós-migração

```sql
-- 1) Nenhuma policy permissiva deve sobrar.
select schemaname, tablename, policyname, roles, cmd, qual
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- 2) Todas as tabelas de PII devem estar com RLS ligado.
select relname, relrowsecurity
from pg_class
where relnamespace = 'public'::regnamespace
  and relkind = 'r'
order by relname;

-- 3) O role anon não deve ter privilégios nas tabelas.
select table_name, privilege_type
from information_schema.role_table_grants
where grantee = 'anon' and table_schema = 'public'
order by table_name, privilege_type;
```

O item 3 deve retornar **zero linhas**. O item 1 deve mostrar apenas as
policies `*_own`, `*_select_own` e `cupons_select_active`.
