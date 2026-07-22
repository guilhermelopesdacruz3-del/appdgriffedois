// Criação de pedidos na Loja Integrada (site) a partir de uma compra no app.
//
// Objetivo: quando o cliente compra no app D'Griffe, o pedido deve aparecer
// também no painel da Loja Integrada (site) e no admin. O webhook do Mercado
// Pago confirma o pagamento; aqui criamos o pedido na LI no momento do checkout
// (status "Em aberto") e o atualizamos para "Pago" quando o MP aprovar.
//
// SEGURANÇA: as chaves da LI vêm do getSecret (Supabase/env, server-only) e
// NUNCA saem do servidor. Qualquer falha é tratada como não-bloqueante: a compra
// no app não pode quebrar só porque a LI recusou algo.

import { getSecret } from "./db.ts";

const LI_API_BASE = "https://api.awsli.com.br/api/v1";
const DEMO = process.env.DEMO_MODE === "true";

async function chamarLI(method: string, resource: string, id?: string | number, query?: Record<string, string>, body?: unknown) {
  const APP_KEY = (await getSecret("LI_APP_KEY").catch(() => null)) || process.env.LOJA_INTEGRADA_APP_KEY || "";
  const API_KEY = (await getSecret("LI_API_KEY").catch(() => null)) || process.env.LOJA_INTEGRADA_API_KEY || "";
  if (!APP_KEY || !API_KEY) {
    if (DEMO) {
      // Em modo demo, simula respostas da LI sem chamar a API real.
      if (method === "POST" && resource === "cliente") return { status: 200, payload: { id: 1, email: (body as any)?.email } };
      if (method === "POST" && resource === "pedido") return { status: 200, payload: { pedido: { id: Math.floor(Math.random() * 900000) + 100000 } } };
      if (method === "PUT" && resource === "pedido") return { status: 200, payload: {} };
      if (method === "GET") return { status: 200, payload: { objects: [] } };
    }
    throw new Error("Chaves da Loja Integrada não configuradas.");
  }
  const upstream = new URL(`${LI_API_BASE}/${resource}/${id ? `${id}/` : ""}`);
  if (query) Object.entries(query).forEach(([k, v]) => upstream.searchParams.set(k, v));
  upstream.searchParams.set("chave_aplicacao", APP_KEY);
  upstream.searchParams.set("chave_api", API_KEY);
  upstream.searchParams.set("format", "json");
  const r = await fetch(upstream.toString(), {
    method,
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: method === "POST" || method === "PUT" ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const ct = r.headers.get("content-type") || "";
  const payload = ct.includes("application/json") ? await r.json().catch(() => ({})) : await r.text();
  return { status: r.status, payload };
}

// Busca o resource_uri de uma situação/pagamento pelo nome (fallback flexível).
async function buscarUri(recurso: string, nomes: string[]): Promise<string | null> {
  try {
    const { status, payload } = await chamarLI("GET", recurso, undefined, { limit: 100 });
    if (status !== 200 || !Array.isArray(payload?.objects)) return null;
    const obj = payload.objects.find((o: any) =>
      nomes.some((n) => (o.nome || "").toLowerCase().includes(n.toLowerCase()))
    );
    return obj?.resource_uri || obj?.id ? `/api/v1/${recurso}/${obj.id}/` : null;
  } catch {
    return null;
  }
}

export async function criarClienteLI(email: string, dados: { nome?: string; telefone?: string; cpf?: string }): Promise<boolean> {
  if (!email) return false;
  try {
    // Se já existe, a LI retorna o cliente (não duplica).
    const { status } = await chamarLI("POST", "cliente", undefined, undefined, {
      email,
      nome: dados.nome || email.split("@")[0],
      telefone: dados.telefone || "",
      cpf: dados.cpf || "",
    });
    return status === 200 || status === 201;
  } catch {
    return false;
  }
}

export interface ItemPedidoLI {
  li_uri?: string; // resource_uri do produto na LI (ex.: /api/v1/produto/123/)
  sku?: string;
  nome?: string;
  preco: number;
  quantidade: number;
}

export async function criarPedidoLI(opts: {
  email: string;
  itens: ItemPedidoLI[];
  valor: number;
  meio: "pix" | "cartao";
}): Promise<number | null> {
  // Situação inicial: "Em aberto" / "Aguardando pagamento".
  const situacao = await buscarUri("situacaopedido", ["em aberto", "aguardando", "aberto", "pendente"]);
  const pagamento = await buscarUri("formapagamento", [opts.meio === "pix" ? "pix" : "cartao", "cartão"]);

  const itens = opts.itens
    .filter((i) => i.li_uri || i.sku)
    .map((i) => ({
      produto: i.li_uri ? { resource_uri: i.li_uri } : { sku: i.sku },
      quantidade: i.quantidade,
      preco: Number(i.preco.toFixed(2)),
    }));

  if (itens.length === 0) return null; // sem itens válidos, não cria

  // Garante que o cliente exista na LI antes de criar o pedido (idempotente:
  // se já existe, a LI apenas retorna o cliente). Evita erro de "cliente inexistente".
  await criarClienteLI(opts.email, {});

  const body: any = {
    cliente: { email: opts.email },
    itens,
    valor_total: Number(opts.valor.toFixed(2)),
  };
  if (situacao) body.situacao = { resource_uri: situacao };
  if (pagamento) body.forma_pagamento = { resource_uri: pagamento };

  const { status, payload } = await chamarLI("POST", "pedido", undefined, undefined, body);
  if (status !== 200 && status !== 201) {
    console.warn(`[LI] falha ao criar pedido (${status}):`, JSON.stringify(payload).slice(0, 200));
    return null;
  }
  return Number(payload?.pedido?.id || payload?.id || null);
}

export async function atualizarPedidoLI(id: number | string, situacaoNome: string): Promise<boolean> {
  const uri = await buscarUri("situacaopedido", [situacaoNome.toLowerCase()]);
  if (!uri) return false;
  try {
    const { status } = await chamarLI("PUT", "pedido", id, undefined, { situacao: { resource_uri: uri } });
    return status === 200 || status === 204;
  } catch {
    return false;
  }
}

// Busca o preço REAL de um produto na LI por SKU. Retorna null se não houver
// chaves, o produto não existir, ou a LI não responder — nesses casos o chamador
// deve manter o comportamento anterior (não quebra o checkout).
export async function buscarPrecoLI(sku?: string): Promise<number | null> {
  if (!sku) return null;
  try {
    const { status, payload } = await chamarLI("GET", "produto", undefined, { sku: String(sku), limit: "1" });
    if (status !== 200) return null;
    const p = Array.isArray(payload?.objects) ? payload.objects[0] : null;
    const preco = Number(p?.preco_promocional || p?.preco_cheio || p?.preco || 0);
    return Number.isFinite(preco) && preco > 0 ? Number(preco.toFixed(2)) : null;
  } catch {
    return null;
  }
}
