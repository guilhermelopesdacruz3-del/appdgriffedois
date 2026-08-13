// Cloudflare Pages Function: proxy reverso de /api/* -> backend Render.
export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (!pathname.startsWith("/api/")) {
    return new Response("NOT API", { status: 404 });
  }

  const target = new URL("https://appdgriffedois.onrender.com");
  target.pathname = pathname;
  target.search = url.search;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("cf-connecting-ip");

  const init = {
    method: request.method,
    headers,
    redirect: "follow",
    // Pages Functions free: limite de execução ~30s (a função é morta pelo
    // Cloudflare e devolve 502 genérico). Timeout de 25s garante que o nosso
    // catch rode e devolva um JSON tratável antes disso.
    signal: AbortSignal.timeout(25000),
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
    init.duplex = "half";
  }

  try {
    const resp = await fetch(target.toString(), init);
    const out = new Headers(resp.headers);
    out.delete("content-encoding");
    out.delete("transfer-encoding");
    return new Response(resp.body, { status: resp.status, headers: out });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, erro: "proxy_falhou", detalhe: String(e) }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }
}
