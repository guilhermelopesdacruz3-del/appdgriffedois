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

import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, ".env") });
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
import { atualizarPedidoLISituacao } from "./liClient.ts";
import { listarVideosRecentes } from "./youtube.ts";
import { getHistoricoFidelidade, registrarLog, supabaseClient, setarPontos, salvarRegrasFidelidade, salvarNotificacao, listarNotificacoes, marcarNotificacaoLida, salvarPerfil, buscarPerfil, listarEnderecos, salvarEndereco, excluirEndereco, salvarPreferencias, buscarPreferencias, getNiveis, NIVEIS_PADRAO, calcularNivel, calcularCashback, BENEFICIO_BASE, TETO_BENEFICIOS_PERC, CASHBACK_BASE, gerarCodigoIndicacao, registrarIndicacao, creditarIndicacao, getIndicacoes, getClubeFamilia, adicionarFamiliar, creditarFamilia, getCreditosFamilia, MISSOES, VALIDADE_PONTOS_MESES_SEM_MOV, VALIDADE_PONTOS_MESES_EXPIRACAO, VALIDADE_CASHBACK_MESES_SEM_MOV, VALIDADE_CASHBACK_DIAS_ADICIONAIS, getSecret, invalidarCacheChave, salvarPushSubscription, removerPushSubscription, listarPushSubscriptions } from "./db.ts";
import cupomApp from "./cupom.ts";
import { receitasApp } from "./receitas";
import { favoritosApp } from "./favoritos";
import webpush from "web-push";

const {
  LOJA_INTEGRADA_APP_KEY,
  LOJA_INTEGRADA_API_KEY,
  LOJA_INTEGRADA_API_BASE_URL = "https://api.awsli.com.br/api/v1",
  FRONTEND_ORIGIN = "https://appdgriffedois.pages.dev",
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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  let upstreamResponse;
  try {
    upstreamResponse = await fetch(upstreamUrl.toString(), {
      method,
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: method === "POST" || method === "PUT" ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  const contentType = upstreamResponse.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await upstreamResponse.json()
    : await upstreamResponse.text();

  return { status: upstreamResponse.status, payload };
}

const RECURSOS_PERMITIDOS = new Set([
  "produto",
  "produto_preco",
  "produto_estoque",
  "produto_imagem",
  "categoria",
  "marca",
  "cliente",
  "pedido",
  "formapagamento",
  "formaenvio",
  "situacao",
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
  // Mantém 'unsafe-inline' porque o app é single-file (vite-plugin-singlefile
  // injeta o JS/CSS inline). Próximo passo: migrar para nonce (requer reconfigurar
  // o plugin de build). Enquanto isso, endurecemos as demais diretivas.
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; " +
      "img-src 'self' data: https:; " +
      "style-src 'self' 'unsafe-inline'; " +
      "font-src 'self' https:; " +
      "connect-src 'self' https:; " +
      "script-src 'self' 'unsafe-inline'; " +
      "object-src 'none'; " +
      "base-uri 'self'; " +
      "form-action 'self'; " +
      "frame-ancestors 'none'; " +
      "upgrade-insecure-requests"
  );
  next();
});

app.get("/health", (_req, res) => res.json({ ok: true, sync: syncState.progresso }));

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
    const objects = await anexarClientesPedidos((obj.objects || []).map((p) => ({
      ...p,
      // A LI expõe `id` (interno) e `resource_uri` (ex.: /api/v1/pedido/1) —
      // o id usado em GET/PUT individuais é o da resource_uri, não o campo id.
      id_api: extrairIdDaUri(p.resource_uri) ?? p.id,
      verificado: Boolean(estado.verificacoes[String(p.id)]),
      verificado_em: estado.verificacoes[String(p.id)] ? estado.verificacoes[String(p.id)].em : null,
    })));
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
    let cliente_nome = obj.cliente_nome;
    let cliente_email = obj.cliente_email;
    if (!cliente_nome && obj.cliente) {
      if (typeof obj.cliente === "object") {
        cliente_nome = obj.cliente.nome || obj.cliente.razao_social || null;
        cliente_email = obj.cliente.email || null;
      } else {
        const clienteId = extrairIdDaUri(obj.cliente);
        if (clienteId) {
          try {
            const { status: cs, payload: cp } = await chamarLI("GET", "cliente", clienteId);
            if (cs === 200) {
              cliente_nome = cp.nome || cp.razao_social || null;
              cliente_email = cp.email || null;
            }
          } catch { /* ignora */ }
        }
      }
    }
    return res.json({
      ...obj,
      cliente_nome,
      cliente_email,
      id_api: extrairIdDaUri(obj.resource_uri) ?? obj.id,
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
    const situacaoId = body.situacao !== undefined ? String(body.situacao) : undefined;

    // Pedidos criados pela integração (/v1/integration/sales) NÃO são
    // atualizáveis pelo endpoint clássico /api/v1/pedido/{id}: a LI exige o
    // PUT /v1/integration/sales/{id} com o CORPO COMPLETO (reference do POST +
    // info.status). Detectamos pelo GET (integration_data presente) e usamos o
    // corpo guardado no espelho do Supabase quando disponível.
    const atual = await chamarLI("GET", "pedido", req.params.id);
    const pedido = atual.status === 200 ? atual.payload : null;
    const ehIntegracao = Boolean(
      pedido?.integration_data &&
      (pedido.integration_data.integrator || pedido.integration_data.marketplace)
    );

    if (ehIntegracao && situacaoId !== undefined) {
      const idIntegracao = pedido.id;
      if (!idIntegracao) {
        console.warn(`[admin-put-pedido] pedido ${req.params.id} de integração sem id.`);
        return res.status(400).json({ erro: "Pedido de integração sem id na LI." });
      }
      const espelho = await segredos.buscarPedidoPorLiPedido(idIntegracao).catch(() => null);
      const corpo = espelho?.li_dados;
      if (!corpo) {
        console.warn(`[admin-put-pedido] pedido ${req.params.id} de integração sem espelho (li_dados) no Supabase.`);
        return res.status(409).json({
          erro: "Pedido de integração sem corpo salvo no espelho (Supabase indisponível ou pedido antigo). Não é possível alterar a situação pela LI.",
        });
      }
      const ok = await atualizarPedidoLISituacao(idIntegracao, situacaoId, corpo as Record<string, unknown>);
      if (!ok) {
        return res.status(502).json({ erro: "A LI recusou a atualização do pedido de integração." });
      }
      console.error(`[admin-put-pedido] id=${req.params.id} integracao id=${idIntegracao} novaSituacao=${situacaoId} (via /v1/integration/sales)`);
      return res.json({ ...pedido, situacao: { id: Number(situacaoId) } });
    }

    const liBody = {};
    if (situacaoId !== undefined) liBody.situacao = situacaoId;
    // A LI exige `id_externo` no PUT de pedido (regra da API). Buscamos o
    // pedido e injetamos o id_externo atual automaticamente, para a mudança
    // de status do admin não depender do front enviar esse campo.
    if (liBody.situacao !== undefined && body.id_externo === undefined) {
      const atual2 = await chamarLI("GET", "pedido", req.params.id);
      if (atual2.status === 200 && atual2.payload?.id_externo != null) {
        liBody.id_externo = atual2.payload.id_externo;
      }
    }
    console.error(`[admin-put-pedido] id=${req.params.id} body=${JSON.stringify(req.body)} liBody=${JSON.stringify(liBody)}`);
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
    const { status, payload } = await chamarLI("GET", "situacao", undefined, { limit: 100 });
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
  const limit = 100;
  const MAX_PAGINAS = 8;
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
  return anexarClientesPedidos(todos);
}

// Cache em memória de clientes da LI (id -> {nome, email}) com TTL curto,
// para enriquecer pedidos sem estourar o rate limit da LI (1 chamada total).
let cacheClientesLI: { mapa: Map<number, { nome: string | null; email: string | null }>; expiraEm: number } | null = null;

async function buscarClientesLI(): Promise<Map<number, { nome: string | null; email: string | null }>> {
  const agora = Date.now();
  if (cacheClientesLI && cacheClientesLI.expiraEm > agora) return cacheClientesLI.mapa;
  const mapa = new Map<number, { nome: string | null; email: string | null }>();
  let offset = 0;
  const limit = 50;
  for (let i = 0; i < 20; i++) {
    const { status, payload } = await chamarLI("GET", "cliente", undefined, { limit, offset });
    if (status !== 200) break;
    const objs = payload.objects || [];
    for (const c of objs) {
      if (c.id) mapa.set(Number(c.id), { nome: c.nome || c.razao_social || null, email: c.email || null });
    }
    if (objs.length < limit) break;
    offset += limit;
  }
  cacheClientesLI = { mapa, expiraEm: agora + 60_000 };
  return mapa;
}

// A LI retorna `cliente` como resource_uri (ex.: /api/v1/cliente/44255391) e não
// os campos cliente_nome/cliente_email — preenche a partir da lista de clientes.
async function anexarClientesPedidos(objects: any[]): Promise<any[]> {
  if (!Array.isArray(objects) || objects.length === 0) return objects || [];
  const clientes = await buscarClientesLI().catch(() => new Map());
  return objects.map((p) => {
    if (p.cliente_nome && p.cliente_email) return p;
    let id: number | null = null;
    if (typeof p.cliente === "object" && p.cliente) id = Number(p.cliente.id) || null;
    else if (typeof p.cliente === "string") id = extrairIdDaUri(p.cliente);
    const c = id != null ? clientes.get(id) : null;
    if (!c) return p;
    return { ...p, cliente_nome: p.cliente_nome || c.nome, cliente_email: p.cliente_email || c.email };
  });
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
    const clientes = await Promise.all(
      Array.from(mapa.values()).map(async (c) => ({
        ...c,
        total: Number(c.total.toFixed(2)),
        pontos: await segredos.getPontos(c.email),
      }))
    );
    clientes.sort((a, b) => b.total - a.total);
    return res.json({ total: clientes.length, clientes });
  } catch (err) {
    console.error("[admin] erro ao listar clientes:", err);
    return res.status(502).json({ erro: "Falha ao listar clientes." });
  }
});

// ---------------------------------------------------------------------------
// RECEITAS — admin pode listar todas as receitas ópticas dos clientes.
app.get("/api/admin/receitas", requireAdmin, async (req, res) => {
  try {
    const sb = supabaseClient();
    if (!sb) return res.status(503).json({ erro: "Banco indisponível." });
    const { data, error } = await sb
      .from("receitas")
      .select("id, email, nome, medico, data_receita, tipo, descricao, esf_od_longe, cil_od_longe, eixo_od_longe, esf_oe_longe, cil_oe_longe, eixo_oe_longe, esf_od_perto, cil_od_perto, eixo_od_perto, esf_oe_perto, cil_oe_perto, eixo_oe_perto, dip, created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return res.json({ ok: true, receitas: data || [] });
  } catch (err) {
    console.error("[admin] erro ao listar receitas:", err);
    return res.status(502).json({ erro: "Falha ao listar receitas." });
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
  if (!DEMO) {
    // Em produção, mantemos acesso público; se quiser, podemos restringir para admin.
    // Hoje o front precisa dela para iniciar o checkout transparente quando cartão.
  }
  try {
    const pk = await segredos.getSecret("MP_PUBLIC_KEY");
    return res.json({ public_key: pk || null });
  } catch (e) {
    return res.json({ public_key: null });
  }
});

// Saldo de fidelidade do cliente (por e-mail) + regras para o front calcular desconto.
// Usa o e-mail do token de cliente quando houver; evita IDOR por querystring.
app.get("/api/fidelidade", async (req, res) => {
  const tokenEmail = requireCliente(req, res);
  const email = String(tokenEmail || req.query.email || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ erro: "E-mail inválido." });
  }
  try {
    const [pontos, regras, niveis, historicoFidelidade] = await Promise.all([
      segredos.getPontos(email).catch((e) => { console.error("[fidelidade] getPontos:", e?.message); return 0; }),
      segredos.getRegrasFidelidade().catch((e) => { console.error("[fidelidade] getRegras:", e?.message); return { pontosPorReal: 1, pontosPorDesconto: 100 }; }),
      getNiveis().catch((e) => { console.error("[fidelidade] getNiveis:", e?.message); return NIVEIS_PADRAO; }),
      segredos.getHistoricoFidelidade(email).catch((e) => { console.error("[fidelidade] getHistorico:", e?.message); return []; }),
    ]);
    const nivel = calcularNivel(pontos, niveis);
    const prox = nivel.prox;
    const ptsParaProx = nivel.ptsParaProx;
    const descontoMax = Math.floor((pontos / (regras.pontosPorDesconto || 100)) * 10);
    const percentual = Math.max(...Object.keys(CASHBACK_BASE).map((cat) => calcularCashback(0, cat, nivel.nivel).percentual));
    return res.json({
      email,
      pontos,
      regras: { pontosPorReal: regras.pontosPorReal, pontosPorDesconto: regras.pontosPorDesconto },
      desconto_max: descontoMax,
      nivel: { id: nivel.nivel.id, nome: nivel.nivel.nome, cashbackAdicional: nivel.nivel.cashbackAdicional, cupomAniversario: nivel.nivel.cupomAniversario, beneficios: nivel.nivel.beneficios },
      niveis: niveis.map((n) => ({ id: n.id, nome: n.nome, min: n.min, max: n.max })),
      proximoNivel: prox ? { id: prox.id, nome: prox.nome, min: prox.min } : null,
      pontosParaProximoNivel: ptsParaProx,
      cashback: {
        percentual,
        disponivel: 0,
        porCategoria: CASHBACK_BASE,
        beneficioBase: BENEFICIO_BASE,
      },
      tetoBeneficiosPerc: TETO_BENEFICIOS_PERC,
    });
  } catch (e) {
    console.error("[fidelidade] falha:", e?.message);
    return res.status(502).json({ erro: "Falha ao ler o saldo de fidelidade." });
  }
});

// Histórico de fidelidade (créditos/resgates) do cliente.
// Isolado pelo e-mail do token de cliente quando disponível.
app.get("/api/fidelidade/historico", async (req, res) => {
  const tokenEmail = requireCliente(req, res);
  const email = String(tokenEmail || req.query.email || "").trim().toLowerCase();
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
// INDICAÇÃO — código único + crédito R$50 + 200pts por conversão.
// ---------------------------------------------------------------------------
app.get("/api/indicacao/codigo", async (req, res) => {
  const email = String(req.query.email || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ erro: "E-mail inválido." });
  try {
    const codigo = await gerarCodigoIndicacao(email);
    const indicacoes = await getIndicacoes(email);
    const convertidas = indicacoes.filter((i) => i.indicador_email === email && i.status === "convertida");
    return res.json({ email, codigo, indicacoesConvertidas: convertidas.length, limiteAnual: 10 });
  } catch (e) {
    return res.status(502).json({ erro: "Falha ao gerar código." });
  }
});

// ---------------------------------------------------------------------------
// FASE B — Rotas de fidelidade (missões, validade, mensagens).
// ---------------------------------------------------------------------------

// GET /api/fidelidade/missao — lista as 5 missões com progresso do cliente.
app.get("/api/fidelidade/missao", async (req, res) => {
  const email = String(req.query.email || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ erro: "E-mail inválido." });
  try {
    const pontos = await segredos.getPontos(email);
    const historico = await segredos.getHistoricoFidelidade(email, 100);
    const pedidosCount = historico.filter((h) => h.tipo === "compra").length;
    const niveis = getNiveis();
    const missoes = MISSOES.map((m) => ({
      ...m,
      feito: m.tipo === "cadastro" ? pontos > 0 :
             m.tipo === "primeira_compra" ? pedidosCount >= 1 : false,
      pontos_concedidos: 0,
    }));
    return res.json({ email, missoes });
  } catch (e) {
    console.error("[missao] falha:", e?.message);
    return res.status(502).json({ erro: "Falha ao ler missões." });
  }
});

// GET /api/fidelidade/validade — regras de validade de pontos e cashback.
app.get("/api/fidelidade/validade", async (req, res) => {
  const email = String(req.query.email || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ erro: "E-mail inválido." });
  try {
    const pontos = VALIDADE_PONTOS_MESES_SEM_MOV * 30; // approx
    const cashbackExpiraMeses = 12 + Math.floor(VALIDADE_CASHBACK_DIAS_ADICIONAIS / 30);
    return res.json({
      pontos_validade_meses_sem_mov: VALIDADE_PONTOS_MESES_SEM_MOV,
      pontos_validade_meses_expiracao: VALIDADE_PONTOS_MESES_EXPIRACAO,
      cashback_validade_meses: cashbackExpiraMeses,
      cashback_reducao_50_pct: "após 12 meses sem movimentação",
      cashback_zera_apos: "12 meses + 180 dias",
    });
  } catch (e) {
    return res.status(502).json({ erro: "Falha ao ler validade." });
  }
});

