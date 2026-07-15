import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON;

if (!url || !anon) {
  // Não quebra o app em dev local (modo demo antigo), mas avisa no console.
  console.warn(
    "[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON não definidos. " +
      "O app usa o proxy local se estiver rodando (server/index.mjs)."
  );
}

// Cliente público (anon). RLS no Supabase controla o que cada usuário enxerga.
export const supabase = createClient(url ?? "", anon ?? "", {
  auth: { persistSession: true, autoRefreshToken: true },
});

// Helper: base URL das Edge Functions.
export const FN_BASE =
  import.meta.env.VITE_SUPABASE_FUNCTIONS ||
  `${url ?? ""}/functions/v1`;

// Chama uma Edge Function autenticada com a sessão atual do usuário.
export async function callFn(path: string, opts: { method?: string; body?: unknown } = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${FN_BASE}/${path}`, {
    method: opts.method ?? "POST",
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(json?.erro || json?.message || `Edge ${path} -> ${res.status}`);
  return json;
}
