// ---------------------------------------------------------------------------
// RECEITAS SALVAS — CRUD por cliente (user_id do Supabase Auth)
// ---------------------------------------------------------------------------
import { Router, type Request, type Response } from "express";
import { supabaseClient, getAuthUserByEmail } from "./db";
import { DEMO, MOCK } from "./demo";

export const receitasApp = Router();

// Resolve user_id a partir do e-mail (igual fluxo de cadastro).
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

// GET /api/cliente/receitas?email=...
receitasApp.get("/", async (req: Request, res: Response) => {
  const email = String(req.query.email || "").trim().toLowerCase();
  if (!email) return res.status(400).json({ erro: "E-mail obrigatório." });

  if (DEMO || MOCK) {
    return res.json({ ok: true, receitas: [] });
  }

  const userId = await resolveUserId(email);
  if (!userId) return res.json({ ok: true, receitas: [] });

  const sb = supabaseClient();
  if (!sb) return res.status(503).json({ erro: "Banco indisponível." });

  const { data, error } = await sb
    .from("receitas")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[receitas] erro:", error.message);
    return res.status(502).json({ erro: "Falha ao listar receitas." });
  }

  return res.json({ ok: true, receitas: data || [] });
});

// POST /api/cliente/receitas
receitasApp.post("/", async (req: Request, res: Response) => {
  const { email, tipo, descricao, arquivo_url } = req.body || {};
  const e = String(email || "").trim().toLowerCase();
  if (!e) return res.status(400).json({ erro: "E-mail obrigatório." });
  const desc = String(descricao || "").trim();
  if (!desc) return res.status(400).json({ erro: "Descrição obrigatória." });

  if (DEMO || MOCK) {
    return res.status(201).json({ ok: true, receita: { id: "demo", user_id: "demo", email: e, tipo: tipo || "grau", descricao: desc, arquivo_url: arquivo_url || null, created_at: new Date().toISOString() } });
  }

  const userId = await resolveUserId(e);
  if (!userId) return res.status(404).json({ erro: "Cliente não encontrado." });

  const sb = supabaseClient();
  if (!sb) return res.status(503).json({ erro: "Banco indisponível." });

  const { data, error } = await sb
    .from("receitas")
    .insert({ user_id: userId, email: e, tipo: tipo || "grau", descricao: desc, arquivo_url: arquivo_url || null })
    .select("*")
    .single();

  if (error) {
    console.error("[receitas] erro:", error.message);
    return res.status(502).json({ erro: "Falha ao salvar receita." });
  }

  return res.status(201).json({ ok: true, receita: data });
});

// PUT /api/cliente/receitas/:id
receitasApp.put("/:id", async (req: Request, res: Response) => {
  const { email, tipo, descricao, arquivo_url } = req.body || {};
  const e = String(email || "").trim().toLowerCase();
  if (!e) return res.status(400).json({ erro: "E-mail obrigatório." });

  if (DEMO || MOCK) {
    return res.json({ ok: true });
  }

  const userId = await resolveUserId(e);
  if (!userId) return res.status(404).json({ erro: "Cliente não encontrado." });

  const sb = supabaseClient();
  if (!sb) return res.status(503).json({ erro: "Banco indisponível." });

  const updates: any = {};
  if (tipo !== undefined) updates.tipo = tipo;
  if (descricao !== undefined) updates.descricao = descricao;
  if (arquivo_url !== undefined) updates.arquivo_url = arquivo_url;

  const { data, error } = await sb
    .from("receitas")
    .update(updates)
    .eq("id", req.params.id)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) {
    console.error("[receitas] erro:", error.message);
    return res.status(502).json({ erro: "Falha ao atualizar receita." });
  }

  return res.json({ ok: true, receita: data });
});

// DELETE /api/cliente/receitas/:id
receitasApp.delete("/:id", async (req: Request, res: Response) => {
  const email = String(req.query.email || "").trim().toLowerCase();
  if (!email) return res.status(400).json({ erro: "E-mail obrigatório." });

  if (DEMO || MOCK) {
    return res.json({ ok: true });
  }

  const userId = await resolveUserId(email);
  if (!userId) return res.status(404).json({ erro: "Cliente não encontrado." });

  const sb = supabaseClient();
  if (!sb) return res.status(503).json({ erro: "Banco indisponível." });

  const { error } = await sb
    .from("receitas")
    .delete()
    .eq("id", req.params.id)
    .eq("user_id", userId);

  if (error) {
    console.error("[receitas] erro:", error.message);
    return res.status(502).json({ erro: "Falha ao apagar receita." });
  }

  return res.json({ ok: true });
});
