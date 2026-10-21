// ---------------------------------------------------------------------------
// FAVORITOS — CRUD por cliente (user_id do Supabase Auth)
//
// SEGURANÇA: identidade derivada do token Bearer validado no Supabase Auth.
// Não aceitamos e-mail em query string/body (IDOR).
// ---------------------------------------------------------------------------
import { Router, type Request, type Response } from "express";
import { supabaseClient } from "./db";
import { requireClienteAuth, type ClienteAutenticado } from "./auth";

export const favoritosApp = Router();

favoritosApp.use(requireClienteAuth);

function clienteDe(req: Request): ClienteAutenticado {
  return (req as any).cliente as ClienteAutenticado;
}

// GET /api/cliente/favoritos
favoritosApp.get("/", async (req: Request, res: Response) => {
  const { userId } = clienteDe(req);

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
  const { userId } = clienteDe(req);
  const { produto_id, sku, nome, imagem, preco } = req.body || {};
  if (!produto_id) return res.status(400).json({ erro: "Produto obrigatório." });

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
  const { userId } = clienteDe(req);

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
