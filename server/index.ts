// Proxy para a API da Loja Integrada + Painel Admin (HARDENED).
//
// Melhorias de segurança aplicadas (vs. versão anterior):
//   - Rate-limit + bloqueio temporário de força bruta no login (/api/admin/login)
//   - Token de admin revogável (jti registrado no servidor) + logout
//   - Cabeçalhos de segurança (CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy)
//   - Body size limit e validação de entrada no login
//   - Erros internos nunca vazam para o cliente (logs apenas no servidor)
//   - Auditoria de acessos (login ok / falha / ações) no log do servidor
//   - Verificação de origem (FRONTEND_ORIGIN) no CORS
//
// Como rodar localmente:
//   1) cp server/.env.example server/.env  (e preencha com as chaves + ADMIN_PASSWORD)
//   2) npm install
//   3) npm run server
//
// Como hospedar: qualquer serviço que rode Node (Render, Railway, Fly.io, VPS).
// Para Vercel/Netlify, use api/loja-integrada/[...path].js e api/admin/[...path].js.

import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, "..", "..", "dist");
import {
  demoResponder,
  demoCriarCliente,
  demoAdminPedidos,
  demoAdminPedido,
  demoAdminSituacoes,
} from "./demo.mjs";
import * as segredos from "./db.ts";
import { processarCheckout } from "./pagamento.ts";
import { processarWebhookMP } from "./webhook.ts";
import { listarVideosRecentes } from "./youtube.ts";
import { getHistoricoFidelidade, registrarLog, supabaseClient } from "./db.ts";
import cupomApp from "./cupom.ts";
import { receitasApp } from "./receitas";
import { favoritosApp } from "./favoritos";

const {
  LOJA_INTEGRADA_API_KEY,
  LOJA_INTEGRADA_API_BASE_URL = "https://api.awsli.com.br/api/v1",
  FRONTEND_ORIGIN = "https://appdgriffedois-3xwz-hrxf1ru63.vercel.app",
  PORT = 8787,
  ADMIN_PASSWORD,
  ADMIN_SECRET = "altere-este-segredo-admin-num-environment",
  // Quando "true", o proxy devolve dados fictícios (modo demo) em vez de
  // chamar a Loja Integrada real.
  DEMO_MODE = "false",
  ADMIN_MOCK = "false",
  // Novos: proteção de login
  ADMIN_MAX_TENTATIVAS = "5",
  ADMIN_LOCKOUT_MS = "900000", // 15 minutos
  ADMIN_SENHA_MIN = "6",
} = process.env;

const DEMO = DEMO_MODE === "true" || DEMO_MODE === "1" || ADMIN_MOCK === "1" || ADMIN_MOCK === "true";
const MOCK = ADMIN_MOCK === "1" || ADMIN_MOCK === "true";

// Em PRODUÇÃO (DEMO_MODE != true), exige senha de admin forte. Nunca aceita a
// senha de demo nem senha curta — falha visivelmente no log se estiver errado.
const SENHA_MIN_PROD = 8;
const SECRET_DEFAULT = "altere-este-segredo-admin-num-environment";
let senhaProducaoFraca = false;
if (!DEMO) {
  if (!ADMIN_PASSWORD || ADMIN_PASSWORD === "demo123" || ADMIN_PASSWORD.length < SENHA_MIN_PROD) {
    senhaProducaoFraca = true;
    console.error(
      "=========================================================================\n" +
      "[SEGURANÇA] ADMIN_PASSWORD ausente ou fraca em PRODUÇÃO (DEMO_MODE!=true).\n" +
      "Defina ADMIN_PASSWORD com >= 8 caracteres (e nunca 'demo123') no ambiente.\n" +
      "O login de admin ficará BLOQUEADO até corrigir.\n" +
      "========================================================================="
    );
  }
  // ADMIN_SECRET é a CHAVE HMAC dos tokens de admin. Se ficar no default, qualquer
  // um forja um token válido → acesso total. Bloqueia o login até configurar.
  if (!ADMIN_SECRET || ADMIN_SECRET === SECRET_DEFAULT || ADMIN_SECRET.length < 16) {
    senhaProducaoFraca = true;
    console.error(
      "=========================================================================\n" +
      "[SEGURANÇA] ADMIN_SECRET ausente/fraco em PRODUÇÃO. Tokens de admin seriam\n" +
      "forjáveis. Defina ADMIN_SECRET com >= 16 caracteres aleatórios no ambiente.\n" +
      "O login de admin ficará BLOQUEADO até corrigir.\n" +
      "========================================================================="
    );
  }
}

if (!process.env.LOJA_INTEGRADA_APP_KEY || !process.env.LOJA_INTEGRADA_API_KEY) {
  console.warn(
    "[loja-integrada-proxy] AVISO: LOJA_INTEGRADA_APP_KEY e/ou LOJA_INTEGRADA_API_KEY não configuradas."
  );
}
if (!ADMIN_PASSWORD) {
  console.warn(
    "[loja-integrada-proxy] AVISO: ADMIN_PASSWORD não configurado. A área de admin estará indisponível."
  );
}

// ---------------------------------------------------------------------------
// Rate-limit / bloqueio de força bruta (por IP) — apenas no login
// ---------------------------------------------------------------------------
const MAX_TENTATIVAS = parseInt(ADMIN_MAX_TENTATIVAS, 10) || 5;
const LOCKOUT_MS = parseInt(ADMIN_LOCKOUT_MS, 10) || 900000;
const SENHA_MIN = parseInt(ADMIN_SENHA_MIN, 10) || 6;
const tentativas = new Map(); // ip -> { count, primeiro, bloqueadoAte }

function checarBloqueio(ip) {
  const t = tentativas.get(ip);
  if (!t) return { bloqueado: false };
  if (t.bloqueadoAte && Date.now() < t.bloqueadoAte) {
    const resta = Math.ceil((t.bloqueadoAte - Date.now()) / 1000);
    return { bloqueado: true, resta };
  }
  if (t.bloqueadoAte && Date.now() >= t.bloqueadoAte) {
    tentativas.delete(ip); // libera após o período
  }
  return { bloqueado: false };
}

