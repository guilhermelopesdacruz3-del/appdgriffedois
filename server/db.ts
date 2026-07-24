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
export const CONFIG_KEYS = ["LI_APP_KEY", "LI_API_KEY", "MP_ACCESS_TOKEN", "MP_PUBLIC_KEY", "YT_API_KEY", "YT_CHANNEL_ID"] as const;
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
    entradas.forEach(([key]) => secretCache.delete(key)); // nova chave vale na hora
    return rows.length;
  }

  const store = lerLocal();
  for (const [key, value] of entradas) {
    store[key] = { value: value.trim(), updated_at: new Date().toISOString() };
  }
  salvarLocal(store);
  return entradas.length;
}

// Cache em memória das chaves (TTL 60s). Sob concorrência, evita 1 query de
// Supabase por requisição — corta a carga no banco em picos (ex.: 100 usuários
// comprando ao mesmo tempo). Invalidado em saveConfig para a nova chave valer na hora.
const SECRET_TTL_MS = 60_000;
const secretCache = new Map<ConfigKey, { value: string | null; expira: number }>();

function lerValor(key: ConfigKey): string | null {
  return lerLocal()[key]?.value || null;
}

// Lê o valor de uma chave (uso interno do servidor, ex.: Mercado Pago em produção).
export async function getSecret(key: ConfigKey): Promise<string | null> {
  const cached = secretCache.get(key);
  if (cached && cached.expira > Date.now()) return cached.value;
  let value: string | null;
  if (sb) {
    const { data, error } = await sb.from("store_config").select("value").eq("key", key).single();
    if (error) value = null;
    else value = data?.value || null;
  } else {
    value = lerValor(key);
  }
  secretCache.set(key, { value, expira: Date.now() + SECRET_TTL_MS });
  return value;
}

// ---------------------------------------------------------------------------
// Fidelidade (pontos por compra)
// ---------------------------------------------------------------------------
// Regras padrão (admin pode ajustar via store_config): 1 ponto/R$1; 100 pts = R$10.
const FID_LOCAL_PATH = path.join(__dirname, ".fidelidade.json");

function lerFidelidadeLocal(): Record<string, number> {
  try {
    if (fs.existsSync(FID_LOCAL_PATH)) return JSON.parse(fs.readFileSync(FID_LOCAL_PATH, "utf8"));
  } catch {
    /* ignore */
  }
  return {};
}
function salvarFidelidadeLocal(obj: Record<string, number>) {
  fs.writeFileSync(FID_LOCAL_PATH, JSON.stringify(obj, null, 2), { mode: 0o600 });
}

export async function getRegrasFidelidade(): Promise<{ pontosPorReal: number; pontosPorDesconto: number }> {
  const def = { pontosPorReal: 1, pontosPorDesconto: 100 };
  if (sb) {
    const { data } = await sb.from("store_config").select("key,value").in("key", ["FID_PONTOS_POR_REAL", "FID_PONTOS_POR_DESC"]);
    const mapa = new Map((data || []).map((r) => [r.key, Number(r.value) || 0]));
    return {
      pontosPorReal: mapa.get("FID_PONTOS_POR_REAL") || def.pontosPorReal,
      pontosPorDesconto: mapa.get("FID_PONTOS_POR_DESC") || def.pontosPorDesconto,
    };
  }
  return def;
}

export async function getPontos(email: string): Promise<number> {
  const e = (email || "").trim().toLowerCase();
  if (!e) return 0;
  if (sb) {
    const { data, error } = await sb.from("fidelidade").select("pontos").eq("email", e).single();
    if (error || !data) return 0;
    return data.pontos || 0;
  }
  return lerFidelidadeLocal()[e] || 0;
}

// Credita pontos após pagamento aprovado. valorGasto em reais.
export async function creditarPontos(email: string, valorGasto: number, ref?: string): Promise<number> {
  const e = (email || "").trim().toLowerCase();
  if (!e || !(valorGasto > 0)) return 0;
  const { pontosPorReal } = await getRegrasFidelidade();
  const pontos = Math.floor(valorGasto * pontosPorReal);
  if (pontos <= 0) return 0;
  if (sb) {
    const { error } = await sb.rpc("creditar_pontos", { p_email: e, p_pontos: pontos, p_ref: ref || null });
    // Se a RPC não existir, fazemos upsert manual:
    if (error) {
      const { data } = await sb.from("fidelidade").select("pontos").eq("email", e).single();
      const atual = (data?.pontos || 0) + pontos;
      await sb.from("fidelidade").upsert({ email: e, pontos: atual, updated_at: new Date().toISOString() }, { onConflict: "email" });
      await sb.from("fidelidade_historico").insert({ email: e, tipo: "credito", pontos, motivo: "compra", ref: ref || null });
    }
    return pontos;
  }
  const store = lerFidelidadeLocal();
  store[e] = (store[e] || 0) + pontos;
  salvarFidelidadeLocal(store);
  return pontos;
}

// ---------------------------------------------------------------------------
// Pedidos do Mercado Pago (espelho + idempotência de webhook)
// ---------------------------------------------------------------------------
export interface PedidoMP {
  mp_payment_id: string;
  email: string | null;
  valor: number;
  status: string;
  external_reference?: string | null;
  pontos_creditados?: boolean;
  li_pedido?: number | null;
  created_at?: string;
  updated_at?: string;
}

// true se já processamos este pagamento (evita crédito duplo de pontos).
export async function jaProcessadoMP(mpPaymentId: string): Promise<boolean> {
  if (!sb) return false;
  const { data } = await sb.from("pedidos").select("mp_payment_id").eq("mp_payment_id", mpPaymentId).single();
  return Boolean(data);
}

