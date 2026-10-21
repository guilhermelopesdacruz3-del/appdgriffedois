import { mapClienteParaApp, type ClienteApp } from "./mappers";
import type { LICliente } from "./types";
import { obterTokenValido } from "../cliente";
import { LojaIntegradaError } from "./client";

/**
 * Dados do cliente na Loja Integrada.
 *
 * O proxy público `/api/loja-integrada/cliente` foi removido: ele permitia
 * consultar/alterar qualquer cliente pelo e-mail. Agora o backend expõe
 * `/api/cliente/loja`, autenticado, e resolve o e-mail pelo token — o
 * argumento `email` é mantido apenas por compatibilidade e é ignorado.
 */
const BASE =
  (import.meta.env.VITE_LOJA_INTEGRADA_PROXY_URL as string | undefined)
    ?.replace(/\/api\/loja-integrada\/?$/, "") || "";

async function clienteFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await obterTokenValido();
  if (!token) {
    throw new LojaIntegradaError("Faça login para acessar seus dados.", 401);
  }
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new LojaIntegradaError(`API ${res.status}: ${body.slice(0, 200)}`, res.status);
  }
  return (await res.json()) as T;
}

export async function buscarClientePorEmail(_email?: string): Promise<ClienteApp | null> {
  const resposta = await clienteFetch<{ objects: LICliente[] }>("/api/cliente/loja");
  const cliente = resposta.objects?.[0];
  return cliente ? mapClienteParaApp(cliente) : null;
}

export async function buscarClientePorId(id: number | string): Promise<ClienteApp> {
  const cliente = await clienteFetch<LICliente>(`/api/cliente/loja/${encodeURIComponent(String(id))}`);
  return mapClienteParaApp(cliente);
}