function registrarTentativaFalha(ip) {
  const t = tentativas.get(ip) || { count: 0, primeiro: Date.now(), bloqueadoAte: 0 };
  t.count += 1;
  if (t.count >= MAX_TENTATIVAS) {
    t.bloqueadoAte = Date.now() + LOCKOUT_MS;
    console.warn(`[seguranca] IP ${ip} bloqueado por ${LOCKOUT_MS / 1000}s após ${t.count} tentativas de login.`);
  }
  tentativas.set(ip, t);
}

function registrarTentativaSucesso(ip) {
  tentativas.delete(ip);
}

function ipDo(req) {
  return (req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "desconhecido");
}

// ---------------------------------------------------------------------------
// Tokens de admin (HMAC via Web Crypto) + revogação server-side
// ---------------------------------------------------------------------------
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function b64urlEncodeBytes(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecodeToBytes(s) {
  const norm = s.replace(/-/g, "+").replace(/_/g, "/");
  const padded = norm.padEnd(Math.ceil(norm.length / 4) * 4, "=");
  const bin = atob(padded);
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
function adminKey() {
  if (!_adminKeyPromise) {
    _adminKeyPromise = crypto.subtle.importKey(
      "raw",
      encoder.encode(ADMIN_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"]
    );
  }
  return _adminKeyPromise;
}

// Set de tokens revogados (jti). Em memória; em produção multi-instância use Redis.
const revokedTokens = new Set();

function gerarJti() {
  return b64urlEncodeStr(`${Date.now()}.${Math.random().toString(36).slice(2)}`);
}

async function signAdminToken() {
  const jti = gerarJti();
  const payload = b64urlEncodeStr(
    JSON.stringify({ sub: "admin", jti, exp: Date.now() + 60 * 60 * 1000 })
  );
  const key = await adminKey();
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return `${payload}.${b64urlEncodeBytes(new Uint8Array(sig))}`;
}

async function verifyAdminToken(token) {
  if (!token || !token.includes(".")) return false;
  const [payload, sig] = token.split(".");
  try {
    const key = await adminKey();
    const ok = await crypto.subtle.verify("HMAC", key, b64urlDecodeToBytes(sig), encoder.encode(payload));
    if (!ok) return false;
    const data = JSON.parse(b64urlDecodeStr(payload));
    if (typeof data.exp !== "number" || data.exp < Date.now()) return false;
    if (revokedTokens.has(data.jti)) return false;
    return true;
  } catch {
    return false;
  }
}

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  verifyAdminToken(token).then((ok) => {
    if (!ok) return res.status(401).json({ erro: "Não autorizado." });
    next();
  });
}

// ---------------------------------------------------------------------------
// Persistência das verificações de pedido (em arquivo, só no servidor Node)
// ---------------------------------------------------------------------------
const ESTADO_ARQ = path.join(__dirname, ".admin-state.json");
let estado = { verificacoes: {} };
try {
  estado = JSON.parse(fs.readFileSync(ESTADO_ARQ, "utf8"));
} catch {
  /* estado vazio */
}
function salvarEstado() {
  fs.writeFile(ESTADO_ARQ, JSON.stringify(estado), () => {});
}

// ---------------------------------------------------------------------------
// Dados fictícios (modo MOCK / ADMIN_MOCK=1)
// ---------------------------------------------------------------------------
const mockSituacoes = [
  { id: 1, codigo: "em_analise", nome: "Em análise", aprovado: false, cancelado: false, final: false, resource_uri: "/api/v1/situacaopedido/1/" },
  { id: 2, codigo: "aprovado", nome: "Aprovado", aprovado: true, cancelado: false, final: false, resource_uri: "/api/v1/situacaopedido/2/" },
  { id: 3, codigo: "em_separacao", nome: "Em separação", aprovado: false, cancelado: false, final: false, resource_uri: "/api/v1/situacaopedido/3/" },
  { id: 4, codigo: "enviado", nome: "Enviado", aprovado: false, cancelado: false, final: false, resource_uri: "/api/v1/situacaopedido/4/" },
  { id: 5, codigo: "entregue", nome: "Entregue", aprovado: false, cancelado: false, final: true, resource_uri: "/api/v1/situacaopedido/5/" },
  { id: 6, codigo: "cancelado", nome: "Cancelado", aprovado: false, cancelado: true, final: false, resource_uri: "/api/v1/situacaopedido/6/" },
];

const mockPedidos = [
  { id: 101, numero: "DG-2025001", cliente_nome: "Ana Beatriz Souza", cliente_email: "ana.souza@email.com", cliente: "/api/v1/cliente/55/", situacao: mockSituacoes[1], data_criacao: "2026-07-10T14:30:00", valor_subtotal: "459.90", valor_desconto: "0.00", valor_envio: "0.00", valor_total: "459.90", itens: [{ id: 1, nome: "Óculos Ray-Ban Aviador", quantidade: 1, preco_venda: "459.90" }], pagamentos: [{ forma_pagamento: { nome: "Pix" }, valor: "459.90" }], envios: [{ forma_envio: { nome: "Transportadora" }, prazo: 5, objeto: "BR123456789XY" }] },
  { id: 102, numero: "DG-2025002", cliente_nome: "Carlos Mendes", cliente_email: "carlos.mendes@email.com", cliente: "/api/v1/cliente/61/", situacao: mockSituacoes[0], data_criacao: "2026-07-12T09:10:00", valor_subtotal: "1290.00", valor_desconto: "0.00", valor_envio: "0.00", valor_total: "1290.00", itens: [{ id: 2, nome: "Óculos Michael Kors Feminino", quantidade: 1, preco_venda: "1290.00" }], pagamentos: [{ forma_pagamento: { nome: "Cartão de crédito" }, valor: "1290.00" }], envios: [{ forma_envio: { nome: "Correios" }, prazo: 8, objeto: null }] },
  { id: 103, numero: "DG-2025003", cliente_nome: "Beatriz Lima", cliente_email: "bia.lima@email.com", cliente: "/api/v1/cliente/72/", situacao: mockSituacoes[3], data_criacao: "2026-07-14T18:45:00", valor_subtotal: "239.90", valor_desconto: "0.00", valor_envio: "0.00", valor_total: "239.90", itens: [{ id: 3, nome: "Óculos Vogue Redondo", quantidade: 1, preco_venda: "239.90" }], pagamentos: [{ forma_pagamento: { nome: "Pix" }, valor: "239.90" }], envios: [{ forma_envio: { nome: "Transportadora" }, prazo: 4, objeto: "BR987654321ZW" }] },
];

const mockVerificacoes = {};

function mockListPedidos() {
  return {
    meta: { limit: 100, offset: 0, total_count: mockPedidos.length, next: null, previous: null },
    objects: mockPedidos.map((p) => ({
      ...p,
      verificado: Boolean(mockVerificacoes[String(p.id)]),
      verificado_em: mockVerificacoes[String(p.id)] ? mockVerificacoes[String(p.id)].em : null,
    })),
  };
}

// ---------------------------------------------------------------------------
// Chamada genérica à Loja Integrada (com credenciais injetadas)
// ---------------------------------------------------------------------------
async function chamarLI(method, resource, id, query, body) {
  const upstreamUrl = new URL(
    `${LOJA_INTEGRADA_API_BASE_URL}/${resource}/${id ? `${id}/` : ""}`
  );
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== "") upstreamUrl.searchParams.set(key, String(value));
    });
  }
  upstreamUrl.searchParams.set("chave_aplicacao", LOJA_INTEGRADA_APP_KEY ?? "");
  upstreamUrl.searchParams.set("chave_api", LOJA_INTEGRADA_API_KEY ?? "");
  upstreamUrl.searchParams.set("format", "json");

  const upstreamResponse = await fetch(upstreamUrl.toString(), {
    method,
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: method === "POST" || method === "PUT" ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });

  const contentType = upstreamResponse.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await upstreamResponse.json()
    : await upstreamResponse.text();

  return { status: upstreamResponse.status, payload };
}

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

