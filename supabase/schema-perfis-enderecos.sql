-- ---------------------------------------------------------------------------
-- Perfil do cliente (C2) + Livro de endereços (C3) + Preferências (C7)
-- Idempotente: roda quantas vezes quiser.
-- ---------------------------------------------------------------------------

-- Reaproveita a tabela `profiles` já existente (chave por email, sem FK rígida).
-- Garante que a coluna `preferencias` (jsonb) existe.
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS preferencias jsonb DEFAULT '{}'::jsonb;

-- Se a tabela `profiles` não existir (deploy limpo), cria.
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE,
  nome text,
  telefone text,
  cpf text,
  cidade text,
  estado text,
  preferencias jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- C3 — livro de endereços (chave por email do cliente).
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

CREATE INDEX IF NOT EXISTS idx_enderecos_email ON public.enderecos(email);

-- ---------------------------------------------------------------------------
-- RLS: o cliente só acessa seus próprios dados (isolamento por email).
-- O backend usa a SERVICE_ROLE (bypassa RLS), mas ativamos RLS para o caso de
-- o app usar o client anon do Supabase diretamente.
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enderecos ENABLE ROW LEVEL SECURITY;

-- Policy: permitir leitura/escrita pelo próprio email (quando autenticado).
DROP POLICY IF EXISTS "profiles_proprio_email" ON public.profiles;
CREATE POLICY "profiles_proprio_email" ON public.profiles
  FOR ALL USING (auth.jwt() ->> 'email' = email)
  WITH CHECK (auth.jwt() ->> 'email' = email);

DROP POLICY IF EXISTS "enderecos_proprio_email" ON public.enderecos;
CREATE POLICY "enderecos_proprio_email" ON public.enderecos
  FOR ALL USING (auth.jwt() ->> 'email' = email)
  WITH CHECK (auth.jwt() ->> 'email' = email);
