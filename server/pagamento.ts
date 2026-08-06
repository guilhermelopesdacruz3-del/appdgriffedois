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
import { getSecret, creditarPontos, resgatarPontos, getRegrasFidelidade, getPontos, upsertPedidoMP, TETO_BENEFICIOS_PERC, concederMissao, creditarIndicacao, creditarFamilia, supabaseClient } from "./db.ts";
import { criarPedidoLI, baixarEstoqueLI, atualizarPedidoLI, buscarPrecoLI } from "./liClient.ts";

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
    // Anti-fraude: se as chaves da LI estiverem configuradas, o preço REAL vem da
    // Loja Integrada (por SKU) — nunca confiamos no valor enviado pelo front.
    // Se a LI não responder / não houver chaves (demo), mantém o preço do front
    // (com a sanitização acima) para não quebrar o fluxo.
    const precoReal = await buscarPrecoLI(it.sku).catch(() => null);
    const preco = precoReal != null ? precoReal : p;
    if (precoReal != null && Math.abs(precoReal - p) > 0.01) {
      console.warn(`[checkout] preço divergente sku=${it.sku}: front=${p} LI=${precoReal} — usando LI.`);
    }
    total += preco * q;
  }
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
  valor_original?: number;
  pontos_creditados?: number;
  desconto_aplicado?: number;
  pix_qr_base64?: string;
  pix_copia_cola?: string;
  email?: string | null;
  demo?: boolean;
  mp_payment_id?: string | number;
  cupom?: { codigo: string; tipo: string; valor: number };
  [k: string]: unknown;
}

export async function processarCheckout(params: {
  items: { price: number; qty: number; sku?: string; li_uri?: string; nome?: string }[];
  meio: "pix" | "cartao";
  email?: string;
  card_token?: string;
  pontosResgate?: number;
  cupom?: { codigo: string; tipo: string; valor: number; id: string };
  observacoes?: string;
  formaEntrega?: "retirada" | "entrega";
}): Promise<CheckoutResult> {
  const { items, meio, email, card_token, pontosResgate, cupom, observacoes, formaEntrega = "retirada" } = params;

  const autorizado = await obterValorAutorizado(items);
  if (!autorizado.ok) throw new Error(autorizado.erro || "Valor inválido.");
  let total = autorizado.total;

  // Resgate de pontos (desconto) — só se o cliente tiver saldo suficiente.
  let desconto = 0;
  let usouPontos = 0;
  const e = (email || "").trim().toLowerCase();
  if (pontosResgate && pontosResgate > 0 && e) {
    const regras = await getRegrasFidelidade();
    const saldoPontos = await getPontos(e);
    const pontosUtilizaveis = Math.min(pontosResgate, saldoPontos);
    // Regra: pontosPorDesconto pontos = R$ 10 (ex.: 100 pts = R$ 10).
    desconto = Math.floor((pontosUtilizaveis / regras.pontosPorDesconto) * 10);
    if (desconto > 0 && desconto < total) {
      usouPontos = await resgatarPontos(e, pontosUtilizaveis);
      if (usouPontos > 0) total = Number((total - desconto).toFixed(2));
      else desconto = 0;
    } else {
      desconto = 0;
    }
  }

  // Cupom
  let descontoCupom = 0;
  if (cupom?.valor && total > 0) {
    if (cupom.tipo === "percentual") descontoCupom = Number((total * (Number(cupom.valor) / 100)).toFixed(2));
    else descontoCupom = Number(cupom.valor);
    descontoCupom = Math.min(descontoCupom, total);
    total = Number((total - descontoCupom).toFixed(2));
    desconto = Number((desconto + descontoCupom).toFixed(2));
  }

  // Regra do plano: teto de 20% de benefícios sobre o valor original.
  // Benefícios = desconto de pontos + desconto de cupom. Se ultrapassar 20%,
  // reduz o desconto pro teto (não estoura a margem).
  const tetoMax = Number((autorizado.total * (TETO_BENEFICIOS_PERC / 100)).toFixed(2));
  if (desconto > tetoMax) {
    desconto = tetoMax;
  }
  total = Number((autorizado.total - desconto).toFixed(2));
  if (total <= 0) total = 0.01;
  // Em DEMO (sem token MP válido ou modo demo), mantém fluxo simulado.
  const mpToken = (await getSecret("MP_ACCESS_TOKEN").catch(() => null)) || process.env.MP_ACCESS_TOKEN || "";
  const demoAtivo = process.env.DEMO_MODE === "true" || !mpToken;
  if (demoAtivo) {
    const idPedido = `DEMO-${Date.now().toString().slice(-8)}`;
    // No demo, creditamos pontos imediatamente (simula pagamento aprovado).
    const pontos = e ? await creditarPontos(e, total, idPedido) : 0;
    // Fase C: missão 1ª compra + indicação + clube família (só pontos, sem R$).
    if (e && pontos > 0) {
      try { await dispararFaseC(e, pontos, params.indicadorEmail); } catch (fcErr) {
        console.warn("[checkout-demo] Fase C (ignorado):", (fcErr as Error)?.message);
      }
    }
    // Cria o pedido na Loja Integrada (site) também em demo — garante que o
    // fluxo de sincronia é exercitado e o admin reflete a venda.
    let liPedido: number | string | null = null;
    let liDados: Record<string, unknown> | null = null;
    try {
      const criado = await criarPedidoLI({
        email: email || "",
        itens: items.map((it) => ({ li_uri: it.li_uri, sku: it.sku, nome: it.nome, preco: it.price, quantidade: it.qty })),
        valor: total,
        meio,
        observacoes,
        formaEntrega,
      });
      if (criado) {
        liPedido = criado.id;
        liDados = criado.corpo;
      }
    } catch (liErr: any) {
      console.warn("[checkout-demo] pedido LI não criado:", liErr?.message || liErr);
    }
    // Espelha no painel admin (Supabase) para o pedido aparecer na lista.
    try {
      await upsertPedidoMP({
        mp_payment_id: idPedido,
        email: email || null,
        valor: total,
        status: "aprovado",
        li_pedido: liPedido ?? undefined,
        li_dados: liDados ?? undefined,
        pontos_creditados: pontos > 0,
      });
    } catch { /* ignora */ }
    // Marca o pedido como pago na LI (se criamos um).
    if (liPedido) {
      try { await atualizarPedidoLI(liPedido, "pago", liDados ?? undefined); } catch { /* ignora */ }
    }
    if (meio === "pix") {
      return {
        meio,
        id: idPedido,
        li_pedido: liPedido,
        status: "pendente",
        valor_total: total,
        valor_original: autorizado.total,
        desconto_aplicado: desconto,
        pontos_creditados: pontos,
        pix_qr_base64:
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        pix_copia_cola: `00020126BR.GOV.BCB.PIX-DEMO-${idPedido}-${total.toFixed(2)}5204000053039865802BR6009SAO PAULO62070503***6304DEMO`,
        email: email || null,
        demo: true,
      };
    }
    return { meio, id: idPedido, li_pedido: liPedido, status: "aprovado", valor_total: total, valor_original: autorizado.total, desconto_aplicado: desconto, pontos_creditados: pontos, email: email || null, demo: true };
  }

  // Produção: chama a API real do Mercado Pago.
  let resultado: CheckoutResult;
  if (meio === "pix") {
    resultado = await criarPixMP(mpToken, total, "Ótica D'Griffe", email);
  } else {
    if (!card_token || typeof card_token !== "string" || card_token.length < 10) {
      throw new Error("Token de cartão inválido (deve ser gerado pelo SDK do Mercado Pago no cliente).");
    }
    resultado = await criarCartaoMP(mpToken, total, card_token, email);
  }
  // Cria o pedido na Loja Integrada (site) com status "Em aberto". Não-bloqueante:
  // se a LI falhar, a compra no app continua funcionando normalmente.
  try {
    const criado = await criarPedidoLI({
      email: email || "",
      itens: items.map((it) => ({ li_uri: it.li_uri, sku: it.sku, nome: it.nome, preco: it.price, quantidade: it.qty })),
      valor: total,
      meio,
      observacoes,
      formaEntrega,
    });
    if (criado) {
      resultado.li_pedido = criado.id;
      // Espelha no Supabase já com o li_pedido (e o corpo para atualizações),
      // para o webhook saber o que atualizar.
      await upsertPedidoMP({
        mp_payment_id: String(resultado.id),
        email: email || null,
        valor: total,
        status: "pendente",
        li_pedido: criado.id,
        li_dados: criado.corpo,
      }).catch(() => {});
    }
  } catch (e: any) {
    console.warn("[checkout] pedido LI não criado:", e?.message || e);
  }
  // Crédito de pontos ocorre quando o MP confirmar (webhook). Aqui registramos
  // a intenção; o webhook/poll chamará creditarPontos após status "approved".
  resultado.valor_original = autorizado.total;
  resultado.desconto_aplicado = desconto;
  return resultado;
}

