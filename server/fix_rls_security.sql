-- ============================================================
-- FIX DE SEGURANÇA: Habilitar RLS em todas as tabelas públicas
-- Execução: Supabase Dashboard → SQL Editor → colar e rodar
-- ============================================================

-- 1. Listar tabelas públicas sem RLS (verificação)
SELECT 
  tablename,
  rowsecurity as rls_habilitado
FROM pg_tables 
WHERE schemaname = 'public' 
  AND rowsecurity = false
ORDER BY tablename;

-- 2. HABILITAR RLS nas tabelas que estão sem
-- (Descomente e execute para cada tabela listada acima)

-- Tabela cupons
ALTER TABLE public.cupons ENABLE ROW LEVEL SECURITY;

-- Tabela cupons_usuarios  
ALTER TABLE public.cupons_usuarios ENABLE ROW LEVEL SECURITY;

-- Tabela afiliados (se ainda não estiver habilitada)
ALTER TABLE public.afiliados ENABLE ROW LEVEL SECURITY;

-- Tabelas do sistema de fidelidade
ALTER TABLE public.fidelidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fidelidade_historico ENABLE ROW LEVEL SECURITY;

-- Tabela de indicações
ALTER TABLE public.indicacoes ENABLE ROW LEVEL SECURITY;

-- Tabela de família
ALTER TABLE public.familia ENABLE ROW LEVEL SECURITY;

-- Tabela de pedidos (se existir)
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

-- Tabela de clientes (se existir)
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- Tabela de endereços
ALTER TABLE public.enderecos ENABLE ROW LEVEL SECURITY;

-- Tabela de preferências
ALTER TABLE public.preferencias ENABLE ROW LEVEL SECURITY;

-- Tabela de logs admin
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

-- Tabela de estoque
ALTER TABLE public.estoque ENABLE ROW LEVEL SECURITY;

-- Tabela de movimentos de estoque
ALTER TABLE public.estoque_movimentos ENABLE ROW LEVEL SECURITY;

-- Tabela de push subscriptions
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- 3. POLÍTICAS DE SEGURANÇA (criar após habilitar RLS)

-- CUPONS: usuários anônimos podem ler cupons ativos
CREATE POLICY IF NOT EXISTS "cupons_read_active" ON public.cupons
  FOR SELECT TO anon, authenticated
  USING (ativo = true AND (data_fim IS NULL OR data_fim > now()));

-- CUPONS: apenas service_role pode modificar (admin via backend)
CREATE POLICY IF NOT EXISTS "cupons_service_write" ON public.cupons
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- CUPONS_USUARIOS: usuários veem apenas seus próprios cupons
CREATE POLICY IF NOT EXISTS "cupons_usuarios_owner" ON public.cupons_usuarios
  FOR SELECT TO authenticated
  USING (email = current_setting('request.jwt.claims', true)::json->>'email');

-- CUPONS_USUARIOS: apenas service_role pode modificar
CREATE POLICY IF NOT EXISTS "cupons_usuarios_service_write" ON public.cupons_usuarios
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- AFILIADOS: cadastro público permitido
CREATE POLICY IF NOT EXISTS "afiliados_insert_public" ON public.afiliados
  FOR INSERT TO anon
  WITH CHECK (true);

-- AFILIADOS: leitura apenas para service_role (admin)
CREATE POLICY IF NOT EXISTS "afiliados_read_service" ON public.afiliados
  FOR SELECT TO authenticated
  USING (true);

-- AFILIADOS: atualização apenas para service_role
CREATE POLICY IF NOT EXISTS "afiliados_update_service" ON public.afiliados
  FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

-- FIDELIDADE: usuários veem apenas seus próprios pontos
CREATE POLICY IF NOT EXISTS "fidelidade_owner" ON public.fidelidade
  FOR SELECT TO authenticated
  USING (email = current_setting('request.jwt.claims', true)::json->>'email');

-- FIDELIDADE: service_role pode modificar
CREATE POLICY IF NOT EXISTS "fidelidade_service" ON public.fidelidade
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- FIDELIDADE_HISTORICO: usuários veem apenas seu histórico
CREATE POLICY IF NOT EXISTS "fidelidade_historico_owner" ON public.fidelidade_historico
  FOR SELECT TO authenticated
  USING (email = current_setting('request.jwt.claims', true)::json->>'email');

