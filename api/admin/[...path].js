// Versão serverless (Vercel) da área de admin — espelha server/index.mjs.
// Mapeia para: /api/admin/<recurso>
//
// Observação: em ambiente serverless não há sistema de arquivos persistido,
// então o estado de "verificado" fica em memória (por instância / cold start).
// Para persistência real em produção na Vercel, use um KV (ex.: Vercel KV)
// no lugar do Map abaixo.
//
// Configure na Vercel (Project Settings > Environment Variables):
//   ADMIN_PASSWORD, ADMIN_SECRET (opcional), LOJA_INTEGRADA_APP_KEY,
//   LOJA_INTEGRADA_API_KEY, LOJA_INTEGRADA_API_BASE_URL (opcional),
//   FRONTEND_ORIGIN (opcional)

export const config = { runtime: "edge" };

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function b64urlEncodeBytes(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecodeToBytes(s) {
  const norm = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(norm);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}
function b64urlEncodeStr(s) {
  return b64urlEncodeBytes(encoder.encode(s));
}
function b64urlDecodeStr(s) {
  return decoder.decode(b64urlDecodeToBytes(s));
}

let _adminKeyPromise = null;
function adminKey(secret) {
  if (!_adminKeyPromise) {
    _adminKeyPromise = crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"]
    );
  }
  return _adminKeyPromise;
}

async function signAdminToken(secret) {
  const payload = b64urlEncodeStr(
    JSON.stringify({ sub: "admin", exp: Date.now() + 60 * 60 * 1000 })
  );
  const key = await adminKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return `${payload}.${b64urlEncodeBytes(new Uint8Array(sig))}`;
}

async function verifyAdminToken(token, secret) {
  if (!token || !token.includes(".")) return false;
  const [payload, sig] = token.split(".");
  try {
    const key = await adminKey(secret);
    const ok = await crypto.subtle.verify("HMAC", key, b64urlDecodeToBytes(sig), encoder.encode(payload));
    if (!ok) return false;
    const data = JSON.parse(b64urlDecodeStr(payload));
    return typeof data.exp === "number" && data.exp > Date.now();
  } catch {
    return false;
  }
}

// Estado de verificação em memória (não persiste entre instâncias).
const verificacoes = new Map();

async function chamarLI(method, resource, id, query, body, env) {
  const upstreamUrl = new URL(`${env.LOJA_INTEGRADA_API_BASE_URL || "https://api.awsli.com.br/api/v1"}/${resource}/${id ? `${id}/` : ""}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== "") upstreamUrl.searchParams.set(k, String(v));
    }
  }
  upstreamUrl.searchParams.set("chave_aplicacao", env.LOJA_INTEGRADA_APP_KEY ?? "");
  upstreamUrl.searchParams.set("chave_api", env.LOJA_INTEGRADA_API_KEY ?? "");
  upstreamUrl.searchParams.set("format", "json");

  const upstreamResponse = await fetch(upstreamUrl.toString(), {
    method,
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: method === "POST" || method === "PUT" ? JSON.stringify(body) : undefined,
  });
  const text = await upstreamResponse.text();
  return { status: upstreamResponse.status, text };
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...(headers || {}) },
  });
}

export default async function handler(request) {
  const env = process.env;
  const ADMIN_SECRET = env.ADMIN_SECRET || "altere-este-segredo-admin-num-environment";
  const FRONTEND_ORIGIN = env.FRONTEND_ORIGIN || "*";

  const corsHeaders = {
    "Access-Control-Allow-Origin": FRONTEND_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean); // ["api","admin", ...]
  const rest = parts.slice(2); // remove "api","admin"
  const resource = rest[0];

  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  // POST /api/admin/login
  if (resource === "login" && request.method === "POST") {
    if (!env.ADMIN_PASSWORD) return json({ erro: "ADMIN_PASSWORD não configurado." }, 500, corsHeaders);
    let senha = "";
    try {
      const body = await request.json();
      senha = body.senha || "";
    } catch {}
    if (!senha || senha !== env.ADMIN_PASSWORD) return json({ erro: "Senha inválida." }, 401, corsHeaders);
    return json({ token: await signAdminToken(ADMIN_SECRET) }, 200, corsHeaders);
  }

  // Demais rotas exigem token de admin
  if (!(await verifyAdminToken(token, ADMIN_SECRET))) {
    return json({ erro: "Não autorizado." }, 401, corsHeaders);
  }

  try {
    // GET /api/admin/pedidos (ou com filtros)
    if (resource === "pedidos" && rest.length === 1) {
      if (request.method !== "GET") return json({ erro: "Método não suportado." }, 405, corsHeaders);
      const query = {};
      url.searchParams.forEach((v, k) => (query[k] = v));
      const { status, text } = await chamarLI("GET", "pedido", undefined, query, undefined, env);
      if (status !== 200) return new Response(text, { status, headers: { "Content-Type": "application/json", ...corsHeaders } });
      const payload = JSON.parse(text);
      const objects = (payload.objects || []).map((p) => ({
        ...p,
        verificado: verificacoes.has(String(p.id)),
        verificado_em: verificacoes.get(String(p.id)) || null,
      }));
      return json({ ...payload, objects }, 200, corsHeaders);
    }

    // GET /api/admin/pedidos/:id
    if (resource === "pedidos" && rest.length === 2 && request.method === "GET") {
      const { status, text } = await chamarLI("GET", "pedido", rest[1], undefined, undefined, env);
      if (status !== 200) return new Response(text, { status, headers: { "Content-Type": "application/json", ...corsHeaders } });
      const p = JSON.parse(text);
      return json(
        { ...p, verificado: verificacoes.has(String(p.id)), verificado_em: verificacoes.get(String(p.id)) || null },
        200,
        corsHeaders
      );
    }

    // PUT /api/admin/pedidos/:id  (body: { situacao })
    if (resource === "pedidos" && rest.length === 2 && request.method === "PUT") {
      const body = await request.json().catch(() => ({}));
      const liBody = {};
      if (body.situacao !== undefined) liBody.situacao = body.situacao;
      const { status, text } = await chamarLI("PUT", "pedido", rest[1], undefined, liBody, env);
      return new Response(text, { status, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    // POST /api/admin/pedidos/:id/verificar  (body: { verificado })
    if (resource === "pedidos" && rest.length === 3 && rest[2] === "verificar" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const verificado = body.verificado ?? true;
      const id = String(rest[1]);
      if (verificado) {
        verificacoes.set(id, new Date().toISOString());
      } else {
        verificacoes.delete(id);
      }
      return json(
        { id, verificado: Boolean(verificado), verificado_em: verificacoes.get(id) || null },
        200,
        corsHeaders
      );
    }

    // GET /api/admin/situacoes
    if (resource === "situacoes" && request.method === "GET") {
      const { status, text } = await chamarLI("GET", "situacaopedido", undefined, { limit: 200 }, undefined, env);
      if (status !== 200) return new Response(text, { status, headers: { "Content-Type": "application/json", ...corsHeaders } });
      const payload = JSON.parse(text);
      return json(payload.objects || [], 200, corsHeaders);
    }

    return json({ erro: "Recurso admin não encontrado." }, 404, corsHeaders);
  } catch (err) {
    return json({ erro: "Falha ao se comunicar com a API da Loja Integrada." }, 502, corsHeaders);
  }
}
