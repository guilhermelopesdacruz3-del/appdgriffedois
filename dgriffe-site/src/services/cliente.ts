const CLIENTE_TOKEN_KEY = 'dgriffe:cliente_token';
const CLIENTE_REFRESH_KEY = 'dgriffe:cliente_refresh';
const CLIENTE_EMAIL_KEY = 'dgriffe:cliente_email';

interface Session {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
}

export interface Cliente {
  id: string;
  email: string;
  nome?: string;
  telefone?: string;
  cpf?: string;
}

// --- Token management ---

export function setClienteSession(session: Session) {
  localStorage.setItem(CLIENTE_TOKEN_KEY, session.access_token);
  if (session.refresh_token) {
    localStorage.setItem(CLIENTE_REFRESH_KEY, session.refresh_token);
  }
}

export function getClienteToken(): string | null {
  return localStorage.getItem(CLIENTE_TOKEN_KEY);
}

export function getClienteRefreshToken(): string | null {
  return localStorage.getItem(CLIENTE_REFRESH_KEY);
}

export function getClienteEmail(): string | null {
  return localStorage.getItem(CLIENTE_EMAIL_KEY);
}

export function isClienteLogado(): boolean {
  return !!getClienteToken();
}

export function logoutCliente() {
  localStorage.removeItem(CLIENTE_TOKEN_KEY);
  localStorage.removeItem(CLIENTE_REFRESH_KEY);
  localStorage.removeItem(CLIENTE_EMAIL_KEY);
}

// --- API calls ---

const API_BASE = import.meta.env.VITE_API_URL || 'https://appdgriffedois.onrender.com';

async function api<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as any).erro || `API ${res.status}`);
  }
  return body as T;
}

// Cadastro: envia OTP por e-mail
export async function cadastrarCliente(data: {
  email: string;
  nome: string;
  telefone?: string;
  cpf?: string;
}): Promise<{ ok: boolean; mensagem?: string }> {
  return api('/api/cliente/cadastro', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Verificar OTP: valida código de 6 dígitos e retorna sessão
export async function verificarOtp(data: {
  email: string;
  token: string;
}): Promise<{ ok: boolean; session: Session; user: Cliente }> {
  return api('/api/cliente/verificar', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Login: envia OTP por e-mail (mesmo que cadastro, mas sem dados extras)
export async function loginCliente(email: string): Promise<{ ok: boolean; mensagem?: string }> {
  return api('/api/cliente/login', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

// Renovar sessão com refresh_token
export async function renovarSessao(refreshToken: string): Promise<{ ok: boolean; session: Session }> {
  return api('/api/cliente/renovar', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}

// Dados do cliente logado (usa token no header Authorization)
export async function getCliente(): Promise<{ ok: boolean; cliente: Cliente }> {
  const token = getClienteToken();
  if (!token) throw new Error('Não autenticado');
  return api('/api/cliente/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
}
