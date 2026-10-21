import type { Favorito } from "../types";
import { obterTokenValido } from "./cliente";

// URL relativa: em dev o Vite faz proxy /api -> localhost:8787;
// em produção (Cloudflare Pages) a Function encaminha /api/* -> Render.
const API = "/api/cliente/favoritos";

async function authHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  const token = await obterTokenValido();
  if (!token) throw new Error("Faça login para acessar seus favoritos.");
  return { ...extra, Authorization: `Bearer ${token}` };
}

export async function getFavoritos(_email?: string): Promise<Favorito[]> {
  const res = await fetch(API, { headers: await authHeaders() });
  if (!res.ok) throw new Error();
  const j = await res.json();
  return j.favoritos ?? [];
}

export async function criarFavorito(_email: string, produto_id: number, nome: string, imagem?: string | null, preco?: number | null, sku?: string | null) {
  const res = await fetch(API, {
    method: "POST",
    headers: await authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ produto_id, nome, imagem, preco, sku }),
  });
  if (!res.ok) throw new Error();
  return res.json();
}

export async function apagarFavorito(id: string, _email?: string) {
  const res = await fetch(`${API}/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error();
  return res.json();
}

export async function checarFavorito(_email: string, produto_id: number): Promise<boolean> {
  const res = await fetch(`${API}/checar?produto_id=${produto_id}`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error();
  const j = await res.json();
  return j.favorito === true;
}