const RECURSOS_ESCRITA_PERMITIDOS = new Set(["cliente", "pedido"]);

const app = express();
app.use(express.json({ limit: "512kb", verify: (req, _res, buf) => { req.rawBody = buf.toString("utf8"); } }));
app.disable("x-powered-by");

// CORS restrito à origem do front (ou '*' só em dev).
const originsPermitidas = FRONTEND_ORIGIN === "*" ? true : FRONTEND_ORIGIN.split(",").map((s) => s.trim());
app.use(
  cors({
    origin: originsPermitidas,
    methods: ["GET", "POST", "PUT", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
  })
);

// Cabeçalhos de segurança (não vazam stack traces; dificultam ataques).
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");
  if (req.secure || req.headers["x-forwarded-proto"] === "https") {
    res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }
  // CSP: permite estilos/imagens e fontes do app; bloqueia injects.
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; font-src 'self' https:; connect-src 'self' https:; script-src 'self' 'unsafe-inline'; frame-ancestors 'none'"
  );
  next();
});

app.get("/health", (_req, res) => res.json({ ok: true }));

// Vídeos mais recentes do canal D'Griffe (YouTube RSS, sem API key).
// Usado pela seção "D'Griffe no YouTube" do app — sempre os últimos vídeos.
app.get("/api/youtube/latest", async (_req, res) => {
  try {
    const videos = await listarVideosRecentes(6);
    res.json({ videos });
  } catch (e: any) {
    console.warn("[youtube] falha ao buscar vídeos:", e?.message || e);
    res.status(502).json({ erro: "Não foi possível carregar os vídeos do YouTube." });
  }
});



// ---------------------------------------------------------------------------
// Área de admin
// ---------------------------------------------------------------------------
app.post("/api/admin/login", async (req, res) => {
  if (senhaProducaoFraca) {
    return res.status(503).json({ erro: "Serviço indisponível (configure a senha de admin)." });
  }
  if (!ADMIN_PASSWORD) {
    return res.status(500).json({ erro: "Serviço indisponível." });
  }
  const ip = ipDo(req);

  // Bloqueio por força bruta.
  const bloq = checarBloqueio(ip);
  if (bloq.bloqueado) {
    console.warn(`[seguranca] Login bloqueado para ${ip} (restam ${bloq.resta}s).`);
    return res.status(429).json({ erro: `Muitas tentativas. Tente novamente em ${bloq.resta}s.` });
  }

  const senha = (req.body && typeof req.body.senha === "string" ? req.body.senha : "") || "";
  if (!senha || senha.length < SENHA_MIN) {
    registrarTentativaFalha(ip);
    return res.status(401).json({ erro: "Senha inválida." });
  }
  if (senha !== ADMIN_PASSWORD) {
    registrarTentativaFalha(ip);
    console.warn(`[seguranca] Falha de login para ${ip}.`);
    return res.status(401).json({ erro: "Senha inválida." });
  }

  registrarTentativaSucesso(ip);
  console.log(`[auditoria] Login admin OK — IP ${ip} em ${new Date().toISOString()}`);
  return res.json({ token: await signAdminToken() });
});

// Logout: revoga o token atual.
app.post("/api/admin/logout", requireAdmin, (req, res) => {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (token && token.includes(".")) {
    try {
      const payload = JSON.parse(b64urlDecodeStr(token.split(".")[0]));
      if (payload.jti) revokedTokens.add(payload.jti);
    } catch {
      /* ignora */
    }
  }
  return res.json({ ok: true });
});

