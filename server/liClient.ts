// Criação de pedidos na Loja Integrada (site) a partir de uma compra no app.
//
// Objetivo: quando o cliente compra no app D'Griffe, o pedido deve aparecer
// também no painel da Loja Integrada (site) e no admin. O webhook do Mercado
// Pago confirma o pagamento; aqui criamos o pedido na LI no momento do checkout
// (situação "Aguardando pagamento") e o atualizamos para "Pago" quando o MP
// aprovar.
//
// Endpoint oficial de integração (Vendas):
//   POST https://api.awsli.com.br/v1/integration/sales
//   PUT  https://api.awsli.com.br/v1/integration/sales/{id}
// Autenticação via header: `Authorization: chave_api {chave_api} aplicacao {aplicacao}`
// (NÃO usa query params como o /api/v1; e o `id` retornado no POST é o que o
// PUT espera no path — o `number` é o número do pedido na loja).
//
// SEGURANÇA: as chaves da LI vêm do getSecret (Supabase/env, server-only) e
// NUNCA saem do servidor. Qualquer falha é tratada como não-bloqueante: a compra
// no app não pode quebrar só porque a LI recusou algo.

import { getSecret, buscarPerfil, listarEnderecos } from "./db.ts";

const LI_API_BASE = "https://api.awsli.com.br/api/v1";
const LI_SALES_BASE = "https://api.awsli.com.br/v1/integration/sales";
const DEMO = process.env.DEMO_MODE === "true";

// Chama um recurso da API clássica da LI (/api/v1/...) com query params.
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
  upstream.searchParams.set("format", "json");
  const r = await fetch(upstream.toString(), {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `chave_api ${API_KEY} aplicacao ${APP_KEY}`,
    },
    body: method === "POST" || method === "PUT" ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const ct = r.headers.get("content-type") || "";
  const payload = ct.includes("application/json") ? await r.json().catch(() => ({})) : await r.text();
  return { status: r.status, payload };
}

// Situação inicial do pedido na LI: id 2 = "Aguardando pagamento".
const SITUACAO_INICIAL = "2";

// Mapeia nomes usados pelo app para o id da situação na LI (GET /api/v1/situacao).
const SITUACOES: Record<string, string> = {
  "aguardando": "2",
  "aguardando pagamento": "2",
  "em aberto": "2",
  "aberto": "2",
  "pendente": "2",
  "pago": "4",
  "aprovado": "4",
  "pedido pago": "4",
  "cancelado": "8",
  "efetuado": "9",
  "separacao": "15",
  "em separacao": "15",
  "enviado": "11",
  "entregue": "14",
  "retirada": "13",
  "pronto para retirada": "13",
};

// Endereço padrão usado quando o cliente não tem endereço salvo. Como o app
// vende com retirada na loja, o endereço de entrega é um placeholder válido.
const ENDERECO_LOJA = {
  name: "D'Griffe Ótica de Luxo",
  address: "Av. Paulista",
  country: "BR",
  complement: "",
  district: "Bela Vista",
  city: "São Paulo",
  state: "SP",
  zipcode: "01310100",
  number: "1000",
};

