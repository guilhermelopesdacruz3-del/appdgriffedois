// ---------------------------------------------------------------------------
// FAVORITOS — CRUD por cliente (user_id do Supabase Auth)
// ---------------------------------------------------------------------------
import { Router, type Request, type Response } from "express";
import { supabaseClient, getAuthUserByEmail } from "./db";

export const favoritosApp = Router();

async function resolveUserId(email: string): Promise<string | null> {
  const sb = supabaseClient();
  if (!sb) return null;
  try {
    const list = await sb.auth.admin.listUsers();
    const u = list.data?.users?.find((x) => x.email === email);
    return u?.id || null;
  } catch {
    return null;
  }
}

// GET /api/cliente/favoritos?email=...
favoritosApp.get("/", async (req: Request, res: Response) => {
  const email = String(req.query.email || "").trim().toLowerCase();
  if (!email) return res.status(400).json({ erro: "E-mail obrigatório." });

  const userId = await resolveUserId(email);
  if (!userId) return res.json({ ok: true, favoritos: [] });

  const sb = supabaseClient();
  if (!sb) return res.status(503).json({ erro: "Banco indisponível." });

  const { data, error } = await sb
    .from("favoritos")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[favoritos] erro:", error.message);
    return res.status(502).json({ erro: "Falha ao listar favoritos." });
  }

  return res.json({ ok: true, favoritos: data || [] });
});

// POST /api/cliente/favoritos
favoritosApp.post("/", async (req: Request, res: Response) => {
  const { email, produto_id, sku, nome, imagem, preco } = req.body || {};
  const e = String(email || "").trim().toLowerCase();
  if (!e || !produto_id) return res.status(400).json({ erro: "E-mail e produto obrigatórios." });

  const userId = await resolveUserId(e);
  if (!userId) return res.status(404).json({ erro: "Cliente não encontrado." });

  const sb = supabaseClient();
  if (!sb) return res.status(503).json({ erro: "Banco indisponível." });

  const { data, error } = await sb
    .from("favoritos")
    .insert({
      user_id: userId,
      produto_id: Number(produto_id),
      sku: sku || null,
      nome: String(nome || ""),
      imagem: imagem || null,
      preco: preco !== undefined ? Number(preco) : null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[favoritos] erro:", error.message);
    return res.status(502).json({ erro: "Falha ao favoritar." });
  }

  return res.status(201).json({ ok: true, favorito: data });
});

// DELETE /api/cliente/favoritos/:id
favoritosApp.delete("/:id", async (req: Request, res: Response) => {
  const email = String(req.query.email || "").trim().toLowerCase();
  if (!email) return res.status(400).json({ erro: "E-mail obrigatório." });

  const userId = await resolveUserId(email);
  if (!userId) return res.status(404).json({ erro: "Cliente não encontrado." });

  const sb = supabaseClient();
  if (!sb) return res.status(503).json({ erro: "Banco indisponível." });

  const { error } = await sb
    .from("favoritos")
    .delete()
    .eq("id", req.params.id)
    .eq("user_id", userId);

  if (error) {
    console.error("[favoritos] erro:", error.message);
    return res.status(502).json({ erro: "Falha ao remover favorito." });
  }

  return res.json({ ok: true });
});