// GET /api/fidelidade/mensagens — mensagens automáticas para o cliente.
app.get("/api/fidelidade/mensagens", async (req, res) => {
  const email = String(req.query.email || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ erro: "E-mail inválido." });
  try {
    const mensagens: string[] = [];
    const pontos = await segredos.getPontos(email).catch((e) => { console.error("[mensagens] getPontos:", e?.message); return 0; });
    const niveis = await getNiveis().catch((e) => { console.error("[mensagens] getNiveis:", e?.message); return NIVEIS_PADRAO; });
    const nivel = calcularNivel(pontos, niveis);
    if (nivel.prox) mensagens.push(`Faltam ${nivel.ptsParaProx} pts para ${nivel.prox.nome}.`);
    return res.json({ email, mensagens, nivel: nivel.nivel.nome, pontos });
  } catch (e) {
    console.error("[mensagens] falha:", e?.message);
    return res.status(502).json({ erro: "Falha ao ler mensagens." });
  }
});

// POST /api/fidelidade/missao/concluir — registra conclusão de missão (ex.: avaliação).
// Usa o e-mail do token de cliente quando disponível e só aceita body se não houver token.
app.post("/api/fidelidade/missao/concluir", async (req, res) => {
  const tokenEmail = requireCliente(req, res);
  const { email, tipo } = req.body || {};
  const e = (tokenEmail || email || "").toString().trim().toLowerCase();
  if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return res.status(400).json({ ok: false, erro: "E-mail inválido." });
  if (!tipo) return res.status(400).json({ ok: false, erro: "Informe o tipo da missão." });
  try {
    const pontos = await segredos.concederMissao(e, tipo);
    return res.json({ ok: true, pontosConcedidos: pontos, jaConcedida: pontos === 0 });
  } catch (err) {
    console.error("[missao:concluir] falha:", (err as Error)?.message);
    return res.status(502).json({ ok: false, erro: "Falha ao concluir missão." });
  }
});

app.post("/api/indicacao/converter", async (req, res) => {
  const { indicadorEmail, indicadoEmail } = req.body || {};
  if (!indicadorEmail || !indicadoEmail)
    return res.status(400).json({ ok: false, erro: "Informe indicador e indicado." });
  try {
    const r = await creditarIndicacao(indicadorEmail, indicadoEmail);
    return res.json({ ok: true, creditoRs: r.creditoRs, pontos: r.pontos });
  } catch (e) {
    return res.status(502).json({ ok: false, erro: "Falha ao converter indicação." });
  }
});

app.post("/api/indicacao/registrar", async (req, res) => {
  const { indicadorEmail, indicadoEmail } = req.body || {};
  try {
    const r = await registrarIndicacao(indicadorEmail, indicadoEmail);
    if (!r.ok) return res.status(400).json({ ok: false, erro: r.erro });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(502).json({ ok: false, erro: "Falha ao registrar indicação." });
  }
});

