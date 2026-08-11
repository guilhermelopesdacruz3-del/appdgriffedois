-- ===========================================================================
-- MIGRAÇÃO: Família + Indicação + coluna credito_rs
-- Roda UMA VEZ no Supabase SQL Editor (idempotente).
-- ===========================================================================

-- 1) Permite que a exclusão de conta delete em cascata profiles/enderecos/fidelidade/etc.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enderecos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fidelidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fidelidade_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
-- cupons/cupons_usuarios: NÃO reativar RLS (quebra envio de cupons com a
-- chave sb_secret_*. Policies admin para as 2 roles ficam em cupons.sql).
ALTER TABLE public.cupons DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.cupons_usuarios DISABLE ROW LEVEL SECURITY;

-- Permissão broad p/ admin/service_role mexer em tudo (usado pelo backend com service_role).
-- Clientes autenticados só seguem as policies específicas abaixo.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='svc_all_profiles') THEN
    CREATE POLICY "svc_all_profiles" ON public.profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='enderecos' AND policyname='svc_all_enderecos') THEN
    CREATE POLICY "svc_all_enderecos" ON public.enderecos FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='fidelidade' AND policyname='svc_all_fidelidade') THEN
    CREATE POLICY "svc_all_fidelidade" ON public.fidelidade FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='fidelidade_historico' AND policyname='svc_all_fidelidade_hist') THEN
    CREATE POLICY "svc_all_fidelidade_hist" ON public.fidelidade_historico FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 2) Coluna credito_rs no histórico (para compatibilidade com getCreditosFamilia).
ALTER TABLE public.fidelidade_historico ADD COLUMN IF NOT EXISTS credito_rs integer DEFAULT 0;

-- 3) Família: vínculo membro → responsável.
CREATE TABLE IF NOT EXISTS public.familia (
  id              bigserial PRIMARY KEY,
  responsavel_email text NOT NULL,
  membro_email     text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(responsavel_email, membro_email)
);
CREATE INDEX IF NOT EXISTS idx_familia_responsavel ON public.familia(responsavel_email);
CREATE INDEX IF NOT EXISTS idx_familia_membro ON public.familia(membro_email);

-- 4) Indicações: código DG-XXXXX do indicador, status, conversão.
CREATE TABLE IF NOT EXISTS public.indicacoes (
  id                bigserial PRIMARY KEY,
  indicador_email   text NOT NULL,
  indicado_email    text NOT NULL,
  codigo            text,
  status            text NOT NULL DEFAULT 'pendente',
  tipo              text NOT NULL DEFAULT 'pendencia',
  convertido_at     timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_indicacoes_indicador ON public.indicacoes(indicador_email);
CREATE INDEX IF NOT EXISTS idx_indicacoes_indicado ON public.indicacoes(indicado_email);

-- Seed inicial de regras de fidelidade (idempotente).
INSERT INTO public.store_config (key, value, is_secret) VALUES
  ('FID_PONTOS_POR_REAL', '2', false),
  ('FID_PONTOS_POR_DESC', '50', false)
ON CONFLICT (key) DO NOTHING;
