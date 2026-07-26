// API de cadastro/OTP do cliente + perfil/endereços/preferências (C2, C3, C7).

// ---------------------------------------------------------------------------
// Cadastro + Login OTP (Supabase Auth) — C5
// ---------------------------------------------------------------------------
function sbUrl(): string {
  return (import.meta.env.VITE_SUPABASE_URL as string | undefined) || "";
}

export async function cadastrarCliente(dados: {
  email: string;
  nome?: string;
  telefone?: string;
  cpf?: string;
  aceiteLgpd?: boolean;
}): Promise<{ ok: boolean; mensagem?: string }> {
  const r = await fetch(`/api/cliente/cadastro`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados),
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(json.erro || `Falha ao cadastrar (${r.status})`);
  return json;
}

export async function verificarOtp(
  email: string,
  token: string
): Promise<{ ok: boolean; session?: unknown; user?: unknown }> {
  const r = await fetch(`/api/cliente/verificar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, token }),
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(json.erro || `Código inválido (${r.status})`);
  return json;
}

// ---------------------------------------------------------------------------
// Perfil / Endereços / Preferências (C2, C3, C7)
// Todas as rotas exigem o access_token da sessão (Authorization Bearer).
// ---------------------------------------------------------------------------
function token(): string | null {
  try {
    return window.localStorage.getItem("dgriffe:cliente_token") || null;
  } catch {
    return null;
  }
}

async function authed<T>(path: string, init: RequestInit = {}): Promise<T> {
  const t = token();
  const res = await fetch(`/api/cliente${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`(${res.status}) ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

export interface PerfilCliente {
  email: string;
  nome?: string;
  telefone?: string;
}

export interface EnderecoCliente {
  id?: string;
  email: string;
  nome: string;
  endereco: string;
  numero: string;
  complemento?: string;
  bairro?: string;
  cidade: string;
  estado: string;
  cep: string;
  principal?: boolean;
}

export const clienteApi = {
  getPerfil: () => authed<PerfilCliente>("/perfil"),
  putPerfil: (nome?: string, telefone?: string) =>
    authed<{ ok: true }>("/perfil", { method: "PUT", body: JSON.stringify({ nome, telefone }) }),
  getEnderecos: () => authed<EnderecoCliente[]>("/enderecos"),
  postEndereco: (e: Omit<EnderecoCliente, "id" | "email">) =>
    authed<EnderecoCliente>("/enderecos", { method: "POST", body: JSON.stringify(e) }),
  deleteEndereco: (id: string) =>
    authed<{ ok: true }>(`/enderecos/${id}`, { method: "DELETE" }),
  getPreferencias: () => authed<Record<string, boolean>>("/preferencias"),
  putPreferencias: (prefs: Record<string, boolean>) =>
    authed<{ ok: true }>("/preferencias", { method: "PUT", body: JSON.stringify({ prefs }) }),
};

// Re-export para quem importa pelo nome (compatibilidade).
export { sbUrl };
