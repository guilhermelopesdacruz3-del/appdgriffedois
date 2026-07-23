// Cupons: criar, listar, enviar para usuários/grupos, validar, usar.
import express from "express";
import crypto from "node:crypto";
import { supabaseClient } from "./db.ts";

// Verificação do token de admin (mesmo HMAC do index.ts, mesma ADMIN_SECRET).
// Necessário aqui porque as rotas /api/admin/cupons vivem neste router.
const ADMIN_SECRET = process.env.ADMIN_SECRET || "altere-este-segredo-admin-num-environment";

function b64urlToBuf(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function verifyAdminToken(token: string): boolean {
  if (!token || !token.includes(".")) return false;
  const [payload, sig] = token.split(".");
  try {
    const expected = crypto.createHmac("sha256", ADMIN_SECRET).update(payload).digest();
    const got = b64urlToBuf(sig);
    if (expected.length !== got.length || !crypto.timingSafeEqual(expected, got)) return false;
    const data = JSON.parse(Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
    return typeof data.exp === "number" && data.exp >= Date.now();
  } catch {
    return false;
  }
}

function requireAdmin(req: any, res: any, next: any) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!verifyAdminToken(token)) return res.status(401).json({ erro: "Não autorizado." });
  next();
}


export interface Cupom {
  id: string;
  codigo: string;
  tipo: "percentual" | "fixo";
  valor: number;
  valor_minimo: number | null;
  max_usos: number | null;
  usos: number;
  data_inicio: string;
  data_fim: string;
  ativo: boolean;
  created_at: string;
  created_by: string | null;
  usuarios_count?: number;
}

export interface CupomUsuario {
  id: string;
  cupom_id: string;
  user_id: string;
  usado: boolean;
  usado_em: string | null;
  created_at: string;
}

export interface CupomValidacao {
  valido: boolean;
  erro?: string;
  cupom?: Cupom;
  atribuicao_id?: string;
}

