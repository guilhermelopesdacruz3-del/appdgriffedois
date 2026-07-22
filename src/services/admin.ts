import type { LIPedido } from "./lojaIntegrada/types";
import { mapPedidoParaApp } from "./lojaIntegrada/mappers";

const TOKEN_KEY = "dg_admin_token";

// O proxy de admin usa URL RELATIVA (/api/admin) para que, em produção, a
// Netlify faça o proxy (netlify.toml: /api/* -> Render) sem problemas de CORS.
// Em dev, o Vite já redireciona /api para o backend local.
const ADMIN_BASE_URL: string = "/api/admin";

export function getAdminToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}
export function setAdminToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}
export function clearAdminToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

export class AdminError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AdminError";
    this.status = status;
  }
}

async function adminRequest<T>(
  path: string,
  opts: { method?: string; body?: unknown; auth?: boolean } = {}
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  const token = getAdminToken();
  if (opts.auth !== false && token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${ADMIN_BASE_URL}${path}`, {
    method: opts.method || "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 401) clearAdminToken();
    throw new AdminError(`Admin respondeu ${res.status}: ${body.slice(0, 200)}`, res.status);
  }
  return (await res.json()) as T;
}

export async function adminLogin(senha: string): Promise<void> {
  const data = await adminRequest<{ token: string }>("/login", {
    method: "POST",
    body: { senha },
    auth: false,
  });
  setAdminToken(data.token);
}

export interface AdminPedido {
  id: number;
  numero: string;
  cliente_nome: string;
  cliente_email: string;
  status: string;
  status_id?: number;
  status_uri?: string;
  data: string;
  total: number;
  items: number;
  verificado: boolean;
  verificado_em: string | null;
}

export interface ListarPedidosAdminResult {
  pedidos: AdminPedido[];
  total: number;
}

type PedidoComVerificacao = LIPedido & { verificado?: boolean; verificado_em?: string | null };

function mapAdminPedido(p: PedidoComVerificacao): AdminPedido {
  const base = mapPedidoParaApp(p);
  return {
    id: p.id,
    numero: p.numero,
    cliente_nome: p.cliente_nome,
    cliente_email: p.cliente_email,
    status: base.status,
    status_id: p.situacao?.id,
    status_uri: p.situacao?.resource_uri,
    data: base.date,
    total: base.total,
    items: base.items,
    verificado: Boolean(p.verificado),
    verificado_em: p.verificado_em || null,
  };
}

export async function listarPedidosAdmin(opts: {
  limit?: number;
  offset?: number;
  numero?: string;
  cliente_email?: string;
} = {}): Promise<ListarPedidosAdminResult> {
  const params = new URLSearchParams();
  if (opts.limit !== undefined) params.set("limit", String(opts.limit));
  if (opts.offset !== undefined) params.set("offset", String(opts.offset));
  if (opts.numero) params.set("numero", opts.numero);
  if (opts.cliente_email) params.set("cliente_email", opts.cliente_email);
  const qs = params.toString();
  const data = await adminRequest<{
    objects: PedidoComVerificacao[];
    meta: { total_count: number };
  }>(`/pedidos${qs ? `?${qs}` : ""}`);
  return {
    pedidos: (data.objects || []).map(mapAdminPedido),
    total: data.meta?.total_count ?? (data.objects || []).length,
  };
}

export async function buscarPedidoAdmin(id: number | string): Promise<PedidoComVerificacao> {
  return adminRequest<PedidoComVerificacao>(`/pedidos/${id}`);
}

export async function atualizarStatusPedido(
  id: number | string,
  situacao: string | number
): Promise<unknown> {
  return adminRequest(`/pedidos/${id}`, { method: "PUT", body: { situacao } });
}

export async function definirVerificadoPedido(
  id: number | string,
  verificado: boolean
): Promise<{ id: string; verificado: boolean; verificado_em: string | null }> {
  return adminRequest(`/pedidos/${id}/verificar`, { method: "POST", body: { verificado } });
}

// Revoga o token atual (logout server-side).
export async function adminLogout(): Promise<void> {
  await adminRequest("/logout", { method: "POST" });
  clearAdminToken();
}

// ---------------------------------------------------------------------------
// Relatórios e agregações (alimentam gráficos do painel)
// ---------------------------------------------------------------------------
export interface RelatorioAdmin {
  totalPedidos: number;
  faturamentoTotal: number;
  faturamentoAprovado: number;
  ticketMedio: number;
  porStatus: Record<string, number>;
  serieDiaria: { dia: string; count: number; total: number }[];
  porCanal: { site: number; app: number };
}

export async function relatorioAdmin(): Promise<RelatorioAdmin> {
  return adminRequest<RelatorioAdmin>("/relatorio");
}

export interface ClienteRelatorio {
  email: string;
  nome: string;
  pedidos: number;
  total: number;
}

export interface ListarClientesAdminResult {
  total: number;
  clientes: ClienteRelatorio[];
}

export async function listarClientesAdmin(): Promise<ListarClientesAdminResult> {
  return adminRequest<ListarClientesAdminResult>("/clientes");
}

export interface SituacaoPedido {
  id: number;
  codigo: string;
  nome: string;
  aprovado?: boolean;
  cancelado?: boolean;
  final?: boolean;
  resource_uri?: string;
}

export async function listarSituacoes(): Promise<SituacaoPedido[]> {
  return adminRequest<SituacaoPedido[]>("/situacoes");
}

export interface ClienteAdminDetalhe {
  cliente: any | null;
  pedidos: any[];
  fidelidade: { pontos: number; historico: any[] };
}

export async function buscarClienteAdmin(email: string): Promise<ClienteAdminDetalhe> {
  return adminRequest<ClienteAdminDetalhe>(`/cliente/${encodeURIComponent(email)}`);
}

export interface ListarLogsAdminResult {
  logs: Array<{
    id: number;
    admin_email: string;
    acao: string;
    detalhe?: Record<string, unknown> | null;
    ip?: string | null;
    created_at?: string;
  }>;
  total?: number;
}

export async function listarLogsAdmin(opts: {
  limit?: number;
  offset?: number;
  admin_email?: string;
  acao?: string;
  inicio?: string;
  fim?: string;
} = {}): Promise<ListarLogsAdminResult> {
  const params = new URLSearchParams();
  if (opts.limit !== undefined) params.set("limit", String(opts.limit));
  if (opts.offset !== undefined) params.set("offset", String(opts.offset));
  if (opts.admin_email) params.set("admin_email", opts.admin_email);
  if (opts.acao) params.set("acao", opts.acao);
  if (opts.inicio) params.set("inicio", opts.inicio);
  if (opts.fim) params.set("fim", opts.fim);
  const qs = params.toString();
  return adminRequest<ListarLogsAdminResult>(`/logs${qs ? `?${qs}` : ""}`);
}

export function pedidoParaCSV(pedidos: AdminPedido[]): string {
  const header = ["numero", "cliente", "email", "data", "status", "total", "itens", "verificado"];
  const linhas = pedidos.map((p) =>
    [
      p.numero,
      p.cliente_nome,
      p.cliente_email,
      p.data,
      p.status,
      p.total.toFixed(2),
      p.items,
      p.verificado ? "sim" : "nao",
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  );
  return [header.join(","), ...linhas].join("\n");
}
