import type { Favorito } from "../types";

const API = `${import.meta.env.VITE_API_URL || ""}/api/cliente/favoritos`;

export async function getFavoritos(email: string): Promise<Favorito[]> {
  const res = await fetch(`${API}?email=${encodeURIComponent(email)}`);
  if (!res.ok) throw new Error();
  const j = await res.json();
  return j.favoritos ?? [];
}

export async function criarFavorito(email: string, produto_id: number, nome: string, imagem?: string | null, preco?: number | null, sku?: string | null) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, produto_id, nome, imagem, preco, sku }),
  });
  if (!res.ok) throw new Error();
  return res.json();
}

export async function apagarFavorito(id: string, email: string) {
  const res = await fetch(`${API}/${encodeURIComponent(id)}?email=${encodeURIComponent(email)}`, { method: "DELETE" });
  if (!res.ok) throw new Error();
  return res.json();
}

export async function checarFavorito(email: string, produto_id: number): Promise<boolean> {
  const res = await fetch(`${API}/checar?email=${encodeURIComponent(email)}&produto_id=${produto_id}`);
  if (!res.ok) throw new Error();
  const j = await res.json();
  return j.favorito === true;
}