// Lista TODOS os pedidos + flag de verificação.
app.get("/api/admin/pedidos", requireAdmin, async (req, res) => {
  if (MOCK) return res.json(mockListPedidos());
  if (DEMO) return res.json(demoAdminPedidos());
  try {
    const { limit = "50", offset = "0", numero, cliente_email, cliente } = req.query;
    const query = { limit, offset };
    if (numero) query.numero = numero;
    if (cliente_email) query.cliente_email = cliente_email;
    if (cliente) query.cliente = cliente;

    const { status, payload } = await chamarLI("GET", "pedido", undefined, query);
    if (status !== 200) return res.status(status).json(payload);

    const obj = payload;
    const objects = (obj.objects || []).map((p) => ({
      ...p,
      verificado: Boolean(estado.verificacoes[String(p.id)]),
      verificado_em: estado.verificacoes[String(p.id)] ? estado.verificacoes[String(p.id)].em : null,
    }));
    return res.json({ ...obj, objects });
  } catch (err) {
    console.error("[admin] erro ao listar pedidos:", err);
    return res.status(502).json({ erro: "Falha ao se comunicar com a Loja Integrada." });
  }
});

// Detalhe de um pedido + flag de verificação.
app.get("/api/admin/pedidos/:id", requireAdmin, async (req, res) => {
  if (MOCK) {
    const p = mockPedidos.find((x) => String(x.id) === String(req.params.id));
    if (!p) return res.status(404).json({ erro: "Pedido não encontrado." });
    return res.json({
      ...p,
      verificado: Boolean(mockVerificacoes[String(p.id)]),
      verificado_em: mockVerificacoes[String(p.id)] ? mockVerificacoes[String(p.id)].em : null,
    });
  }
  if (DEMO) {
    const r = demoAdminPedido(req.params.id);
    return res.status(r.status).json(r.body);
  }
  try {
    const { status, payload } = await chamarLI("GET", "pedido", req.params.id);
    if (status !== 200) return res.status(status).json(payload);
    const obj = payload;
    return res.json({
      ...obj,
      verificado: Boolean(estado.verificacoes[String(obj.id)]),
      verificado_em: estado.verificacoes[String(obj.id)] ? estado.verificacoes[String(obj.id)].em : null,
    });
  } catch (err) {
    console.error("[admin] erro ao buscar pedido:", err);
    return res.status(502).json({ erro: "Falha ao se comunicar com a Loja Integrada." });
  }
});

// Atualiza a situação (status) de um pedido.
app.put("/api/admin/pedidos/:id", requireAdmin, async (req, res) => {
  if (MOCK) {
    const p = mockPedidos.find((x) => String(x.id) === String(req.params.id));
    if (!p) return res.status(404).json({ erro: "Pedido não encontrado." });
    const sit = mockSituacoes.find((s) => String(s.id) === String((req.body || {}).situacao));
    if (sit) p.situacao = sit;
    return res.json(p);
  }
  try {
    const body = req.body || {};
    const liBody = {};
    if (body.situacao !== undefined) liBody.situacao = body.situacao;
    console.error(`[admin-put-pedido] id=${req.params.id} liBody=${JSON.stringify(liBody)}`);
    const { status, payload } = await chamarLI("PUT", "pedido", req.params.id, undefined, liBody);
    return res.status(status).json(payload);
  } catch (err) {
    const detail = err && typeof err === "object" ? (err.stack || err.message || JSON.stringify(err)) : String(err);
    console.error("[admin] erro ao atualizar pedido:", detail);
    return res.status(502).json({ erro: "Falha ao se comunicar com a Loja Integrada.", detalhe: detail });
  }
});

// Marca/desmarca um pedido como verificado.
app.post("/api/admin/pedidos/:id/verificar", requireAdmin, async (req, res) => {
  const id = String(req.params.id);
  if (MOCK) {
    const verificado = Boolean(req.body && req.body.verificado !== undefined ? req.body.verificado : true);
    if (verificado) mockVerificacoes[id] = { em: new Date().toISOString() };
    else delete mockVerificacoes[id];
    return res.json({ id, verificado, verificado_em: mockVerificacoes[id] ? mockVerificacoes[id].em : null });
  }
  const verificado = Boolean(req.body && req.body.verificado !== undefined ? req.body.verificado : true);
  if (verificado) estado.verificacoes[id] = { em: new Date().toISOString() };
  else delete estado.verificacoes[id];
  salvarEstado();
  return res.json({
    id,
    verificado,
    verificado_em: estado.verificacoes[id] ? estado.verificacoes[id].em : null,
  });
});

// Situações disponíveis.
app.get("/api/admin/situacoes", requireAdmin, async (_req, res) => {
  if (MOCK) return res.json(mockSituacoes);
  if (DEMO) return res.json(demoAdminSituacoes());
  try {
    const { status, payload } = await chamarLI("GET", "situacaopedido", undefined, { limit: 200 });
    if (status !== 200) return res.status(status).json(payload);
    return res.json((payload.objects || []));
  } catch (err) {
    console.error("[admin] erro ao buscar situações:", err);
    return res.status(502).json({ erro: "Falha ao se comunicar com a Loja Integrada." });
  }
});

// ---------------------------------------------------------------------------
// RELATÓRIOS / AGREGAÇÕES (alimenta gráficos do admin)
// ---------------------------------------------------------------------------
function agregarPedidos(objects) {
  const porStatus = {};
  const porDia = {};
  let total = 0;
  let totalAprovado = 0;
  let TicketMedio = 0;
  const aprovados = new Set(["aprovado", "em_separacao", "enviado", "entregue"]);

  for (const p of objects) {
    const situacao = (p.situacao && (p.situacao.nome || p.situacao.codigo)) || "sem_status";
    porStatus[situacao] = (porStatus[situacao] || 0) + 1;

    const valor = Number(p.valor_total || p.valor_subtotal || 0) || 0;
    total += valor;
    const cod = p.situacao?.codigo || "";
    if (aprovados.has(cod)) totalAprovado += valor;

    const dia = (p.data_criacao || "").slice(0, 10);
    if (dia) {
      porDia[dia] = porDia[dia] || { count: 0, total: 0 };
      porDia[dia].count += 1;
      porDia[dia].total += valor;
    }
  }

  const dias = Object.keys(porDia).sort();
  TicketMedio = objects.length ? total / objects.length : 0;

  return {
    totalPedidos: objects.length,
    faturamentoTotal: Number(total.toFixed(2)),
    faturamentoAprovado: Number(totalAprovado.toFixed(2)),
    ticketMedio: Number(TicketMedio.toFixed(2)),
    porStatus,
    serieDiaria: dias.map((d) => ({ dia: d, count: porDia[d].count, total: Number(porDia[d].total.toFixed(2)) })),
  };
}

