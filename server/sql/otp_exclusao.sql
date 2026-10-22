-- otp_exclusao — códigos OTP de exclusão de conta (LGPD, self-service).
-- Rodar UMA VEZ no Supabase SQL Editor.
--
-- SEGURANÇA:
--   • O código nunca é armazenado em claro: apenas HMAC-SHA256(código;e-mail)
--     com segredo server-only (OTP_SALT ou ADMIN_SECRET).
--   • RLS HABILITADO e NENHUMA policy definida: clientes anon/authenticated
--     não conseguem ler nem escrever; o backend usa a KEY service_role,
--     que bypassa RLS — único caminho de acesso.
--   • 1 registro por e-mail (PRIMARY KEY): reenviar substitui o código
--     anterior não usado. `tentativas` invalida após 5 erros (no server).
--
-- Retenção: linhas são apagadas no uso (sucesso/expiração/5 erros). Linhas
-- órfãs (e-mail nunca confirmou) ficam, então limpeza automática do server:
-- nenhuma — o cooldown de 60s + validade de 10 min tornam a tabela pequena.

create table if not exists public.otp_exclusao (
  email        text        primary key,
  codigo_hash  text        not null,
  criado_em    timestamptz not null default now(),
  expira_em    timestamptz not null,
  tentativas   int         not null default 0
);

alter table public.otp_exclusao enable row level security;
-- (deliberadamente SEM policies — ver risco de USING (true): nunca.)

grant select, insert, update, delete on public.otp_exclusao to service_role;
