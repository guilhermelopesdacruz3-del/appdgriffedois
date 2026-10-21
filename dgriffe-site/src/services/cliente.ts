const CLIENTE_TOKEN_KEY = 'dgriffe:cliente_token';
const CLIENTE_REFRESH_KEY = 'dgriffe:cliente_refresh';

export interface Cliente {
  id: string;
  email: string;
  nome?: string;
  telefone?: string;
  cpf?: string;
}

export interface Session {
  access_token: string;
  refresh_token: string;
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

export function isClienteLogado(): boolean {
  return !!getClienteToken();
}

// Lê o e-mail do JWT do cliente para pré-preencher o checkout. Não valida a
// assinatura (quem valida é o servidor); serve só para conveniência da UI.
export function getClienteEmail(): string | null {
  const token = getClienteToken();
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof json?.email === "string" ? json.email : null;
  } catch {
    return null;
  }
}

export function logoutCliente() {
  localStorage.removeItem(CLIENTE_TOKEN_KEY);
  localStorage.removeItem(CLIENTE_REFRESH_KEY);
}

// --- API calls ---

import { API_BASE } from '../config';

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

// Login com e-mail + senha
export async function loginCliente(data: {
  email: string;
  senha: string;
}): Promise<{ ok: boolean; session: Session; user: Cliente; mensagem?: string }> {
  return api('/api/cliente/login-password', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Cadastro com e-mail + senha
export async function cadastrarCliente(data: {
  email: string;
  senha: string;
  nome: string;
  telefone?: string;
  cpf?: string;
}): Promise<{ ok: boolean; session?: Session; user?: Cliente; mensagem?: string }> {
  return api('/api/cliente/login-password', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Dados do cliente logado
export async function getCliente(): Promise<{ ok: boolean; cliente: Cliente }> {
  const token = getClienteToken();
  if (!token) throw new Error('Não autenticado');
  return api('/api/cliente/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
}