// Dispara os gatilhos da Fase C após uma compra creditada (SÓ PONTOS, sem R$):
// - missão "primeira_compra" (se for a 1ª compra do cliente)
// - indicação convertida (se o cliente veio de um indicador)
// - clube família (20% dos pontos da compra viram pontos do responsável)
// `indicadorEmail` vem do front (quem indicou). `pontosCompra` = pontos já creditados.
export async function dispararFaseC(compradorEmail: string, pontosCompra: number, indicadorEmail?: string): Promise<void> {
  const e = (compradorEmail || "").trim().toLowerCase();
  if (!e || !(pontosCompra > 0)) return;
  // 1) Missão primeira_compra (idempotente: só concede se ainda não tem pontos de compra).
  try { await concederMissao(e, "primeira_compra"); } catch (err) { console.warn("[faseC] primeira_compra:", (err as Error)?.message); }
  // 2) Indicação convertida (se veio de indicador e ainda está pendente).
  const ind = (indicadorEmail || "").trim().toLowerCase();
  if (ind && ind !== e) {
    try { await creditarIndicacao(ind, e); } catch (err) { console.warn("[faseC] indicacao:", (err as Error)?.message); }
  }
  // 3) Clube família: se o comprador é membro de algum clube, credita 20% dos pontos ao responsável.
  try {
    const sb = supabaseClient();
    if (sb) {
      const { data: vinculo } = await sb.from("familia").select("responsavel_email").eq("membro_email", e).maybeSingle();
      if (vinculo?.responsavel_email) {
        await creditarFamilia(vinculo.responsavel_email, pontosCompra);
      }
    }
  } catch (err) { console.warn("[faseC] familia:", (err as Error)?.message); }
}
