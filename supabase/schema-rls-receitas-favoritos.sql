-- ============================================================
-- D'Griffe — RLS + tabelas de dados do cliente
-- Rode este SQL no Supabase → SQL Editor (em duas partes se precisar).
-- Garante que só o dono (auth.uid()) e o admin (service_role) veem os dados.
-- ============================================================

-- 1) Habilita RLS em profiles (se ainda não estiver habilitado)
-- O admin usa service_role, que BYPASSA RLS automaticamente (policy extra não é necessária).
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dono_le_perfil"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "dono_atualiza_perfil"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);


-- 2) Tabela: receitas (Receitas Salvas)
CREATE TABLE IF NOT EXISTS receitas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  tipo text NOT NULL DEFAULT 'grau', -- 'grau' | 'lente'
  descricao text NOT NULL,
  arquivo_url text NULL,            -- se quiser guardar PDF/imagem depois
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE receitas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dono_le_receitas"
  ON receitas FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "dono_cria_receitas"
  ON receitas FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "dono_atualiza_receitas"
  ON receitas FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "dono_apaga_receitas"
  ON receitas FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_receitas_user_id ON receitas(user_id);


-- 3) Tabela: favoritos (Favoritos do cliente)
CREATE TABLE IF NOT EXISTS favoritos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  produto_id integer NOT NULL,      -- ID da Loja Integrada
  sku text NULL,
  nome text NOT NULL,
  imagem text NULL,
  preco numeric(10,2) NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, produto_id)
);

ALTER TABLE favoritos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dono_le_favoritos"
  ON favoritos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "dono_cria_favoritos"
  ON favoritos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "dono_atualiza_favoritos"
  ON favoritos FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "dono_apaga_favoritos"
  ON favoritos FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_favoritos_user_id ON favoritos(user_id);
