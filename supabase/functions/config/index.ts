// Supabase Edge Function: config
// GET  -> lista store_config (sem valores secretos para o cliente)
// PUT  -> salva chaves das APIs (LI + Mercado Pago) — SÓ ADMIN (verifica is_admin).
// O admin preenche essas chaves pela interface, não precisando mexer no painel.
// Deploy: supabase functions deploy config --project-ref unpbvztvscuisqnzofqp

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  const sbUser = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });
  const { data: { user }, error } = await sbUser.auth.getUser(auth);
  if (error || !user) return json({ erro: "não autenticado" }, 401);

  // É admin?
  const { data: admin } = await sbUser.from("admin_users").select("user_id").eq("user_id", user.id).single();
  if (!admin) return json({ erro: "sem permissão de admin" }, 403);

  if (req.method === "GET") {
    const { data } = await sbUser.from("store_config").select("key,is_secret,updated_at").order("key");
    // Não devolve o valor de segredos para o cliente; só que existe/atualizado.
    const safe = (data || []).map((r: any) => ({ key: r.key, is_secret: r.is_secret, updated_at: r.updated_at, set: r.is_secret ? (r.value ? true : false) : r.value }));
    return json(safe, 200);
  }

  if (req.method === "PUT") {
    const body = await req.json();
    const keys = ["LI_APP_KEY", "LI_API_KEY", "MP_ACCESS_TOKEN", "ADMIN_PASSWORD"];
    for (const k of keys) {
      if (body[k] !== undefined) {
        await sbUser.from("store_config").upsert({ key: k, value: String(body[k]), is_secret: true, updated_at: new Date().toISOString() });
      }
    }
    return json({ ok: true }, 200);
  }
  return json({ erro: "método não suportado" }, 405);
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "*" } });
}
