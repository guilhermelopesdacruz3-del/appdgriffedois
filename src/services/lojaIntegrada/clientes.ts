import { getResource, postResource, request } from "./client";
import { mapClienteParaApp, type ClienteApp } from "./mappers";
import type { LICliente } from "./types";

/**
 * Busca um cliente pelo e-mail usando o endpoint DEDICADO da Loja Integrada
 * (GET /cliente/busca/?email=...). O filtro em GET /cliente/?email= falha e
 * sempre retorna o primeiro cliente — por isso usamos /busca/ (doc oficial).
 */
export async function buscarClientePorEmail(email: string): Promise<ClienteApp | null> {
  const resposta = await request<{ objects: LICliente[] }>("/cliente/busca/", {
    email,
    limit: 1,
  });
  const cliente = resposta.objects?.[0];
  return cliente ? mapClienteParaApp(cliente) : null;
}

export async function buscarClientePorCpf(cpf: string): Promise<ClienteApp | null> {
  const cpfLimpo = cpf.replace(/\D/g, "");
  const resposta = await request<{ objects: LICliente[] }>("/cliente/busca/", {
    cpf: cpfLimpo,
    limit: 1,
  });
  const cliente = resposta.objects?.[0];
  return cliente ? mapClienteParaApp(cliente) : null;
}

export async function buscarClientePorId(id: number | string): Promise<ClienteApp> {
  const cliente = await getResource<LICliente>("cliente", id);
  return mapClienteParaApp(cliente);
}

export interface NovoClientePayload {
  nome: string;
  email: string;
  cpf?: string;
  telefone_celular?: string;
  tipo?: "PF" | "PJ";
}

/** Cria um novo cliente na Loja Integrada (ex.: cadastro feito neste site). */
export async function criarCliente(payload: NovoClientePayload): Promise<ClienteApp> {
  const cliente = await postResource<LICliente>("cliente", payload);
  return mapClienteParaApp(cliente);
}
