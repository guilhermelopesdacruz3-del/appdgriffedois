// Liga o app ao PROXY local (Express) em vez do Supabase.
// As rotas /api/config e /api/checkout existem no server/index.mjs.
// O admin é autenticado via token guardado em sessionStorage (função getAdminToken de admin.ts).

import { getAdminToken, clearAdminToken } from "./admin";

async function adminCall<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = getAdminToken();
  const res = await fetch(`/api/${path}`, {
    method: opts.method ?? "GET",
    headers: {
      ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const erro = json?.erro || json?.message || `API ${path} -> ${res.status}`;
    if (res.status === 401) clearAdminToken();
    throw new Error(erro);
  }
  return json as T;
}

// Lê as chaves das APIs cadastradas pelo admin (store_config no servidor).
// O proxy só devolve se a chave está definida (não o valor secreto).
export interface ApiConfigStatus {
  key: string;
  is_secret: boolean;
  updated_at: string | null;
  set: boolean;
}

export async function getApiConfigStatus(): Promise<ApiConfigStatus[]> {
  return adminCall<ApiConfigStatus[]>("config", { method: "GET" });
}

// Salva as chaves das APIs (Loja Integrada + Mercado Pago) pela UI do admin.
// Só admin autenticado consegue (o proxy valida o token).
export async function saveApiConfig(cfg: {
  LI_APP_KEY?: string;
  LI_API_KEY?: string;
  MP_ACCESS_TOKEN?: string;
  ADMIN_PASSWORD?: string;
}) {
  return adminCall("config", { method: "PUT", body: cfg });
}

// Cria o pedido + cobrança via proxy (/api/checkout).
// `meio`: "pix" | "cartao". Em demo o proxy devolve PIX simulado.
export interface CheckoutResult {
  meio: string;
  pix_qr_base64?: string;
  pix_copia_cola?: string;
  id?: string | number;
  li_pedido?: string | number | null;
  status?: string;
  valor_total?: number;
  email?: string | null;
  demo?: boolean;
  cupom?: { codigo: string; tipo: string; valor: number };
  [k: string]: unknown;
}

export async function iniciarCheckout(payload: {
  items: { price: number; qty: number; li_uri?: string; sku?: string }[];
  cliente?: { email?: string };
  meio: "pix" | "cartao";
  card_token?: string;
  email?: string;
  pontosResgate?: number;
  cupom?: { codigo: string; tipo: string; valor: number; id: string };
}) {
  return adminCall<CheckoutResult>("checkout", { method: "POST", body: payload });
}
