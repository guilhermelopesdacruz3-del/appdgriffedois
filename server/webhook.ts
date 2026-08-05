// Webhook de confirmação de pagamento do Mercado Pago.
//
// O Mercado Pago NOTIFICA este endpoint quando o status de um pagamento muda.
// Aqui validamos a assinatura (HMAC-SHA256 do body com o access_token como
// secret — método oficial do MP), buscamos o payment na API do MP para ter
// dados frescos, e se estiver "approved":
//   1) creditamos pontos de fidelidade (idempotente por mp_payment_id)
//   2) espelhamos o pedido na tabela `pedidos` do Supabase
//
// SEGURANÇA: o access_token (server-only) nunca sai daqui. A validação de
// assinatura impede que qualquer um forje uma confirmação de pagamento.

import crypto from "node:crypto";
import { getSecret, creditarPontos, jaProcessadoMP, upsertPedidoMP, confirmarPagamentoMP, buscarPedidoMP } from "./db.ts";
import { atualizarPedidoLI } from "./liClient.ts";

const MP_API = "https://api.mercadopago.com";
const DEMO = process.env.DEMO_MODE === "true";

// Valida a assinatura do webhook MP (header x-signature).
// Formato oficial (v1): "ts=TIMESTAMP,v1=HMAC_SHA256(manifest, secret)" onde
//   manifest = "id:{data.id};request-id:{x-request-id};ts:{ts};"
//   (pares ausentes são omitidos) e secret = chave revelada no painel do MP
//   (Webhooks > Configure notification). Também aceita o formato legado
//   HMAC(concat(ts, body)) com o access_token como secret.
export function validarAssinaturaMP(
  bodyRaw: string,
  xSignature: string | undefined,
  accessToken: string,
  dataId?: string,
  xRequestId?: string,
  webhookSecret?: string
): boolean {
  if (!xSignature) return false;
  let ts = "";
  let v1 = "";
  for (const part of xSignature.split(",")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    if (k === "ts") ts = v;
    if (k === "v1") v1 = v;
  }
  if (!ts || !v1) return false;

  const secrets: string[] = [];
  if (webhookSecret) secrets.push(webhookSecret);
  if (accessToken) secrets.push(accessToken);

  // Manifest oficial: id:...;request-id:...;ts:...; (pares ausentes omitidos).
  const partes: string[] = [];
  if (dataId) partes.push(`id:${dataId}`);
  if (xRequestId) partes.push(`request-id:${xRequestId}`);
  partes.push(`ts:${ts}`);
  const manifest = `${partes.join(";")};`;

  for (const secret of secrets) {
    for (const alvo of [manifest, `${ts}${bodyRaw}`]) {
      const expected = crypto.createHmac("sha256", secret).update(alvo).digest("hex");
      const a = Buffer.from(expected);
      const b = Buffer.from(v1);
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
    }
  }
  return false;
}

// Busca os dados frescos do pagamento na API do MP.
async function buscarPaymentMP(accessToken: string, paymentId: string | number) {
  const r = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`MP ${r.status}`);
  return r.json();
}

/**
 * Processa uma notificação do MP.
 * @param bodyRaw corpo cruo (string) para validar assinatura
 * @param xSignature header x-signature
 * @returns { status: "ignored" | "ok" | "duplicado" | "erro", pontos?: number }
 */