function app() {
  const r = express.Router();
  const sb = supabaseClient();

  // Admin: criar cupom
  r.post("/api/admin/cupons", requireAdmin, async (req: any, res: any) => {
    try {
      const { codigo, tipo, valor, valor_minimo, max_usos, data_inicio, data_fim, destinatarios } = req.body || {};
      const creator = (req as any).admin?.email || null;
      if (!codigo || !tipo || valor == null || !data_inicio || !data_fim) {
        return res.status(400).json({ erro: "Campos obrigatórios: codigo, tipo, valor, data_inicio, data_fim." });
      }
      const { data: cupom, error: e1 } = await sb
        .from("cupons")
        .insert({
          codigo: String(codigo).trim().toUpperCase(),
          tipo,
          valor: Number(valor),
          valor_minimo: valor_minimo != null ? Number(valor_minimo) : null,
          max_usos: max_usos != null ? Number(max_usos) : null,
          data_inicio: new Date(data_inicio).toISOString(),
          data_fim: new Date(data_fim).toISOString(),
          created_by: creator,
        })
        .select("*")
        .single();
      if (e1) return res.status(500).json({ erro: e1.message });

      // Atribui a destinatários (se houver)
      const usuarios: string[] = Array.isArray(destinatarios) ? destinatarios : [];
      if (usuarios.length > 0) {
        const rows = usuarios.map((uid) => ({ cupom_id: cupom.id, user_id: uid }));
        const { error: e2 } = await sb.from("cupons_usuarios").insert(rows);
        if (e2) return res.status(500).json({ erro: e2.message });
      }

      return res.json({ cupom, atribuidos: usuarios.length });
    } catch (err) {
      console.error("[cupons] criar:", err);
      return res.status(500).json({ erro: "Falha ao criar cupom." });
    }
  });

  // Admin: listar cupons
  r.get("/api/admin/cupons", requireAdmin, async (_req: any, res: any) => {
    try {
      const { data, error } = await sb
        .from("cupons")
        .select("*, cupons_usuarios(count)")
        .order("created_at", { ascending: false });
      if (error) return res.status(500).json({ erro: error.message });
      const lista = (data || []).map((c: any) => ({
        ...c,
        usuarios_count: c.cupons_usuarios?.[0]?.count || 0,
      }));
      return res.json(lista);
    } catch (err) {
      console.error("[cupons] listar:", err);
      return res.status(500).json({ erro: "Falha ao listar cupons." });
    }
  });

  // Admin: enviar cupom a selecionados/grupo
  r.post("/api/admin/cupons/:id/enviar", requireAdmin, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { user_ids, grupo, emails } = req.body || {};
      const alvo: string[] = Array.isArray(user_ids) ? [...user_ids] : [];

      // Emails -> user_id (permite envio seletivo por e-mail do cliente)
      if (Array.isArray(emails) && emails.length > 0) {
        const { data: perfis } = await sb
          .from("profiles")
          .select("id,email")
          .in("email", emails.map((e: string) => String(e).trim().toLowerCase()));
        for (const p of perfis || []) alvo.push(p.id);
      }

      if (grupo === "todos") {
        const { data: users } = await sb.from("profiles").select("id");
        alvo.push(...(users || []).map((u: any) => u.id));
      } else if (grupo === "vip") {
        const { data: regras } = await sb.from("fidelidade").select("id").limit(1);
        if (regras && regras.length > 0) {
          const { data: perfis } = await sb
            .from("profiles")
            .select("id,email");
          for (const p of perfis || []) {
            const { data: fid } = await sb
              .from("fidelidade")
              .select("pontos")
              .eq("email", p.email)
              .maybeSingle();
            if ((fid?.pontos || 0) >= 500) alvo.push(p.id);
          }
        }
      }

      const unique = [...new Set(alvo)];
      if (unique.length === 0) return res.status(400).json({ erro: "Nenhum destinatário." });
      const rows = unique.map((uid) => ({ cupom_id: id, user_id: uid }));
      const { error } = await sb.from("cupons_usuarios").upsert(rows, { onConflict: "cupom_id,user_id" });
      if (error) return res.status(500).json({ erro: error.message });
      return res.json({ atribuidos: rows.length });
    } catch (err) {
      console.error("[cupons] enviar:", err);
      return res.status(500).json({ erro: "Falha ao enviar cupom." });
    }
  });

  // Front: meus cupons (requer auth)
  r.get("/api/cupons/meus", async (req: any, res: any) => {
    try {
      const auth = req.headers.authorization || "";
      const token = auth.replace("Bearer ", "");
      if (!token) return res.status(401).json({ erro: "Token não informado." });
      const { data: { user } } = await sb.auth.getUser(token);
      if (!user) return res.status(401).json({ erro: "Sessão inválida." });

      const { data, error } = await sb
        .from("cupons_usuarios")
        .select("*, cupons(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) return res.status(500).json({ erro: error.message });
      return res.json((data || []).map((r: any) => ({ ...r.cupons, atribuicao_id: r.id, usado: r.usado, usado_em: r.usado_em })));
    } catch (err) {
      console.error("[cupons] meus:", err);
      return res.status(500).json({ erro: "Falha ao carregar cupons." });
    }
  });

  // Front/admin: validar cupom por código
  r.get("/api/cupons/validar/:codigo", async (req: any, res: any) => {
    try {
      const codigo = String(req.params.codigo || "").trim().toUpperCase();
      const { data, error } = await sb
        .from("cupons")
        .select("*")
        .eq("codigo", codigo)
        .eq("ativo", true)
        .maybeSingle();
      if (error) return res.status(500).json({ erro: error.message });
      if (!data) return res.json({ valido: false, erro: "Cupom não encontrado." } as CupomValidacao);
      if (new Date(data.data_fim) < new Date()) return res.json({ valido: false, erro: "Cupom expirado." } as CupomValidacao);
      if ((data.max_usos != null && data.usos >= data.max_usos)) return res.json({ valido: false, erro: "Cupom esgotado." } as CupomValidacao);

      // Se for atribuído a usuários, checar se o usuário atual tem direito
      const auth = req.headers.authorization || "";
      const token = auth.replace("Bearer ", "");
      if (token) {
        const { data: { user } } = await sb.auth.getUser(token);
        if (user) {
          const { data: attr } = await sb
            .from("cupons_usuarios")
            .select("id,usado,usado_em")
            .eq("cupom_id", data.id)
            .eq("user_id", user.id)
            .maybeSingle();
          if (!attr) return res.json({ valido: false, erro: "Cupom não atribuído a você." } as CupomValidacao);
          if (attr.usado) return res.json({ valido: false, erro: "Cupom já utilizado." } as CupomValidacao);
          return res.json({ valido: true, cupom: data, atribuicao_id: attr.id } as CupomValidacao);
        }
      }
      return res.json({ valido: true, cupom: data, atribuicao_id: null } as CupomValidacao);
    } catch (err) {
      console.error("[cupons] validar:", err);
      return res.status(500).json({ valido: false, erro: "Falha ao validar cupom." } as CupomValidacao);
    }
  });

  // Usar cupom (checkout/backend)
  r.post("/api/cupons/:id/usar", async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { discount } = req.body || {};
      const cupom_id = id;

      // Marcar usado no cupons_usuarios se houver atribuição
      const auth = req.headers.authorization || "";
      const token = auth.replace("Bearer ", "");
      if (token) {
        const { data: { user } } = await sb.auth.getUser(token);
        if (user) {
          const { data: attr } = await sb
            .from("cupons_usuarios")
            .select("id")
            .eq("cupom_id", cupom_id)
            .eq("user_id", user.id)
            .eq("usado", false)
            .maybeSingle();
          if (attr) {
            const { error } = await sb.from("cupons_usuarios").update({ usado: true, usado_em: new Date().toISOString() }).eq("id", attr.id);
            if (error) return res.status(500).json({ erro: error.message });
          }
        }
      }

      const { error } = await sb.rpc("incrementar_usos_cupom", { cupom_id });
      if (error) return res.status(500).json({ erro: error.message });

      return res.json({ ok: true, desconto: Number(discount || 0) });
    } catch (err) {
      console.error("[cupons] usar:", err);
      return res.status(500).json({ erro: "Falha ao usar cupom." });
    }
  });

  return r;
}

export default app();
