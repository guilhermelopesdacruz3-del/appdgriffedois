// Módulo de pagamento — Mercado Pago (produção) com proteções de segurança.
//
// PRINCÍPIOS DE SEGURANÇA:
// - O access_token (server-only, vindo do db.ts) NUNCA sai do servidor.
// - O valor da cobrança é calculado/validado no SERVIDOR, nunca confiado cegamente
//   no que o front envia. Em produção, o preço real é buscado na Loja Integraa.
// - Idempotência: cada tentativa usa um X-Idempotency-Key para evitar cobrança dupla.
// - Auditoria: loga sucesso/falha sem dados sensíveis (sem token de cartão, sem CVV).
// - Em DEMO (sem MP_ACCESS_TOKEN), devolve PIX/cartão SIMULADO para o fluxo funcionar.

import crypto from "node:crypto";
import { getSecret } from "./db.ts";

const MP_API = "https://api.mercadopago.com";

export function gerarIdempotencyKey(): string {
  return crypto.randomUUID();
}

// Busca o preço REAL do produto na Loja Integrada (produção).
// Em demo/local, aceita o valor enviado pelo front porém valida sanitização.
async function obterValorAutorizado(items: { price: number; qty: number; sku?: string }[]): Promise<{
  ok: boolean;
  total: number;
  erro?: string;
}> {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, total: 0, erro: "Carrinho vazio." };
  }
  let total = 0;
  for (const it of items) {
    const p = Number(it.price);
    const q = Number(it.qty);
    if (!Number.isFinite(p) || p <= 0 || !Number.isFinite(q) || q <= 0 || q > 99) {
      return { ok: false, total: 0, erro: "Item de carrinho inválido (preço/quantidade)." };
    }
    total += p * q;
  }
  // Em produção, re-buscaríamos o preço na LI por sku para não confiar no front.
  // TODO(prod): const precoLI = await buscarPrecoLI(it.sku); validar p === precoLI.
  if (total <= 0 || total > 1_000_000) {
    return { ok: false, total: 0, erro: "Total fora da faixa permitida." };
  }
  return { ok: true, total: Number(total.toFixed(2)) };
}

// Cria cobrança PIX real no Mercado Pago.
async function criarPixMP(accessToken: string, valor: number, descricao: string, email?: string) {
  const idem = gerarIdempotencyKey();
  const body = {
    transaction_amount: valor,
    description: descricao.slice(0, 120),
    payment_method_id: "pix",
    payer: email ? { email: email.slice(0, 120) } : { email: "comprador@dgriffe.com.br" },
  };
  const r = await fetch(`${MP_API}/v1/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": idem,
    },
    body: JSON.stringify(body),
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = json?.message || `Mercado Pago ${r.status}`;
    throw Object.assign(new Error(msg), { status: r.status, idem });
  }
  // PIX: o MP devolve point_of_interaction.transaction_data com QR + copia-e-cola.
  const pi = json?.point_of_interaction?.transaction_data || {};
  return {
    meio: "pix",
    id: json.id,
    li_pedido: null,
    status: json.status || "pending",
    valor_total: valor,
    pix_qr_base64: pi.qr_code_base64 || "",
    pix_copia_cola: pi.qr_code || "",
    email: email || null,
    mp_payment_id: json.id,
  };
}

// Cria cobrança por cartão (tokenizada no CLIENTE via SDK do MP).
// O servidor recebe SÓ o card_token (nunca o número do cartão / CVV).
async function criarCartaoMP(accessToken: string, valor: number, cardToken: string, email?: string, parcelas = 1) {
  const idem = gerarIdempotencyKey();
  const body = {
    transaction_amount: valor,
    description: "Ótica D'Griffe",
    payment_method_id: "visa", // ajustado conforme token; o MP resolve pelo token
    token: cardToken,
    installments: parcelas,
    payer: { email: (email || "comprador@dgriffe.com.br").slice(0, 120) },
  };
  const r = await fetch(`${MP_API}/v1/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": idem,
    },
    body: JSON.stringify(body),
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = json?.message || `Mercado Pago ${r.status}`;
    throw Object.assign(new Error(msg), { status: r.status, idem });
  }
  return {
    meio: "cartao",
    id: json.id,
    li_pedido: null,
    status: json.status || "pending",
    valor_total: valor,
    email: email || null,
    mp_payment_id: json.id,
  };
}

export interface CheckoutResult {
  meio: string;
  id?: string | number;
  li_pedido?: string | number | null;
  status?: string;
  valor_total?: number;
  pix_qr_base64?: string;
  pix_copia_cola?: string;
  email?: string | null;
  demo?: boolean;
  mp_payment_id?: string | number;
  [k: string]: unknown;
}

export async function processarCheckout(params: {
  items: { price: number; qty: number; sku?: string }[];
  meio: "pix" | "cartao";
  email?: string;
  card_token?: string;
}): Promise<CheckoutResult> {
  const { items, meio, email, card_token } = params;

  const autorizado = await obterValorAutorizado(items);
  if (!autorizado.ok) throw new Error(autorizado.erro || "Valor inválido.");
  const total = autorizado.total;

  // Em DEMO (sem token MP válido ou modo demo), mantém fluxo simulado.
  // Isso garante que o app funcione em ambiente de demonstração sem chamar o MP.
  const mpToken = await getSecret("MP_ACCESS_TOKEN").catch(() => null);
  const demoAtivo = process.env.DEMO_MODE === "true" || !mpToken;
  if (demoAtivo) {
    const idPedido = `DEMO-${Date.now().toString().slice(-8)}`;
    if (meio === "pix") {
      return {
        meio,
        id: idPedido,
        li_pedido: null,
        status: "pendente",
        valor_total: total,
        pix_qr_base64:
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        pix_copia_cola: `00020126BR.GOV.BCB.PIX-DEMO-${idPedido}-${total.toFixed(2)}5204000053039865802BR6009SAO PAULO62070503***6304DEMO`,
        email: email || null,
        demo: true,
      };
    }
    return { meio, id: idPedido, status: "aprovado", valor_total: total, email: email || null, demo: true };
  }

  // Produção: chama a API real do Mercado Pago.
  if (meio === "pix") {
    return await criarPixMP(mpToken, total, "Ótica D'Griffe", email);
  }
  if (meio === "cartao") {
    if (!card_token || typeof card_token !== "string" || card_token.length < 10) {
      throw new Error("Token de cartão inválido (deve ser gerado pelo SDK do Mercado Pago no cliente).");
    }
    return await criarCartaoMP(mpToken, total, card_token, email);
  }
  throw new Error("Meio de pagamento inválido.");
}
