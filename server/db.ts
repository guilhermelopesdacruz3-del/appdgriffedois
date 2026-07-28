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

// ---------------------------------------------------------------------------
// REGRAS DO PROGRAMA DE FIDELIDADE (plano oficial) — parametrizáveis.
// ---------------------------------------------------------------------------

// Níveis de relacionamento (faixas em pontos).
export type Nivel = {
  id: "cliente" | "gold" | "platinum" | "diamond";
  nome: string;
  min: number;
  max: number | null;
  cashbackAdicional: number; // % extra sobre o base, por categoria
  cupomAniversario: number; // R$
  beneficios: string[];
};

export const NIVEIS_PADRAO: Nivel[] = [
  { id: "cliente", nome: "Cliente D'Griffe", min: 0, max: 4999, cashbackAdicional: 0, cupomAniversario: 0, beneficios: ["Benefício fidelidade", "Cashback base", "Acesso completo ao app"] },
  { id: "gold", nome: "Gold", min: 5000, max: 14999, cashbackAdicional: 2, cupomAniversario: 50, beneficios: ["Cashback base +2%", "Promoções antecipadas", "Cupom aniversário R$50"] },
  { id: "platinum", nome: "Platinum", min: 15000, max: 29999, cashbackAdicional: 3, cupomAniversario: 100, beneficios: ["Cashback base +3%", "Cupom aniversário R$100", "Atendimento prioritário", "Garantia estendida"] },
  { id: "diamond", nome: "Diamond", min: 30000, max: null, cashbackAdicional: 5, cupomAniversario: 200, beneficios: ["Cashback base +5%", "Cupom aniversário R$200", "Atendimento VIP", "Eventos exclusivos"] },
];

// Cashback base por categoria (% sobre o valor).
export const CASHBACK_BASE: Record<string, number> = {
  grau: 2,
  solar: 2,
  joias: 2,
  relogios: 1,
};

export async function getNiveis(): Promise<Nivel[]> {
  // Por enquanto fixo em NIVEIS_PADRAO; futuramente lido de store_config se houver override.
  return NIVEIS_PADRAO;
}

// Calcula o nível a partir dos pontos.
export function calcularNivel(pontos: number, niveis: Nivel[] = NIVEIS_PADRAO): { nivel: Nivel; indice: number; prox: Nivel | null; ptsParaProx: number } {
  const p = Math.max(0, Math.floor(pontos));
  let indice = 0;
  for (let i = 0; i < niveis.length; i++) {
    if (p >= niveis[i].min) indice = i;
  }
  const nivel = niveis[indice];
  const prox = indice < niveis.length - 1 ? niveis[indice + 1] : null;
  const ptsParaProx = prox ? Math.max(0, prox.min - p) : 0;
  return { nivel, indice, prox, ptsParaProx };
}

// Cashback (% e R$) para um valor de compra numa categoria, dado o nível.
export function calcularCashback(valor: number, categoria: string, nivel: Nivel): { percentual: number; valorCashback: number } {
  const base = CASHBACK_BASE[categoria] ?? 0;
  const percentual = Math.max(0, base + nivel.cashbackAdicional);
  const valorCashback = Number(((valor * percentual) / 100).toFixed(2));
  return { percentual, valorCashback };
}

// ---------------------------------------------------------------------------
// MISSÕES (plano oficial): bônus por comportamento.
// ---------------------------------------------------------------------------
export const MISSOES: { id: string; descricao: string; pontos: number; tipo: "cadastro" | "primeira_compra" | "avaliacao" | "indicacao_convertida" | "recompra" }[] = [
  { id: "cadastro_completo", descricao: "Completar cadastro", pontos: 100, tipo: "cadastro" },
  { id: "primeira_compra", descricao: "Primeira compra", pontos: 500, tipo: "primeira_compra" },
  { id: "avaliar_atendimento", descricao: "Avaliar atendimento", pontos: 100, tipo: "avaliacao" },
  { id: "indicacao_convertida", descricao: "Indicação convertida em venda", pontos: 200, tipo: "indicacao_convertida" },
  { id: "recompra_12m", descricao: "Recompra em até 12 meses", pontos: 400, tipo: "recompra" },
];

// Regras de validade (do plano)
export const VALIDADE_PONTOS_MESES_SEM_MOV = 24;
export const VALIDADE_PONTOS_MESES_EXPIRACAO = 36;
export const VALIDADE_CASHBACK_MESES_SEM_MOV = 12;
export const VALIDADE_CASHBACK_DIAS_ADICIONAIS = 180;
// ---------------------------------------------------------------------------
export const INDICACAO_CREDITO_RS = 50;
export const INDICACAO_PONTOS = 200;
export const INDICACAO_LIMITE_ANUAL = 10;

