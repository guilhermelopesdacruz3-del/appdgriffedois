// Alternativa "serverless" ao server/index.mjs — use esta se for hospedar o
// proxy na Vercel em vez de um servidor Node tradicional (Render, Railway, etc.).
// Mapeia para: /api/loja-integrada/<recurso>/<id?>
//
// Configure na Vercel (Project Settings > Environment Variables):
//   LOJA_INTEGRADA_APP_KEY, LOJA_INTEGRADA_API_KEY,
//   LOJA_INTEGRADA_API_BASE_URL (opcional), FRONTEND_ORIGIN (opcional)

export const config = { runtime: "edge" };

const RECURSOS_PERMITIDOS = new Set([
  "produto",
  "categoria",
  "marca",
  "cliente",
  "pedido",
  "formapagamento",
  "formaenvio",
  "situacaopedido",
]);
const RECURSOS_ESCRITA_PERMITIDOS = new Set(["cliente"]);

export default async function handler(request) {
  const {
    LOJA_INTEGRADA_APP_KEY,
    LOJA_INTEGRADA_API_KEY,
    LOJA_INTEGRADA_API_BASE_URL = "https://api.awsli.com.br/api/v1",
    FRONTEND_ORIGIN = "*",
  } = process.env;

  const url = new URL(request.url);
  // .../api/loja-integrada/produto/123/ -> ["", "api", "loja-integrada", "produto", "123"]
  const parts = url.pathname.split("/").filter(Boolean);
  const resourceIndex = parts.indexOf("loja-integrada") + 1;
  const resource = parts[resourceIndex];
  const id = parts[resourceIndex + 1];

  const corsHeaders = {
    "Access-Control-Allow-Origin": FRONTEND_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (!resource || !RECURSOS_PERMITIDOS.has(resource)) {
    return Response.json(
      { erro: `Recurso "${resource}" não é exposto por este proxy.` },
      { status: 404, headers: corsHeaders }
    );
  }

  if (request.method === "POST" && !RECURSOS_ESCRITA_PERMITIDOS.has(resource)) {
    return Response.json(
      { erro: `Criação via proxy não habilitada para "${resource}".` },
      { status: 405, headers: corsHeaders }
    );
  }

  const upstreamUrl = new URL(`${LOJA_INTEGRADA_API_BASE_URL}/${resource}/${id ? `${id}/` : ""}`);
  url.searchParams.forEach((value, key) => upstreamUrl.searchParams.set(key, value));
  upstreamUrl.searchParams.set("chave_aplicacao", LOJA_INTEGRADA_APP_KEY ?? "");
  upstreamUrl.searchParams.set("chave_api", LOJA_INTEGRADA_API_KEY ?? "");
  upstreamUrl.searchParams.set("format", "json");

  try {
    const upstreamResponse = await fetch(upstreamUrl.toString(), {
      method: request.method,
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: request.method === "POST" ? await request.text() : undefined,
    });

    const body = await upstreamResponse.text();
    return new Response(body, {
      status: upstreamResponse.status,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    return Response.json(
      { erro: "Falha ao se comunicar com a API da Loja Integrada." },
      { status: 502, headers: corsHeaders }
    );
  }
}