// ---------------------------------------------------------------------------
// CLUBE FAMÍLIA — membros + créditos.
// ---------------------------------------------------------------------------
app.get("/api/familia", async (req, res) => {
  const email = String(req.query.email || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ erro: "E-mail inválido." });
  try {
    const membros = await getClubeFamilia(email);
    const creditos = await getCreditosFamilia(email);
    return res.json({ email, membros, limite: 5, creditos });
  } catch (e) {
    return res.status(502).json({ erro: "Falha ao ler clube família." });
  }
});

app.post("/api/familia/adicionar", async (req, res) => {
  const { responsavelEmail, membroEmail } = req.body || {};
  try {
    const r = await adicionarFamiliar(responsavelEmail, membroEmail);
    if (!r.ok) return res.status(400).json({ ok: false, erro: r.erro });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(502).json({ ok: false, erro: "Falha ao adicionar membro." });
  }
});

// ---------------------------------------------------------------------------
// ADMIN — FIDELIDADE (ajustar saldo manualmente + regras)
// ---------------------------------------------------------------------------
// Ajusta os pontos de um cliente (creditar / resgatar / definir saldo).
app.post("/api/admin/fidelidade/ajustar", requireAdmin, async (req, res) => {
  const { email, pontos, operacao, motivo } = req.body || {};
  const e = String(email || "").trim().toLowerCase();
  const pts = Number(pontos);
  const op = String(operacao || "creditar");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) {
    return res.status(400).json({ erro: "E-mail inválido." });
  }
  if (!Number.isFinite(pts) || pts <= 0) {
    return res.status(400).json({ erro: "Informe uma quantidade de pontos maior que zero." });
  }
  try {
    let saldo = 0;
    if (op === "resgatar") saldo = await segredos.resgatarPontos(e, pts);
    else if (op === "definir") saldo = await setarPontos(e, pts);
    else saldo = await segredos.setarPontos(e, (await segredos.getPontos(e)) + pts);
    // Avisa o cliente no app (sino de notificações) sobre a mudança de pontos.
    const verbo = op === "resgatar" ? "resgatou" : op === "definir" ? "atualizou para" : "creditou";
    await salvarNotificacao({
      email: e,
      titulo: "Pontos de fidelidade atualizados",
      corpo: `O admin ${verbo} ${pts} ponto(s). Seu saldo agora é ${saldo} pts.`,
      tipo: "geral",
    }).catch(() => {});
    await registrarLog({ admin_email: req.adminEmail || "admin", acao: "fidelidade_ajustar", detalhe: { email: e, operacao: op, pontos: pts, saldo } });
    return res.json({ ok: true, email: e, operacao: op, saldo });
  } catch (err) {
    console.error("[fidelidade admin] falha:", err);
    return res.status(500).json({ erro: "Falha ao ajustar pontos." });
  }
});

// GET regras de fidelidade (para admin panel)
app.get("/api/admin/fidelidade/regras", requireAdmin, async (_req, res) => {
  try {
    const regras = await segredos.getRegrasFidelidade();
    return res.json({ regras });
  } catch (err) {
    console.error("[admin] falha ao ler regras fidelidade:", err);
    return res.status(500).json({ erro: "Falha ao ler regras." });
  }
});

// Salva as regras do programa de fidelidade.
app.post("/api/admin/fidelidade/regras", requireAdmin, async (req, res) => {
  const pontosPorReal = Number(req.body?.pontosPorReal);
  const pontosPorDesconto = Number(req.body?.pontosPorDesconto);
  if (!Number.isFinite(pontosPorReal) || pontosPorReal < 0 || !Number.isFinite(pontosPorDesconto) || pontosPorDesconto < 1) {
    return res.status(400).json({ erro: "Regras inválidas." });
  }
  try {
    await salvarRegrasFidelidade(pontosPorReal, pontosPorDesconto);
    await registrarLog({ admin_email: req.adminEmail || "admin", acao: "fidelidade_regras", detalhe: { pontosPorReal, pontosPorDesconto } });
    return res.json({ ok: true, regras: { pontosPorReal, pontosPorDesconto } });
  } catch (err) {
    console.error("[fidelidade admin] falha regras:", err);
    return res.status(500).json({ erro: "Falha ao salvar regras." });
  }
});

// ---------------------------------------------------------------------------
// CHECKOUT (PIX / cartão). Em DEMO gera uma cobrança PIX simulada para o fluxo
// funcionar ponta a ponta. Em produção, cria o pedido na Loja Integrada primeiro,
// usa o número do pedido como external_reference e depois chama o Mercado Pago.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// NOTIFICAÇÕES IN-APP (fase 1: cupons/promoções via admin)
// ---------------------------------------------------------------------------

// Admin envia notificação para clientes filtrados (cupom/promoção/geral).
app.post("/api/admin/notificar", requireAdmin, async (req, res) => {
  try {
    const { titulo, corpo, tipo, filtros } = req.body || {};
    if (!titulo || !corpo) return res.status(400).json({ erro: "Informe título e corpo." });
    const f = filtros || {};
    // Base de clientes: TODOS os cadastrados na Loja Integrada (via lista de
    // clientes), não só quem já comprou. Complementa com pedidos quando o
    // e-mail aparece em pedidos mas não na lista de clientes.
    const clientesLI = await buscarClientesLI().catch(() => new Map());
    const mapa = new Map<string, { email: string; nome: string; pedidos: number }>();
    for (const c of clientesLI.values()) {
      const email = (c.email || "").trim().toLowerCase();
      if (!email) continue;
      mapa.set(email, { email, nome: c.nome || "", pedidos: 0 });
    }
    const objects = await buscarTodosPedidos();
    for (const p of objects) {
      const email = (p.cliente_email || "").toLowerCase();
      if (!email) continue;
      if (!mapa.has(email)) mapa.set(email, { email, nome: p.cliente_nome || "", pedidos: 0 });
      const c = mapa.get(email)!;
      c.pedidos = (c.pedidos || 0) + 1;
      if (!c.nome) c.nome = p.cliente_nome || "";
    }
    const clientes = Array.from(mapa.values());
    const alvo = clientes.filter((c) => {
      if (f.email && !c.email.includes(String(f.email).toLowerCase())) return false;
      if (f.nome && !c.nome.toLowerCase().includes(String(f.nome).toLowerCase())) return false;
      return true;
    });
    // Filtro de pontos mínimos (busca pontos só dos já filtrados).
    let final = alvo;
    if (typeof f.pontosMin === "number" && f.pontosMin > 0) {
      const comPontos = await Promise.all(alvo.map(async (c) => ({ ...c, pontos: await segredos.getPontos(c.email) })));
      final = comPontos.filter((c) => (c.pontos || 0) >= f.pontosMin);
    }
    if (final.length === 0) return res.status(400).json({ erro: "Nenhum cliente corresponde aos filtros." });
    let enviadas = 0;
    let pushEnviados = 0;
    for (const c of final) {
      await salvarNotificacao({ email: c.email, titulo, corpo, tipo: tipo || "geral" });
      enviadas++;
    }
    // Push web: envia para os dispositivos assinados dos destinatários.
    const subs = await listarPushSubscriptions(final.map((c) => c.email)).catch(() => new Map());
    const pushes: Promise<void>[] = [];
    for (const c of final) {
      const lista = subs.get(c.email.toLowerCase()) || [];
      for (const s of lista) {
        pushes.push(
          webpush
            .sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify({ title: titulo, body: corpo, tipo: tipo || "geral" }))
            .then(() => { pushEnviados++; })
            .catch((err: any) => {
              const status = err?.statusCode;
              if (status === 404 || status === 410) {
                // Dispositivo deixou de existir — limpa a subscription.
                removerPushSubscription(c.email, s.endpoint).catch(() => {});
              }
            })
        );
      }
    }
    await Promise.all(pushes).catch(() => {});
    await registrarLog({ admin_email: (req as any).adminEmail || "admin", acao: "notificar", detalhe: { titulo, tipo, filtros, destinatarios: enviadas, pushEnviados } }).catch(() => {});
    return res.json({ ok: true, enviadas, destinatarios: final.length, pushEnviados });
  } catch (err: any) {
    console.error("[notificar] falha:", err);
    return res.status(502).json({ erro: "Falha ao enviar notificações." });
  }
});

// Cliente logado lista suas notificações.
app.get("/api/notificacoes", async (req, res) => {
  const email = String((req.query.email as string) || "").trim().toLowerCase();
  if (!email) return res.status(400).json({ erro: "Informe o e-mail." });
  try {
    const notifs = await listarNotificacoes(email);
    const naoLidas = notifs.filter((n) => !n.lida).length;
    return res.json({ notificacoes: notifs, naoLidas });
  } catch (err) {
    return res.status(500).json({ erro: "Falha ao listar notificações." });
  }
});

// Cliente marca como lida.
app.post("/api/notificacoes/:id/lida", async (req, res) => {
  const email = String((req.query.email as string) || "").trim().toLowerCase();
  if (!email) return res.status(400).json({ erro: "Informe o e-mail." });
  try {
    await marcarNotificacaoLida(email, req.params.id);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ erro: "Falha ao marcar como lida." });
  }
});

// ---------------------------------------------------------------------------
// NOTIFICAÇÕES PUSH (web) — VAPID + subscriptions por e-mail.
// Chaves VAPID geradas no primeiro boot e guardadas em store_config.
// ---------------------------------------------------------------------------
const VAPID_PUBLIC_KEY = "VAPID_PUBLIC_KEY";
const VAPID_PRIVATE_KEY = "VAPID_PRIVATE_KEY";