export async function processarWebhookMP(
  bodyRaw: string,
  xSignature: string | undefined,
  opts: { dataId?: string; xRequestId?: string } = {}
): Promise<{ status: string; pontos?: number; erro?: string }> {
  const mpToken = (await getSecret("MP_ACCESS_TOKEN").catch(() => null)) || process.env.MP_ACCESS_TOKEN || "";
  const webhookSecret = (await getSecret("MP_WEBHOOK_SECRET").catch(() => null)) || process.env.MP_WEBHOOK_SECRET || "";

  // DEMO: exercita o fluxo de ponta a ponta (crédito de pontos + pedido LI)
  // sem validar assinatura nem chamar a API real do MP. Só ativo com
  // DEMO_MODE=true — em produção este bloco é ignorado sempre.
  if (DEMO) {
    let payload: any;
    try {
      payload = JSON.parse(bodyRaw);
    } catch {
      return { status: "erro", erro: "body inválido" };
    }
    const paymentId = payload?.data?.id ?? payload?.resource?.split("/").pop();
    if (!paymentId) return { status: "ignored" };
    const email = (payload?.payer?.email || "").toLowerCase() || "demo@dgriffe.com.br";
    const valor = Number(payload?.transaction_amount || 0);
    const demoPayment = { status: "approved", payer: { email }, transaction_amount: valor, external_reference: payload?.external_reference || null };
    return await aplicarAprovacao(String(paymentId), demoPayment, payload?.li_pedido);
  }

  if (!mpToken) {
    return { status: "ignored", erro: "sem MP_ACCESS_TOKEN" };
  }
  if (!validarAssinaturaMP(bodyRaw, xSignature, mpToken, opts.dataId, opts.xRequestId, webhookSecret)) {
    return { status: "erro", erro: "assinatura inválida" };
  }

  let payload: any;
  try {
    payload = JSON.parse(bodyRaw);
  } catch {
    return { status: "erro", erro: "body inválido" };
  }

  // O MP envia tanto o formato novo (resource/payment_id) quanto notificações de
  // pedido. Só tratamos payment.
  const paymentId = payload?.data?.id ?? payload?.resource?.split("/").pop();
  if (!paymentId) return { status: "ignored" };

  // Idempotência: já processamos este pagamento?
  if (await jaProcessadoMP(String(paymentId))) {
    return { status: "duplicado" };
  }

  let payment: any;
  try {
    payment = await buscarPaymentMP(mpToken, paymentId);
  } catch (e: any) {
    return { status: "erro", erro: e?.message || "falha ao buscar payment" };
  }

  return await aplicarAprovacao(String(paymentId), payment);
}

// Extrai dados do payment e, se aprovado, credita pontos + espelha no Supabase
// + atualiza o pedido na Loja Integrada para "Pago". Usado tanto em produção
// quanto em DEMO (com payment fake).
async function aplicarAprovacao(paymentId: string, payment: any, liPedidoFallback?: string | number): Promise<{ status: string; pontos?: number; erro?: string }> {
  const status = payment?.status;
  const email = (payment?.payer?.email || "").toLowerCase() || null;
  const valor = Number(payment?.transaction_amount || 0);
  const externalRef = payment?.external_reference || null;

  // Espelha o pedido independente de aprovado ou não (para auditoria).
  await upsertPedidoMP({
    mp_payment_id: String(paymentId),
    email,
    valor,
    status: status || "desconhecido",
    external_reference: externalRef,
    pontos_creditados: false,
  });

  if (status !== "approved") {
    return { status: "ignored", erro: `status=${status}` };
  }

  // Aprovado: credita pontos de fidelidade (idempotente pelo mp_payment_id).
  let pontos = 0;
  if (email) {
    pontos = await creditarPontos(email, valor, `mp-${paymentId}`);
  }
  await confirmarPagamentoMP(String(paymentId), pontos > 0);

  // Atualiza o pedido na Loja Integrada (site) para "Pago", se criamos um.
  try {
    const espelho = await buscarPedidoMP(String(paymentId));
    const liPedido = espelho?.li_pedido ?? liPedidoFallback;
    if (liPedido) {
      await atualizarPedidoLI(liPedido, "pago");
    }
  } catch (e: any) {
    console.warn("[webhook-mp] falha ao atualizar pedido LI:", e?.message || e);
  }

  console.log(`[webhook-mp] pagamento ${paymentId} APROVADO email=${email} valor=${valor} pontos=${pontos}`);
  return { status: "ok", pontos };
}
