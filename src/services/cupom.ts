const PROXY_BASE_URL: string =
  (import.meta.env.VITE_LOJA_INTEGRADA_PROXY_URL as string | undefined)?.replace(/\/$/, "") ||
  "/api/loja-integrada";

const BASE_URL: string =
  PROXY_BASE_URL.replace(/\/api\/loja-integrada\/?$/, "") + "/api";

async function request<T>(
  path: string,
  opts: { method?: string; body?: unknown; auth?: boolean } = {}
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  const token = opts.auth !== false ? localStorage.getItem("dg_admin_token") : null;
  if (token && !headers["Authorization"]) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method: opts.method || "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (res.status === 401) {
    localStorage.removeItem("dg_admin_token");
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Falha (${res.status}): ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

// ===== Cupons =====
export interface Cupom {
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
}

export interface CupomUsuario {
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
}

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
  return request<Cupom>("/admin/cupons", { method: "POST", body: dados });
}

export async function listarCupons(): Promise<Cupom[]> {
  return request<Cupom[]>("/admin/cupons");
}

export async function enviarCupom(
  id: string,
  dados: { user_ids?: string[]; grupo?: "todos" | "vip" }
): Promise<{ atribuidos: number }> {
  return request<{ atribuidos: number }>(`/admin/cupons/${id}/enviar`, {
    method: "POST",
    body: dados,
  });
}

export async function meusCupons(): Promise<CupomUsuario[]> {
  return request<CupomUsuario[]>("/cupons/meus", { auth: true });
}

export async function validarCupom(codigo: string): Promise<{
  valido: boolean;
  erro?: string;
  cupom?: Cupom;
  atribuicao_id?: string;
}> {
  const data = await request<{ valido: boolean; erro?: string; cupom?: Cupom; atribuicao_id?: string }>(
    `/cupons/validar/${encodeURIComponent(codigo)}`
  );
  return data;
}

export async function usarCupom(id: string, discount: number): Promise<{ ok: boolean; desconto: number }> {
  return request<{ ok: boolean; desconto: number }>(`/cupons/${id}/usar`, {
    method: "POST",
    body: { discount },
  });
}
