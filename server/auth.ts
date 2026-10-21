// Autenticação de cliente reutilizável pelos routers (receitas, favoritos etc.).
// A identidade vem SEMPRE do token validado no Supabase Auth — nunca de
// e-mail em query string ou body.
import type { NextFunction, Request, Response } from "express";
import { supabaseClient } from "./db";

export interface ClienteAutenticado {
  email: string;
  userId: string;
}

export async function autenticarCliente(req: Request): Promise<ClienteAutenticado | null> {
  const auth = (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  if (!auth) return null;

  const sb = supabaseClient();
  if (!sb) return null;

  try {
    const { data: { user }, error } = await sb.auth.getUser(auth);
    const email = (user?.email || "").trim().toLowerCase();
    if (error || !user || !email.includes("@")) return null;
    return { email, userId: user.id };
  } catch {
    return null;
  }
}

// Middleware: responde 401 e encerra se não houver sessão válida.
// Em caso de sucesso, disponibiliza `req.cliente = { email, userId }`.
export async function requireClienteAuth(req: Request, res: Response, next: NextFunction) {
  const cliente = await autenticarCliente(req);
  if (!cliente) {
    return res.status(401).json({ erro: "Sessão inválida ou ausente." });
  }
  (req as any).cliente = cliente;
  next();
}
