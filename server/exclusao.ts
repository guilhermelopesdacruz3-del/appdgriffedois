// OTP self-hosted para exclusão de conta (LGPD / Política de Dados do Google Play).
//
// Substitui o fluxo antigo (Supabase signInWithOtp → link mágico no template de
// e-mail), que dependia do link abrir no app. Agora:
//   1) geramos um código de 6 dígitos com crypto.randomInt (seguro)
//   2) guardamos SÓ o hash (HMAC-SHA256) no banco, com validade de 10 min
//   3) enviamos o e-mail pelo Resend contendo apenas o código + aviso de expiração
//   4) na confirmação, comparamos em tempo constante e apagamos o registro
//      (uso único). 5 tentativas erradas invalidam o código (força bruta).
//
// Os códigos ficam na tabela `otp_exclusao` (RLS habilitado, SEM policies —
// só o backend com service_role acessa; anon/authenticated não leem nem escrevem).

import crypto from "node:crypto";
import { supabaseClient, getSecret } from "./db.ts";
import { demoPermitido } from "./ambiente.ts";

export const CODIGO_VALIDADE_MS = 10 * 60 * 1000; // 10 minutos
export const CODIGO_TENTATIVAS_MAX = 5; // código errado >= 5x → invalidado
export const REENVIO_SEGUNDOS = 60; // cooldown entre envios

// ------------------------------------------------------------------
// Primitivas puras (testáveis) — usam secret do servidor, nunca saem.
// ------------------------------------------------------------------

// Segredo do HMAC: OTP_SALT se definido, senão ADMIN_SECRET (ambos server-only).
function segredoHash(): string {
  return process.env.OTP_SALT || process.env.ADMIN_SECRET || "";
}

/**
 * Hash HMAC-SHA256 do código vinculado ao e-mail (mesmo código com e-mail
 * diferente gera hash diferente — evita reuso entre contas).
 */
export function hashCodigo(codigo: string, email: string): string {
  const seg = segredoHash();
  if (!seg) throw new Error("segredo de OTP ausente (defina OTP_SALT ou ADMIN_SECRET)");
  return crypto.createHmac("sha256", seg).update(`${email.trim().toLowerCase()}:${codigo}`).digest("hex");
}

/** fail-closed: data inválida/ausente = expirado. */
export function expirou(expiraEm: unknown): boolean {
  const t = Date.parse(String(expiraEm || ""));
  if (!Number.isFinite(t)) return true;
  return Date.now() >= t;
}

/** Código de 6 dígitos cryptograficamente aleatório (100000–999999). */
export function gerarCodigo(): string {
  return String(crypto.randomInt(100000, 1000000)); // nunca começa com 0
}

function igualSeguro(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

// ------------------------------------------------------------------
// E-mail via Resend (API REST, sem dependências novas)
// ------------------------------------------------------------------

export async function enviarEmailCodigo(email: string, codigo: string): Promise<{ ok: boolean; erro?: string }> {
  // Chave: store_config primeiro (getSecret), env como fallback.
  const apiKey = (await getSecret("RESEND_API_KEY").catch(() => null)) || process.env.RESEND_API_KEY || "";
  if (!apiKey) return { ok: false, erro: "RESEND_API_KEY não configurada" };

  // "From" precisa ser um domínio VERIFICADO na Resend (cascata: env → config → sandbox).
  const from =
    process.env.RESEND_FROM ||
    (await getSecret("RESEND_FROM").catch(() => null)) ||
    "D'Griffe <onboarding@resend.dev>";
  // sandbox (onboarding@resend.dev) só entrega para o dono da conta Resend.

  const assunto = "Código para excluir sua conta — D'Griffe";
  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">` +
    `<p style="font-size:14px;margin:0 0 12px">Recebeu uma solicitação para <b>excluir sua conta</b> na D'Griffe.</p>` +
    `<p style="font-size:14px;margin:0 0 8px">Seu código de confirmação:</p>` +
    `<p style="font-size:34px;letter-spacing:8px;font-weight:bold;margin:12px 0;color:#111">${codigo}</p>` +
    `<p style="font-size:13px;color:#555;margin:0 0 12px">Este código <b>expira em 10 minutos</b> e só pode ser usado uma vez.</p>` +
    `<p style="font-size:13px;color:#555;margin:0">Se <b>você não</b> solicitou a exclusão, ignore este e-mail — sua conta não será afetada.</p>` +
    `</div>`;
  const texto =
    `Recebeu uma solicitacao para EXCLUIR SUA CONTA na D'Griffe.\n\n` +
    `Seu codigo de confirmacao: ${codigo}\n\n` +
    `Expira em 10 minutos e so pode ser usado uma vez.\n` +
    `Se voce NAO solicitou a exclusao, ignore este e-mail — sua conta nao sera afetada.`;

  let r: Response;
  try {
    r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [email], subject: assunto, html, text: texto }),
      signal: AbortSignal.timeout(15000),
    });
  } catch (errRede) {
    // Falha de rede/timeout da fetch JAMAIS pode derrubar a rota (Express 4
    // não captura promises rejeitadas → request pendura → proxy devolve 502).
    const e = errRede as { name?: string; message?: string };
    const timeout = e?.name === "TimeoutError" || e?.name === "AbortError";
    return { ok: false, erro: timeout ? "timeout ao contatar o Resend" : `falha de rede ao enviar e-mail: ${e?.message || "desconhecida"}` };
  }
  if (!r.ok) {
    const j: any = await r.json().catch(() => ({}));
    return { ok: false, erro: j?.message || `Resend respondeu ${r.status}` };
  }
  return { ok: true };
}