// Gera/retorna código único de indicação para o email (cliente).
export async function gerarCodigoIndicacao(email: string): Promise<string> {
  const e = (email || "").trim().toLowerCase();
  if (!e) throw new Error("Email obrigatório.");
  if (sb) {
    // Busca código existente.
    const { data: existente } = await sb.from("indicacoes").select("codigo").eq("indicador_email", e).eq("tipo", "indicador").maybeSingle();
    if (existente?.codigo) return existente.codigo;
    // Gera código DG-XXXXX (5 chars alfanuméricos).
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let codigo = "";
    for (let i = 0; i < 5; i++) codigo += chars[Math.floor(Math.random() * chars.length)];
    const codigoFinal = `DG-${codigo}`;
    await sb.from("indicacoes").insert({ codigo: codigoFinal, indicador_email: e, tipo: "indicador" });
    return codigoFinal;
  }
  // Fallback local (sem Supabase): código determinístico.
  return `DG-${Buffer.from(e).slice(0, 5).toString("base64").replace(/[^A-Z0-9]/gi, "X").toUpperCase().slice(0, 5)}`;
}

// Registra uma indicação (indicador indica indicado).
export async function registrarIndicacao(indicadorEmail: string, indicadoEmail: string): Promise<{ ok: boolean; erro?: string }> {
  const ind = (indicadorEmail || "").trim().toLowerCase();
  const indado = (indicadoEmail || "").trim().toLowerCase();
  if (!ind || !indado || ind === indado) return { ok: false, erro: "Dados inválidos." };
  if (sb) {
    // Limite anual de 10 indicações convertidas.
    const { count } = await sb.from("indicacoes").select("*", { count: "exact", head: true }).eq("indicador_email", ind).eq("status", "convertida").gte("created_at", new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString());
    if ((count ?? 0) >= INDICACAO_LIMITE_ANUAL) return { ok: false, erro: `Limite de ${INDICACAO_LIMITE_ANUAL} indicações/ano atingido.` };
    // Evita duplicata.
    const { data: dup } = await sb.from("indicacoes").select("id").eq("indicador_email", ind).eq("indicado_email", indado).maybeSingle();
    if (dup) return { ok: false, erro: "Indicação já registrada." };
    await sb.from("indicacoes").insert({ indicador_email: ind, indicado_email: indado, status: "pendente" });
  }
  return { ok: true };
}

// Confirma indicação (chamado quando o indicado faz 1ª compra).
export async function creditarIndicacao(indicadorEmail: string, indicadoEmail: string): Promise<{ creditoRs: number; pontos: number }> {
  const ind = (indicadorEmail || "").trim().toLowerCase();
  const indado = (indicadoEmail || "").trim().toLowerCase();
  if (!ind || !indado || ind === indado) return { creditoRs: 0, pontos: 0 };
  if (sb) {
    const { data: pend } = await sb.from("indicacoes").select("id").eq("indicador_email", ind).eq("indicado_email", indado).eq("status", "pendente").maybeSingle();
    if (!pend) return { creditoRs: 0, pontos: 0 };
    await sb.from("indicacoes").update({ status: "convertida", convertido_at: new Date().toISOString() }).eq("id", pend.id);
    await creditarCreditoFidelidade(ind, INDICACAO_CREDITO_RS, "indicacao");
    await creditarPontos(ind, INDICACAO_PONTOS, `indicacao-${indado}`);
    return { creditoRs: INDICACAO_CREDITO_RS, pontos: INDICACAO_PONTOS };
  }
  return { creditoRs: 0, pontos: 0 };
}

export async function getIndicacoes(email: string): Promise<any[]> {
  const e = (email || "").trim().toLowerCase();
  if (!sb) return [];
  const { data } = await sb.from("indicacoes").select("*").or(`indicador_email.eq.${e},indicado_email.eq.${e}`).order("created_at", { ascending: false });
  return data || [];
}

// ---------------------------------------------------------------------------
// CLUBE FAMÍLIA (plano oficial): até 5 membros, 20% dos pontos viram crédito.
// ---------------------------------------------------------------------------
export const FAMILIA_LIMITE_MEMBROS = 5;
export const FAMILIA_PERCENTUAL_PONTOS = 20; // % dos pontos da compra viram crédito família
export const CREDITOS_FAMILIA: Record<number, number> = { 5000: 50, 10000: 100, 20000: 200 };

