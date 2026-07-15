import { supabase, callFn } from "../lib/supabase";

// Lê as chaves das APIs cadastradas pelo admin (store_config no Postgres).
// A Edge `config` só devolve se a chave está definida (não o valor secreto).
export interface ApiConfigStatus {
  key: string;
  is_secret: boolean;
  updated_at: string | null;
  set: boolean;
}

export async function getApiConfigStatus(): Promise<ApiConfigStatus[]> {
  return callFn("config", { method: "GET" });
}

// Salva as chaves das APIs (Loja Integrada + Mercado Pago) pela UI do admin.
// Só admin autenticado consegue (a Edge valida is_admin).
export async function saveApiConfig(cfg: {
  LI_APP_KEY?: string;
  LI_API_KEY?: string;
  MP_ACCESS_TOKEN?: string;
  ADMIN_PASSWORD?: string;
}) {
  return callFn("config", { method: "PUT", body: cfg });
}

// Cria o pedido + cobrança no Mercado Pago via Edge `checkout-mp`.
// `meio`: "pix" | "cartao". O app mostra o resultado SEM sair da tela.
export interface CheckoutResult {
  meio: string;
  pix_qr_base64?: string;
  pix_copia_cola?: string;
  id?: string | number;
  li_pedido?: string | number | null;
  status?: string;
  [k: string]: unknown;
}

export async function iniciarCheckout(payload: {
  items: { price: number; qty: number; li_uri?: string; sku?: string }[];
  cliente?: { email?: string };
  meio: "pix" | "cartao";
  card_token?: string;
  email?: string;
}) {
  return callFn("checkout-mp", { method: "POST", body: payload }) as Promise<CheckoutResult>;
}