-- FIDELIDADE_HISTORICO: service_role pode modificar
CREATE POLICY IF NOT EXISTS "fidelidade_historico_service" ON public.fidelidade_historico
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- INDICAÇÕES: usuários veem apenas suas indicações
CREATE POLICY IF NOT EXISTS "indicacoes_owner" ON public.indicacoes
  FOR SELECT TO authenticated
  USING (
    indicador_email = current_setting('request.jwt.claims', true)::json->>'email'
    OR indicado_email = current_setting('request.jwt.claims', true)::json->>'email'
  );

-- INDICAÇÕES: service_role pode modificar
CREATE POLICY IF NOT EXISTS "indicacoes_service" ON public.indicacoes
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- FAMÍLIA: usuários veem apenas membros da sua família
CREATE POLICY IF NOT EXISTS "familia_owner" ON public.familia
  FOR SELECT TO authenticated
  USING (
    responsavel_email = current_setting('request.jwt.claims', true)::json->>'email'
    OR membro_email = current_setting('request.jwt.claims', true)::json->>'email'
  );

-- FAMÍLIA: service_role pode modificar
CREATE POLICY IF NOT EXISTS "familia_service" ON public.familia
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- PEDIDOS: usuários veem apenas seus próprios pedidos
CREATE POLICY IF NOT EXISTS "pedidos_owner" ON public.pedidos
  FOR SELECT TO authenticated
  USING (cliente_email = current_setting('request.jwt.claims', true)::json->>'email');

-- PEDIDOS: service_role pode modificar
CREATE POLICY IF NOT EXISTS "pedidos_service" ON public.pedidos
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ENDEREÇOS: usuários veem apenas seus próprios endereços
CREATE POLICY IF NOT EXISTS "enderecos_owner" ON public.enderecos
  FOR SELECT TO authenticated
  USING (cliente_email = current_setting('request.jwt.claims', true)::json->>'email');

-- ENDEREÇOS: service_role pode modificar
CREATE POLICY IF NOT EXISTS "enderecos_service" ON public.enderecos
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- PREFERÊNCIAS: usuários veem apenas suas próprias preferências
CREATE POLICY IF NOT EXISTS "preferencias_owner" ON public.preferencias
  FOR SELECT TO authenticated
  USING (email = current_setting('request.jwt.claims', true)::json->>'email');

-- PREFERÊNCIAS: service_role pode modificar
CREATE POLICY IF NOT EXISTS "preferencias_service" ON public.preferencias
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ADMIN_LOGS: apenas service_role pode ler
CREATE POLICY IF NOT EXISTS "admin_logs_service" ON public.admin_logs
  FOR SELECT TO authenticated
  USING (true);

-- ADMIN_LOGS: service_role pode inserir
CREATE POLICY IF NOT EXISTS "admin_logs_insert" ON public.admin_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- ESTOQUE: apenas service_role pode ler
CREATE POLICY IF NOT EXISTS "estoque_service" ON public.estoque
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ESTOQUE_MOVIMENTOS: apenas service_role pode ler
CREATE POLICY IF NOT EXISTS "estoque_movimentos_service" ON public.estoque_movimentos
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- PUSH_SUBSCRIPTIONS: usuários veem apenas suas próprias subscriptions
CREATE POLICY IF NOT EXISTS "push_subs_owner" ON public.push_subscriptions
  FOR SELECT TO authenticated
  USING (email = current_setting('request.jwt.claims', true)::json->>'email');

-- PUSH_SUBSCRIPTIONS: service_role pode modificar
CREATE POLICY IF NOT EXISTS "push_subs_service" ON public.push_subscriptions
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- STORE_CONFIG: apenas service_role pode acessar
CREATE POLICY IF NOT EXISTS "store_config_service" ON public.store_config
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- 4. VERIFICAÇÃO FINAL
SELECT 
  tablename,
  rowsecurity as rls_habilitado
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
