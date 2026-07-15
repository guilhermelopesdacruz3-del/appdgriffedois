// Camada de segredos do backend.
//
// Em produção, os segredos (chaves da Loja Integrada + Mercado Pago) ficam no
// Supabase (tabela store_config), acessados com a SERVICE_ROLE key (server-only).
// Em modo demo/local sem Supabase configurado, cai para um arquivo .json local
// (server/.store-config.json) para não quebrar o fluxo.
//
// SEGURANÇA:
// - A SERVICE_ROLE nunca vai para o front nem para o bundle. Fica só em
//   process.env.SUPABASE_SERVICE_ROLE (lida no servidor).
// - getSecret devolve o valor; listConfig NUNCA devolve o valor (só status).

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_STORE_PATH = path.join(__dirname, ".store-config.json");
export const CONFIG_KEYS = ["LI_APP_KEY", "LI_API_KEY", "MP_ACCESS_TOKEN", "MP_PUBLIC_KEY"] as const;
export type ConfigKey = (typeof CONFIG_KEYS)[number];

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

let sb: SupabaseClient | null = null;
let sbReason: string | null = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE) {
  try {
    sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  } catch (e: any) {
    sbReason = e?.message || "falha ao criar cliente";
    sb = null;
  }
}

export const usingSupabase = Boolean(sb);
export function supabaseStatus(): string {
  if (sb) return "ok";
  return sbReason ? `indisponível (${sbReason}) — usando arquivo local` : "não configurado — usando arquivo local";
}

// ---------------------------------------------------------------------------
// Fallback local (arquivo .json)
// ---------------------------------------------------------------------------
function lerLocal(): Record<string, { value: string; updated_at: string }> {
  try {
    if (fs.existsSync(CONFIG_STORE_PATH)) return JSON.parse(fs.readFileSync(CONFIG_STORE_PATH, "utf8"));
  } catch {
    /* ignore */
  }
  return {};
}
function salvarLocal(obj: Record<string, unknown>) {
  fs.writeFileSync(CONFIG_STORE_PATH, JSON.stringify(obj, null, 2), { mode: 0o600 });
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

// Status de cada chave (NUNCA expõe o valor).
export async function listConfig(): Promise<
  { key: string; is_secret: boolean; updated_at: string | null; set: boolean }[]
> {
  if (sb) {
    const { data, error } = await sb.from("store_config").select("key,value,updated_at").in("key", CONFIG_KEYS);
    if (error) throw new Error(`Supabase: ${error.message}`);
    const mapa = new Map((data || []).map((r) => [r.key, r]));
    return CONFIG_KEYS.map((key) => {
      const r = mapa.get(key);
      return { key, is_secret: true, updated_at: r?.updated_at ?? null, set: Boolean(r?.value) };
    });
  }
  const store = lerLocal();
  return CONFIG_KEYS.map((key) => ({
    key,
    is_secret: true,
    updated_at: store[key]?.updated_at ?? null,
    set: Boolean(store[key]?.value),
  }));
}

// Salva uma ou mais chaves. Retorna quantas foram alteradas.
export async function saveConfig(cfg: Partial<Record<ConfigKey, string>>): Promise<number> {
  const entradas = Object.entries(cfg).filter(
    ([k, v]) => CONFIG_KEYS.includes(k as ConfigKey) && typeof v === "string" && v.trim()
  ) as [ConfigKey, string][];
  if (entradas.length === 0) return 0;

  if (sb) {
    const rows = entradas.map(([key, value]) => ({ key, value: value.trim(), is_secret: true, updated_at: new Date().toISOString() }));
    const { error } = await sb.from("store_config").upsert(rows, { onConflict: "key" });
    if (error) throw new Error(`Supabase: ${error.message}`);
    return rows.length;
  }

  const store = lerLocal();
  for (const [key, value] of entradas) {
    store[key] = { value: value.trim(), updated_at: new Date().toISOString() };
  }
  salvarLocal(store);
  return entradas.length;
}

// Lê o valor de uma chave (uso interno do servidor, ex.: Mercado Pago em produção).
export async function getSecret(key: ConfigKey): Promise<string | null> {
  if (sb) {
    const { data, error } = await sb.from("store_config").select("value").eq("key", key).single();
    if (error) return null;
    return data?.value || null;
  }
  return lerLocal()[key]?.value || null;
}