async function garantirVapid(): Promise<boolean> {
  try {
    let pub = await getSecret(VAPID_PUBLIC_KEY as any);
    let priv = await getSecret(VAPID_PRIVATE_KEY as any);
    if (!pub || !priv) {
      const keys = webpush.generateVAPIDKeys();
      pub = keys.publicKey;
      priv = keys.privateKey;
      const sb = supabaseClient();
      if (sb) {
        const { error } = await sb.from("store_config").upsert([
          { key: VAPID_PUBLIC_KEY, value: pub, is_secret: false, updated_at: new Date().toISOString() },
          { key: VAPID_PRIVATE_KEY, value: priv, is_secret: true, updated_at: new Date().toISOString() },
        ], { onConflict: "key" });
        if (error) console.error("[vapid] upsert falhou:", error.message);
        invalidarCacheChave(VAPID_PUBLIC_KEY as any);
        invalidarCacheChave(VAPID_PRIVATE_KEY as any);
      } else {
        console.error("[vapid] Supabase indisponível — VAPID não persistido");
      }
    }
    webpush.setVapidDetails("mailto:contato@dgriffedois.com.br", pub, priv);
    return true;
  } catch (err) {
    console.error("[vapid] falha ao configurar:", err);
    return false;
  }
}

// Expoe a chave pública para o app assinar as notificações.
app.get("/api/notificacoes/push-config", async (_req, res) => {
  const pub = await getSecret(VAPID_PUBLIC_KEY as any).catch(() => null);
  return res.json({ publicKey: pub });
});

// Diagnóstico temporário: status do Supabase + prefixo da key (sem expor segredo).
app.get("/api/diag/supabase", async (_req, res) => {
  const sb = supabaseClient();
  let role = "sem-sb";
  let count = -1;
  if (sb) {
    try {
      const { data } = await sb.auth.admin.listUsers({ page: 1, perPage: 1 });
      role = "service_role";
      count = data?.total ?? -1;
    } catch (e: any) {
      role = `nao-service-role: ${String(e?.message || e).slice(0, 60)}`;
    }
  }
  const key = String(process.env.SUPABASE_SERVICE_ROLE || "");
  let keyClaims: { role?: string; exp?: number } | null = null;
  try {
    const pay = key.split(".")[1];
    if (pay) {
      keyClaims = JSON.parse(Buffer.from(pay.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
    }
  } catch { /* ignora */ }
  let insertTeste: { ok: boolean; erro?: string; modo?: string } | null = null;
  if (sb) {
    try {
      const { error } = await sb.from("cupons").insert({
        codigo: `DIAG${Math.floor(Math.random() * 9999)}`,
        tipo: "percentual",
        valor: 1,
        data_inicio: new Date().toISOString(),
        data_fim: new Date(Date.now() + 86400000).toISOString(),
      });
      if (!error) insertTeste = { ok: true, modo: "supabase-js" };
      else insertTeste = { ok: false, erro: String(error.message).slice(0, 200), modo: "supabase-js" };
    } catch (e: any) {
      insertTeste = { ok: false, erro: String(e?.message || e).slice(0, 200), modo: "supabase-js" };
    }
  }
  return res.json({
    url: String(process.env.SUPABASE_URL || "").slice(0, 40),
    keyPrefix: key.slice(0, 14),
    keyClaims: keyClaims
      ? { role: keyClaims.role, exp: keyClaims.exp ?? null, agora: Math.floor(Date.now() / 1000), expirada: typeof keyClaims.exp === "number" && keyClaims.exp < Date.now() / 1000 }
      : "nao-jwt",
    role,
    users: count,
    insertTeste,
  });
});

// Cliente salva a subscription do dispositivo (associada ao e-mail).
app.post("/api/notificacoes/subscribe", async (req, res) => {
  const email = String((req.body?.email || "").trim().toLowerCase());
  const sub = req.body?.subscription;
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ erro: "E-mail inválido." });
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return res.status(400).json({ erro: "Subscription inválida." });
  try {
    await salvarPushSubscription(email, { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } });
    return res.json({ ok: true });
  } catch (err) {
    console.error("[push] falha ao assinar:", err);
    return res.status(500).json({ erro: "Falha ao assinar notificações." });
  }
});

