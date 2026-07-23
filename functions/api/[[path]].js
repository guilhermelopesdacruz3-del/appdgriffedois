// Cloudflare Pages Function: faz proxy reverso de /api/* -> backend Render.
// O _redirects do Pages não faz proxy cross-origin; esta Function sim.
// Dispara automaticamente para toda rota /api/* (catch-all [[path]]).
export async function onRequest(context) {
  const { request, params } = context;
  const path = Array.isArray(params.path) ? params.path.join("/") : (params.path || "");
  const url = new URL(request.url);
  const target = "https://appdgriffedois.onrender.com/api/" + path + url.search;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("cf-connecting-ip");

  const init = {
    method: request.method,
    headers,
    redirect: "follow",
    // Timeout de 55s: dá margem para o Render (free) acordar do cold-start
    // sem o Cloudflare abortar antes com 502.
    signal: AbortSignal.timeout(55000),
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
    init.duplex = "half";
  }

  try {
    const resp = await fetch(target, init);
    const out = new Headers(resp.headers);
    out.delete("content-encoding");
    out.delete("transfer-encoding");
    return new Response(resp.body, {
      status: resp.status,
      headers: out,
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, erro: "proxy_falhou", detalhe: String(e) }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }
}
