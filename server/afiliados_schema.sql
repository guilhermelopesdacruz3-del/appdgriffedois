-- Tabela de afiliados do site D'Griffe
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

-- Índice para busca por email
CREATE INDEX IF NOT EXISTS idx_afiliados_email ON public.afiliados(email);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.afiliados ENABLE ROW LEVEL SECURITY;

-- Permitir inserção anônima (cadastro de afiliado no site)
CREATE POLICY "Permitir cadastro de afiliado" ON public.afiliados
  FOR INSERT TO anon
  WITH CHECK (true);

-- Permitir leitura apenas para admin
CREATE POLICY "Permitir leitura para admin" ON public.afiliados
  FOR SELECT TO authenticated
  USING (true);
