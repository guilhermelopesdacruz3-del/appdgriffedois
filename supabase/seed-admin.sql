-- ===========================================================================
-- Seed do admin (rodar APÓS supabase/schema.sql no SQL Editor).
-- Registra o usuário como admin na tabela admin_users.
-- O insert em admin_users exige service_role (bypassa RLS), por isso
-- só pode ser feito via SQL Editor / db query, nunca pelo cliente anon.
-- ===========================================================================

-- Substitua o e-mail abaixo pelo que você criou em Authentication → Users.
insert into public.admin_users (user_id)
select id
from auth.users
where email = 'guilhermelopesdacruz3@gmail.com'
on conflict (user_id) do nothing;

-- Confirma:
select au.user_id, u.email
from public.admin_users au
join auth.users u on u.id = au.user_id;
