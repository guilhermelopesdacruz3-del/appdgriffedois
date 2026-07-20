-- ===========================================================================
-- D'Griffe Ótica — Schema completo do Supabase
-- Aplicar no SQL Editor do projeto: https://unpbvztvscuisqnzofqp.supabase.co
-- (ou via psql com a connection string do banco).
-- Idempotente: CREATE TABLE IF NOT EXISTS + policies com DROP se existirem.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) store_config — segredos do backend (LI + Mercado Pago). SÓ service_role.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS store_config (
  key text PRIMARY KEY,
  value text,
  is_secret boolean DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 2) profiles — espelho do auth.users (id = auth.uid()).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  nome text,
  telefone text,
  cpf text,
  cidade text,
  estado text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 3) fidelidade — saldo de pontos por e-mail.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fidelidade (
  email text PRIMARY KEY,
  pontos integer DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 4) fidelidade_historico — log de créditos/resgates.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fidelidade_historico (
  id bigserial PRIMARY KEY,
  email text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('credito','resgate')),
  pontos integer NOT NULL,
  motivo text,
  ref text,
  created_at timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 5) pedidos — espelho dos pagamentos do Mercado Pago (idempotência webhook).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pedidos (
  mp_payment_id text PRIMARY KEY,
  email text,
  valor numeric(12,2) DEFAULT 0,
  status text DEFAULT 'pendente',
  external_reference text,
  pontos_creditados boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 6) admin_logs — auditoria de ações do admin.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_logs (
  id bigserial PRIMARY KEY,
  admin_email text NOT NULL,
  acao text NOT NULL,
  detalhe jsonb DEFAULT '{}',
  ip text,
  created_at timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 7) cupons — definição de cupons.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  tipo text NOT NULL CHECK (tipo IN ('percentual','fixo')),
  valor numeric(12,2) NOT NULL DEFAULT 0,
  valor_minimo numeric(12,2),
  max_usos integer,
  usos integer DEFAULT 0,
  data_inicio timestamptz NOT NULL,
  data_fim timestamptz NOT NULL,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by text
);

-- ---------------------------------------------------------------------------
-- 8) cupons_usuarios — atribuição de cupom a um usuário.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cupons_usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cupom_id uuid REFERENCES cupons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  usado boolean DEFAULT false,
  usado_em timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE (cupom_id, user_id)
);

-- ===========================================================================
-- RPC: creditar_pontos (usada em db.ts → creditarPontos)
-- ===========================================================================
CREATE OR REPLACE FUNCTION creditar_pontos(p_email text, p_pontos integer, p_ref text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  atual integer;
BEGIN
  INSERT INTO fidelidade (email, pontos, updated_at)
  VALUES (p_email, p_pontos, now())
  ON CONFLICT (email) DO UPDATE SET pontos = fidelidade.pontos + p_pontos, updated_at = now()
  RETURNING pontos INTO atual;

  INSERT INTO fidelidade_historico (email, tipo, pontos, motivo, ref)
  VALUES (p_email, 'credito', p_pontos, 'compra', p_ref);

  RETURN p_pontos;
END;
$$;

-- ===========================================================================
-- RLS — habilitado em todas. service_role (backend) bypassa automaticamente.
-- Policies abaixo controlam o acesso dos usuários (anon/user token).
-- ===========================================================================
ALTER TABLE store_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE fidelidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE fidelidade_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE cupons_usuarios ENABLE ROW LEVEL SECURITY;

-- store_config: ninguém (anon/user) lê ou escreve. Só service_role.
DROP POLICY IF EXISTS "store_config_no_public" ON store_config;
CREATE POLICY "store_config_no_public" ON store_config FOR ALL TO anon USING (false) WITH CHECK (false);

-- profiles: usuário vê/edita o próprio.
DROP POLICY IF EXISTS "profiles_owner" ON profiles;
CREATE POLICY "profiles_owner" ON profiles FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- fidelidade: usuário vê o próprio (por e-mail correspondente ao uid).
DROP POLICY IF EXISTS "fidelidade_owner" ON fidelidade;
CREATE POLICY "fidelidade_owner" ON fidelidade FOR SELECT USING (
  email = (SELECT email FROM profiles WHERE id = auth.uid())
);

-- fidelidade_historico: usuário vê o próprio.
DROP POLICY IF EXISTS "fidelidade_historico_owner" ON fidelidade_historico;
CREATE POLICY "fidelidade_historico_owner" ON fidelidade_historico FOR SELECT USING (
  email = (SELECT email FROM profiles WHERE id = auth.uid())
);

-- pedidos: usuário vê os próprios (por e-mail).
DROP POLICY IF EXISTS "pedidos_owner" ON pedidos;
CREATE POLICY "pedidos_owner" ON pedidos FOR SELECT USING (
  email = (SELECT email FROM profiles WHERE id = auth.uid())
);

-- admin_logs: nenhum acesso público. Só service_role.
DROP POLICY IF EXISTS "admin_logs_no_public" ON admin_logs;
CREATE POLICY "admin_logs_no_public" ON admin_logs FOR ALL TO anon USING (false) WITH CHECK (false);

-- cupons: todos podem LER cupons ativos (para validação no checkout); escrita só service_role.
DROP POLICY IF EXISTS "cupons_read_active" ON cupons;
CREATE POLICY "cupons_read_active" ON cupons FOR SELECT USING (ativo = true);
DROP POLICY IF EXISTS "cupons_no_public_write" ON cupons;
CREATE POLICY "cupons_no_public_write" ON cupons FOR INSERT TO anon WITH CHECK (false);

-- cupons_usuarios: usuário vê os próprios.
DROP POLICY IF EXISTS "cupons_usuarios_owner" ON cupons_usuarios;
CREATE POLICY "cupons_usuarios_owner" ON cupons_usuarios FOR SELECT USING (
  user_id = auth.uid()
);

-- ===========================================================================
-- Índices auxiliares
-- ===========================================================================
CREATE INDEX IF NOT EXISTS idx_fidelidade_historico_email ON fidelidade_historico(email);
CREATE INDEX IF NOT EXISTS idx_pedidos_email ON pedidos(email);
CREATE INDEX IF NOT EXISTS idx_cupons_codigo ON cupons(codigo);
CREATE INDEX IF NOT EXISTS idx_cupons_usuarios_user ON cupons_usuarios(user_id);
