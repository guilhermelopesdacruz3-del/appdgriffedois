-- ---------------------------------------------------------------------------
-- Notificações in-app (C7) — tabela de persistência real no Supabase.
-- O backend tenta gravar aqui primeiro; sem a tabela, cai num JSON efêmero
-- no Render (some a cada redeploy) e a notificação NÃO chega ao cliente.
-- Idempotente.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  titulo text NOT NULL,
  corpo text NOT NULL,
  lida boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notificacoes_email ON public.notificacoes(email);
CREATE INDEX IF NOT EXISTS idx_notificacoes_lida ON public.notificacoes(lida);

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

-- O app pode ler/escrever via service_role (backend). Para acesso direto do
-- cliente autenticado, permitimos pelo próprio e-mail do JWT.
DROP POLICY IF EXISTS "notificacoes_proprio_email" ON public.notificacoes;
CREATE POLICY "notificacoes_proprio_email" ON public.notificacoes
  FOR ALL USING (auth.jwt() ->> 'email' = email)
  WITH CHECK (auth.jwt() ->> 'email' = email);
