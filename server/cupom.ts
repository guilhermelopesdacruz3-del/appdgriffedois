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

// Cupom já validado no servidor, com o desconto calculado a partir do banco.
// O checkout NUNCA usa `tipo`/`valor` enviados pelo front.
export interface CupomCheckout {
  id: string;
  codigo: string;
  tipo: "percentual" | "fixo";
  valor: number;
  desconto: number;
}

function erroCheckout(mensagem: string): Error {
  return Object.assign(new Error(mensagem), { status: 400 });
}

async function perfilPorEmail(sb: any, email: string): Promise<{ id: string } | null> {
  const { data } = await sb.from("profiles").select("id").eq("email", email).limit(1).maybeSingle();
  return data?.id ? { id: data.id } : null;
}

// Valida um cupom para o checkout e devolve o desconto calculado no servidor.
// Regras: ativo, dentro da vigência, dentro do limite de usos, valor mínimo e,
// se o cupom foi atribuído a usuários específicos, exige login e atribuição
// não utilizada. Lança erro com status 400 quando inválido.
export async function validarCupomCheckout(
  codigo: string | undefined,
  email: string | undefined,
  subtotal: number
): Promise<CupomCheckout> {
  const code = String(codigo || "").trim().toUpperCase();
  if (!code) throw erroCheckout("Cupom inválido.");
  const sb = supabaseClient();
  if (!sb) throw erroCheckout("Não foi possível validar o cupom agora.");

  const { data, error } = await sb
    .from("cupons")
    .select("*")
    .eq("codigo", code)
    .eq("ativo", true)
    .maybeSingle();
  if (error) throw erroCheckout("Não foi possível validar o cupom agora.");
  if (!data) throw erroCheckout("Cupom não encontrado.");

  const agora = Date.now();
  if (data.data_inicio && new Date(data.data_inicio).getTime() > agora) {
    throw erroCheckout("Cupom ainda não está válido.");
  }
  if (data.data_fim && new Date(data.data_fim).getTime() < agora) {
    throw erroCheckout("Cupom expirado.");
  }
  if (data.max_usos != null && Number(data.usos || 0) >= Number(data.max_usos)) {
    throw erroCheckout("Cupom esgotado.");
  }
  if (data.valor_minimo != null && Number(subtotal) < Number(data.valor_minimo)) {
    throw erroCheckout(`Este cupom exige compra mínima de R$ ${Number(data.valor_minimo).toFixed(2)}.`);
  }

  // Cupom atribuído a destinatários específicos? Só o dono pode usar.
  const { count } = await sb
    .from("cupons_usuarios")
    .select("id", { count: "exact", head: true })
    .eq("cupom_id", data.id);
  if ((count || 0) > 0) {
    const e = String(email || "").trim().toLowerCase();
    if (!e) throw erroCheckout("Faça login para usar este cupom.");
    const perfil = await perfilPorEmail(sb, e);
    if (!perfil) throw erroCheckout("Cupom não atribuído a você.");
    const { data: attr } = await sb
      .from("cupons_usuarios")
      .select("id,usado")
      .eq("cupom_id", data.id)
      .eq("user_id", perfil.id)
      .maybeSingle();
    if (!attr) throw erroCheckout("Cupom não atribuído a você.");
    if (attr.usado) throw erroCheckout("Cupom já utilizado.");
  }

  const tipo: "percentual" | "fixo" = data.tipo === "percentual" ? "percentual" : "fixo";
  const valor = Number(data.valor) || 0;
  let desconto = tipo === "percentual" ? Number(subtotal) * (valor / 100) : valor;
  desconto = Math.min(Math.max(0, desconto), Number(subtotal));
  desconto = Number(desconto.toFixed(2));
  if (!(desconto > 0)) throw erroCheckout("Cupom sem desconto aplicável.");

  return { id: data.id, codigo: data.codigo, tipo, valor, desconto };
}

