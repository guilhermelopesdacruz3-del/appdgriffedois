import { getResource, listResource, postResource } from "./client";
import { mapClienteParaApp, type ClienteApp } from "./mappers";
import type { LICliente } from "./types";

/**
 * Busca um cliente pelo e-mail — usado, por exemplo, para autenticar a área
 * "Minha Conta" a partir do e-mail que a pessoa usou na loja (junto de uma
 * validação própria de posse do e-mail/CPF, já que a Loja Integrada não
 * expõe login/senha do cliente final via essa API).
 */
export async function buscarClientePorEmail(email: string): Promise<ClienteApp | null> {
  const resposta = await listResource<LICliente>("cliente", { email, limit: 1 });
  const cliente = resposta.objects[0];
  return cliente ? mapClienteParaApp(cliente) : null;
}

export async function buscarClientePorCpf(cpf: string): Promise<ClienteApp | null> {
  const cpfLimpo = cpf.replace(/\D/g, "");
  const resposta = await listResource<LICliente>("cliente", { cpf: cpfLimpo, limit: 1 });
  const cliente = resposta.objects[0];
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
