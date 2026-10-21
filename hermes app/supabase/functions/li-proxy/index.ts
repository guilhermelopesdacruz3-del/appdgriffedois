// Supabase Edge Function: li-proxy
// ATENÇÃO (LGPD P0): esta função usa a service_role e, se pública, vira um
// proxy aberto para CPF/telefone/endereço/pedidos de qualquer cliente.
//
// Agora ela é "fechada por padrão":
//   * exige o segredo LI_PROXY_TOKEN no header `x-li-proxy-token`;
//   * sem esse secret configurado, a função responde 503 (desativada);
//   * só permite recursos de catálogo (nunca cliente/pedido);
//   * só aceita GET e, se LI_PROXY_ORIGIN for definido, restringe o CORS.
//
// Deploy: supabase functions deploy li-proxy --project-ref unpbvztvscuisqnzofqp
// Secret: supabase secrets set LI_PROXY_TOKEN=<valor-forte>

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LI_API_BASE = "https://api.awsli.com.br/api/v1";

const LI_PROXY_TOKEN = Deno.env.get("LI_PROXY_TOKEN") ?? "";
const LI_PROXY_ORIGIN = Deno.env.get("LI_PROXY_ORIGIN") ?? "";
const RECURSOS_PERMITIDOS = new Set([
  "produto",
  "produto_preco",
  "produto_estoque",
  "produto_imagem",
  "categoria",
  "marca",
  "grades",
  "formapagamento",
  "formaenvio",
  "situacao",
]);

const demoData = {
  categoria: [
    { id: 1, nome: "Sol", descricao: "", categoria_pai: null, url: "", resource_uri: `${LI_API_BASE}/categoria/1/` },
    { id: 2, nome: "Grau", descricao: "", categoria_pai: null, url: "", resource_uri: `${LI_API_BASE}/categoria/2/` },
    { id: 3, nome: "Ray-Ban", descricao: "", categoria_pai: null, url: "", resource_uri: `${LI_API_BASE}/categoria/3/` },
    { id: 4, nome: "Grazi", descricao: "", categoria_pai: null, url: "", resource_uri: `${LI_API_BASE}/categoria/4/` },
    { id: 5, nome: "Michael Kors", descricao: "", categoria_pai: null, url: "", resource_uri: `${LI_API_BASE}/categoria/5/` },
    { id: 6, nome: "Infantil", descricao: "", categoria_pai: null, url: "", resource_uri: `${LI_API_BASE}/categoria/6/` },
  ],
  marca: [
    { id: 1, nome: "Ray-Ban", apelido: "rb", ativo: true, resource_uri: `${LI_API_BASE}/marca/1/` },
    { id: 2, nome: "Michael Kors", apelido: "mk", ativo: true, resource_uri: `${LI_API_BASE}/marca/2/` },
    { id: 3, nome: "Vogue", apelido: "vg", ativo: true, resource_uri: `${LI_API_BASE}/marca/3/` },
    { id: 4, nome: "Armani", apelido: "ar", ativo: true, resource_uri: `${LI_API_BASE}/marca/4/` },
    { id: 5, nome: "Grazi", apelido: "gz", ativo: true, resource_uri: `${LI_API_BASE}/marca/5/` },
    { id: 6, nome: "Aviator", apelido: "av", ativo: true, resource_uri: `${LI_API_BASE}/marca/6/` },
  ],
};

function img(n: string) { return `/images/${n}`; }

