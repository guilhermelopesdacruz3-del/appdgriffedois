// Cloudflare Pages Function: faz proxy reverso de /api/* -> backend Render.
// O _redirects do Pages não faz proxy cross-origin; esta Function sim.
// Dispara automaticamente para toda rota /api/* (catch-all [[path]]).
export async function onRequest(context) {
  const { request, params } = context;
  const path = Array.isArray(params.path) ? params.path.join("/") : (params.path || "");
  const target = "https://appdgriffedois.onrender.com/api/" + path;

  // Preserva o corpo (POST/PUT) e os headers relevantes.
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("cf-connecting-ip");

  const init = {
    method: request.method,
    headers,
    redirect: "follow",
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
    // Cloudflare streaming do body original
    init.duplex = "half";
  }

  try {
    const resp = await fetch(target, init);
    // Retorna a resposta do backend, removendo headers que conflitam.
    const out = new Headers(resp.headers);
    out.delete("content-encoding"); // o CF re-comprime
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
