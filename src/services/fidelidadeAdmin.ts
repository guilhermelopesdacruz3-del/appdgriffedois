import { getAdminToken } from "./admin";

const ADMIN_BASE_URL = "/api/admin";

async function adminRequest<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  const token = getAdminToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${ADMIN_BASE_URL}${path}`, {
    method: opts.method || "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Admin respondeu ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export interface RegrasFidelidade {
  pontosPorReal: number;
  pontosPorDesconto: number;
}

export async function getRegrasFidelidadeAdmin(): Promise<RegrasFidelidade> {
  // Reusa o endpoint público de fidelidade (só leitura de regras).
  const email = "cliente@demo.com.br";
  const d = await (await fetch(`${ADMIN_BASE_URL.replace("/api/admin", "")}/api/fidelidade?email=${encodeURIComponent(email)}`)).json();
  return d.regras as RegrasFidelidade;
}

export async function ajustarPontosFidelidade(
  email: string,
  pontos: number,
  operacao: "creditar" | "resgatar" | "definir",
  motivo?: string
): Promise<{ ok: boolean; email: string; operacao: string; saldo: number }> {
  return adminRequest("/fidelidade/ajustar", {
    method: "POST",
    body: { email, pontos, operacao, motivo },
  });
}

export async function salvarRegrasFidelidadeAdmin(
  pontosPorReal: number,
  pontosPorDesconto: number
): Promise<{ ok: boolean; regras: RegrasFidelidade }> {
  return adminRequest("/fidelidade/regras", {
    method: "POST",
    body: { pontosPorReal, pontosPorDesconto },
  });
}