// Busca paginada de pedidos da loja para agregar no relatório.
// Teto de páginas (MAX_PAGINAS x limit) para não estourar memória/tempo com
// lojas de histórico grande — 4x200 = 800 pedidos recentes cobrem o relatório
// sem travar o servidor (evita o antigo loop de até 4000 pedidos por clique).
async function buscarTodosPedidos() {
  const todos = [];
  let offset = 0;
  const limit = 200;
  const MAX_PAGINAS = 4;
  // Em demo, retorna os pedidos demo direto.
  if (DEMO || MOCK) {
    const base = DEMO ? demoAdminPedidos().objects : mockListPedidos().objects;
    return base;
  }
  for (let i = 0; i < MAX_PAGINAS; i++) {
    const { status, payload } = await chamarLI("GET", "pedido", undefined, { limit, offset });
    if (status !== 200) break;
    const objs = payload.objects || [];
    todos.push(...objs);
    if (objs.length < limit) break;
    offset += limit;
  }
  return todos;
}

app.get("/api/admin/relatorio", requireAdmin, async (req, res) => {
  try {
    const objects = await buscarTodosPedidos();
    const agreg = agregarPedidos(objects);

    // Canal (app vs site): a LI não expõe distinção direta de forma padronizada.
    // Usamos o campo `plataforma_pedido` / `origem` se existir; senão marcamos "site".
    let porCanal = { site: 0, app: 0 };
    for (const p of objects) {
      const canal = (p.plataforma_pedido || p.origem || p.canal || "").toString().toLowerCase();
      if (canal.includes("app") || canal.includes("mobile") || canal.includes("aplicativo")) porCanal.app += 1;
      else porCanal.site += 1;
    }
    // Se nenhum pedido trouxe canal, mostra tudo como "site" (comportamento defensivo).
    if (porCanal.app === 0 && porCanal.site === 0) porCanal = { site: objects.length, app: 0 };

    return res.json({ ...agreg, porCanal });
  } catch (err) {
    console.error("[admin] erro ao gerar relatório:", err);
    return res.status(502).json({ erro: "Falha ao gerar relatório." });
  }
});

// Detalhe de um cliente: dados LI + pedidos + saldo de fidelidade.
app.get("/api/admin/cliente/:email", requireAdmin, async (req, res) => {
  const email = String(req.params.email || "").trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ erro: "E-mail inválido." });
  }
  try {
    // Dados do cliente na LI
    const { status: sc, payload: cli } = await chamarLI("GET", "cliente", undefined, { email, limit: 1 });
    const cliente = sc === 200 && Array.isArray(cli?.objects) && cli.objects[0] ? cli.objects[0] : null;

    // Pedidos do cliente (via proxy LI)
    let pedidos: any[] = [];
    if (cliente?.id) {
      const { status: sp, payload: ped } = await chamarLI("GET", "pedido", undefined, { cliente: `/api/v1/cliente/${cliente.id}/`, limit: 20 });
      if (sp === 200 && Array.isArray(ped?.objects)) pedidos = ped.objects;
    }

    // Fidelidade (Supabase)
    const [pontos, historico] = await Promise.all([
      segredos.getPontos(email),
      segredos.getHistoricoFidelidade(email, 20),
    ]);

    return res.json({ cliente, pedidos, fidelidade: { pontos, historico } });
  } catch (err) {
    console.error("[admin] erro ao buscar cliente:", err);
    return res.status(502).json({ erro: "Falha ao buscar o cliente." });
  }
});

// Clientes distintos (e-mail + nome) dos pedidos — para o card de "clientes".
app.get("/api/admin/clientes", requireAdmin, async (_req, res) => {
  try {
    const objects = await buscarTodosPedidos();
    const mapa = new Map();
    for (const p of objects) {
      const email = (p.cliente_email || "").toLowerCase();
      if (!email) continue;
      if (!mapa.has(email)) mapa.set(email, { email, nome: p.cliente_nome || "", pedidos: 0, total: 0 });
      const c = mapa.get(email);
      c.pedidos += 1;
      c.total += Number(p.valor_total || p.valor_subtotal || 0) || 0;
    }
    const clientes = Array.from(mapa.values()).map((c) => ({ ...c, total: Number(c.total.toFixed(2)) }));
    clientes.sort((a, b) => b.total - a.total);
    return res.json({ total: clientes.length, clientes });
  } catch (err) {
    console.error("[admin] erro ao listar clientes:", err);
    return res.status(502).json({ erro: "Falha ao listar clientes." });
  }
});

// ---------------------------------------------------------------------------
// CONFIG DE APIs (chaves da Loja Integrada / Mercado Pago) — usado pelo painel admin.
// Fonte de verdade: Supabase (tabela store_config) quando SUPABASE_* estão setadas;
// caso contrário, fallback para arquivo local .store-config.json. NUNCA devolve
// os valores secretos, só o status.
// ---------------------------------------------------------------------------
app.get("/api/config", requireAdmin, async (_req, res) => {
  try {
    const status = await segredos.listConfig();
    return res.json(status);
  } catch (e) {
    console.error("[config] falha ao ler:", e?.message);
    return res.status(502).json({ erro: "Falha ao ler as chaves de API." });
  }
});

