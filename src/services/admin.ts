import type { LIPedido } from "./lojaIntegrada/types";
import { mapPedidoParaApp } from "./lojaIntegrada/mappers";
import {
  getAdminToken as getCookieAdminToken,
  setAdminToken as setCookieAdminToken,
  clearAdminToken as deleteCookieAdminToken,
} from "../utils/cookies";

const ADMIN_BASE_URL: string = "/api/admin";

export function getAdminToken(): string | null {
  return getCookieAdminToken();
}
export function setAdminToken(token: string): void {
  setCookieAdminToken(token);
}
export function clearAdminToken(): void {
  deleteCookieAdminToken();
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
  cliente_cpf: string | null;
  cliente_telefone: string | null;
  cliente_endereco: string | null;
  status: string;
  status_id?: number;
  status_uri?: string;
  data: string;
  total: number;
  items: number;
  itens: Array<{
    nome: string;
    quantidade: number;
    preco_venda: number;
    sku: string;
    variacao?: string | null;
  }>;
  pagamento?: string | null;
  pagamento_status?: string | null;
  envio?: string | null;
  envio_status?: string | null;
  envio_rastreio?: string | null;
  endereco_entrega?: string | null;
  pagamento_detalhes?: string | null;
  observacoes?: string | null;
  forma_entrega?: "retirada" | "entrega";
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
  const itens = (p.itens || []).map((it) => ({
    nome: it.nome || "",
    quantidade: Number(it.quantidade) || 0,
    preco_venda: Number(it.preco_venda) || 0,
    sku: it.sku || "",
    variacao: it.variacao || null,
  }));
  const pagamento = p.pagamentos?.[0];
  const envio = p.envios?.[0];
  const endEntrega = p.endereco_entrega as
    | { endereco?: string; numero?: string; bairro?: string; cidade?: string; estado?: string; cep?: string; nome?: string }
    | null
    | undefined;
  const enderecoLoja = /d'griffe/i.test(endEntrega?.nome || "") && endEntrega?.bairro === "Bela Vista";
  return {
    id: (p as any).id_api ?? p.id,
    numero: p.numero,
    cliente_nome: p.cliente_nome,
    cliente_email: p.cliente_email,
    cliente_cpf: p.cliente_cpf ?? null,
    cliente_telefone: p.cliente_telefone ?? null,
    cliente_endereco: endEntrega
      ? [endEntrega.endereco, endEntrega.numero, endEntrega.bairro, endEntrega.cidade, endEntrega.estado].filter(Boolean).join(", ")
      : null,
    status: base.status,
    status_id: p.situacao?.id,
    status_uri: p.situacao?.resource_uri,
    data: base.date,
    total: base.total,
    items: base.items,
    itens,
    pagamento: pagamento?.forma_pagamento?.nome ?? null,
    pagamento_status: pagamento?.status ?? null,
    pagamento_detalhes: pagamento
      ? [
          pagamento.valor ? `R$ ${Number(pagamento.valor).toFixed(2)}` : null,
          pagamento.parcelamento_numero_parcelas ? `${pagamento.parcelamento_numero_parcelas}x` : null,
          pagamento.bandeira ?? null,
          pagamento.pix_code ? "PIX" : null,
        ].filter(Boolean).join(" · ")
      : null,
    envio: envio?.forma_envio?.nome ?? null,
    envio_status: envio?.status ?? null,
    envio_rastreio: envio?.objeto ?? null,
    endereco_entrega: endEntrega
      ? `${endEntrega.endereco}, ${endEntrega.numero} — ${endEntrega.bairro}, ${endEntrega.cidade}/${endEntrega.estado} ${endEntrega.cep}`
      : null,
    observacoes: (p as any).cliente_obs || null,
    forma_entrega: endEntrega && !enderecoLoja ? "entrega" : "retirada",
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
  serieDiaria: { dia: string; count: number; total: number; totalAprovado?: number }[];
  porCanal: { site: number; app: number };
}

export async function relatorioAdmin(): Promise<RelatorioAdmin> {
  return adminRequest<RelatorioAdmin>("/relatorio");
}

export interface ClienteRelatorio {
  email: string;
  nome: string;
  pontos?: number;
  pedidos?: number;
  total?: number;
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

export interface ReceitaAdmin {
  id: string;
  email: string;
  nome: string | null;
  medico: string | null;
  data_receita: string | null;
  tipo: string;
  descricao: string;
  esf_od_longe: number | null;
  cil_od_longe: number | null;
  eixo_od_longe: number | null;
  esf_oe_longe: number | null;
  cil_oe_longe: number | null;
  eixo_oe_longe: number | null;
  esf_od_perto: number | null;
  cil_od_perto: number | null;
  eixo_od_perto: number | null;
  esf_oe_perto: number | null;
  cil_oe_perto: number | null;
  eixo_oe_perto: number | null;
  dip: number | null;
  created_at: string;
}

export async function listarReceitasAdmin(): Promise<{ total: number; receitas: ReceitaAdmin[] }> {
  return adminRequest<{ ok: boolean; receitas: ReceitaAdmin[] }>("/receitas").then((r) => ({
    total: r.receitas?.length || 0,
    receitas: r.receitas || [],
  }));
}