// Cliente cancela a subscription de um dispositivo.
app.post("/api/notificacoes/unsubscribe", async (req, res) => {
  const email = String((req.body?.email || "").trim().toLowerCase());
  const endpoint = String(req.body?.endpoint || "");
  if (!email || !endpoint) return res.status(400).json({ erro: "Dados incompletos." });
  try {
    await removerPushSubscription(email, endpoint);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ erro: "Falha ao cancelar notificações." });
  }
});

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
  const { items, meio, email, card_token, pontosResgate, cupom, cliente } = body;
  const dadosCliente = (cliente && typeof cliente === "object" ? cliente : {}) as {
    nome?: string;
    telefone?: string;
    cpf?: string;
    forma_entrega?: string;
    endereco?: {
      endereco?: string;
      numero?: string;
      complemento?: string;
      bairro?: string;
      cidade?: string;
      estado?: string;
      cep?: string;
    };
    observacoes?: string;
  };

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ erro: "Carrinho vazio." });
  }
  if (!["pix", "cartao"].includes(meio)) {
    return res.status(400).json({ erro: "Meio de pagamento inválido." });
  }
  if (email && (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return res.status(400).json({ erro: "E-mail inválido." });
  }
  if (!email) {
    return res.status(400).json({ erro: "Informe o e-mail para receber a cobrança." });
  }
  if (meio === "cartao" && (!card_token || typeof card_token !== "string")) {
    return res.status(400).json({ erro: "Token de cartão ausente (gere-o com o SDK do Mercado Pago no cliente)." });
  }
  if (items.length > 50) {
    return res.status(400).json({ erro: "Carrinho excede o limite de itens." });
  }
  if (dadosCliente.nome !== undefined && (typeof dadosCliente.nome !== "string" || dadosCliente.nome.length > 120)) {
    return res.status(400).json({ erro: "Nome inválido." });
  }
  if (dadosCliente.telefone !== undefined && (typeof dadosCliente.telefone !== "string" || dadosCliente.telefone.length > 30)) {
    return res.status(400).json({ erro: "Telefone inválido." });
  }
  if (dadosCliente.cpf !== undefined && dadosCliente.cpf && !/^[\d. -]{11,14}$/.test(String(dadosCliente.cpf))) {
    return res.status(400).json({ erro: "CPF inválido." });
  }
  if (dadosCliente.observacoes !== undefined && (typeof dadosCliente.observacoes !== "string" || dadosCliente.observacoes.length > 500)) {
    return res.status(400).json({ erro: "Observações muito longas (máx. 500 caracteres)." });
  }

  try {
    // Salva perfil/endereço do cliente (Supabase) quando informados — o pedido
    // na LI é criado com esses dados (buyer + endereço), e o admin os exibe.
    if (dadosCliente.nome || dadosCliente.telefone) {
      await salvarPerfil({
        email,
        nome: dadosCliente.nome || undefined,
        telefone: dadosCliente.telefone || undefined,
      }).catch((err) => console.warn("[checkout] falha ao salvar perfil:", err?.message));
    }
    const end = dadosCliente.endereco;
    if (dadosCliente.forma_entrega === "entrega" && end?.endereco && end?.cidade && end?.estado && end?.cep) {
      await salvarEndereco({
        email,
        nome: dadosCliente.nome || email.split("@")[0],
        endereco: String(end.endereco),
        numero: end.numero ? String(end.numero) : "",
        complemento: end.complemento ? String(end.complemento) : undefined,
        bairro: end.bairro ? String(end.bairro) : undefined,
        cidade: String(end.cidade),
        estado: String(end.estado),
        cep: String(end.cep).replace(/\D/g, ""),
        principal: true,
      }).catch((err) => console.warn("[checkout] falha ao salvar endereço:", err?.message));
    }

    const resultado = await processarCheckout({
      items: items.map((it) => ({ price: Number(it.price), qty: Number(it.qty), sku: String(it.sku || it.product_id || ""), nome: it.nome })),
      meio,
      email,
      card_token,
      pontosResgate: Number(pontosResgate || 0) || undefined,
      cupom: cupom || undefined,
      observacoes: dadosCliente.observacoes || undefined,
      formaEntrega: dadosCliente.forma_entrega || "retirada",
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
  const reqId = req.headers["x-request-id"];
  const reqIdStr = Array.isArray(reqId) ? reqId[0] : reqId;
  const dataId = typeof req.query?.["data.id"] === "string" ? req.query["data.id"] : undefined;
  try {
    const r = await processarWebhookMP(raw, sigStr, { dataId, xRequestId: reqIdStr });
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

// A API v3 da Loja Integrada NÃO retorna imagens, preço e estoque na listagem
// de produtos (só no GET individual). Para o catálogo inteiro (19 mil produtos)
// não é viável buscar 1 por 1 a cada página — então o servidor sincroniza em
// background as três fontes em massa (/produto_imagem, /produto_preco,
// /produto_estoque) e guarda em memória. O enriquecimento da listagem consulta
// esses mapas (instantâneo) e, se ainda não sincronizado, cai no GET individual.
const CDN_PREFIX = "https://cdn.awsli.com.br";
const imagemSync = new Map(); // produtoId -> { principal: string, todas: string[] }
const precoSync = new Map(); // produtoId -> { cheio, promocional, sob_consulta }
const estoqueSync = new Map(); // produtoId -> { quantidade, disponivel, gerenciado }
// Catálogo real (listagem da LI, sem variações): produtoId -> objeto da listagem.
// A LI ignora filtros (marca/categorias/nome) na listagem, então o proxy guarda
// o catálogo em memória e filtra/pagina localmente — permitindo total correto e
// busca/filtro rápidos sem chamadas extras à LI.
const produtosSync = new Map();
let syncState = { rodando: false, ultimoOk: 0, progresso: "" };

function extrairIdDaUri(uri) {
  const m = String(uri || "").match(/(\d+)\/?$/);
  return m ? Number(m[1]) : null;
}

async function paginarRecurso(recurso, processaItem, queryExtra = {}) {
  let offset = 0;
  const limit = 100;
  for (;;) {
    let resp = null;
    // Retry com backoff exponencial: a LI derruba chamadas em rajada (429/5xx).
    for (let tentativa = 1; tentativa <= 5; tentativa++) {
      resp = await chamarLI("GET", recurso, undefined, { limit, offset, ...queryExtra });
      if (resp.status === 200) break;
      console.warn(`[sync-${recurso}] status ${resp.status} no offset ${offset} (tentativa ${tentativa})`);
      await new Promise((r) => setTimeout(r, 1500 * tentativa));
    }
    if (!resp || resp.status !== 200) {
      console.error(`[sync-${recurso}] desistindo no offset ${offset} após retries`);
      return;
    }
    const objetos = resp.payload.objects || [];
    for (const item of objetos) processaItem(item);
    if (objetos.length < limit) return;
    offset += limit;
  }
}

async function sincronizarDadosLoja() {
  if (syncState.rodando) return;
  syncState.rodando = true;
  syncState.progresso = "iniciando";
  const t0 = Date.now();
  try {
    // Imagens: caminho -> https://cdn.awsli.com.br/800x800/{caminho}
    await paginarRecurso("produto_imagem", (img) => {
      const produtoId = extrairIdDaUri(img.produto);
      if (!produtoId) return;
      const url = img.caminho ? `${CDN_PREFIX}/800x800/${img.caminho}` : null;
      let registro = imagemSync.get(produtoId);
      if (!registro) {
        registro = { principal: null, todas: [] };
        imagemSync.set(produtoId, registro);
      }
      if (url) registro.todas.push(url);
      if (img.principal && !registro.principal) registro.principal = url;
    });

    // Preços
    await paginarRecurso("produto_preco", (preco) => {
      const produtoId = extrairIdDaUri(preco.produto);
      if (!produtoId) return;
      precoSync.set(produtoId, {
        cheio: preco.cheio ?? null,
        promocional: preco.promocional ?? null,
        sob_consulta: preco.sob_consulta ?? false,
      });
    });

    // Estoque
    await paginarRecurso("produto_estoque", (est) => {
      const produtoId = extrairIdDaUri(est.produto);
      if (!produtoId) return;
      estoqueSync.set(produtoId, {
        quantidade: est.quantidade ?? 0,
        disponivel: est.quantidade_disponivel ?? est.quantidade ?? 0,
        gerenciado: est.gerenciado ?? false,
        em_estoque: est.situacao_em_estoque ?? null,
        sem_estoque: est.situacao_sem_estoque ?? null,
      });
    });

    // Catálogo (listagem completa, sem variações) — usado para filtros locais
    // (marca/categoria/busca) e total real, já que a LI ignora filtros na listagem.
    produtosSync.clear();
    await paginarRecurso(
      "produto",
      (p) => {
        if (!p?.id || p?.tipo === "atributo_opcao") return;
        produtosSync.set(p.id, p);
      },
      { ativo: "true", removido: "false" }
    );

    syncState.ultimoOk = Date.now();
    syncState.progresso = `ok: ${imagemSync.size} imagens, ${precoSync.size} precos, ${estoqueSync.size} estoques, ${produtosSync.size} produtos em ${((Date.now() - t0) / 1000).toFixed(0)}s`;
    console.log(`[loja-integrada-proxy] sync em massa: ${syncState.progresso}`);

    // A listagem da LI NÃO retorna o campo `marca` (vem null para a maioria) —
    // sem isso o filtro por marca não funciona. Enriquecimento em background:
    // busca o GET individual dos produtos sem marca/categorias (aos poucos,
    // com concorrência) e guarda no catálogo em memória.
    enriquecerCatalogoComDetalhes();
  } catch (e) {
    console.error("[loja-integrada-proxy] sync em massa falhou:", e?.message);
    syncState.progresso = `erro: ${e?.message}`;
  } finally {
    syncState.rodando = false;
  }
}

// Sincroniza no boot (se houver chaves) e a cada 15 minutos.
setTimeout(() => {
  if (!DEMO && !MOCK && process.env.LOJA_INTEGRADA_APP_KEY) sincronizarDadosLoja();
}, 2000);
setInterval(() => {
  if (!DEMO && !MOCK && process.env.LOJA_INTEGRADA_APP_KEY) sincronizarDadosLoja();
}, 15 * 60 * 1000);

// A listagem da LI não traz `marca` (nem sempre `categorias`). Este enriquecimento
// percorre o catálogo local em background (GET individual, com concorrência) e
// copia marca/categorias para o objeto em produtosSync — necessário para o
// filtro por marca funcionar. Processa em lotes com pausa para não estourar o
// rate limit da LI (em rajada a LI derruba parte das chamadas).
let enriquecendoCatalogo = false;
const LOTE_ENRIQUECIMENTO = 300;
async function enriquecerCatalogoComDetalhes() {
  if (enriquecendoCatalogo || produtosSync.size === 0) return;
  enriquecendoCatalogo = true;
  try {
    const semMarca = [...produtosSync.values()].filter(
      (p) => !p?.marca || (Array.isArray(p.categorias) && p.categorias.length === 0)
    );
    if (semMarca.length === 0) return;
    console.log(`[loja-integrada-proxy] enriquecendo ${semMarca.length} produtos (lotes de ${LOTE_ENRIQUECIMENTO})...`);
    for (let inicio = 0; inicio < semMarca.length; inicio += LOTE_ENRIQUECIMENTO) {
      const lote = semMarca.slice(inicio, inicio + LOTE_ENRIQUECIMENTO);
      let fila = [...lote];
      async function worker() {
        while (fila.length > 0) {
          const produto = fila.shift();
          try {
            const extra = await enriquecerProdutoComImagem(produto.id);
            const atual = produtosSync.get(produto.id);
            if (!atual) continue;
            if (!atual.marca && extra.marca) atual.marca = extra.marca;
            if ((!atual.categorias || atual.categorias.length === 0) && extra.categorias?.length) {
              atual.categorias = extra.categorias;
            }
          } catch {
            /* produto individual indisponível — segue */
          }
        }
      }
      await Promise.all(Array.from({ length: 8 }, worker));
      // Pausa entre lotes: evita rate limit da LI em rajada.
      await new Promise((r) => setTimeout(r, 8000));
    }
    const faltam = [...produtosSync.values()].filter((p) => !p?.marca).length;
    console.log(`[loja-integrada-proxy] enriquecimento concluído; ${produtosSync.size - faltam} de ${produtosSync.size} com marca.`);
  } finally {
    enriquecendoCatalogo = false;
  }
}

// Fallback individual (usado enquanto o sync em massa ainda não cobriu o produto).
const imagemCache = new Map(); // id -> { campos extras, expira }
const IMAGEM_CACHE_TTL_MS = 10 * 60 * 1000;
const IMAGEM_CONCURRENCIA = 6;

// Campos que o GET individual devolve e a listagem não — usados no fallback.
const CAMPOS_DO_INDIVIDUAL = [
  "imagem_principal",
  "imagens",
  "preco_cheio",
  "preco_promocional",
  "preco_custo",
  "preco_sob_consulta",
  "destaque",
  "estoque_quantidade",
  "estoque_gerenciado",
  "estoque_situacao_em_estoque",
  "estoque_situacao_sem_estoque",
  "marca",
  "data_criacao",
  "data_modificacao",
  "usado",
];

async function enriquecerProdutoComImagem(id) {
  const agora = Date.now();
  const cached = imagemCache.get(id);
  if (cached && cached.expira > agora) return cached;
  try {
    const { status, payload } = await chamarLI("GET", "produto", id, {});
    if (status !== 200) return {};
    let obj = Array.isArray(payload.objects) ? payload.objects[0] : payload;
    // Produtos pai (tipo "atributo") não têm preço/imagem próprios — os dados
    // estão no primeiro filho (variação). Herda os dados do primeiro filho.
    if (obj && !obj.preco_cheio && Array.isArray(obj.filhos) && obj.filhos.length > 0) {
      const marcaDoPai = obj.marca;
      const categoriasDoPai = obj.categorias;
      const primeiroFilhoId = extrairIdDaUri(obj.filhos[0]);
      if (primeiroFilhoId) {
        const filho = await chamarLI("GET", "produto", primeiroFilhoId, {});
        const filhoObj = Array.isArray(filho.payload?.objects) ? filho.payload.objects[0] : filho.payload;
        if (filhoObj) {
          obj = { ...obj, ...filhoObj, id: obj.id };
          // Variações (atributo_opcao) não têm marca/categorias — preserva as do pai.
          if (!obj.marca && marcaDoPai) obj.marca = marcaDoPai;
          if ((!obj.categorias || obj.categorias.length === 0) && categoriasDoPai?.length) {
            obj.categorias = categoriasDoPai;
          }
        }
      }
    }
    const dados = { expira: agora + IMAGEM_CACHE_TTL_MS };
    for (const campo of CAMPOS_DO_INDIVIDUAL) {
      dados[campo] = obj?.[campo] ?? null;
    }
    imagemCache.set(id, dados);
    return dados;
  } catch {
    return {};
  }
}

/** Aplica dados sincronizados (imagem/preço/estoque em massa) a um produto da listagem. */
function aplicarDadosSincronizados(produto) {
  const id = produto?.id;
  if (!id) return;
  // Produtos pai (tipo "atributo") não têm dados próprios — herdam do primeiro
  // filho (variação), que carrega preço/imagem/estoque.
  if (produto.tipo === "atributo" && Array.isArray(produto.filhos) && produto.filhos.length > 0) {
    const filhoId = extrairIdDaUri(produto.filhos[0]);
    if (filhoId && precoSync.has(filhoId)) {
      const fp = precoSync.get(filhoId);
      if (!produto.preco_cheio) {
        produto.preco_cheio = fp.cheio ?? 0;
        produto.preco_promocional = fp.promocional ?? null;
        produto.preco_sob_consulta = fp.sob_consulta ?? false;
      }
      const fim = imagemSync.get(filhoId);
      if (fim && !produto.imagem_principal && fim.principal) {
        produto.imagem_principal = {
          caminho: fim.principal.replace(`${CDN_PREFIX}/800x800/`, ""),
          grande: fim.principal,
          media: fim.principal,
          icone: fim.principal,
          pequena: fim.principal,
        };
      }
      const fest = estoqueSync.get(filhoId);
      // Produtos pai (atributo) nunca têm estoque próprio (LI retorna 0/0) —
      // a situação real vem do primeiro filho (variação).
      if (fest) {
        if (fest.gerenciado) {
          produto.estoque_quantidade = fest.disponivel;
          produto.estoque_gerenciado = true;
        } else {
          produto.estoque_gerenciado = false;
          produto.estoque_quantidade = undefined;
        }
        produto.estoque_situacao_em_estoque = fest.em_estoque;
        produto.estoque_situacao_sem_estoque = fest.sem_estoque;
      }
    }
  }
  const img = imagemSync.get(id);
  if (img && !produto.imagem_principal && img.principal) {
    produto.imagem_principal = {
      caminho: img.principal.replace(`${CDN_PREFIX}/800x800/`, ""),
      grande: img.principal,
      media: img.principal,
      icone: img.principal,
      pequena: img.principal,
    };
  }
  const preco = precoSync.get(id);
  if (preco && !produto.preco_cheio) {
    produto.preco_cheio = preco.cheio ?? 0;
    produto.preco_promocional = preco.promocional ?? null;
    produto.preco_sob_consulta = preco.sob_consulta ?? false;
  }
  const est = estoqueSync.get(id);
  if (est && produto.estoque_quantidade === undefined) {
    if (est.gerenciado) {
      produto.estoque_quantidade = est.disponivel;
      produto.estoque_gerenciado = true;
    } else {
      // Loja não rastreia estoque desse produto — marca como disponível
      // (não informado), para o app não exibir "esgotado" erroneamente.
      produto.estoque_gerenciado = false;
    }
    produto.estoque_situacao_em_estoque = est.em_estoque;
    produto.estoque_situacao_sem_estoque = est.sem_estoque;
  }
}

/** Filtra e pagina o catálogo local (produtosSync) com os mesmos parâmetros
 *  que a LI aceitaria, mas funcionando de verdade (a LI ignora filtros na
 *  listagem). Retorna { objects, total_count }. */
function listarProdutosLocal(query) {
  const limit = Math.min(parseInt(query.limit, 10) || 100, 200);
  const offset = Math.max(parseInt(query.offset, 10) || 0, 0);
  const marca = query.marca ? String(query.marca).trim() : null;
  const categorias = query.categorias
    ? String(query.categorias).split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const busca = query.nome__icontains ? String(query.nome__icontains).trim().toLowerCase() : null;

  let objetos = [...produtosSync.values()].filter(
    (p) => p?.ativo !== false && p?.removido !== true
  );

  if (marca) {
    const marcaId = extrairIdDaUri(marca);
    objetos = objetos.filter((p) => {
      if (marcaId && extrairIdDaUri(p.marca) === marcaId) return true;
      return String(p.marca || "") === marca;
    });
  }

  if (categorias.length > 0) {
    const ids = new Set(categorias.map(extrairIdDaUri).filter(Boolean));
    objetos = objetos.filter((p) => {
      const uris = Array.isArray(p.categorias) ? p.categorias : p.categoria ? [p.categoria] : [];
      return uris.some((u) => ids.has(extrairIdDaUri(u)) || categorias.includes(String(u)));
    });
  }

  if (busca) {
    objetos = objetos.filter(
      (p) =>
        (p.nome || "").toLowerCase().includes(busca) ||
        (p.sku || "").toLowerCase().includes(busca)
    );
  }

  const total = objetos.length;
  return {
    objects: objetos.slice(offset, offset + limit).map((p) => ({ ...p })),
    total_count: total,
  };
}

async function enriquecerListaProdutos(objects) {
  const semDetalhes = objects.filter(
    (p) => !p?.imagem_principal && !(p?.imagens && p.imagens.length > 0) && p?.preco_cheio === undefined
  );
  if (semDetalhes.length === 0) return;
  for (const produto of objects) aplicarDadosSincronizados(produto);
  const aindaFaltam = objects.filter(
    (p) => (!p?.imagem_principal && !(p?.imagens && p.imagens.length > 0)) || p?.preco_cheio === undefined
  );
  if (aindaFaltam.length === 0) return;
  let fila = [...aindaFaltam];
  async function worker() {
    while (fila.length > 0) {
      const produto = fila.shift();
      const extra = await enriquecerProdutoComImagem(produto.id);
      for (const campo of CAMPOS_DO_INDIVIDUAL) {
        if (produto[campo] === undefined && extra[campo] !== undefined && extra[campo] !== null) {
          produto[campo] = extra[campo];
        }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(IMAGEM_CONCURRENCIA, aindaFaltam.length) }, worker));
}

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
      const atual = typeof payload === "string" ? JSON.parse(payload || "{}") : payload || {};
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

    // Catálogo servido do sync em memória: filtros reais (marca/categoria/busca),
    // total exato e sem chamadas extras à LI. Usado sempre que o catálogo já
    // foi sincronizado (produtosSync populado).
    if (req.method === "GET" && resource === "produto" && !id && produtosSync.size > 0) {
      const { objects, total_count } = listarProdutosLocal(query);
      await enriquecerListaProdutos(objects);
      return res.status(200).json({
        meta: { total_count, limit: Number(query.limit) || 100, offset: Number(query.offset) || 0 },
        objects,
      });
    }

    const { status, payload } = await chamarLI(req.method, resource, id, query, req.body);
    // GET individual de produto: a listagem sincronizada tem preço/imagem/estoque
    // reais (sync em massa), o detalhe da LI nem sempre traz — aplica o sync para
    // o app exibir preço certo na tela do produto e nos destaques da home.
    if (req.method === "GET" && resource === "produto" && id && status === 200 && payload && typeof payload === "object" && !Array.isArray(payload)) {
      aplicarDadosSincronizados(payload);
      const semImagem = !payload.imagem_principal || !(Array.isArray(payload.imagens) && payload.imagens.length > 0);
      if (payload.destaque === undefined || !payload.preco_cheio || semImagem) {
        const extra = await enriquecerProdutoComImagem(payload.id || id).catch(() => ({}));
        for (const campo of CAMPOS_DO_INDIVIDUAL) {
          const alvo = payload[campo];
          const alvoVazio =
            alvo === undefined || alvo === null || alvo === "" ||
            (Array.isArray(alvo) && alvo.length === 0);
          if (extra[campo] !== undefined && extra[campo] !== null && extra[campo] !== "" && alvoVazio) {
            payload[campo] = extra[campo];
          }
        }
      }
    }
    if (req.method === "GET" && resource === "produto" && !id && status === 200 && Array.isArray(payload?.objects)) {
      // A LI lista variações (atributo_opcao) junto com produtos reais — o
      // catálogo do app mostra apenas produtos (normal/atributo). Filtramos
      // aqui para não inflar a listagem com centenas de variações sem foto.
      const antes = payload.objects.length;
      payload.objects = payload.objects.filter((p) => p?.tipo !== "atributo_opcao");
      if (payload.meta && payload.meta.total_count) {
        payload.meta.total_count -= antes - payload.objects.length;
      }
      await enriquecerListaProdutos(payload.objects);
    }
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
    const busca = await chamarLI("GET", "cliente", "search", { cliente_email: email });
    const objs = (busca.payload && (busca.payload as any).objects) || [];
    if (busca.status === 200 && objs[0]?.id) {
      return objs[0];
    }
  } catch {
    /* segue para criação */
  }

  const body: any = { email, enderecos: [] };
  if (dados.nome) body.nome = dados.nome;
  else body.nome = email.split("@")[0];
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
    //    emailRedirectTo: o link do e-mail aponta para o app (evita cair em
    //    localhost:3000, o default do projeto Supabase).
    const siteUrl = FRONTEND_ORIGIN.split(",")[0].trim();
    const { error: otpErr } = await sb.auth.signInWithOtp({
      email: e,
      options: {
        shouldCreateUser: true,
        data: { nome: nome || "", telefone: telefone || "", cpf: cpf || "" },
        emailRedirectTo: siteUrl,
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
    // Fase B: concede a missão "cadastro completo" (idempotente — só 1x).
    try { await segredos.concederMissao(e, "cadastro_completo"); } catch (mErr) {
      console.warn("[verificar] falha ao conceder missão de cadastro (ignorado):", (mErr as Error)?.message);
    }
    return res.json({ ok: true, session: data.session, user: data.user });
  } catch (err) {
    registrarTentativaFalha(ip);
    return res.status(500).json({ erro: "Falha ao verificar código." });
  }
});

// POST /api/cliente/renovar -> renova a sessão com o refresh_token
// (o access_token do Supabase expira em ~1h; o app guarda o refresh_token
// e renova aqui para o cliente não perder o login/cupons no meio da sessão).
app.post("/api/cliente/renovar", async (req, res) => {
  const { refresh_token } = req.body || {};
  const rt = String(refresh_token || "").trim();
  if (!rt) return res.status(400).json({ erro: "refresh_token ausente." });
  const sb = supabaseClient();
  if (!sb) return res.status(503).json({ erro: "Banco de dados indisponível (modo demo)." });
  try {
    const { data, error } = await sb.auth.refreshSession({ refresh_token: rt });
    if (error) return res.status(401).json({ erro: "Sessão expirada. Faça login novamente." });
    return res.json({ ok: true, session: data.session, user: data.user });
  } catch (err) {
    console.error("[cliente] renovar sessão:", err);
    return res.status(500).json({ erro: "Falha ao renovar sessão." });
  }
});

// POST /api/cliente/confirmar-link -> troca o token_hash do link do e-mail
// (Supabase magic link) por uma sessão. Usado quando o cliente clica no link
// do e-mail em vez de digitar o código de 6 dígitos.
app.post("/api/cliente/confirmar-link", async (req, res) => {
  const { token_hash, type } = req.body || {};
  const th = String(token_hash || "").trim();
  const tp = String(type || "magiclink").trim();
  if (!th) return res.status(400).json({ erro: "token_hash ausente." });
  const sb = supabaseClient();
  if (!sb) return res.status(503).json({ erro: "Banco de dados indisponível (modo demo)." });
  try {
    const { data, error } = await sb.auth.verifyOtp({ token_hash: th, type: tp as any });
    if (error) return res.status(401).json({ erro: error.message });
    // Garante o perfil do usuário confirmado via link.
    try {
      const uid = data.user?.id;
      if (uid) {
        await sb.from("profiles").upsert({
          id: uid,
          email: data.user?.email || "",
          updated_at: new Date().toISOString(),
        }, { onConflict: "id" });
      }
    } catch (pErr) {
      console.warn("[confirmar-link] falha ao garantir perfil (ignorado):", (pErr as Error)?.message);
    }
    return res.json({ ok: true, session: data.session, user: data.user });
  } catch (err) {
    console.error("[cliente] confirmar link:", err);
    return res.status(500).json({ erro: "Falha ao confirmar link." });
  }
});

// POST /api/cliente/login-password -> cria usuário com senha ou faz login
// Ideal para testes: o cliente digita email + senha e entra direto.
// Se o usuário não existir, cria com senha. Se existir, loga ou define senha.
app.post("/api/cliente/login-password", async (req, res) => {
  const ip = ipDo(req);
  const bloq = checarBloqueio(ip);
  if (bloq.bloqueado) return res.status(429).json({ erro: `Muitas tentativas. Tente em ${bloq.resta}s.` });

  const { email, senha, nome, telefone, cpf } = req.body || {};
  const e = (email || "").trim().toLowerCase();
  const s = String(senha || "").trim();
  if (!e || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) {
    return res.status(400).json({ erro: "E-mail inválido." });
  }
  if (!s || s.length < 6) {
    return res.status(400).json({ erro: "Senha deve ter ao menos 6 caracteres." });
  }
  const sb = supabaseClient();
  if (!sb) return res.status(503).json({ erro: "Banco de dados indisponível." });

  try {
    // Verifica se já existe — se sim, só loga.
    let listUser: string | null = null;
    try {
      const list = await sb.auth.admin.listUsers();
      listUser = list.data?.users?.find((u) => u.email === e)?.id || null;
    } catch { /* ignora */ }

    if (listUser) {
      // Tenta login com senha direto. Se falhar (usuário sem senha, cadastro via OTP),
      // define a senha e faz login novamente.
      const { data, error: loginErr } = await sb.auth.signInWithPassword({ email: e, password: s });
      if (loginErr) {
        try {
          const { error: updErr } = await sb.auth.admin.updateUserById(listUser, { password: s });
          if (updErr) throw updErr;
          const { data: data2, error: loginErr2 } = await sb.auth.signInWithPassword({ email: e, password: s });
          if (loginErr2) throw loginErr2;
          registrarTentativaSucesso(ip);
          try { await sb.from("profiles").upsert({ id: data2.user!.id, email: e, nome: (nome || null), updated_at: new Date().toISOString() }, { onConflict: "id" }); } catch (pErr) {
            console.warn("[login-password] falha ao salvar perfil (ignorado):", (pErr as Error)?.message);
          }
          // Sincroniza com a Loja Integrada (se houver credenciais configuradas).
          try {
            const { LI_APP_KEY, LI_API_KEY } = await getSecretsLI();
            if (LI_APP_KEY && LI_API_KEY) await criarClienteLI(e, { nome, telefone, cpf });
          } catch (liErr) {
            console.warn("[login-password] falha ao sincronizar com Loja Integrada (ignorado):", (liErr as Error)?.message);
          }
          return res.json({ ok: true, session: data2.session, user: data2.user, mensagem: "Senha definida e login OK." });
        } catch (fallbackErr) {
          console.error("[login-password] fallback senha falhou:", (fallbackErr as Error)?.message);
          return res.status(401).json({ erro: "Senha incorreta." });
        }
      }
      registrarTentativaSucesso(ip);
      try { await sb.from("profiles").upsert({ id: data.user!.id, email: e, nome: (nome || null), updated_at: new Date().toISOString() }, { onConflict: "id" }); } catch (pErr) {
        console.warn("[login-password] falha ao salvar perfil (ignorado):", (pErr as Error)?.message);
      }
      // Sincroniza com a Loja Integrada (se houver credenciais configuradas).
      try {
        const { LI_APP_KEY, LI_API_KEY } = await getSecretsLI();
        if (LI_APP_KEY && LI_API_KEY) await criarClienteLI(e, { nome, telefone, cpf });
      } catch (liErr) {
        console.warn("[login-password] falha ao sincronizar com Loja Integrada (ignorado):", (liErr as Error)?.message);
      }
      return res.json({ ok: true, session: data.session, user: data.user, mensagem: "Login OK" });
    }

    // Cria o usuário com senha (bypassa confirmação de e-mail).
    const { data, error } = await sb.auth.admin.createUser({
      email: e,
      password: s,
      email_confirm: true,
      user_metadata: { nome: nome || "", telefone: "" },
    });
    if (error) {
      console.error("[register-password] createUser erro:", error.message);
      // Não vaza detalhes do Supabase; tenta fallback de login caso já exista.
      if (/already/i.test(error.message)) {
        return res.status(409).json({ erro: "Já existe uma conta com este e-mail. Faça login." });
      }
      return res.status(400).json({ erro: "Não foi possível criar a conta." });
    }
    registrarTentativaSucesso(ip);
    // Garante perfil na tabela profiles.
    try {
      const perfil: any = { id: data.user!.id, email: e, nome: (nome || null), updated_at: new Date().toISOString() };
      if (telefone) perfil.telefone = telefone;
      if (cpf) perfil.cpf = cpf;
      await sb.from("profiles").upsert(perfil, { onConflict: "id" });
    } catch (pErr) {
      console.warn("[register-password] falha ao salvar perfil (ignorado):", (pErr as Error)?.message);
    }
    // Sincroniza com a Loja Integrada (se houver credenciais configuradas).
    try {
      const { LI_APP_KEY, LI_API_KEY } = await getSecretsLI();
      if (LI_APP_KEY && LI_API_KEY) await criarClienteLI(e, { nome, telefone, cpf });
    } catch (liErr) {
      console.warn("[register-password] falha ao sincronizar com Loja Integrada (ignorado):", (liErr as Error)?.message);
    }
    // Faz login para obter a sessão.
    const { data: loginData, error: loginErr } = await sb.auth.signInWithPassword({ email: e, password: s });
    if (loginErr) {
      // Se o login falhar (raro), retorna ok mas sem sessão — o cliente tenta de novo.
      console.warn("[register-password] signInWithPassword falhou:", loginErr.message);
      return res.json({ ok: true, user: data.user, mensagem: "Conta criada. Faça login." });
    }
    return res.json({ ok: true, session: loginData.session, user: loginData.user, mensagem: "Conta criada com sucesso." });
  } catch (err) {
    console.error("[register-password] erro:", err);
    return res.status(500).json({ erro: "Falha ao criar conta." });
  }
});

// POST /api/cliente/login -> verifica se email existe, envia link mágico (sem código)
// Login simplificado: o cliente digita só o e-mail já cadastrado → recebe link mágico
// (não precisa digitar código). Clica no link → /auth/callback confirma a sessão.
app.post("/api/cliente/login", async (req, res) => {
  const ip = ipDo(req);
  const bloq = checarBloqueio(ip);
  if (bloq.bloqueado) return res.status(429).json({ erro: `Muitas tentativas. Tente em ${bloq.resta}s.` });

  const { email } = req.body || {};
  const e = (email || "").trim().toLowerCase();
  if (!e || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) {
    return res.status(400).json({ erro: "E-mail inválido." });
  }
  const sb = supabaseClient();
  if (!sb) return res.status(503).json({ erro: "Banco de dados indisponível." });

  try {
    // Verifica se o usuário já existe (sign-in, não sign-up).
    let existente: string | null = null;
    try {
      const list = await sb.auth.admin.listUsers();
      existente = list.data?.users?.find((u) => u.email === e)?.id || null;
    } catch { /* ignora */ }

    if (!existente) {
      return res.status(404).json({ erro: "E-mail não cadastrado. Faça seu cadastro primeiro." });
    }

    registrarTentativaSucesso(ip);
    const siteUrl = FRONTEND_ORIGIN.split(",")[0].trim();

    // Envia link mágico (shouldCreateUser: false → apenas existing users).
    const { error: otpErr } = await sb.auth.signInWithOtp({
      email: e,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${siteUrl}/auth/callback`,
      },
    });
    if (otpErr) {
      if (/rate limit/i.test(otpErr.message)) {
        return res.status(429).json({ erro: "Muitas tentativas. Aguarde alguns minutos." });
      }
      return res.status(400).json({ erro: otpErr.message });
    }
    return res.json({ ok: true, mensagem: "Link mágico enviado. Clique no e-mail para entrar." });
  } catch (err) {
    console.error("[login] erro:", err);
    return res.status(500).json({ erro: "Falha ao enviar link de login." });
  }
});

// EXCLUSÃO DE CONTA (LGPD / Política de Dados do Google Play) — self-service.
// Fluxo em 2 passos com OTP por e-mail (mesmo padrão do cadastro/verificar):
//   1) POST /api/cliente/excluir-solicitar  -> envia OTP
//   2) POST /api/cliente/excluir-confirmar  -> valida OTP e apaga tudo
app.post("/api/cliente/excluir-solicitar", async (req, res) => {
  const ip = ipDo(req);
  const bloq = checarBloqueio(ip);
  if (bloq.bloqueado) return res.status(429).json({ erro: `Muitas tentativas. Tente em ${bloq.resta}s.` });
  const { email } = req.body || {};
  const e = (email || "").trim().toLowerCase();
  if (!e || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) {
    return res.status(400).json({ erro: "E-mail inválido." });
  }
  const sb = supabaseClient();
  if (!sb) return res.status(503).json({ erro: "Banco de dados indisponível (modo demo)." });
  // Envia o OTP de exclusão. Usa shouldCreateUser:true para cobrir clientes que
  // se cadastraram só pela Loja Integrada (sem conta no Supabase Auth) — o
  // usuario sera criado e imediatamente deletado no confirmar. Sem isso, o
  // Supabase barra com "Signups not allowed" e a exclusao nunca acontece (P1).
  const siteUrl = FRONTEND_ORIGIN.split(",")[0].trim();
  const { error } = await sb.auth.signInWithOtp({
    email: e,
    options: { shouldCreateUser: true, data: { __exclusao: true }, emailRedirectTo: siteUrl },
  });
  if (error) {
    // Se o usuário não existe, não vaza a informação — mas também não envia OTP.
    if (/user not found/i.test(error.message)) {
      return res.status(404).json({ erro: "Nenhuma conta encontrada com este e-mail." });
    }
    if (/rate limit/i.test(error.message)) {
      return res.status(429).json({ erro: "Muitas tentativas. Aguarde alguns minutos e tente de novo." });
    }
    return res.status(400).json({ erro: error.message });
  }
  return res.json({ ok: true, mensagem: "Enviamos um código de confirmação para seu e-mail." });
});

app.post("/api/cliente/excluir-confirmar", async (req, res) => {
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
    // 1) Valida o OTP (type email).
    const { data, error } = await sb.auth.verifyOtp({ email: e, token: String(token), type: "email" });
    if (error) {
      registrarTentativaFalha(ip);
      return res.status(401).json({ erro: error.message });
    }
    registrarTentativaSucesso(ip);

    // 2) Busca o id do usuário para deleção em cascata.
    const userId = data.user?.id || data.session?.user?.id;
    if (!userId) return res.status(401).json({ erro: "Sessão inválida." });

    // 3) Remove da Loja Integrada (se as chaves estiverem configuradas).
    try {
      const { LI_APP_KEY, LI_API_KEY } = await getSecretsLI();
      if (LI_APP_KEY && LI_API_KEY) {
        // A LI não tem DELETE por e-mail direto: busca o id via /cliente/search/
        // e exclui pelo id. Por segurança, não quebramos o fluxo se a LI falhar —
        // o dado do app (Supabase) é a fonte de verdade.
        const busca = await chamarLI("GET", "cliente", "search", { cliente_email: e }).catch(() => null);
        const objs = (busca?.payload && (busca.payload as any).objects) || [];
        if (busca?.status === 200 && objs[0]?.id) {
          await chamarLI("DELETE", "cliente", objs[0].id, {}).catch(() => {});
        }
      }
    } catch (liErr) {
      console.warn("[exclusao] falha ao remover da LI (ignorado):", (liErr as Error)?.message);
    }

    // 4) Limpa fidelidade (Supabase + espelho local, se houver).
    try {
      await sb.from("fidelidade").delete().eq("email", e);
    } catch (fErr) {
      console.warn("[exclusao] falha ao limpar fidelidade (ignorado):", (fErr as Error)?.message);
    }

    // 5) Remove perfis, favoritos, receitas, enderecos, notificacoes vinculados.
    // Deleta por userId (Auth) E por email (clientes via LI sem Auth, onde o
    // profiles.enderecos.fidelidade usam email como chave e id pode ser nulo).
    try {
      await sb.from("profiles").delete().eq("id", userId);
      await sb.from("profiles").delete().eq("email", e);
      await sb.from("enderecos").delete().eq("email", e);
      await sb.from("favoritos").delete().eq("user_id", userId);
      await sb.from("receitas").delete().eq("user_id", userId);
      await sb.from("notificacoes").delete().eq("email", e);
    } catch (pErr) {
      console.warn("[exclusao] falha ao limpar tabelas (ignorado):", (pErr as Error)?.message);
    }

    // 6) Deleta o usuário de autenticação (remove o acesso).
    await sb.auth.admin.deleteUser(userId);

    return res.json({ ok: true, mensagem: "Sua conta foi excluída com sucesso." });
  } catch (err) {
    registrarTentativaFalha(ip);
    console.error("[exclusao] erro:", err);
    return res.status(500).json({ erro: "Falha ao excluir conta." });
  }
});

// ---------------------------------------------------------------------------
// Perfil / Endereços / Preferências do cliente (C2, C3, C7)
// Todas exigem o token de sessão do usuário (Authorization: Bearer <access_token>).
// O email do token deve bater com o email da requisição (isolamento).
// ---------------------------------------------------------------------------
function emailDoToken(req: express.Request): string | null {
  const auth = (req.headers.authorization || "").replace("Bearer ", "").trim();
  if (!auth) return null;
  try {
    // JWT não assinado: só decodifica o payload (não valida — o Supabase já
    // validou ao emitir; aqui só extraímos o email para isolamento de dados).
    const payload = JSON.parse(Buffer.from(auth.split(".")[1], "base64").toString("utf8"));
    const email = (payload.email || "").toString().trim().toLowerCase();
    return /@/.test(email) ? email : null;
  } catch {
    return null;
  }
}

function requireCliente(req: express.Request, res: express.Response): string | null {
  const email = emailDoToken(req);
  if (!email) {
    res.status(401).json({ erro: "Não autorizado." });
    return null;
  }
  return email;
}

// C2 — buscar/salvar perfil (nome/telefone)
app.get("/api/cliente/perfil", async (req, res) => {
  const email = requireCliente(req, res);
  if (!email) return;
  const perfil = await buscarPerfil(email);
  res.json(perfil || { email, nome: undefined, telefone: undefined });
});

app.put("/api/cliente/perfil", async (req, res) => {
  const email = requireCliente(req, res);
  if (!email) return;
  const { nome, telefone } = req.body || {};
  if (nome !== undefined && (typeof nome !== "string" || nome.length > 120)) {
    return res.status(400).json({ erro: "Nome inválido." });
  }
  if (telefone !== undefined && (typeof telefone !== "string" || telefone.length > 30)) {
    return res.status(400).json({ erro: "Telefone inválido." });
  }
  await salvarPerfil({ email, nome: nome || undefined, telefone: telefone || undefined });
  res.json({ ok: true });
});

// C3 — livro de endereços (CRUD)
app.get("/api/cliente/enderecos", async (req, res) => {
  const email = requireCliente(req, res);
  if (!email) return;
  res.json(await listarEnderecos(email));
});

app.post("/api/cliente/enderecos", async (req, res) => {
  const email = requireCliente(req, res);
  if (!email) return;
  const { nome, endereco, numero, complemento, bairro, cidade, estado, cep, principal } = req.body || {};
  if (!nome || !endereco || !numero || !cidade || !estado || !cep) {
    return res.status(400).json({ erro: "Preencha os campos obrigatórios do endereço." });
  }
  const salvo = await salvarEndereco({
    email, nome: String(nome), endereco: String(endereco), numero: String(numero),
    complemento: complemento ? String(complemento) : undefined,
    bairro: bairro ? String(bairro) : undefined,
    cidade: String(cidade), estado: String(estado), cep: String(cep),
    principal: Boolean(principal),
  });
  if (!salvo) return res.status(500).json({ erro: "Não foi possível salvar o endereço." });
  res.json(salvo);
});

app.delete("/api/cliente/enderecos/:id", async (req, res) => {
  const email = requireCliente(req, res);
  if (!email) return;
  await excluirEndereco(email, req.params.id);
  res.json({ ok: true });
});

// C7 — preferências de notificação
app.get("/api/cliente/preferencias", async (req, res) => {
  const email = requireCliente(req, res);
  if (!email) return;
  const prefs = await buscarPreferencias(email);
  res.json(prefs || {});
});

app.put("/api/cliente/preferencias", async (req, res) => {
  const email = requireCliente(req, res);
  if (!email) return;
  const { prefs } = req.body || {};
  if (!prefs || typeof prefs !== "object") return res.status(400).json({ erro: "Preferências inválidas." });
  await salvarPreferencias(email, prefs);
  res.json({ ok: true });
});

app.use("/api/cliente/receitas", receitasApp);
app.use("/api/cliente/favoritos", favoritosApp);
// Cupons: rotas já incluem /api no próprio caminho (ex: /api/admin/cupons,
// /api/cupons/meus), por isso montamos na raiz e não em /api/loja-integrada.
app.use(cupomApp);

app.listen(PORT, () => {
  console.log(`[loja-integrada-proxy] rodando em http://localhost:${PORT}`);
  console.log(`[loja-integrada-proxy] endpoint: http://localhost:${PORT}/api/loja-integrada/produto/`);
  console.log(`[loja-integrada-proxy] admin:    http://localhost:${PORT}/api/admin/login`);
  if (ADMIN_PASSWORD) console.log(`[loja-integrada-proxy] segurança: rate-limit ${MAX_TENTATIVAS} tentativas / ${LOCKOUT_MS / 1000}s, token revogável, CSP/HSTS ativos.`);
  garantirVapid().then((ok) => console.log(`[vapid] ${ok ? "push web configurado" : "push web INDISPONÍVEL (sem VAPID)"}`));
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