app.put("/api/config", requireAdmin, async (req, res) => {
  const body = req.body || {};
  let alterou = 0;
  try {
    alterou = await segredos.saveConfig({
      LI_APP_KEY: body.LI_APP_KEY,
      LI_API_KEY: body.LI_API_KEY,
      MP_ACCESS_TOKEN: body.MP_ACCESS_TOKEN,
      MP_PUBLIC_KEY: body.MP_PUBLIC_KEY,
    });
  } catch (e) {
    console.error("[config] falha ao salvar:", e?.message);
    return res.status(502).json({ erro: "Falha ao salvar as chaves de API." });
  }
  if (alterou === 0) return res.status(400).json({ erro: "Nenhuma chave válida enviada." });
  console.log(`[auditoria] Config de APIs atualizada (${alterou} chave(s)) por IP ${req.ip}`);
  return res.json({ ok: true, alteradas: alterou });
});

// Chave PÚBLICA do Mercado Pago (segura para o front — usada pelo SDK de cartão).
// NUNCA devolve o access_token.
app.get("/api/mp-public-key", async (_req, res) => {
  try {
    const pk = await segredos.getSecret("MP_PUBLIC_KEY");
    return res.json({ public_key: pk || null });
  } catch (e) {
    return res.json({ public_key: null });
  }
});

// Saldo de fidelidade do cliente (por e-mail) + regras para o front calcular desconto.
app.get("/api/fidelidade", async (req, res) => {
  const email = String(req.query.email || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ erro: "E-mail inválido." });
  }
  try {
    const [pontos, regras] = await Promise.all([
      segredos.getPontos(email),
      segredos.getRegrasFidelidade(),
    ]);
    const descontoMax = Math.floor((pontos / regras.pontosPorDesconto) * 10);
    return res.json({ email, pontos, regras, desconto_max: descontoMax });
  } catch (e) {
    console.error("[fidelidade] falha:", e?.message);
    return res.status(502).json({ erro: "Falha ao ler o saldo de fidelidade." });
  }
});

// Histórico de fidelidade (créditos/resgates) do cliente.
app.get("/api/fidelidade/historico", async (req, res) => {
  const email = String(req.query.email || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ erro: "E-mail inválido." });
  }
  try {
    const historico = await segredos.getHistoricoFidelidade(email);
    return res.json({ email, historico });
  } catch (e) {
    console.error("[fidelidade] falha histórico:", e?.message);
    return res.status(502).json({ erro: "Falha ao ler o histórico de fidelidade." });
  }
});

// ---------------------------------------------------------------------------
// CHECKOUT (PIX / cartão). Em DEMO gera uma cobrança PIX simulada para o fluxo
// funcionar ponta a ponta. Em produção, cria o pedido na Loja Integrada primeiro,
// usa o número do pedido como external_reference e depois chama o Mercado Pago.
// ---------------------------------------------------------------------------
async function criarPedidoLI(email, items, total) {
  if (!email || !Array.isArray(items) || items.length === 0) return null;
  const clienteResp = await chamarLI("GET", "cliente", undefined, { email, limit: 1 });
  const cliente = clienteResp.payload?.objects?.[0];
  if (!cliente?.id) return null;

  const body = {
    cliente: `/api/v1/cliente/${cliente.id}/`,
    cliente_email: email,
    valor_total: Number(total.toFixed(2)),
    itens: items.map((it) => ({
      produto: String(it.sku || it.product?.id || ""),
      quantidade: Number(it.qty || it.quantity || 1),
      preco_venda: Number(it.price || 0),
    })),
  };

  const r = await chamarLI("POST", "pedido", undefined, {}, body);
  const pedido = r.payload?.object || r.payload;
  const numero = pedido?.numero || pedido?.id || null;
  return numero ? String(numero) : null;
}

app.post("/api/checkout", async (req, res) => {
  const body = req.body || {};
  const { items, meio, email, card_token, pontosResgate, cupom } = body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ erro: "Carrinho vazio." });
  }
  if (!["pix", "cartao"].includes(meio)) {
    return res.status(400).json({ erro: "Meio de pagamento inválido." });
  }
  if (email && (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return res.status(400).json({ erro: "E-mail inválido." });
  }
  if (meio === "cartao" && (!card_token || typeof card_token !== "string")) {
    return res.status(400).json({ erro: "Token de cartão ausente (gere-o com o SDK do Mercado Pago no cliente)." });
  }
  if (items.length > 50) {
    return res.status(400).json({ erro: "Carrinho excede o limite de itens." });
  }

  try {
    const resultado = await processarCheckout({
      items: items.map((it) => ({ price: Number(it.price), qty: Number(it.qty), sku: String(it.sku || it.product_id || "") })),
      meio,
      email,
      card_token,
      pontosResgate: Number(pontosResgate || 0) || undefined,
      cupom: cupom || undefined,
    });
    return res.json(resultado);
  } catch (e: any) {
    const msg = e?.message || "Falha ao processar o pagamento.";
    const status = typeof e?.status === "number" ? e.status : 502;
    console.error(`[checkout] falha (${meio}) ip=${req.ip}:`, msg);
    return res.status(status).json({ erro: msg });
  }
});

// ---------------------------------------------------------------------------
// WEBHOOK DO MERCADO PAGO — confirmação automática de pagamento.
// O MP POSTa aqui quando o status de um pagamento muda. Validamos a assinatura
// (HMAC com o access_token) e, se aprovado, creditamos pontos + espelhamos o
// pedido no Supabase (idempotente por mp_payment_id). Sem isso, o pagamento
// aprovado nunca voltava para o app (bug de produção).
// ---------------------------------------------------------------------------
app.post("/api/mp-webhook", async (req, res) => {
  const raw = req.rawBody || JSON.stringify(req.body || {});
  const sig = req.headers["x-signature"];
  const sigStr = Array.isArray(sig) ? sig[0] : sig;
  try {
    const r = await processarWebhookMP(raw, sigStr);
    if (r.status === "erro") {
      console.warn(`[webhook-mp] ${r.erro}`);
      return res.status(401).json({ erro: r.erro });
    }
    return res.status(200).json({ ok: true, status: r.status });
  } catch (e) {
    console.error("[webhook-mp] falha:", e?.message);
    return res.status(200).json({ ok: true, status: "erro" }); // MP reenvia em caso de 5xx
  }
});