// Busca o pedido espelhado pelo mp_payment_id (para recuperar o li_pedido).
export async function buscarPedidoMP(mpPaymentId: string): Promise<{ li_pedido: number | null } | null> {
  if (!sb) return null;
  const { data } = await sb.from("pedidos").select("li_pedido").eq("mp_payment_id", mpPaymentId).single();
  return data ? { li_pedido: data.li_pedido ?? null } : null;
}

// Insere/atualiza o espelho do pedido MP. Se não houver Supabase, vira no-op.
export async function upsertPedidoMP(p: PedidoMP): Promise<void> {
  if (!sb) return;
  const agora = new Date().toISOString();
  await sb.from("pedidos").upsert(
    {
      mp_payment_id: p.mp_payment_id,
      email: p.email,
      valor: p.valor,
      status: p.status,
      external_reference: p.external_reference ?? null,
      pontos_creditados: p.pontos_creditados ?? false,
      li_pedido: p.li_pedido ?? null,
      updated_at: agora,
    },
    { onConflict: "mp_payment_id" }
  );
}

// Marca o pedido como aprovado e registra que os pontos foram creditados.
export async function confirmarPagamentoMP(mpPaymentId: string, creditouPontos: boolean): Promise<void> {
  if (!sb) return;
  await sb.from("pedidos").update({
    status: "aprovado",
    pontos_creditados: creditouPontos,
    updated_at: new Date().toISOString(),
  }).eq("mp_payment_id", mpPaymentId);
}

// Resgata pontos (desconto no checkout). Retorna os pontos usados ou 0 se insuficiente.
export async function resgatarPontos(email: string, pontos: number): Promise<number> {
  const e = (email || "").trim().toLowerCase();
  if (!e || pontos <= 0) return 0;
  if (sb) {
    const { data } = await sb.from("fidelidade").select("pontos").eq("email", e).single();
    const saldo = data?.pontos || 0;
    if (saldo < pontos) return 0;
    await sb.from("fidelidade").upsert({ email: e, pontos: saldo - pontos, updated_at: new Date().toISOString() }, { onConflict: "email" });
    await sb.from("fidelidade_historico").insert({ email: e, tipo: "resgate", pontos, motivo: "desconto", ref: null });
    return pontos;
  }
  const store = lerFidelidadeLocal();
  const saldo = store[e] || 0;
  if (saldo < pontos) return 0;
  store[e] = saldo - pontos;
  salvarFidelidadeLocal(store);
  return pontos;
}

export interface HistoricoFidelidade {
  id?: number;
  email: string;
  tipo: "credito" | "resgate";
  pontos: number;
  motivo?: string | null;
  ref?: string | null;
  created_at?: string;
}

// Histórico de créditos/resgates de um e-mail (tabela fidelidade_historico).
// Define o saldo exato de pontos (admin ajusta manualmente).
export async function setarPontos(email: string, pontos: number): Promise<number> {
  const e = (email || "").trim().toLowerCase();
  const p = Math.max(0, Math.floor(pontos || 0));
  if (!e) return 0;
  if (sb) {
    await sb.from("fidelidade").upsert({ email: e, pontos: p, updated_at: new Date().toISOString() }, { onConflict: "email" });
    await sb.from("fidelidade_historico").insert({ email: e, tipo: "credito", pontos: p, motivo: "ajuste manual", ref: null });
    return p;
  }
  const store = lerFidelidadeLocal();
  store[e] = p;
  salvarFidelidadeLocal(store);
  return p;
}

// Salva as regras de fidelidade (pontos por real / por desconto).
export async function salvarRegrasFidelidade(pontosPorReal: number, pontosPorDesconto: number): Promise<void> {
  if (!sb) return;
  const mapa = [
    { key: "FID_PONTOS_POR_REAL", value: String(pontosPorReal) },
    { key: "FID_PONTOS_POR_DESC", value: String(pontosPorDesconto) },
  ];
  for (const r of mapa) {
    await sb.from("store_config").upsert({ key: r.key, value: r.value }, { onConflict: "key" });
  }
}

export async function getHistoricoFidelidade(email: string, limite = 50): Promise<HistoricoFidelidade[]> {
  const e = (email || "").trim().toLowerCase();
  if (!e || !sb) return [];
  const { data, error } = await sb
    .from("fidelidade_historico")
    .select("id,email,tipo,pontos,motivo,ref,created_at")
    .eq("email", e)
    .order("created_at", { ascending: false })
    .limit(limite);
  if (error) return [];
  return (data || []) as HistoricoFidelidade[];
}

// ---------------------------------------------------------------------------
// Auditoria de ações do admin (A8)
// ---------------------------------------------------------------------------
export interface AdminLog {
  id?: number;
  admin_email: string;
  acao: string;
  detalhe?: Record<string, unknown> | null;
  ip?: string | null;
  created_at?: string;
}

export async function registrarLog(entry: AdminLog): Promise<void> {
  if (!sb) return;
  const admin_email = (entry.admin_email || "").trim().toLowerCase();
  if (!admin_email) return;
  await sb.from("admin_logs").insert({
    admin_email,
    acao: String(entry.acao || "").trim(),
    detalhe: entry.detalhe || {},
    ip: entry.ip || null,
    created_at: entry.created_at || new Date().toISOString(),
  });
}

export function supabaseClient(): SupabaseClient | null {
  return sb;
}