// Chama o endpoint de Vendas da LI (header Authorization, sem query params).
async function chamarSalesLI(
  method: "POST" | "PUT",
  id?: number | string,
  body?: unknown
): Promise<{ status: number; payload: any }> {
  const APP_KEY = (await getSecret("LI_APP_KEY").catch(() => null)) || process.env.LOJA_INTEGRADA_APP_KEY || "";
  const API_KEY = (await getSecret("LI_API_KEY").catch(() => null)) || process.env.LOJA_INTEGRADA_API_KEY || "";
  if (!APP_KEY || !API_KEY) {
    if (DEMO) {
      // Em modo demo sem chaves, simula respostas da LI sem chamar a API real.
      if (method === "POST") {
        const fakeId = Math.floor(Math.random() * 900000000) + 100000000;
        return { status: 201, payload: { id: fakeId, number: fakeId } };
      }
      return { status: 200, payload: {} };
    }
    throw new Error("Chaves da Loja Integrada não configuradas.");
  }
  const url = id != null ? `${LI_SALES_BASE}/${id}` : LI_SALES_BASE;
  const r = await fetch(url, {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `chave_api ${API_KEY} aplicacao ${APP_KEY}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
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
    // A LI exige nome e (para PF) CPF; enderecos pode ser lista vazia.
    const { status } = await chamarLI("POST", "cliente", undefined, undefined, {
      email,
      nome: dados.nome || email.split("@")[0],
      telefone_celular: dados.telefone || "",
      cpf: dados.cpf || "",
      enderecos: [],
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

// Extrai o ID numérico do produto a partir do li_uri ou sku.
// O front manda sku = String(product.id) (id numérico da LI).
function extrairIdProduto(item: ItemPedidoLI): number | null {
  if (item.sku && /^\d+$/.test(String(item.sku).trim())) return Number(item.sku);
  if (item.li_uri) {
    const m = String(item.li_uri).match(/produto\/(\d+)/);
    if (m) return Number(m[1]);
  }
  return null;
}

// Baixa o estoque de cada item na Loja Integrada (site). Não-bloqueante:
// se a LI falhar, apenas avisa no log — a compra no app não pode quebrar.
export async function baixarEstoqueLI(itens: ItemPedidoLI[]): Promise<void> {
  for (const item of itens) {
    const id = extrairIdProduto(item);
    if (!id || !(item.quantidade > 0)) continue;
    try {
      // Lê a quantidade atual e decrementa (a LI aceita PUT com `quantidade`).
      const { status, payload } = await chamarLI("GET", "produto", id, { limit: "1" });
      if (status !== 200) continue;
      const atual = payload?.produto?.quantidade ?? payload?.quantidade ?? payload?.estoque_quantidade ?? null;
      if (atual == null) continue;
      const nova = Math.max(0, Number(atual) - item.quantidade);
      await chamarLI("PUT", "produto", id, undefined, { quantidade: nova });
    } catch (e: any) {
      console.warn(`[LI] falha ao baixar estoque do produto ${id}:`, e?.message || e);
    }
  }
}

export interface PedidoLICriado {
  id: number; // id do pedido na LI (usado no PUT /v1/integration/sales/{id})
  numero: number; // número do pedido na loja (aparece no admin)
  corpo: Record<string, unknown>; // corpo completo enviado (necessário no PUT)
}

export async function criarPedidoLI(opts: {
  email: string;
  itens: ItemPedidoLI[];
  valor: number;
  meio: "pix" | "cartao";
  observacoes?: string;
  formaEntrega?: "retirada" | "entrega";
  origem?: "app" | "site";
}): Promise<PedidoLICriado | null> {
  const itens = opts.itens
    .map((i) => {
      const product_id = extrairIdProduto(i);
      if (!product_id || !(i.quantidade > 0)) return null;
      return { product_id, quantity: i.quantidade, unit_value: i.preco, line_value: i.preco * i.quantidade };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (itens.length === 0) return null; // sem itens válidos, não cria

  // Garante que o cliente exista na LI antes de criar o pedido (idempotente:
  // se já existe, a LI apenas retorna o cliente). Evita erro de "cliente inexistente".
  await criarClienteLI(opts.email, {}).catch(() => false);

  // Buyer: usa nome/telefone/CPF do perfil do cliente quando disponíveis;
  // fallback para valores neutros (a LI exige document, mas aceita 00000000000).
  const perfil = await buscarPerfil(opts.email).catch(() => null);
  const enderecos = await listarEnderecos(opts.email).catch(() => []);
  const end = enderecos[0];
  const endereco = end
    ? {
        name: perfil?.nome || opts.email.split("@")[0],
        address: end.endereco,
        country: "BR",
        complement: end.complemento || "",
        district: end.bairro || "",
        city: end.cidade,
        state: end.estado,
        zipcode: String(end.cep).replace(/\D/g, ""),
        number: end.numero || "0",
      }
    : ENDERECO_LOJA;

  const formaEntrega = opts.formaEntrega || "retirada";
  const comentarios = [
    `Pedido do app D'Griffe (${opts.meio})`,
    formaEntrega === "entrega" ? "Entrega no endereço informado" : "Retirada na loja",
    opts.observacoes ? `Obs: ${opts.observacoes}` : null,
  ]
    .filter(Boolean)
    .join(" · ")
    .slice(0, 500);

  const timestamp = Date.now();
  const corpo: Record<string, unknown> = {
    buyer: {
      name: perfil?.nome || opts.email.split("@")[0] || "Cliente",
      email: opts.email,
      document: (perfil as any)?.cpf || "00000000000",
      external_id: String(timestamp),
      phone: (perfil as any)?.telefone || "",
      type: "CPF",
      cellPhone: "",
    },
    shipping: {
      address: endereco,
      option: formaEntrega === "entrega" ? "entrega" : "retirar_pessoalmente",
    },
    amount: {
      discount: null,
      freight: 0,
      fees: null,
      total: Number(opts.valor.toFixed(2)),
      gross: Number(opts.valor.toFixed(2)),
    },
    items: itens,
    info: {
      status: SITUACAO_INICIAL,
      marketPlaceId: null,
      reference: `dgriffe-app/${timestamp}`,
      comment: comentarios,
    },
    integration_data: {
      integrator: "dgriffe-app",
      marketplace: opts.origem === "site" ? "site" : "app",
      external_id: timestamp,
      unique_id: null,
    },
  };

  const { status, payload } = await chamarSalesLI("POST", undefined, corpo);
  if (status !== 200 && status !== 201) {
    console.warn(`[LI] falha ao criar pedido (${status}):`, JSON.stringify(payload).slice(0, 300));
    return null;
  }
  const id = Number(payload?.id || null);
  const numero = Number(payload?.number || payload?.id || null);
  if (!id) {
    console.warn("[LI] pedido criado sem id:", JSON.stringify(payload).slice(0, 300));
    return null;
  }
  // Baixa o estoque dos itens na LI (não-bloqueante).
  await baixarEstoqueLI(opts.itens).catch(() => {});
  return { id, numero, corpo };
}

// Atualiza a situação do pedido na LI. O endpoint de Vendas exige o CORPO
// COMPLETO do pedido (com a mesma reference do POST); por isso `corpo` deve ser
// o objeto retornado por criarPedidoLI (guardado no espelho do pedido).
export async function atualizarPedidoLI(
  id: number | string,
  situacaoNome: string,
  corpo?: Record<string, unknown>
): Promise<boolean> {
  const situacaoId = SITUACOES[situacaoNome.trim().toLowerCase()];
  if (!situacaoId) return false;
  if (!corpo) {
    console.warn(`[LI] não é possível atualizar o pedido ${id}: corpo do pedido não informado.`);
    return false;
  }
  try {
    const novo: Record<string, unknown> = JSON.parse(JSON.stringify(corpo));
    novo.info = { ...(novo.info as Record<string, unknown>), status: situacaoId };
    const { status } = await chamarSalesLI("PUT", id, novo);
    return status === 200 || status === 204;
  } catch {
    return false;
  }
}

// Atualiza a situação do pedido de integração usando o corpo do espelho
// (li_dados) e o id da situação da LI (ex.: 4 = pago) — caminho usado pelo
// admin, que manda o id da situação em vez do nome.
export async function atualizarPedidoLISituacao(
  id: number | string,
  situacaoId: string | number,
  corpo?: Record<string, unknown>
): Promise<boolean> {
  if (!corpo) {
    console.warn(`[LI] não é possível atualizar o pedido ${id}: corpo do pedido não informado.`);
    return false;
  }
  try {
    const novo: Record<string, unknown> = JSON.parse(JSON.stringify(corpo));
    novo.info = { ...(novo.info as Record<string, unknown>), status: String(situacaoId) };
    const { status } = await chamarSalesLI("PUT", id, novo);
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