// ------------------------------------------------------------------
// Fluxo principal
// ------------------------------------------------------------------

/**
 * Gera um código novo, troca o anterior (não usado) e envia por e-mail.
 * Respeita cooldown de 60s entre envios para o mesmo e-mail.
 */
export async function solicitarCodigoExclusao(
  email: string
): Promise<{ status: "ok" | "cooldown" | "erro"; segundos?: number; erro?: string }> {
  const sb = supabaseClient();
  if (!sb) return { status: "erro", erro: "banco de dados indisponível" };
  const e = email.trim().toLowerCase();

  // Cooldown: código anterior criado há menos de REENVIO_SEGUNDOS.
  try {
    const { data: antigo } = await sb
      .from("otp_exclusao")
      .select("criado_em")
      .eq("email", e)
      .maybeSingle();
    const criadoEm = (antigo as any)?.criado_em as string | undefined;
    if (criadoEm) {
      const decorrido = (Date.now() - Date.parse(criadoEm)) / 1000;
      if (Number.isFinite(decorrido) && decorrido < REENVIO_SEGUNDOS) {
        return { status: "cooldown", segundos: Math.ceil(REENVIO_SEGUNDOS - decorrido) };
      }
    }
  } catch { /* sem cooldown → prossegue */ }

  // Up = substitui código anterior não utilizado (mesmo e-mail, 1 registro).
  const codigo = gerarCodigo();
  const agora = new Date();
  const { error: upErr } = await sb.from("otp_exclusao").upsert(
    {
      email: e,
      codigo_hash: hashCodigo(codigo, e),
      criado_em: agora.toISOString(),
      expira_em: new Date(agora.getTime() + CODIGO_VALIDADE_MS).toISOString(),
      tentativas: 0,
    },
    { onConflict: "email" }
  );
  if (upErr) {
    // 42P01 = tabela inexistente (SQL de criação ainda não rodou).
    if (upErr.message?.includes("otp_exclusao")) {
      return { status: "erro", erro: "tabela otp_exclusao não existe (aplique server/sql/otp_exclusao.sql)" };
    }
    return { status: "erro", erro: upErr.message || "falha ao registrar código" };
  }

  // Demo/local: não dispara e-mail real; o código aparece no log do servidor.
  if (demoPermitido()) {
    console.log(`[exclusao-otp] DEMO_MODE: código de exclusão para ${e}: ${codigo}`);
    return { status: "ok" };
  }

  const envio = await enviarEmailCodigo(e, codigo);
  if (!envio.ok) {
    // E-mail não saiu: apaga a linha para permitir nova tentativa imediata.
    try { await sb.from("otp_exclusao").delete().eq("email", e); } catch { /* ignore */ }
    return { status: "erro", erro: envio.erro || "falha ao enviar e-mail" };
  }
  return { status: "ok" };
}

/**
 * Valida o código e o consome (uso único). Motivos de falha explícitos:
 *  - "invalido": código errado (conta tentativa)
 *  - "expirado": passou dos 10 min (código descartado)
 *  - "bloqueado": 5+ erros seguidos (código invalidado por brute force)
 */
export async function confirmarCodigoExclusao(
  email: string,
  codigo: string
): Promise<{ ok: boolean; motivo?: "invalido" | "expirado" | "bloqueado"; erro?: string }> {
  const sb = supabaseClient();
  if (!sb) return { ok: false, motivo: "invalido", erro: "banco de dados indisponível" };
  const e = email.trim().toLowerCase();

  const { data, error } = await sb.from("otp_exclusao").select("*").eq("email", e).maybeSingle();
  if (error) return { ok: false, motivo: "invalido" };
  const reg = data as any;
  if (!reg) return { ok: false, motivo: "invalido" };

  // Força bruta: 5+ tentativas erradas → invalida e exige novo código.
  if ((Number(reg.tentativas) || 0) >= CODIGO_TENTATIVAS_MAX) {
    try { await sb.from("otp_exclusao").delete().eq("email", e); } catch { /* ignore */ }
    return { ok: false, motivo: "bloqueado" };
  }

  if (expirou(reg.expira_em)) {
    try { await sb.from("otp_exclusao").delete().eq("email", e); } catch { /* ignore */ }
    return { ok: false, motivo: "expirado" };
  }

  if (igualSeguro(String(reg.codigo_hash), hashCodigo(String(codigo), e))) {
    // Uso único: consome ANTES de prosseguir. Se o delete falhar, avisa —
    // mas NÃO valida duas vezes em fluxo normal.
    const del = await sb.from("otp_exclusao").delete().eq("email", e);
    if (del?.error) console.warn("[exclusao-otp] falha ao consumir código:", del.error.message);
    return { ok: true };
  }

  const novas = (Number(reg.tentativas) || 0) + 1;
  if (novas >= CODIGO_TENTATIVAS_MAX) {
    try { await sb.from("otp_exclusao").delete().eq("email", e); } catch { /* ignore */ }
    return { ok: false, motivo: "bloqueado" };
  }
  try { await sb.from("otp_exclusao").update({ tentativas: novas }).eq("email", e); } catch { /* ignore */ }
  return { ok: false, motivo: "invalido" };
}
