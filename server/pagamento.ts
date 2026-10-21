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
import { validarCupomCheckout, consumirCupomCheckout, type CupomCheckout } from "./cupom.ts";
import { demoPermitido, permiteFallbackPreco } from "./ambiente.ts";

const MP_API = "https://api.mercadopago.com";

export function gerarIdempotencyKey(): string {
  return crypto.randomUUID();
}

// Consulta o status atual de um pagamento no Mercado Pago. Usado pelo site
// para acompanhar PIX e cartão em análise sem expor o access_token.
export async function consultarPagamentoMP(
  id: string
): Promise<{ status: string; status_detail?: string } | null> {
  const token = (await getSecret("MP_ACCESS_TOKEN").catch(() => null)) || process.env.MP_ACCESS_TOKEN || "";
  if (!token) return null;
  const r = await fetch(`${MP_API}/v1/payments/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  const j: any = await r.json().catch(() => ({}));
  return { status: String(j?.status || ""), status_detail: j?.status_detail };
}

interface ItemCheckout {
  price: number;
  qty: number;
  sku?: string;
  li_uri?: string;
  nome?: string;
  variacao?: string;
}

// Resolve o preço REAL de cada item na Loja Integrada e devolve os itens já
// com o preço autorizado. Em produção, se não for possível confirmar o preço,
// o checkout falha fechado — nunca cobra o valor arbitrário do front.
async function obterValorAutorizado(items: ItemCheckout[]): Promise<{
  ok: boolean;
  total: number;
  itens: ItemCheckout[];
  erro?: string;
}> {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, total: 0, itens: [], erro: "Carrinho vazio." };
  }
  const fallback = permiteFallbackPreco();
  let total = 0;
  const itens: ItemCheckout[] = [];

  for (const it of items) {
    const p = Number(it.price);
    const q = Number(it.qty);
    if (!Number.isFinite(p) || p <= 0 || !Number.isFinite(q) || q <= 0 || q > 99) {
      return { ok: false, total: 0, itens: [], erro: "Item de carrinho inválido (preço/quantidade)." };
    }

    const precoReal = await buscarPrecoLI(it.sku, it.li_uri).catch(() => null);
    if (precoReal == null && !fallback) {
      return {
        ok: false,
        total: 0,
        itens: [],
        erro: `Não foi possível confirmar o preço do produto ${it.sku || it.li_uri || ""}. Tente novamente ou fale com a loja.`,
      };
    }
    const preco = precoReal != null ? precoReal : p;
    if (precoReal != null && Math.abs(precoReal - p) > 0.01) {
      console.warn(`[checkout] preço divergente sku=${it.sku || it.li_uri}: front=${p} LI=${precoReal} — usando LI.`);
    } else if (precoReal == null) {
      console.warn(`[checkout] preço não confirmado na LI (fallback ${process.env.NODE_ENV || "?"}) sku=${it.sku || it.li_uri}.`);
    }
    total += preco * q;
    itens.push({ ...it, price: preco });
  }

  if (total <= 0 || total > 1_000_000) {
    return { ok: false, total: 0, itens: [], erro: "Total fora da faixa permitida." };
  }
  return { ok: true, total: Number(total.toFixed(2)), itens };
}

// Cria cobrança PIX real no Mercado Pago.
async function criarPixMP(
  accessToken: string,
  valor: number,
  descricao: string,
  email?: string,
  opts: { idempotencyKey?: string; externalReference?: string } = {}
) {
  const idem = opts.idempotencyKey || gerarIdempotencyKey();
  const body: Record<string, unknown> = {
    transaction_amount: valor,
    description: descricao.slice(0, 120),
    payment_method_id: "pix",
    payer: email ? { email: email.slice(0, 120) } : { email: "comprador@dgriffe.com.br" },
  };
  if (opts.externalReference) body.external_reference = opts.externalReference.slice(0, 250);
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
    const raw = json?.message || `Mercado Pago ${r.status}`;
    let msg = String(raw);
    if (/communication_error|fill and validate/i.test(msg)) {
      msg =
        "O Mercado Pago recusou a cobrança PIX. Confira se o access_token de PRODUÇÃO está correto no painel (APIs) e se a conta tem uma chave PIX cadastrada.";
    }
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
async function criarCartaoMP(
  accessToken: string,
  valor: number,
  cardToken: string,
  email?: string,
  parcelas = 1,
  opts: { idempotencyKey?: string; externalReference?: string } = {}
) {
  const idem = opts.idempotencyKey || gerarIdempotencyKey();
  const body: Record<string, unknown> = {
    transaction_amount: valor,
    description: "Ótica D'Griffe",
    token: cardToken,
    installments: parcelas,
    payer: { email: (email || "comprador@dgriffe.com.br").slice(0, 120) },
  };
  // Sem `payment_method_id` fixo: o MP resolve a bandeira pelo token. O código
  // antigo forçava "visa" e podia recusar Mastercard/Elo.
  if (opts.externalReference) body.external_reference = opts.externalReference.slice(0, 250);
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
  items: ItemCheckout[];
  meio: "pix" | "cartao";
  email?: string;
  emailCliente?: string;
  card_token?: string;
  pontosResgate?: number;
  cupom?: { codigo: string };
  observacoes?: string;
  formaEntrega?: "retirada" | "entrega";
  origem?: "app" | "site";
  idempotencyKey?: string;
  parcelas?: number;
  indicadorEmail?: string;
}): Promise<CheckoutResult> {
  const {
    items,
    meio,
    email,
    emailCliente,
    card_token,
    pontosResgate,
    cupom,
    observacoes,
    formaEntrega = "retirada",
    origem = "site",
  } = params;

  const autorizado = await obterValorAutorizado(items);
  if (!autorizado.ok) {
    throw Object.assign(new Error(autorizado.erro || "Valor inválido."), { status: 400 });
  }
  const subtotal = autorizado.total;
  const e = (email || "").trim().toLowerCase();
  const eCliente = (emailCliente || "").trim().toLowerCase();

  // Cupom: valida no banco pelo código. `tipo`/`valor` do front são ignorados.
  let cupomValidado: CupomCheckout | null = null;
  if (cupom?.codigo) {
    cupomValidado = await validarCupomCheckout(cupom.codigo, eCliente || undefined, subtotal);
  }

  // Teto de 20% de benefícios sobre o valor original (pontos + cupom).
  const tetoMax = Number((subtotal * (TETO_BENEFICIOS_PERC / 100)).toFixed(2));
  // O cupom entra primeiro no teto; os pontos usam o que sobrar.
  const descontoCupom = cupomValidado ? Math.min(cupomValidado.desconto, tetoMax) : 0;

  // Resgate de pontos: SÓ com identidade autenticada. O e-mail do body nunca
  // serve para gastar pontos de outra pessoa.
  let descontoPontos = 0;
  if (pontosResgate && pontosResgate > 0) {
    if (!eCliente) {
      throw Object.assign(new Error("Faça login para usar seus pontos."), { status: 401 });
    }
    const regras = await getRegrasFidelidade();
    const pontosPorDesconto = regras.pontosPorDesconto || 100;
    const saldoPontos = await getPontos(eCliente);
    const pontosUtilizaveis = Math.min(Math.floor(pontosResgate), saldoPontos);
    const descontoBruto = Math.floor((pontosUtilizaveis / pontosPorDesconto) * 10);
    const descontoPermitido = Math.min(descontoBruto, Math.max(0, tetoMax - descontoCupom));
    if (descontoPermitido > 0) {
      // Converte de volta para pontos para não resgatar mais do que o desconto
      // efetivamente aplicado (ex.: teto de 20%).
      const pontosParaResgate = Math.min(
        pontosUtilizaveis,
        Math.floor((descontoPermitido / 10) * pontosPorDesconto)
      );
      if (pontosParaResgate > 0) {
        const resgatados = await resgatarPontos(eCliente, pontosParaResgate);
        if (resgatados > 0) {
          descontoPontos = Math.min(
            Math.floor((resgatados / pontosPorDesconto) * 10),
            descontoPermitido
          );
        }
      }
    }
  }

  const desconto = Number((descontoPontos + descontoCupom).toFixed(2));
  let total = Number((subtotal - desconto).toFixed(2));
  if (total <= 0) total = 0.01;

  const mpToken = (await getSecret("MP_ACCESS_TOKEN").catch(() => null)) || process.env.MP_ACCESS_TOKEN || "";
  const demoAtivo = demoPermitido();
  // Fail-closed: em produção sem token do MP não há como cobrar. Nunca aprova
  // pedido de graça só porque a chave sumiu.
  if (!mpToken && !demoAtivo) {
    throw Object.assign(
      new Error("Pagamento indisponível: configure o Mercado Pago antes de vender."),
      { status: 503 }
    );
  }

  if (demoAtivo) {
    const idPedido = `DEMO-${Date.now().toString().slice(-8)}-${crypto.randomBytes(2).toString("hex")}`;
    // No demo, creditamos pontos imediatamente (simula pagamento aprovado).
    const comprador = eCliente || e;
    const pontos = comprador ? await creditarPontos(comprador, total, idPedido) : 0;
    if (comprador && pontos > 0) {
      try { await dispararFaseC(comprador, pontos, params.indicadorEmail); } catch (fcErr) {
        console.warn("[checkout-demo] Fase C (ignorado):", (fcErr as Error)?.message);
      }
    }
    // Demo não tem webhook: consome o cupom aqui (uma vez).
    if (cupomValidado) {
      try { await consumirCupomCheckout(cupomValidado.codigo, comprador || undefined); } catch (cErr) {
        console.warn("[checkout-demo] cupom não consumido:", (cErr as Error)?.message);
      }
    }
    // Cria o pedido na Loja Integrada (site) também em demo — garante que o
    // fluxo de sincronia é exercitado e o admin reflete a venda.
    let liPedido: number | string | null = null;
    let liDados: Record<string, unknown> | null = null;
    try {
      const criado = await criarPedidoLI({
        email: e,
        itens: autorizado.itens.map((it) => ({ li_uri: it.li_uri, sku: it.sku, nome: it.nome, preco: it.price, quantidade: it.qty, variacao: it.variacao })),
        valor: total,
        meio,
        observacoes,
        formaEntrega,
        origem,
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
        email: comprador || null,
        valor: total,
        status: "aprovado",
        li_pedido: liPedido ?? undefined,
        li_dados: liDados ?? undefined,
        pontos_creditados: pontos > 0,
      });
    } catch { /* ignora */ }
    if (liPedido) {
      try { await atualizarPedidoLI(liPedido, "pago", liDados ?? undefined); } catch { /* ignora */ }
    }
    const cupomResp = cupomValidado
      ? { codigo: cupomValidado.codigo, tipo: cupomValidado.tipo, valor: cupomValidado.valor }
      : undefined;
    if (meio === "pix") {
      return {
        meio,
        id: idPedido,
        li_pedido: liPedido,
        status: "pendente",
        valor_total: total,
        valor_original: subtotal,
        desconto_aplicado: desconto,
        pontos_creditados: pontos,
        pix_qr_base64:
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        pix_copia_cola: `00020126BR.GOV.BCB.PIX-DEMO-${idPedido}-${total.toFixed(2)}5204000053039865802BR6009SAO PAULO62070503***6304DEMO`,
        email: comprador || null,
        cupom: cupomResp,
        demo: true,
      };
    }
    return {
      meio,
      id: idPedido,
      li_pedido: liPedido,
      status: "aprovado",
      valor_total: total,
      valor_original: subtotal,
      desconto_aplicado: desconto,
      pontos_creditados: pontos,
      email: comprador || null,
      cupom: cupomResp,
      demo: true,
    };
  }

  // Produção: chama a API real do Mercado Pago.
  const idem =
    params.idempotencyKey && /^[A-Za-z0-9._:-]{8,128}$/.test(params.idempotencyKey)
      ? params.idempotencyKey
      : gerarIdempotencyKey();
  // A referência carrega o cupom e o e-mail da conta (quando logado) para o
  // webhook consumir o cupom e creditar pontos na conta correta.
  // Mantém o JSON abaixo do limite de 250 caracteres do MP. Campos longos
  // (e-mail/idempotencyKey) são truncados para o JSON continuar parseável no
  // webhook; a referência completa fica no espelho `pedidos`.
  const externalReference = JSON.stringify({
    ref: idem.slice(0, 40),
    cupom: cupomValidado?.codigo ? cupomValidado.codigo.slice(0, 40) : null,
    cliente: eCliente ? eCliente.slice(0, 80) : null,
  });

  let resultado: CheckoutResult;
  if (meio === "pix") {
    resultado = await criarPixMP(mpToken, total, "Ótica D'Griffe", eCliente || e, {
      idempotencyKey: idem,
      externalReference,
    });
  } else {
    if (!card_token || typeof card_token !== "string" || card_token.length < 10) {
      throw Object.assign(
        new Error("Token de cartão inválido (deve ser gerado pelo SDK do Mercado Pago no cliente)."),
        { status: 400 }
      );
    }
    const parcelas = Math.max(1, Math.min(12, Math.floor(Number(params.parcelas) || 1)));
    resultado = await criarCartaoMP(mpToken, total, card_token, eCliente || e, parcelas, {
      idempotencyKey: idem,
      externalReference,
    });
  }

  // Cria o pedido na Loja Integrada (site) com status "Em aberto". Não-bloqueante:
  // se a LI falhar, a compra no app continua funcionando normalmente.
  let liPedido: number | string | null = null;
  let liDados: Record<string, unknown> | null = null;
  try {
    const criado = await criarPedidoLI({
      email: e,
      itens: autorizado.itens.map((it) => ({ li_uri: it.li_uri, sku: it.sku, nome: it.nome, preco: it.price, quantidade: it.qty, variacao: it.variacao })),
      valor: total,
      meio,
      observacoes,
      formaEntrega,
      origem,
    });
    if (criado) {
      liPedido = criado.id;
      liDados = criado.corpo;
      resultado.li_pedido = criado.id;
    }
  } catch (err: any) {
    console.warn("[checkout] pedido LI não criado:", err?.message || err);
  }
  // Espelha SEMPRE, mesmo se a LI falhar: o webhook e a consulta de status
  // precisam da linha para confirmar o pagamento e validar o dono do pedido.
  // Usamos o e-mail da conta (quando logado) para que a consulta de status
  // continue funcionando mesmo se o cliente digitar outro e-mail de contato.
  try {
    await upsertPedidoMP({
      mp_payment_id: String(resultado.id),
      email: eCliente || e || null,
      valor: total,
      status: String(resultado.status || "pendente"),
      external_reference: externalReference,
      li_pedido: liPedido ?? undefined,
      li_dados: liDados ?? undefined,
    });
  } catch (err: any) {
    console.warn("[checkout] falha ao espelhar pedido:", err?.message || err);
  }
  // Crédito de pontos ocorre quando o MP confirmar (webhook). Aqui registramos
  // a intenção; o webhook/poll chamará creditarPontos após status "approved".
  resultado.valor_original = subtotal;
  resultado.desconto_aplicado = desconto;
  if (cupomValidado) {
    resultado.cupom = { codigo: cupomValidado.codigo, tipo: cupomValidado.tipo, valor: cupomValidado.valor };
  }
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