export async function getClubeFamilia(email: string): Promise<any[]> {
  const e = (email || "").trim().toLowerCase();
  if (!sb) return [];
  const { data } = await sb.from("familia").select("*").eq("responsavel_email", e).order("created_at", { ascending: false });
  return data || [];
}

export async function adicionarFamiliar(responsavelEmail: string, familiarEmail: string): Promise<{ ok: boolean; erro?: string }> {
  const r = (responsavelEmail || "").trim().toLowerCase();
  const f = (familiarEmail || "").trim().toLowerCase();
  if (!r || !f || r === f) return { ok: false, erro: "Dados inválidos." };
  if (sb) {
    const { count } = await sb.from("familia").select("*", { count: "exact", head: true }).eq("responsavel_email", r);
    if ((count ?? 0) >= FAMILIA_LIMITE_MEMBROS) return { ok: false, erro: `Limite de ${FAMILIA_LIMITE_MEMBROS} membros atingido.` };
    const { error } = await sb.from("familia").insert({ responsavel_email: r, membro_email: f });
    if (error) return { ok: false, erro: error.message };
  }
  return { ok: true };
}

// Credita 20% dos pontos da compra para a conta família do responsável.
export async function creditarFamilia(responsavelEmail: string, pontosCompra: number): Promise<number> {
  const r = (responsavelEmail || "").trim().toLowerCase();
  if (!r || pontosCompra <= 0) return 0;
  const pontosFamilia = Math.floor((pontosCompra * FAMILIA_PERCENTUAL_PONTOS) / 100);
  if (sb && pontosFamilia > 0) {
    await creditarCreditoFidelidade(r, 0, "familia", pontosFamilia); // crédito em pontos família
  }
  return pontosFamilia;
}

// Créditos Família disponíveis (R$) conforme pontos acumulados.
export async function getCreditosFamilia(email: string): Promise<{ pontos: number; creditoRs: number }> {
  const e = (email || "").trim().toLowerCase();
  if (!sb) return { pontos: 0, creditoRs: 0 };
  const { data } = await sb.from("fidelidade_historico").select("pontos").eq("email", e).eq("tipo", "familia").eq("credito_rs", 0).maybeSingle();
  const pontos = data?.pontos ?? 0;
  let creditoRs = 0;
  const thresholds = Object.keys(CREDITOS_FAMILIA).map(Number).sort((a, b) => a - b);
  for (const t of thresholds) { if (pontos >= t) creditoRs = CREDITOS_FAMILIA[t]; }
  return { pontos, creditoRs };
}

// Benefício fidelidade base: 10% parcelado / 15% Pix (do plano).
export const BENEFICIO_BASE = { parcelado: 10, pix: 15 };

// Teto máximo de benefícios por venda: 20% do valor total (do plano).
export const TETO_BENEFICIOS_PERC = 20;

export async function getPontos(email: string): Promise<number> {
  const e = (email || "").trim().toLowerCase();
  if (!e) return 0;
  // Se há Supabase, ele É a fonte de verdade (persiste entre reinícios do Render).
  // O espelho local (arquivo) é efêmero no Render e só serve p/ dev sem banco.
  if (sb) {
    try {
      const { data, error } = await sb.from("fidelidade").select("pontos").eq("email", e).single();
      if (!error && data) return data.pontos || 0;
      if (error && /does not exist|relation/i.test(error.message)) {
        console.warn("[fidelidade] tabela 'fidelidade' ausente no Supabase — retornando 0.");
      }
      return 0;
    } catch {
      return 0;
    }
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
    // Supabase é a fonte de verdade em produção — não usar espelho local efêmero.
    try {
      const { error } = await sb.rpc("creditar_pontos", { p_email: e, p_pontos: pontos, p_ref: ref || null });
      if (error) {
        const { data } = await sb.from("fidelidade").select("pontos").eq("email", e).single();
        const atual = (data?.pontos || 0) + pontos;
        await sb.from("fidelidade").upsert({ email: e, pontos: atual, updated_at: new Date().toISOString() }, { onConflict: "email" });
        await sb.from("fidelidade_historico").insert({ email: e, tipo: "credito", pontos, motivo: "compra", ref: ref || null });
      }
      return pontos;
    } catch {
      return 0; // falha no SB não deve criar saldo fantasma no arquivo local
    }
  }
  // Sem Supabase (dev/local): espelho em arquivo.
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
  // Saldo efetivo vindo do Supabase (fonte de verdade em produção).
  if (sb) {
    try {
      const { data } = await sb.from("fidelidade").select("pontos").eq("email", e).single();
      const saldo = data?.pontos || 0;
      if (saldo < pontos) return 0;
      const novo = saldo - pontos;
      await sb.from("fidelidade").upsert({ email: e, pontos: novo, updated_at: new Date().toISOString() }, { onConflict: "email" });
      await sb.from("fidelidade_historico").insert({ email: e, tipo: "resgate", pontos, motivo: "desconto", ref: null });
      return pontos;
    } catch {
      return 0;
    }
  }
  // Sem Supabase (dev/local): espelho em arquivo.
  const saldoLocal = lerFidelidadeLocal()[e] || 0;
  if (saldoLocal < pontos) return 0;
  const novo = saldoLocal - pontos;
  const store = lerFidelidadeLocal();
  store[e] = novo;
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
    // Supabase é a fonte de verdade em produção.
    try {
      await sb.from("fidelidade").upsert({ email: e, pontos: p, updated_at: new Date().toISOString() }, { onConflict: "email" });
      await sb.from("fidelidade_historico").insert({ email: e, tipo: "credito", pontos: p, motivo: "ajuste manual", ref: null });
      return p;
    } catch {
      return 0;
    }
  }
  // Sem Supabase (dev/local): espelho em arquivo.
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

