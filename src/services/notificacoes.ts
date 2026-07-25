const BASE = "/api";

async function req<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method || "GET",
    headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
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

export async function listarNotificacoes(email: string): Promise<{ notificacoes: Notificacao[]; naoLidas: number }> {
  return req(`/notificacoes?email=${encodeURIComponent(email)}`);
}

export async function marcarNotificacaoLida(email: string, id: string): Promise<void> {
  await req(`/notificacoes/${id}/lida?email=${encodeURIComponent(email)}`, { method: "POST" });
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
}): Promise<{ ok: boolean; enviadas: number; destinatarios: number }> {
  return req("/admin/notificar", { method: "POST", body: p });
}
