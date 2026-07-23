const BASE_URL =
  (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") ||
  "/api";

async function request<T>(path: string, opts: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  // As rotas de cupom estão montadas na raiz do backend (/api/admin/cupons,
  // /api/cupons/...), então a base é /api (não o proxy /api/loja-integrada).
  const token = opts.auth !== false ? sessionStorage.getItem("dg_admin_token") : null;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method: opts.method || "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (res.status === 401) sessionStorage.removeItem("dg_admin_token");
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Falha (${res.status}): ${txt.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export type Cupom = {
  id: string;
  codigo: string;
  tipo: "percentual" | "fixo";
  valor: number;
  valor_minimo: number | null;
  max_usos: number | null;
  usos: number;
  data_inicio: string;
  data_fim: string;
  ativo: boolean;
  created_at: string;
  created_by: string | null;
  usuarios_count?: number;
};

export type CupomUsuario = {
  id: string;
  cupom_id: string;
  user_id: string;
  usado: boolean;
  usado_em: string | null;
  created_at: string;
  codigo?: string;
  tipo?: string;
  valor?: number;
  data_fim?: string;
};

export async function criarCupom(dados: {
  codigo: string;
  tipo: "percentual" | "fixo";
  valor: number;
  valor_minimo?: number | null;
  max_usos?: number | null;
  data_inicio: string;
  data_fim: string;
  destinatarios?: string[];
}): Promise<Cupom> {
  return request<Cupom>("/api/admin/cupons", { method: "POST", body: dados });
}

export async function listarCupons(): Promise<Cupom[]> {
  return request<Cupom[]>("/api/admin/cupons");
}

export type EnviarCupomPayload = { user_ids?: string[]; grupo?: "todos" | "vip"; emails?: string[] };
export async function enviarCupom(id: string, dados: EnviarCupomPayload): Promise<{ atribuidos: number }> {
  return request<{ atribuidos: number }>(`/api/admin/cupons/${encodeURIComponent(id)}/enviar`, { method: "POST", body: dados });
}

export async function meusCupons(): Promise<CupomUsuario[]> {
  return request<CupomUsuario[]>("/api/cupons/meus", { auth: true });
}

export async function validarCupom(codigo: string): Promise<{
  valido: boolean;
  erro?: string;
  cupom?: Cupom;
  atribuicao_id?: string;
}> {
  return request(`/api/cupons/validar/${encodeURIComponent(codigo)}`);
}

export async function usarCupom(id: string, discount: number): Promise<{ ok: boolean; desconto: number }> {
  return request<{ ok: boolean; desconto: number }>(`/api/cupons/${encodeURIComponent(id)}/usar`, { method: "POST", body: { discount } });
}