// ---------------------------------------------------------------------------
// NOTIFICAÇÕES IN-APP (cliente) — fase 1: cupons/promoções via admin.
// Fallback Supabase (tabela notificacoes) -> arquivo .notificacoes.json local.
// ---------------------------------------------------------------------------
export interface Notificacao {
  id: string;
  email: string;
  titulo: string;
  corpo: string;
  tipo: "cupom" | "promocao" | "produto" | "carrinho" | "geral";
  lida: boolean;
  created_at: string;
}

const NOTIF_LOCAL_PATH = path.join(__dirname, ".notificacoes.json");

function lerNotificacoesLocal(): Notificacao[] {
  try {
    const raw = fs.readFileSync(NOTIF_LOCAL_PATH, "utf8");
    return JSON.parse(raw) as Notificacao[];
  } catch {
    return [];
  }
}
function salvarNotificacoesLocal(lista: Notificacao[]): void {
  try {
    fs.writeFileSync(NOTIF_LOCAL_PATH, JSON.stringify(lista, null, 2));
  } catch { /* ignora */ }
}

export async function salvarNotificacao(n: Omit<Notificacao, "id" | "lida" | "created_at"> & Partial<Notificacao>): Promise<Notificacao> {
  const notif: Notificacao = {
    id: n.id || `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    email: (n.email || "").trim().toLowerCase(),
    titulo: n.titulo || "",
    corpo: n.corpo || "",
    tipo: (n.tipo || "geral") as Notificacao["tipo"],
    lida: n.lida ?? false,
    created_at: n.created_at || new Date().toISOString(),
  };
  if (!notif.email) return notif;
  if (sb) {
    try {
      await sb.from("notificacoes").insert({
        id: notif.id, email: notif.email, titulo: notif.titulo, corpo: notif.corpo,
        tipo: notif.tipo, lida: notif.lida, created_at: notif.created_at,
      });
      return notif;
    } catch {
      // Tabela pode não existir ainda — fallback para JSON local.
    }
  }
  const lista = lerNotificacoesLocal();
  lista.push(notif);
  salvarNotificacoesLocal(lista);
  return notif;
}

export async function listarNotificacoes(email: string): Promise<Notificacao[]> {
  const e = (email || "").trim().toLowerCase();
  if (!e) return [];
  let doSb: Notificacao[] = [];
  if (sb) {
    try {
      const { data, error } = await sb
        .from("notificacoes").select("*").eq("email", e).order("created_at", { ascending: false }).limit(50);
      if (!error && data) doSb = data as Notificacao[];
    } catch { /* ignora */ }
  }
  // Mescla com o JSON local (fallback / histórico) e deduplica por id.
  const local = lerNotificacoesLocal().filter((n) => n.email === e);
  const mapa = new Map<string, Notificacao>();
  for (const n of [...local, ...doSb]) mapa.set(n.id, n);
  return Array.from(mapa.values()).sort((a, b) => (b.created_at < a.created_at ? -1 : 1));
}

export async function marcarNotificacaoLida(email: string, id: string): Promise<void> {
  const e = (email || "").trim().toLowerCase();
  if (!e) return;
  if (sb) {
    try {
      await sb.from("notificacoes").update({ lida: true }).eq("email", e).eq("id", id);
    } catch { /* ignora */ }
  }
  const lista = lerNotificacoesLocal();
  const n = lista.find((x) => x.email === e && x.id === id);
  if (n) { n.lida = true; salvarNotificacoesLocal(lista); }
}

export function supabaseClient(): SupabaseClient | null {
  return sb;
}

// ---------------------------------------------------------------------------
// PERFIL DO CLIENTE (nome/telefone) — C2
// ---------------------------------------------------------------------------
export interface PerfilCliente {
  email: string;
  nome?: string;
  telefone?: string;
}

// Atualiza nome/telefone na tabela `perfis` (e no Auth user, se possível).
export async function salvarPerfil(p: PerfilCliente): Promise<void> {
  const e = (p.email || "").trim().toLowerCase();
  if (!e || !sb) return;
  const row = {
    email: e,
    nome: p.nome || null,
    telefone: p.telefone || null,
    updated_at: new Date().toISOString(),
  };
  await sb.from("profiles").upsert(row, { onConflict: "email" });
  // Espelha no Auth metadata (para o nome aparecer no login futuro).
  try {
    const { data } = await sb.auth.admin.listUsers();
    const user = data.users.find((u) => u.email?.toLowerCase() === e);
    if (user) {
      await sb.auth.admin.updateUserById(user.id, { user_metadata: { nome: p.nome || "", telefone: p.telefone || "" } });
    }
  } catch { /* ignora — perfil já salvo */ }
}

export async function buscarPerfil(email: string): Promise<PerfilCliente | null> {
  const e = (email || "").trim().toLowerCase();
  if (!e || !sb) return null;
  const { data, error } = await sb.from("profiles").select("email,nome,telefone").eq("email", e).single();
  if (error || !data) return null;
  return { email: e, nome: data.nome || undefined, telefone: data.telefone || undefined };
}

// ---------------------------------------------------------------------------
// ENDEREÇOS DO CLIENTE (livro de endereços) — C3
// ---------------------------------------------------------------------------
export interface EnderecoCliente {
  id?: string;
  email: string;
  nome: string; // apelido: "Casa", "Trabalho"
  endereco: string;
  numero: string;
  complemento?: string;
  bairro?: string;
  cidade: string;
  estado: string;
  cep: string;
  principal?: boolean;
}

export async function listarEnderecos(email: string): Promise<EnderecoCliente[]> {
  const e = (email || "").trim().toLowerCase();
  if (!e || !sb) return [];
  const { data, error } = await sb
    .from("enderecos").select("*").eq("email", e).order("principal", { ascending: false });
  if (error) return [];
  return (data || []) as EnderecoCliente[];
}

export async function salvarEndereco(end: EnderecoCliente): Promise<EnderecoCliente | null> {
  const e = (end.email || "").trim().toLowerCase();
  if (!e || !sb) return null;
  const row = { ...end, email: e, updated_at: new Date().toISOString() };
  // Se for o primeiro ou marcado principal, desmarca os outros.
  if (end.principal) {
    await sb.from("enderecos").update({ principal: false }).eq("email", e);
  }
  const { data, error } = await sb.from("enderecos").upsert(row, { onConflict: "id" }).select().single();
  if (error) return null;
  return data as EnderecoCliente;
}

export async function excluirEndereco(email: string, id: string): Promise<void> {
  const e = (email || "").trim().toLowerCase();
  if (!e || !sb) return;
  await sb.from("enderecos").delete().eq("email", e).eq("id", id);
}

// ---------------------------------------------------------------------------
// PREFERÊNCIAS DE NOTIFICAÇÃO — C7
// ---------------------------------------------------------------------------
export async function salvarPreferencias(email: string, prefs: Record<string, boolean>): Promise<void> {
  const e = (email || "").trim().toLowerCase();
  if (!e || !sb) return;
  await sb.from("profiles").upsert(
    { email: e, preferencias: prefs, updated_at: new Date().toISOString() },
    { onConflict: "email" }
  );
}

export async function buscarPreferencias(email: string): Promise<Record<string, boolean> | null> {
  const e = (email || "").trim().toLowerCase();
  if (!e || !sb) return null;
  const { data, error } = await sb.from("profiles").select("preferencias").eq("email", e).single();
  if (error || !data) return null;
  return (data.preferencias as Record<string, boolean>) || null;
}
