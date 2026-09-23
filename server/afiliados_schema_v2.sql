-- ============================================================
-- AFILIADOS v2: Tabela de afiliados + vendas para D'Griffe
-- Execução: Supabase Dashboard → SQL Editor → colar e rodar
-- ============================================================

-- 1. Adicionar campos na tabela afiliados (se não existem)
ALTER TABLE public.afiliados ADD COLUMN IF NOT EXISTS cupom text;
ALTER TABLE public.afiliados ADD COLUMN IF NOT EXISTS porcentagem_ganho numeric(5,2) DEFAULT 10.00;
ALTER TABLE public.afiliados ADD COLUMN IF NOT EXISTS desconto_usuario numeric(5,2) DEFAULT 5.00;

-- 2. Código único para afiliados antigos (se estiverem sem cupom)
UPDATE public.afiliados SET cupom = 'AFILIADO' || UPPER(SUBSTRING(nome, 1, 3)) || FLOOR(RANDOM() * 900 + 100)::text WHERE cupom IS NULL;

-- 3. Tornar cupom único
ALTER TABLE public.afiliados ADD CONSTRAINT afiliados_cupom_unique UNIQUE (cupom);

-- 4. Tabela de vendas de afiliados
CREATE TABLE IF NOT EXISTS public.afiliado_vendas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  afiliado_id uuid NOT NULL REFERENCES public.afiliados(id) ON DELETE CASCADE,
  produto_nome text NOT NULL,
  produto_id integer,
  quantidade integer NOT NULL DEFAULT 1,
  valor_total numeric(10,2) NOT NULL,
  ganho_afiliado numeric(10,2) NOT NULL,
  valor_com_desconto numeric(10,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 5. Índice para buscar vendas por afiliado
CREATE INDEX IF NOT EXISTS idx_afiliado_vendas_afiliado ON public.afiliado_vendas(afiliado_id);
CREATE INDEX IF NOT EXISTS idx_afiliado_vendas_created ON public.afiliado_vendas(created_at);

-- 6. RLS para vendas
ALTER TABLE public.afiliado_vendas ENABLE ROW LEVEL SECURITY;

CREATE POLICY afiliado_vendas_service ON public.afiliado_vendas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7. Verificação final
SELECT 'afiliados' as tabela, count(*) as total FROM public.afiliados
UNION ALL
SELECT 'afiliado_vendas', count(*) FROM public.afiliado_vendas;
