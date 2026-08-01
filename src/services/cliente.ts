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

function expJwt(t: string): number {
  try {
    const p = t.split(".")[1];
    const d = JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof d.exp === "number" ? d.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

// Retorna um access_token válido, renovando com o refresh_token se o atual
// estiver expirado ou prestes a expirar (< 60s). Retorna null se não houver
// sessão ou a renovação falhar.
export async function obterTokenValido(): Promise<string | null> {
  const t = token();
  if (!t) return null;
  if (expJwt(t) > Date.now() + 60_000) return t;
  const rt = (() => {
    try { return window.localStorage.getItem("dgriffe:cliente_refresh_token") || null; } catch { return null; }
  })();
  if (!rt) return null;
  try {
    const res = await fetch(`/api/cliente/renovar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: rt }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.session?.access_token) return null;
    salvarSessaoLocal(json.session);
    return json.session.access_token;
  } catch {
    return null;
  }
}

function salvarSessaoLocal(sess: { access_token?: string; refresh_token?: string }): void {
  try {
    if (sess.access_token) window.localStorage.setItem("dgriffe:cliente_token", sess.access_token);
    if (sess.refresh_token) window.localStorage.setItem("dgriffe:cliente_refresh_token", sess.refresh_token);
  } catch { /* ignore */ }
}

async function authed<T>(path: string, init: RequestInit = {}): Promise<T> {
  const t = await obterTokenValido();
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
