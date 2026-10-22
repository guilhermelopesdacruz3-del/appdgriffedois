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

// --- Renovação de sessão ---

// Renova a sessão com o refresh_token (o access_token do Supabase expira em
// ~1h). Retorna true se a nova sessão foi recebida e salva no localStorage.
export async function renovarSessao(): Promise<boolean> {
  const rt = getClienteRefreshToken();
  if (!rt) return false;
  try {
    const res = await fetch(`${API_BASE}/api/cliente/renovar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: rt }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body?.session?.access_token) return false;
    setClienteSession(body.session as Session);
    return true;
  } catch {
    return false;
  }
}

// Token pronto para uso: renova proativamente quando faltam <60s para expirar
// (evita 401 no meio do fluxo de compra) e devolve o token atual.
export async function obterTokenValido(): Promise<string | null> {
  const token = getClienteToken();
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    if (payload) {
      const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
      const exp = Number(json?.exp || 0);
      if (exp && Date.now() / 1000 > exp - 60) {
        await renovarSessao();
        return getClienteToken();
      }
    }
  } catch {
    /* payload ilegível: usa o token como está */
  }
  return token;
}

// --- API calls ---

import { API_BASE } from '../config';

async function api<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  if (res.status === 401 && path !== '/api/cliente/renovar' && getClienteRefreshToken()) {
    // Sessão expirada no servidor: renova uma vez e repete a chamada.
    if (await renovarSessao()) {
      const retryHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      Object.assign(retryHeaders, opts.headers as Record<string, string> | undefined);
      const novoToken = getClienteToken();
      if (novoToken) retryHeaders.Authorization = `Bearer ${novoToken}`;
      const retry = await fetch(`${API_BASE}${path}`, { ...opts, headers: retryHeaders });
      const retryBody = await retry.json().catch(() => ({}));
      if (!retry.ok) throw new Error((retryBody as any).erro || `API ${retry.status}`);
      return retryBody as T;
    }
  }
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
  aceiteLgpd?: boolean;
}): Promise<{ ok: boolean; session?: Session; user?: Cliente; mensagem?: string }> {
  return api('/api/cliente/login-password', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Dados do cliente logado
export async function getCliente(): Promise<{ ok: boolean; cliente: Cliente }> {
  const token = await obterTokenValido();
  if (!token) throw new Error('Não autenticado');
  return api('/api/cliente/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
}
