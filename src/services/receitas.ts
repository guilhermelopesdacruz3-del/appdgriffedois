import type { Receita } from "../types";
import { obterTokenValido } from "./cliente";

const camposOpticos = [
  "nome", "medico", "data_receita",
  "esf_od_longe", "cil_od_longe", "eixo_od_longe",
  "esf_oe_longe", "cil_oe_longe", "eixo_oe_longe",
  "esf_od_perto", "cil_od_perto", "eixo_od_perto",
  "esf_oe_perto", "cil_oe_perto", "eixo_oe_perto",
  "dip",
] as const;

export type DadosReceitaOptica = {
  [K in (typeof camposOpticos)[number]]?: string | number | null;
};

function baseUrl(): string {
  return (import.meta.env.VITE_LOJA_INTEGRADA_PROXY_URL as string | undefined)?.replace(/\/$/, "") || "";
}

// O backend identifica o titular pelo token. Nunca enviamos e-mail em query/body.
async function authHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  const token = await obterTokenValido();
  if (!token) throw new Error("Faça login para acessar suas receitas.");
  return { ...extra, Authorization: `Bearer ${token}` };
}

export async function getReceitas(_email?: string): Promise<Receita[]> {
  const res = await fetch(`${baseUrl()}/api/cliente/receitas`, {
    headers: await authHeaders({ Accept: "application/json" }),
  });
  if (!res.ok) throw new Error(`Falha ao carregar receitas (${res.status}).`);
  const json = (await res.json()) as { ok: boolean; receitas: Receita[] };
  return json.receitas || [];
}

export async function criarReceita(
  _email: string,
  dados: { tipo?: string; descricao: string; arquivo_url?: string | null } & DadosReceitaOptica
): Promise<Receita> {
  const res = await fetch(`${baseUrl()}/api/cliente/receitas`, {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json", Accept: "application/json" }),
    body: JSON.stringify(dados),
  });
  if (!res.ok) throw new Error(`Falha ao salvar receita (${res.status}).`);
  const json = (await res.json()) as { ok: true; receita: Receita };
  return json.receita;
}

export async function atualizarReceita(
  id: string,
  _email: string,
  dados: { tipo?: string; descricao?: string; arquivo_url?: string | null } & Partial<DadosReceitaOptica>
): Promise<Receita> {
  const res = await fetch(`${baseUrl()}/api/cliente/receitas/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: await authHeaders({ "Content-Type": "application/json", Accept: "application/json" }),
    body: JSON.stringify(dados),
  });
  if (!res.ok) throw new Error(`Falha ao atualizar receita (${res.status}).`);
  const json = (await res.json()) as { ok: true; receita: Receita };
  return json.receita;
}

export async function apagarReceita(id: string, _email?: string): Promise<void> {
  const res = await fetch(`${baseUrl()}/api/cliente/receitas/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: await authHeaders({ Accept: "application/json" }),
  });
  if (!res.ok) throw new Error(`Falha ao apagar receita (${res.status}).`);
}