const produtos = [
  { id: 101, nome: "Ray-Ban Aviador Clássico", sku: "RB3025", preco: 1290.0, promo: 1099.0, cat: 1, marca: 1, imagem: "product-gold-aviator.jpg", destaque: true, tags: "cor:Dourado, try-on" },
  { id: 102, nome: "Ray-Ban Wayfarer Preto", sku: "RB2140", preco: 1190.0, promo: null, cat: 1, marca: 1, imagem: "product-black-wayfarer.jpg", destaque: true, tags: "cor:Preto, 3d" },
  { id: 103, nome: "Michael Kors Aviador Rose", sku: "MK5001", preco: 990.0, promo: 840.0, cat: 1, marca: 2, imagem: "product-mk-aviator.jpg", destaque: false, tags: "cor:Rose, try-on" },
  { id: 104, nome: "Vogue Trendy Oversized", sku: "VOTD", preco: 870.0, promo: 699.0, cat: 1, marca: 3, imagem: "product-vogue-trendy.jpg", destaque: true, tags: "cor:Preto, try-on" },
  { id: 105, nome: "Armani Modern Square", sku: "EA0", preco: 1450.0, promo: null, cat: 1, marca: 4, imagem: "product-armani-modern.jpg", destaque: false, tags: "cor:Prata, 3d" },
  { id: 106, nome: "Grazi Cat Eye", sku: "GZCE", preco: 760.0, promo: 599.0, cat: 4, marca: 5, imagem: "product-grazi-cateye.jpg", destaque: false, tags: "cor:Marrom, try-on" },
  { id: 107, nome: "Cat Eye Clássico", sku: "CE001", preco: 540.0, promo: 459.0, cat: 2, marca: 6, imagem: "product-cateye.jpg", destaque: false, tags: "cor:Preto, 3d" },
  { id: 108, nome: "Redondo Vintage", sku: "RD002", preco: 480.0, promo: null, cat: 2, marca: 6, imagem: "product-round.jpg", destaque: false, tags: "cor:Dourado, try-on" },
].map((p) => ({
  id: p.id, nome: p.nome, apelido: "", sku: p.sku, gtin: null, ncm: null, ativo: true, removido: false,
  bloqueado: false, destaque: p.destaque, usado: false, descricao_completa: p.nome,
  preco_cheio: p.preco, preco_promocional: p.promo, preco_custo: null, preco_sob_consulta: false,
  estoque_quantidade: 10, estoque_gerenciado: true, estoque_situacao_em_estoque: 1, estoque_situacao_sem_estoque: 2,
  peso: "0.050", altura: "5", largura: "15", profundidade: "5",
  marca: `${LI_API_BASE}/marca/${p.marca}/`, pai: null, tags: p.tags, url: `/produto/${p.id}/`, url_video_youtube: null,
  imagem_principal: { id: p.id * 100, principal: true, posicao: 1, pequena: img(p.imagem), media: img(p.imagem), grande: img(p.imagem), icone: img(p.imagem), mime: "image/jpeg", resource_uri: `${LI_API_BASE}/produto_imagem/${p.id * 100}/` },
  imagens: [], categorias: [`${LI_API_BASE}/categoria/${p.cat}/`], categoria: `${LI_API_BASE}/categoria/${p.cat}/`,
  variacoes: [], resource_uri: `${LI_API_BASE}/produto/${p.id}/`, data_criacao: "2026-01-10T12:00:00", data_modificacao: "2026-06-01T12:00:00",
}));

function envelope(objects: any[], query: URLSearchParams) {
  const limit = Number(query.get("limit") ?? 20);
  const offset = Number(query.get("offset") ?? 0);
  return { meta: { limit, offset, total_count: objects.length, next: null, previous: null }, objects };
}

function demoResponder(resource: string, id: string | null, method: string, query: URLSearchParams) {
  switch (resource) {
    case "produto": {
      if (id) { const p = produtos.find((x) => String(x.id) === id); return p ? { status: 200, body: p } : { status: 404, body: { erro: "não encontrado" } }; }
      let lista = produtos;
      const busca = query.get("nome__icontains");
      if (busca) lista = lista.filter((p) => p.nome.toLowerCase().includes(busca.toLowerCase()));
      const cat = query.get("categorias");
      if (cat) lista = lista.filter((p) => p.categorias.includes(`${LI_API_BASE}/categoria/${cat}/`));
      return { status: 200, body: envelope(lista, query) };
    }
    case "categoria": return { status: 200, body: envelope(demoData.categoria as any[], query) };
    case "marca": return { status: 200, body: envelope(demoData.marca as any[], query) };
    case "cliente": return { status: 200, body: envelope([{ id: 1, nome: "Maria Cliente Demo", email: query.get("email") || "cliente@demo.com.br", cpf: "123.456.789-00", resource_uri: `${LI_API_BASE}/cliente/1/` }], query) };
    case "pedido": return { status: 200, body: envelope([], query) };
    default: return { status: 404, body: { erro: `sem demo para ${resource}` } };
  }
}

