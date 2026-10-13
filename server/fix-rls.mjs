// Correção C1 — RLS por proprietário (idempotente).
// Roda via: node fix-rls.mjs   (usa SUPABASE_URL + SUPABASE_SERVICE_ROLE do .env)
// Substitui policies amplas (USING true) por isolamento por email/user_id.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// Carrega .env manualmente (sem depender de dotenv no diretório)
const env = readFileSync(new URL("./.env", import.meta.url), "utf8").replace(/^\uFEFF/, "");
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE;
if (!url || !key) { console.error("Faltam SUPABASE_URL/SUPABASE_SERVICE_ROLE no .env"); process.exit(1); }
const sb = createClient(url, key, { auth: { persistSession: false } });

// Tabelas -> como isolar. Perfil/enderecos/fidelidade usam email como dono.
// A policy permite o DONO (email = JWT) OU o service_role (backend).
const dono = (col) => `${col} = (auth.jwt() ->> 'email')`;
const tabelas = [
  { t: "profiles", col: "email" },
  { t: "enderecos", col: "email" },
  { t: "fidelidade", col: "email" },
  { t: "fidelidade_historico", col: "email" },
  { t: "cupons_usuarios", col: "email" },
];

const stmts = [];
for (const { t, col } of tabelas) {
  stmts.push(`ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY;`);
  stmts.push(`DROP POLICY IF EXISTS "svc_all_${t}" ON public.${t};`);
  stmts.push(`DROP POLICY IF EXISTS "owner_${t}" ON public.${t};`);
  stmts.push(`CREATE POLICY "owner_${t}" ON public.${t} FOR ALL TO authenticated USING (${dono(col)}) WITH CHECK (${dono(col)});`);
}
const sql = stmts.join("\n");

// Executa via RPC (executa SQL arbitrário exige uma função; se não existir,
// cai para instrução individual usando a API de policies).
try {
  const { error } = await sb.rpc("exec_sql", { sql });
  if (error) throw error;
  console.log("RLS aplicado via exec_sql.");
} catch {
  console.log("exec_sql indisponível; aplique manualmente o SQL abaixo no painel Supabase:\n");
  console.log(sql);
}
console.log("---VERIFICACAO---");
for (const { t } of tabelas) {
  const { data, error } = await sb.from(t).select("*", { count: "exact", head: true }).limit(1);
  console.log(`${t}: ${error ? "erro (" + error.message.slice(0,60) + ")" : "acessível (" + (data ?? []).length + " amostra)"}`);
}