// ---------------------------------------------------------------------------
// Proxy público de dados da Loja Integrada
// ---------------------------------------------------------------------------
app.all("/api/loja-integrada/:resource/:id?", async (req, res) => {
  const { resource, id } = req.params;

  if (!RECURSOS_PERMITIDOS.has(resource)) {
    return res.status(404).json({ erro: `Recurso "${resource}" não é exposto por este proxy.` });
  }
  if ((req.method === "POST" || req.method === "PUT") && !RECURSOS_ESCRITA_PERMITIDOS.has(resource)) {
    return res.status(405).json({ erro: `Escrita via proxy não habilitada para "${resource}".` });
  }
  if (!["GET", "POST", "PUT"].includes(req.method)) {
    return res.status(405).json({ erro: "Método não suportado." });
  }

  if (DEMO) {
    const query = Object.fromEntries(Object.entries(req.query).map(([k, v]) => [k, String(v)]));
    if (req.method === "POST" && resource === "cliente") {
      const r = demoCriarCliente(req.body || {});
      return res.status(r.status).json(r.body);
    }
    const r = demoResponder(resource, id, req.method, query);
    if (r) return res.status(r.status).json(r.body);
    return res.status(404).json({ erro: `Recurso "${resource}" não tem dados de demo.` });
  }

  // Segurança: PUT em cliente só se o email do body for dono do id (impede edição de terceiro).
  if (req.method === "PUT" && resource === "cliente") {
    const emailBody = (req.body && (req.body.email || (req.body.cliente && req.body.cliente.email))) || "";
    if (!emailBody) {
      return res.status(403).json({ erro: "Informe o email do cliente para confirmar a edição." });
    }
    try {
      const { status, payload } = await chamarLI("GET", "cliente", id, {});
      const atual = JSON.parse(payload || "{}");
      const obj = Array.isArray(atual.objects) ? atual.objects[0] : atual;
      const donoEmail = (obj.email || (obj.cliente && obj.cliente.email) || "").toString().trim().toLowerCase();
      console.error(`[seguranca-put] id=${id} status=${status} dono=${donoEmail} body=${emailBody}`);
      if (status !== 200 || donoEmail !== emailBody.toString().trim().toLowerCase()) {
        return res.status(403).json({ erro: "Este cliente não pertence ao e-mail informado." });
      }
    } catch {
      return res.status(502).json({ erro: "Falha ao validar a posse do cliente." });
    }
  }

  try {
    const query = Object.fromEntries(Object.entries(req.query).map(([k, v]) => [k, String(v)]));
    const { status, payload } = await chamarLI(req.method, resource, id, query);
    res.status(status).send(payload);
  } catch (err) {
    console.error("[loja-integrada-proxy] erro ao chamar a Loja Integrada:", err);
    res.status(502).json({ erro: "Falha ao se comunicar com a Loja Integrada." });
  }
});

// ---------------------------------------------------------------------------
// CADASTRO DE CLIENTE (OTP por e-mail, sem senha) + sincronização Loja Integrada
// ---------------------------------------------------------------------------
import crypto from "node:crypto";

// Lê as chaves da Loja Integrada (do Supabase store_config ou env local).
async function getSecretsLI(): Promise<{ LI_APP_KEY?: string; LI_API_KEY?: string }> {
  const appKey = (await getSecret("LI_APP_KEY")) || process.env.LOJA_INTEGRADA_APP_KEY || "";
  const apiKey = (await getSecret("LI_API_KEY")) || process.env.LOJA_INTEGRADA_API_KEY || "";
  return { LI_APP_KEY: appKey || undefined, LI_API_KEY: apiKey || undefined };
}

// Cria o cliente na Loja Integrada (se as credenciais existirem).
async function criarClienteLI(email: string, dados: { nome?: string; telefone?: string; cpf?: string }) {
  const { LI_APP_KEY, LI_API_KEY } = await getSecretsLI();
  if (!LI_APP_KEY || !LI_API_KEY) return null;

  // Se o cliente já existe na Loja Integrada (busca por e-mail dedicada),
  // reaproveita o id em vez de tentar criar de novo (evita erro "já existe").
  try {
    const busca = await chamarLI("GET", "cliente", "busca", { email, limit: 1 });
    const objs = (busca.payload && (busca.payload as any).objects) || [];
    if (busca.status === 200 && objs[0]?.id) {
      return objs[0];
    }
  } catch {
    /* segue para criação */
  }

  const body: any = { email };
  if (dados.nome) body.nome = dados.nome;
  if (dados.telefone) body.telefone_celular = dados.telefone;
  if (dados.cpf) body.cpf = dados.cpf;
  const { status, payload } = await chamarLI("POST", "cliente", undefined, {}, body);
  if (status >= 400) throw new Error(`LI ${status}: ${JSON.stringify(payload).slice(0, 200)}`);
  return payload;
}