async function getConfig(): Promise<{ appKey: string; apiKey: string }> {
  // Tenta Secrets primeiro, depois store_config.
  const appKey = Deno.env.get("LI_APP_KEY") ?? "";
  const apiKey = Deno.env.get("LI_API_KEY") ?? "";
  if (appKey && apiKey) return { appKey, apiKey };
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
    const { data } = await sb.from("store_config").select("key,value").in("key", ["LI_APP_KEY", "LI_API_KEY"]);
    const map: Record<string, string> = {};
    (data || []).forEach((r: any) => (map[r.key] = r.value));
    return { appKey: appKey || map.LI_APP_KEY || "", apiKey: apiKey || map.LI_API_KEY || "" };
  } catch { return { appKey, apiKey }; }
}

async function chamarLI(method: string, resource: string, id: string | null, query: Record<string, string>, appKey: string, apiKey: string) {
  const url = new URL(`${LI_API_BASE}/${resource}/${id ? `${id}/` : ""}`);
  Object.entries(query).forEach(([k, v]) => { if (v) url.searchParams.set(k, v); });
  url.searchParams.set("format", "json");
  // Credenciais em header (não na query string, que vaza em logs/proxies).
  const r = await fetch(url.toString(), {
    method,
    headers: {
      Accept: "application/json",
      Authorization: `chave_api ${apiKey} aplicacao ${appKey}`,
    },
    signal: AbortSignal.timeout(15000),
  });
  const ct = r.headers.get("content-type") || "";
  const payload = ct.includes("application/json") ? await r.json() : await r.text();
  return { status: r.status, payload };
}

Deno.serve(async (req) => {
  const corsHeaders: Record<string, string> = LI_PROXY_ORIGIN
    ? {
        "Access-Control-Allow-Origin": LI_PROXY_ORIGIN,
        "Access-Control-Allow-Headers": "content-type, x-li-proxy-token",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        Vary: "Origin",
      }
    : {};
  const responder = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  // Fechada por padrão: sem secret configurado, ninguém usa a função.
  if (!LI_PROXY_TOKEN) return responder(503, { erro: "Função desativada." });
  if ((req.headers.get("x-li-proxy-token") || "") !== LI_PROXY_TOKEN) {
    return responder(401, { erro: "Não autorizado." });
  }

  const url = new URL(req.url);
  const parts = url.pathname.replace(/^\/|\/$/g, "").split("/"); // api/loja-integrada/<resource>/<id>
  const resource = parts[2];
  const id = parts[3] ?? null;
  const method = req.method;
  const query = Object.fromEntries(url.searchParams.entries());

  if (method !== "GET") return responder(405, { erro: "Método não suportado." });
  if (!RECURSOS_PERMITIDOS.has(resource)) {
    return responder(404, { erro: "Recurso não exposto por este proxy." });
  }
  if (id && !/^\d+$/.test(id)) return responder(400, { erro: "ID inválido." });

  const { appKey, apiKey } = await getConfig();
  if (!appKey || !apiKey) {
    const r = demoResponder(resource, id, method, url.searchParams);
    return responder(r.status, r.body);
  }
  try {
    const { status, payload } = await chamarLI(method, resource, id, query, appKey, apiKey);
    return responder(status, payload);
  } catch (e) {
    console.error("[li-proxy] falha:", (e as Error)?.message);
    return responder(502, { erro: "Falha ao chamar Loja Integrada" });
  }
});
