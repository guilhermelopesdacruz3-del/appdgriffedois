// Supabase Edge Function: checkout-mp
// Recebe { items, cliente, meio } e:
//   1) cria o pedido na Loja Integrada (se chaves presentes)
//   2) cria cobrança no Mercado Pago (PIX ou cartão transparente)
//   3) devolve ao APP os dados para mostrar o PIX (QR + copia-e-cola) ou
//      o init_point do cartão — TUDO DENTRO DO APP, sem redirecionar o usuário.
// Deploy: supabase functions deploy checkout-mp --project-ref unpbvztvscuisqnzofqp

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LI_API_BASE = "https://api.awsli.com.br/api/v1";
const MP_BASE = "https://api.mercadopago.com";

async function getSecrets(): Promise<{ liApp: string; liApi: string; mpToken: string }> {
  const liApp = Deno.env.get("LI_APP_KEY") ?? "";
  const liApi = Deno.env.get("LI_API_KEY") ?? "";
  const mpToken = Deno.env.get("MP_ACCESS_TOKEN") ?? "";
  if (liApp && liApi && mpToken) return { liApp, liApi, mpToken };
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
  const { data } = await sb.from("store_config").select("key,value").in("key", ["LI_APP_KEY", "LI_API_KEY", "MP_ACCESS_TOKEN"]);
  const m: Record<string, string> = {};
  (data || []).forEach((r: any) => (m[r.key] = r.value));
  return { liApp: liApp || m.LI_APP_KEY || "", liApi: liApi || m.LI_API_KEY || "", mpToken: mpToken || m.MP_ACCESS_TOKEN || "" };
}

// ----- Mercado Pago -----
async function mpCobranca(mpToken: string, body: any) {
  const r = await fetch(`${MP_BASE}/v1/payments`, {
    method: "POST",
    headers: { Authorization: `Bearer ${mpToken}`, "Content-Type": "application/json", "X-Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify(body),
  });
  return { status: r.status, payload: await r.json() };
}

// Cria cobrança PIX e devolve QR (base64) + copia-e-cola.
async function cobrarPix(mpToken: string, total: number, descricao: string) {
  const body = {
    transaction_amount: Math.round(total * 100) / 100,
    description: descricao,
    payment_method_id: "pix",
    payer: { email: "cliente@demo.com.br" },
  };
  const { status, payload } = await mpCobranca(mpToken, body);
  if (status !== 201) return { status, erro: payload };
  return {
    status: 200,
    body: {
      meio: "pix",
      pix_qr_base64: payload.point_of_interaction?.transaction_data?.qr_code_base64,
      pix_copia_cola: payload.point_of_interaction?.transaction_data?.qr_code,
      id: payload.id,
    },
  };
}

// Cria cobrança de cartão transparente (o token do cartão vem do SDK do MP no front).
async function cobrarCartao(mpToken: string, total: number, descricao: string, cardToken: string, email: string) {
  const body = {
    transaction_amount: Math.round(total * 100) / 100,
    description: descricao,
    payment_method_id: "visa", // ajustado pelo front conforme a bandeira
    token: cardToken,
    payer: { email },
    installments: 1,
  };
  const { status, payload } = await mpCobranca(mpToken, body);
  return { status, body: payload };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "*" } });
  try {
    const { items, cliente, meio, card_token, email } = await req.json();
    const { liApp, liApi, mpToken } = await getSecrets();
    if (!mpToken) return json({ erro: "Mercado Pago não configurado. Defina MP_ACCESS_TOKEN no painel." }, 400);

    const total = (items || []).reduce((s: number, it: any) => s + (Number(it.price) * Number(it.qty || 1)), 0);

    // 1) Cria pedido na Loja Integrada (opcional — só se chaves presentes).
    let liPedido: any = null;
    if (liApp && liApi) {
      const r = await fetch(`${LI_API_BASE}/pedido/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_email: cliente?.email || email,
          itens: (items || []).map((it: any) => ({ produto: it.li_uri || it.sku, quantidade: it.qty || 1, preco_cheio: it.price })),
        }),
      });
      if (r.ok) liPedido = await r.json();
    }

    // 2) Cobrança no Mercado Pago.
    let resultado;
    if (meio === "pix") resultado = await cobrarPix(mpToken, total, "Compra D'Griffe Ótica");
    else if (meio === "cartao") resultado = await cobrarCartao(mpToken, total, "Compra D'Griffe Ótica", card_token, email || "cliente@demo.com.br");
    else return json({ erro: "meio inválido (use 'pix' ou 'cartao')" }, 400);

    if (resultado.status >= 400) return json(resultado, resultado.status);
    return json({ ...resultado.body, li_pedido: liPedido?.id ?? null }, 200);
  } catch (e: any) {
    return json({ erro: e.message || "erro interno" }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "*" } });
}
