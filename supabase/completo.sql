-- ===========================================================================
-- D'Griffe Ótica — Schema COMPLETO do Supabase
-- COLE TUDO no SQL Editor e clique em RUN (idempotente — pode rodar várias vezes)
-- Ordem: 1) tabelas → 2) funções → 3) RLS → 4) índices → 5) seed
-- ===========================================================================

-- 1) TABELAS
CREATE TABLE IF NOT EXISTS store_config (
  key text PRIMARY KEY,
  value text,
  is_secret boolean DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  nome text,
  telefone text,
  cpf text,
  cidade text,
  estado text,
  preferencias jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fidelidade (
  email text PRIMARY KEY,
  pontos integer DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fidelidade_historico (
  id bigserial PRIMARY KEY,
  email text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('credito','resgate','bonus')),
  pontos integer NOT NULL,
  motivo text,
  ref text,
  credito_rs integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS admin_logs (
  id bigserial PRIMARY KEY,
  admin_email text NOT NULL,
  acao text NOT NULL,
  detalhe jsonb DEFAULT '{}',
  ip text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cupons (
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

CREATE TABLE IF NOT EXISTS public.cupons_usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cupom_id uuid REFERENCES public.cupons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  usado boolean DEFAULT false,
  usado_em timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE (cupom_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  titulo text NOT NULL,
  corpo text NOT NULL,
  lida boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.enderecos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  nome text NOT NULL,
  endereco text NOT NULL,
  numero text NOT NULL,
  complemento text,
  bairro text,
  cidade text NOT NULL,
  estado text NOT NULL,
  cep text NOT NULL,
  principal boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS receitas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  tipo text NOT NULL DEFAULT 'grau',
  descricao text NOT NULL,
  arquivo_url text NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS favoritos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  produto_id integer NOT NULL,
  sku text NULL,
  nome text NOT NULL,
  imagem text NULL,
  preco numeric(10,2) NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, produto_id)
);

CREATE TABLE IF NOT EXISTS public.familia (
  id bigserial PRIMARY KEY,
  responsavel_email text NOT NULL,
  membro_email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(responsavel_email, membro_email)
);

CREATE TABLE IF NOT EXISTS public.indicacoes (
  id bigserial PRIMARY KEY,
  indicador_email text NOT NULL,
  indicado_email text NOT NULL,
  codigo text,
  status text NOT NULL DEFAULT 'pendente',
  tipo text NOT NULL DEFAULT 'pendencia',
  convertido_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2) FUNÇÕES
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY invoker
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = (SELECT auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.creditar_pontos(p_email text, p_pontos integer, p_ref text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

CREATE OR REPLACE FUNCTION public.incrementar_usos_cupom(p_cupom_id uuid)
RETURNS void
LANGUAGE sql
SECURITY definer
SET search_path = public
AS $$
  UPDATE public.cupons SET usos = usos + 1 WHERE id = p_cupom_id;
$$;

-- 3) ROW LEVEL SECURITY
ALTER TABLE store_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE fidelidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE fidelidade_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;
-- cupons: RLS desligado (quebra envio com chave sb_secret_*); policies em cupons.sql.
ALTER TABLE public.cupons DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.cupons_usuarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enderecos ENABLE ROW LEVEL SECURITY;
ALTER TABLE receitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE favoritos ENABLE ROW LEVEL SECURITY;

-- store_config: só service_role
DROP POLICY IF EXISTS "store_config_no_public" ON store_config;
CREATE POLICY "store_config_no_public" ON store_config FOR ALL TO anon USING (false) WITH CHECK (false);

-- profiles: dono
DROP POLICY IF EXISTS "profiles_owner" ON profiles;
CREATE POLICY "profiles_owner" ON profiles FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- fidelidade: dono pelo email
DROP POLICY IF EXISTS "fidelidade_owner" ON fidelidade;
CREATE POLICY "fidelidade_owner" ON fidelidade FOR SELECT USING (email = (SELECT email FROM profiles WHERE id = auth.uid()));

-- fidelidade_historico: dono
DROP POLICY IF EXISTS "fidelidade_historico_owner" ON fidelidade_historico;
CREATE POLICY "fidelidade_historico_owner" ON fidelidade_historico FOR SELECT USING (email = (SELECT email FROM profiles WHERE id = auth.uid()));

-- pedidos: dono
DROP POLICY IF EXISTS "pedidos_owner" ON pedidos;
CREATE POLICY "pedidos_owner" ON pedidos FOR SELECT USING (email = (SELECT email FROM profiles WHERE id = auth.uid()));

-- admin_logs: só service_role
DROP POLICY IF EXISTS "admin_logs_no_public" ON admin_logs;
CREATE POLICY "admin_logs_no_public" ON admin_logs FOR ALL TO anon USING (false) WITH CHECK (false);

-- cupons: leitura pública de ativos
DROP POLICY IF EXISTS "cupons_read_active" ON public.cupons;
CREATE POLICY "cupons_read_active" ON public.cupons FOR SELECT USING (ativo = true);
DROP POLICY IF EXISTS "cupons_no_public_write" ON public.cupons;
CREATE POLICY "cupons_no_public_write" ON public.cupons FOR INSERT TO anon WITH CHECK (false);

-- cupons_usuarios: dono
DROP POLICY IF EXISTS "cupons_usuarios_owner" ON public.cupons_usuarios;
CREATE POLICY "cupons_usuarios_owner" ON public.cupons_usuarios FOR SELECT USING (user_id = auth.uid());

-- notificacoes: dono pelo email
DROP POLICY IF EXISTS "notificacoes_proprio_email" ON public.notificacoes;
CREATE POLICY "notificacoes_proprio_email" ON public.notificacoes FOR ALL USING (auth.jwt() ->> 'email' = email) WITH CHECK (auth.jwt() ->> 'email' = email);

-- enderecos: dono pelo email
DROP POLICY IF EXISTS "enderecos_proprio_email" ON public.enderecos;
CREATE POLICY "enderecos_proprio_email" ON public.enderecos FOR ALL USING (auth.jwt() ->> 'email' = email) WITH CHECK (auth.jwt() ->> 'email' = email);

-- receitas: dono
DROP POLICY IF EXISTS "dono_le_receitas" ON receitas;
CREATE POLICY "dono_le_receitas" ON receitas FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "dono_cria_receitas" ON receitas;
CREATE POLICY "dono_cria_receitas" ON receitas FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "dono_atualiza_receitas" ON receitas;
CREATE POLICY "dono_atualiza_receitas" ON receitas FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "dono_apaga_receitas" ON receitas;
CREATE POLICY "dono_apaga_receitas" ON receitas FOR DELETE USING (auth.uid() = user_id);

-- favoritos: dono
DROP POLICY IF EXISTS "dono_le_favoritos" ON favoritos;
CREATE POLICY "dono_le_favoritos" ON favoritos FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "dono_cria_favoritos" ON favoritos;
CREATE POLICY "dono_cria_favoritos" ON favoritos FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "dono_atualiza_favoritos" ON favoritos;
CREATE POLICY "dono_atualiza_favoritos" ON favoritos FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "dono_apaga_favoritos" ON favoritos;
CREATE POLICY "dono_apaga_favoritos" ON favoritos FOR DELETE USING (auth.uid() = user_id);

-- 4) ÍNDICES
CREATE INDEX IF NOT EXISTS idx_notificacoes_email ON public.notificacoes(email);
CREATE INDEX IF NOT EXISTS idx_notificacoes_lida ON public.notificacoes(lida);
CREATE INDEX IF NOT EXISTS idx_enderecos_email ON public.enderecos(email);
CREATE INDEX IF NOT EXISTS idx_receitas_user_id ON receitas(user_id);
CREATE INDEX IF NOT EXISTS idx_favoritos_user_id ON favoritos(user_id);
CREATE INDEX IF NOT EXISTS idx_familia_responsavel ON public.familia(responsavel_email);
CREATE INDEX IF NOT EXISTS idx_familia_membro ON public.familia(membro_email);
CREATE INDEX IF NOT EXISTS idx_indicacoes_indicador ON public.indicacoes(indicador_email);
CREATE INDEX IF NOT EXISTS idx_indicacoes_indicado ON public.indicacoes(indicado_email);
CREATE INDEX IF NOT EXISTS idx_fidelidade_historico_email ON fidelidade_historico(email);
CREATE INDEX IF NOT EXISTS idx_pedidos_email ON pedidos(email);
CREATE INDEX IF NOT EXISTS idx_cupons_codigo ON public.cupons(codigo);
CREATE INDEX IF NOT EXISTS idx_cupons_usuarios_user ON public.cupons_usuarios(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_email ON admin_logs(admin_email);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON admin_logs(created_at desc);

-- 5) SEED
INSERT INTO public.store_config (key, value, is_secret) VALUES
  ('LI_APP_KEY', '', true),
  ('LI_API_KEY', '', true),
  ('MP_ACCESS_TOKEN', '', true),
  ('MP_PUBLIC_KEY', '', true),
  ('FID_PONTOS_POR_REAL', '2', false),
  ('FID_PONTOS_POR_DESC', '50', false)
ON CONFLICT (key) DO NOTHING;

-- Permissões
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