// POST /api/cliente/cadastro -> envia OTP por e-mail (cria o usuário se não existir)
app.post("/api/cliente/cadastro", async (req, res) => {
  const ip = ipDo(req);
  const bloq = checarBloqueio(ip);
  if (bloq.bloqueado) return res.status(429).json({ erro: `Muitas tentativas. Tente em ${bloq.resta}s.` });

  const { email, nome, telefone, cpf } = req.body || {};
  const e = (email || "").trim().toLowerCase();
  if (!e || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) {
    return res.status(400).json({ erro: "E-mail inválido." });
  }
  const sb = supabaseClient();
  if (!sb) return res.status(503).json({ erro: "Banco de dados indisponível (modo demo)." });

  try {
    // 1) Envia OTP por e-mail. shouldCreateUser:true cria o usuário se ainda
    //    não existir; se já existir, apenas reenvia o código.
    const { error: otpErr } = await sb.auth.signInWithOtp({
      email: e,
      options: {
        shouldCreateUser: true,
        data: { nome: nome || "", telefone: telefone || "", cpf: cpf || "" },
      },
    });
    if (otpErr) {
      // Rate limit do Supabase (muitas tentativas) — mensagem amigável.
      if (/rate limit/i.test(otpErr.message)) {
        return res.status(429).json({ erro: "Muitas tentativas. Aguarde alguns minutos e tente de novo." });
      }
      return res.status(400).json({ erro: otpErr.message });
    }

    // 2) Se o usuário acabou de ser criado, garantimos o perfil e a sincronização LI.
    //    (Para usuários já existentes, o perfil é atualizado na verificação do OTP.)
    let userId: string | undefined;
    try {
      const list = await sb.auth.admin.listUsers();
      userId = list.data?.users?.find((u) => u.email === e)?.id;
    } catch { /* ignora */ }

    if (userId) {
      try {
        await sb.from("profiles").upsert({
          id: userId,
          email: e,
          nome: nome || null,
          telefone: telefone || null,
          cpf: cpf || null,
          aceite_lgpd: Boolean(req.body?.aceiteLgpd) || false,
          aceite_lgpd_em: Boolean(req.body?.aceiteLgpd) ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "id" });
      } catch (profileErr) {
        console.warn("[cadastro] falha ao salvar perfil (ignorado):", (profileErr as Error)?.message);
      }

      // 3) Sincroniza com a Loja Integrada (se houver credenciais configuradas).
      try {
        const { LI_APP_KEY, LI_API_KEY } = await getSecretsLI();
        if (LI_APP_KEY && LI_API_KEY) {
          await criarClienteLI(e, { nome, telefone, cpf });
        }
      } catch (liErr) {
        console.warn("[cadastro] falha ao sincronizar com Loja Integrada (ignorado):", (liErr as Error)?.message);
      }
    }

    return res.json({ ok: true, mensagem: "Enviamos um código de verificação para seu e-mail." });
  } catch (err) {
    console.error("[cadastro] erro:", err);
    return res.status(500).json({ erro: "Falha ao criar cadastro." });
  }
});

// POST /api/cliente/verificar -> valida o OTP e retorna a sessão
app.post("/api/cliente/verificar", async (req, res) => {
  const ip = ipDo(req);
  const bloq = checarBloqueio(ip);
  if (bloq.bloqueado) return res.status(429).json({ erro: `Muitas tentativas. Tente em ${bloq.resta}s.` });

  const { email, token } = req.body || {};
  const e = (email || "").trim().toLowerCase();
  if (!e || !token || !/^\d{6}$/.test(String(token))) {
    return res.status(400).json({ erro: "E-mail e código de 6 dígitos são obrigatórios." });
  }
  const sb = supabaseClient();
  if (!sb) return res.status(503).json({ erro: "Banco de dados indisponível (modo demo)." });
  try {
    const { data, error } = await sb.auth.verifyOtp({ email: e, token: String(token), type: "email" });
    if (error) {
      registrarTentativaFalha(ip);
      return res.status(401).json({ erro: error.message });
    }
    registrarTentativaSucesso(ip);
    return res.json({ ok: true, session: data.session, user: data.user });
  } catch (err) {
    registrarTentativaFalha(ip);
    return res.status(500).json({ erro: "Falha ao verificar código." });
  }
});

app.use("/api/cliente/receitas", receitasApp);
app.use("/api/cliente/favoritos", favoritosApp);
app.use("/api/loja-integrada", cupomApp);

app.listen(PORT, () => {
  console.log(`[loja-integrada-proxy] rodando em http://localhost:${PORT}`);
  console.log(`[loja-integrada-proxy] endpoint: http://localhost:${PORT}/api/loja-integrada/produto/`);
  console.log(`[loja-integrada-proxy] admin:    http://localhost:${PORT}/api/admin/login`);
  if (ADMIN_PASSWORD) console.log(`[loja-integrada-proxy] segurança: rate-limit ${MAX_TENTATIVAS} tentativas / ${LOCKOUT_MS / 1000}s, token revogável, CSP/HSTS ativos.`);
});


// ---------------------------------------------------------------------------
// A7 — Export CSV de pedidos do painel admin
// ---------------------------------------------------------------------------
app.get("/api/admin/pedidos/csv", requireAdmin, async (_req, res) => {
  const admin = _req.admin as { email: string } | undefined;
  try {
    const { pedidos } = await listarPedidosAdmin({ limit: 1000, offset: 0 });
    const header = ["numero", "cliente", "email", "data", "status", "total", "itens", "verificado"];
    const linhas = (pedidos || []).map((p) =>
      [
        p.numero,
        p.cliente_nome,
        p.cliente_email,
        p.data,
        p.status,
        p.total.toFixed(2),
        p.items,
        p.verificado ? "sim" : "nao",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [header.join(","), ...linhas].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="pedidos-dgriffe.csv"');
    return res.send(csv);
  } catch (e) {
    console.error("[admin] erro ao exportar CSV:", e?.message);
    return res.status(502).json({ erro: "Falha ao exportar CSV." });
  }
});
app.get("/api/admin/logs", requireAdmin, async (req, res) => {
  const admin = req.admin as { email: string } | undefined;
  try {
    const limit = Math.min(Number(req.query.limit || 200), 1000);
    const page = Math.max(Number(req.query.page || 1), 1);
    const offset = (page - 1) * limit;
    const [countRes, logsRes] = await Promise.all([
      supabaseClient()
        .from("admin_logs")
        .select("*", { count: "exact", head: true }),
      supabaseClient()
        .from("admin_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1),
    ]);
    if (countRes.error) throw countRes.error;
    const total = countRes.count || 0;
    const logs = logsRes.data || [];
    return res.json({ total, page, limit, logs });
  } catch (e) {
    console.error("[admin] erro ao listar logs:", e?.message);
    return res.status(502).json({ erro: "Falha ao listar logs." });
  }
});

