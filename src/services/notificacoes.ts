import { obterTokenValido } from "./cliente";

const BASE = "/api";

type AuthMode = "cliente" | "admin";

// Rotas de cliente usam o Bearer do cliente; apenas /api/admin/* usa o token
// de admin. Antes o token de admin era enviado em rotas de cliente (e o e-mail
// ia na query/body), o que permitia ler notificações de outras pessoas.
async function req<T>(
  path: string,
  opts: { method?: string; body?: unknown } = {},
  auth: AuthMode = "cliente"
): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (auth === "admin") {
    const tokenAdmin = (await import("./admin")).getAdminToken?.();
    if (tokenAdmin) headers["Authorization"] = `Bearer ${tokenAdmin}`;
  } else {
    const token = await obterTokenValido();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method || "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Notificações ${res.status}: ${txt.slice(0, 150)}`);
  }
  return (await res.json()) as T;
}

export interface Notificacao {
  id: string;
  email: string;
  titulo: string;
  corpo: string;
  tipo: "cupom" | "promocao" | "produto" | "carrinho" | "geral";
  lida: boolean;
  created_at: string;
}

export async function listarNotificacoes(): Promise<{ notificacoes: Notificacao[]; naoLidas: number }> {
  return req("/notificacoes");
}

export async function marcarNotificacaoLida(id: string): Promise<void> {
  await req(`/notificacoes/${encodeURIComponent(id)}/lida`, { method: "POST" });
}

export interface FiltrosNotificar {
  email?: string;
  nome?: string;
  pontosMin?: number;
}
export async function notificarClientesAdmin(p: {
  titulo: string;
  corpo: string;
  tipo: Notificacao["tipo"];
  filtros: FiltrosNotificar;
}): Promise<{ ok: boolean; enviadas: number; destinatarios: number; pushEnviados?: number }> {
  return req("/admin/notificar", { method: "POST", body: p }, "admin");
}

// --- Web Push ---
export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export async function getPushPublicKey(): Promise<string | null> {
  const r = await fetch(`${BASE}/notificacoes/push-config`);
  if (!r.ok) return null;
  const j = await r.json();
  return j?.publicKey || null;
}

export async function assinarPush(subscription: PushSubscriptionInput): Promise<void> {
  await req("/notificacoes/subscribe", { method: "POST", body: { subscription } });
}

export async function cancelarPush(endpoint: string): Promise<void> {
  await req("/notificacoes/unsubscribe", { method: "POST", body: { endpoint } });
}

export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}