// Consome o cupom APÓS o pagamento aprovado (webhook/demo). O front não decide
// mais quando consumir. Idempotente para cupons atribuídos: se a atribuição já
// estava usada, não incrementa o contador de novo.
export async function consumirCupomCheckout(codigo: string | undefined, email?: string): Promise<void> {
  const code = String(codigo || "").trim().toUpperCase();
  if (!code) return;
  const sb = supabaseClient();
  if (!sb) return;

  const { data: cupom } = await sb.from("cupons").select("id,usos,max_usos").eq("codigo", code).maybeSingle();
  if (!cupom?.id) return;

  // Marca a atribuição como usada, quando existir. Se já estava usada, este
  // cupom já foi consumido — não incrementa de novo.
  if (email) {
    const perfil = await perfilPorEmail(sb, String(email).trim().toLowerCase());
    if (perfil) {
      const { data: attr } = await sb
        .from("cupons_usuarios")
        .select("id,usado")
        .eq("cupom_id", cupom.id)
        .eq("user_id", perfil.id)
        .maybeSingle();
      if (attr) {
        if (attr.usado) return;
        const { error: attrErr } = await sb
          .from("cupons_usuarios")
          .update({ usado: true, usado_em: new Date().toISOString() })
          .eq("id", attr.id);
        if (attrErr) {
          console.warn("[cupom] falha ao marcar atribuição como usada:", attrErr.message);
          return;
        }
      }
    }
  }

  // Incremento otimista: só atualiza se o valor de `usos` não mudou desde a
  // leitura. Evita estourar max_usos em duas confirmações simultâneas.
  const usosAtual = Number(cupom.usos || 0);
  if (cupom.max_usos != null && usosAtual >= Number(cupom.max_usos)) return;
  const { error } = await sb
    .from("cupons")
    .update({ usos: usosAtual + 1 })
    .eq("id", cupom.id)
    .eq("usos", usosAtual);
  if (error) console.warn("[cupom] falha ao incrementar usos:", error.message);
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
      const valorNum = Number(valor);
      if (!Number.isFinite(valorNum)) {
        return res.status(400).json({ erro: "Valor inválido — use número sem vírgula (ex: 10 ou 10.5)." });
      }
      const inicio = new Date(data_inicio);
      const fim = new Date(data_fim);
      if (isNaN(inicio.getTime()) || isNaN(fim.getTime())) {
        return res.status(400).json({ erro: "Data inválida — confira o início e o término." });
      }
      if (fim <= inicio) {
        return res.status(400).json({ erro: "O término deve ser depois do início." });
      }
      const minimoNum = valor_minimo != null ? Number(valor_minimo) : null;
      const maxUsosNum = max_usos != null ? Number(max_usos) : null;
      const { data: cupom, error: e1 } = await sb
        .from("cupons")
        .insert({
          codigo: String(codigo).trim().toUpperCase(),
          tipo,
          valor: valorNum,
          valor_minimo: minimoNum,
          max_usos: maxUsosNum,
          data_inicio: inicio.toISOString(),
          data_fim: fim.toISOString(),
          created_by: creator,
        })
        .select("*")
        .single();
      if (e1) {
        console.error("[cupons] criar (insert):", e1.message);
        const jaExiste = /duplicate key|already exists/i.test(e1.message);
        return res.status(500).json({ erro: jaExiste ? "Já existe um cupom com esse código." : `Falha ao criar o cupom: ${e1.message}` });
      }

      // Atribui a destinatários (se houver)
      const usuarios: string[] = Array.isArray(destinatarios) ? destinatarios : [];
      if (usuarios.length > 0) {
        const rows = usuarios.map((uid) => ({ cupom_id: cupom.id, user_id: uid }));
        const { error: e2 } = await sb.from("cupons_usuarios").insert(rows);
        if (e2) {
          console.error("[cupons] criar (atribuir):", e2.message);
          return res.status(400).json({ erro: "Cupom criado, mas um ou mais destinatários não existem." });
        }
      }

      return res.json({ cupom, atribuidos: usuarios.length });
    } catch (err) {
      console.error("[cupons] criar:", err);
      return res.status(500).json({ erro: "Falha ao criar cupom." });
    }
  });

  // Admin: listar cupons (apenas os ainda válidos — vencidos somem sozinhos)
  r.get("/api/admin/cupons", requireAdmin, async (_req: any, res: any) => {
    try {
      const { data, error } = await sb
        .from("cupons")
        .select("*, cupons_usuarios(count)")
        .gt("data_fim", new Date().toISOString())
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

      // Emails -> user_id (permite envio seletivo por e-mail do cliente).
      // Se o perfil ainda nao existir (cliente veio da Loja Integrada), criamos
      // o profiles + o Auth user para conseguir atribuir o cupom (opcao A).
      if (Array.isArray(emails) && emails.length > 0) {
        const norm = emails.map((e: string) => String(e).trim().toLowerCase()).filter(Boolean);
        const { data: perfis } = await sb
          .from("profiles")
          .select("id,email")
          .in("email", norm);
        const existentes = new Map((perfis || []).map((p: any) => [p.email, p.id]));
        for (const email of norm) {
          const existente = existentes.get(email);
          if (existente) { alvo.push(existente); continue; }
          // Cria o Auth user (sem senha, email ja confirmado) e o profiles.
          try {
            const { data: novoUser, error: uErr } = await sb.auth.admin.createUser({
              email,
              email_confirm: true,
              // Nao exige senha: o cliente faz login via OTP depois.
            });
            const uid = novoUser?.user?.id;
            if (uid && !uErr) {
              await sb.from("profiles").upsert({ id: uid, email, created_at: new Date().toISOString() });
              alvo.push(uid);
            } else if (uErr && /already been registered/i.test(uErr.message)) {
              // Usuario ja existe no Auth mas sem profiles — busca o id.
              const { data: list } = await sb.auth.admin.listUsers();
              const u = (list?.users || []).find((x: any) => x.email === email);
              if (u?.id) {
                await sb.from("profiles").upsert({ id: u.id, email, created_at: new Date().toISOString() });
                alvo.push(u.id);
              }
            }
          } catch (e) {
            console.warn("[cupons] falha ao criar usuário (e-mail omitido):", (e as Error)?.message);
          }
        }
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
        .select("*, cupons!inner(*)")
        .eq("user_id", user.id)
        .gt("cupons.data_fim", new Date().toISOString())
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

  // Consumo de cupom: agora é feito pelo servidor, após a confirmação do
  // pagamento (webhook). Esta rota pública permitia que qualquer pessoa
  // queimasse cupons de terceiros só com o id.
  r.post("/api/cupons/:id/usar", async (_req: any, res: any) => {
    return res.status(410).json({ erro: "O cupom é consumido automaticamente após a confirmação do pagamento." });
  });

  return r;
}

export default app();
