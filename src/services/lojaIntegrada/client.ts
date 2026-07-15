import type { LIListResponse } from "./types";

/**
 * IMPORTANTE — por que existe um proxy:
 *
 * A Loja Integrada exige duas credenciais (chave_aplicacao + chave_api) que
 * identificam sua loja e SÃO SECRETAS. Este projeto é buildado como um único
 * arquivo HTML estático (vite-plugin-singlefile) que roda 100% no navegador
 * do visitante — qualquer coisa colocada aqui (inclusive variáveis VITE_*)
 * fica visível no "Ver código-fonte" da página. Por isso as chaves NUNCA
 * devem ser usadas diretamente neste arquivo.
 *
 * A solução é um pequeno backend/proxy (veja /server) que guarda as chaves
 * em variáveis de ambiente do servidor e repassa as chamadas para a Loja
 * Integrada. O front-end só conhece a URL pública desse proxy.
 *
 * Configure a URL do proxy no arquivo .env (veja .env.example):
 *   VITE_LOJA_INTEGRADA_PROXY_URL=https://seu-proxy.exemplo.com/api/loja-integrada
 */
const PROXY_BASE_URL: string =
  (import.meta.env.VITE_LOJA_INTEGRADA_PROXY_URL as string | undefined)?.replace(/\/$/, "") ||
  "/api/loja-integrada";

export class LojaIntegradaError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "LojaIntegradaError";
    this.status = status;
  }
}

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.append(key, String(value));
    }
  });
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

async function request<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined> = {},
  init: RequestInit = {}
): Promise<T> {
  const url = `${PROXY_BASE_URL}${path}${buildQuery(params)}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.headers || {}),
      },
    });
  } catch {
    throw new LojaIntegradaError(
      `Não foi possível conectar ao proxy da Loja Integrada em ${PROXY_BASE_URL}. Verifique se o serviço em /server está no ar e se VITE_LOJA_INTEGRADA_PROXY_URL está correto.`,
      0
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new LojaIntegradaError(
      `Loja Integrada respondeu ${response.status} para ${path}: ${body.slice(0, 300)}`,
      response.status
    );
  }

  return (await response.json()) as T;
}

/** GET de listagem paginada (produtos, clientes, pedidos, categorias, etc.) */
export function listResource<T>(
  resource: string,
  params: Record<string, string | number | boolean | undefined> = {}
): Promise<LIListResponse<T>> {
  return request<LIListResponse<T>>(`/${resource}/`, { limit: 20, offset: 0, ...params });
}

/** GET de um único recurso por id */
export function getResource<T>(
  resource: string,
  id: number | string,
  params: Record<string, string | number | boolean | undefined> = {}
): Promise<T> {
  return request<T>(`/${resource}/${id}/`, params);
}

/** POST genérico (ex.: criar cliente) */
export function postResource<T>(resource: string, payload: unknown): Promise<T> {
  return request<T>(`/${resource}/`, {}, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
