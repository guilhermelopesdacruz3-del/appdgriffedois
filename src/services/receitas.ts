import type { Receita } from "../types";

export async function getReceitas(email: string): Promise<Receita[]> {
  const base = (import.meta.env.VITE_LOJA_INTEGRADA_PROXY_URL as string | undefined)?.replace(/\/$/, "") || "";
  const res = await fetch(
    `${base}/api/cliente/receitas?email=${encodeURIComponent(email)}`,
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) throw new Error(`Falha ao carregar receitas (${res.status}).`);
  const json = (await res.json()) as { ok: boolean; receitas: Receita[] };
  return json.receitas || [];
}

export async function criarReceita(email: string, dados: {
  tipo?: string;
  descricao: string;
  arquivo_url?: string | null;
}): Promise<Receita> {
  const base = (import.meta.env.VITE_LOJA_INTEGRADA_PROXY_URL as string | undefined)?.replace(/\/$/, "") || "";
  const res = await fetch(`${base}/api/cliente/receitas`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, ...dados }),
  });
  if (!res.ok) throw new Error(`Falha ao salvar receita (${res.status}).`);
  const json = (await res.json()) as { ok: true; receita: Receita };
  return json.receita;
}

export async function atualizarReceita(
  id: string,
  email: string,
  dados: { tipo?: string; descricao?: string; arquivo_url?: string | null }
): Promise<Receita> {
  const base = (import.meta.env.VITE_LOJA_INTEGRADA_PROXY_URL as string | undefined)?.replace(/\/$/, "") || "";
  const res = await fetch(`${base}/api/cliente/receitas/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, ...dados }),
  });
  if (!res.ok) throw new Error(`Falha ao atualizar receita (${res.status}).`);
  const json = (await res.json()) as { ok: true; receita: Receita };
  return json.receita;
}

export async function apagarReceita(id: string, email: string): Promise<void> {
  const base = (import.meta.env.VITE_LOJA_INTEGRADA_PROXY_URL as string | undefined)?.replace(/\/$/, "") || "";
  const res = await fetch(
    `${base}/api/cliente/receitas/${encodeURIComponent(id)}?email=${encodeURIComponent(email)}`,
    { method: "DELETE", headers: { Accept: "application/json" } }
  );
  if (!res.ok) throw new Error(`Falha ao apagar receita (${res.status}).`);
}
