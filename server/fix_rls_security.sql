-- ============================================================
-- FIX DE SEGURANÇA v5: RLS completo (corrigido)
-- Execução: Supabase Dashboard → SQL Editor → colar e rodar
-- ============================================================

-- VERIFICAÇÃO DE COLUNAS (rode primeiro para ver a estrutura real)
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name IN ('cupons', 'cupons_usuarios', 'fidelidade', 'fidelidade_historico', 'indicacoes', 'familia', 'pedidos', 'enderecos', 'afiliados')
ORDER BY table_name, ordinal_position;

-- ============================================================
-- TABELA: cupons
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='cupons') THEN
    ALTER TABLE public.cupons ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON TABLE public.cupons FROM anon, authenticated;
    GRANT SELECT ON TABLE public.cupons TO anon, authenticated;

    DROP POLICY IF EXISTS cupons_read_active ON public.cupons;
    CREATE POLICY cupons_read_active ON public.cupons
      FOR SELECT TO anon, authenticated
      USING (ativo = true AND (data_fim IS NULL OR data_fim > now()));

    DROP POLICY IF EXISTS cupons_service_write ON public.cupons;
    CREATE POLICY cupons_service_write ON public.cupons
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- TABELA: cupons_usuarios
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='cupons_usuarios') THEN
    ALTER TABLE public.cupons_usuarios ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON TABLE public.cupons_usuarios FROM anon, authenticated;
    GRANT SELECT ON TABLE public.cupons_usuarios TO authenticated;

    DROP POLICY IF EXISTS cupons_usuarios_owner ON public.cupons_usuarios;
    CREATE POLICY cupons_usuarios_owner ON public.cupons_usuarios
      FOR SELECT TO authenticated
      USING (cliente_email = current_setting('request.jwt.claims', true)::json->>'email');

    DROP POLICY IF EXISTS cupons_usuarios_service_write ON public.cupons_usuarios;
    CREATE POLICY cupons_usuarios_service_write ON public.cupons_usuarios
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- TABELA: afiliados (criação + RLS)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.afiliados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  email text NOT NULL UNIQUE,
  telefone text,
  total_vendas integer DEFAULT 0,
  total_comissao numeric(10,2) DEFAULT 0,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_afiliados_email ON public.afiliados(email);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='afiliados') THEN
    ALTER TABLE public.afiliados ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON TABLE public.afiliados FROM anon, authenticated;
    GRANT INSERT ON TABLE public.afiliados TO anon;
    GRANT SELECT, UPDATE ON TABLE public.afiliados TO authenticated;

    DROP POLICY IF EXISTS afiliados_insert_public ON public.afiliados;
    CREATE POLICY afiliados_insert_public ON public.afiliados
      FOR INSERT TO anon WITH CHECK (true);

    DROP POLICY IF EXISTS afiliados_read_service ON public.afiliados;
    CREATE POLICY afiliados_read_service ON public.afiliados
      FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS afiliados_update_service ON public.afiliados;
    CREATE POLICY afiliados_update_service ON public.afiliados
      FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- TABELA: fidelidade
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='fidelidade') THEN
    ALTER TABLE public.fidelidade ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON TABLE public.fidelidade FROM anon, authenticated;
    GRANT SELECT ON TABLE public.fidelidade TO authenticated;

    DROP POLICY IF EXISTS fidelidade_owner ON public.fidelidade;
    CREATE POLICY fidelidade_owner ON public.fidelidade
      FOR SELECT TO authenticated
      USING (email = current_setting('request.jwt.claims', true)::json->>'email');

    DROP POLICY IF EXISTS fidelidade_service ON public.fidelidade;
    CREATE POLICY fidelidade_service ON public.fidelidade
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- TABELA: fidelidade_historico
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='fidelidade_historico') THEN
    ALTER TABLE public.fidelidade_historico ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON TABLE public.fidelidade_historico FROM anon, authenticated;
    GRANT SELECT ON TABLE public.fidelidade_historico TO authenticated;

    DROP POLICY IF EXISTS fidelidade_historico_owner ON public.fidelidade_historico;
    CREATE POLICY fidelidade_historico_owner ON public.fidelidade_historico
      FOR SELECT TO authenticated
      USING (email = current_setting('request.jwt.claims', true)::json->>'email');

    DROP POLICY IF EXISTS fidelidade_historico_service ON public.fidelidade_historico;
    CREATE POLICY fidelidade_historico_service ON public.fidelidade_historico
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- TABELA: indicacoes
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='indicacoes') THEN
    ALTER TABLE public.indicacoes ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON TABLE public.indicacoes FROM anon, authenticated;
    GRANT SELECT ON TABLE public.indicacoes TO authenticated;

    DROP POLICY IF EXISTS indicacoes_owner ON public.indicacoes;
    CREATE POLICY indicacoes_owner ON public.indicacoes
      FOR SELECT TO authenticated
      USING (indicador_email = current_setting('request.jwt.claims', true)::json->>'email'
             OR indicado_email = current_setting('request.jwt.claims', true)::json->>'email');

    DROP POLICY IF EXISTS indicacoes_service ON public.indicacoes;
    CREATE POLICY indicacoes_service ON public.indicacoes
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- TABELA: familia
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='familia') THEN
    ALTER TABLE public.familia ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON TABLE public.familia FROM anon, authenticated;
    GRANT SELECT ON TABLE public.familia TO authenticated;

    DROP POLICY IF EXISTS familia_owner ON public.familia;
    CREATE POLICY familia_owner ON public.familia
      FOR SELECT TO authenticated
      USING (responsavel_email = current_setting('request.jwt.claims', true)::json->>'email'
             OR membro_email = current_setting('request.jwt.claims', true)::json->>'email');

    DROP POLICY IF EXISTS familia_service ON public.familia;
    CREATE POLICY familia_service ON public.familia
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- TABELA: pedidos
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='pedidos') THEN
    ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON TABLE public.pedidos FROM anon, authenticated;
    GRANT SELECT ON TABLE public.pedidos TO authenticated;

    DROP POLICY IF EXISTS pedidos_owner ON public.pedidos;
    CREATE POLICY pedidos_owner ON public.pedidos
      FOR SELECT TO authenticated
      USING (cliente_email = current_setting('request.jwt.claims', true)::json->>'email');

    DROP POLICY IF EXISTS pedidos_service ON public.pedidos;
    CREATE POLICY pedidos_service ON public.pedidos
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- TABELA: enderecos
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='enderecos') THEN
    ALTER TABLE public.enderecos ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON TABLE public.enderecos FROM anon, authenticated;
    GRANT SELECT ON TABLE public.enderecos TO authenticated;

    DROP POLICY IF EXISTS enderecos_owner ON public.enderecos;
    CREATE POLICY enderecos_owner ON public.enderecos
      FOR SELECT TO authenticated
      USING (cliente_email = current_setting('request.jwt.claims', true)::json->>'email');

    DROP POLICY IF EXISTS enderecos_service ON public.enderecos;
    CREATE POLICY enderecos_service ON public.enderecos
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- TABELA: admin_logs
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='admin_logs') THEN
    ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON TABLE public.admin_logs FROM anon, authenticated;
    GRANT SELECT, INSERT ON TABLE public.admin_logs TO authenticated;

    DROP POLICY IF EXISTS admin_logs_service ON public.admin_logs;
    CREATE POLICY admin_logs_service ON public.admin_logs
      FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS admin_logs_insert ON public.admin_logs;
    CREATE POLICY admin_logs_insert ON public.admin_logs
      FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- TABELA: estoque
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='estoque') THEN
    ALTER TABLE public.estoque ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON TABLE public.estoque FROM anon, authenticated;
    GRANT SELECT ON TABLE public.estoque TO authenticated;

    DROP POLICY IF EXISTS estoque_service ON public.estoque;
    CREATE POLICY estoque_service ON public.estoque
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- TABELA: estoque_movimentos
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='estoque_movimentos') THEN
    ALTER TABLE public.estoque_movimentos ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON TABLE public.estoque_movimentos FROM anon, authenticated;
    GRANT SELECT ON TABLE public.estoque_movimentos TO authenticated;

    DROP POLICY IF EXISTS estoque_movimentos_service ON public.estoque_movimentos;
    CREATE POLICY estoque_movimentos_service ON public.estoque_movimentos
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- TABELA: store_config
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='store_config') THEN
    ALTER TABLE public.store_config ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON TABLE public.store_config FROM anon, authenticated;

    DROP POLICY IF EXISTS store_config_service ON public.store_config;
    CREATE POLICY store_config_service ON public.store_config
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- VERIFICAÇÃO FINAL
-- ============================================================
SELECT
  tablename,
  rowsecurity as rls_habilitado
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
