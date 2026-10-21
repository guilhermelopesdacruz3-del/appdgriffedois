// Logger estruturado para o backend D'Griffe.
// Substitui console.* espalhado: nível + timestamp + contexto.
// Grava em stdout + arquivo local + tabela admin_logs (Supabase, se configurado).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { supabaseClient } from "./db";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.join(__dirname, "logs");
const LOG_FILE = path.join(LOG_DIR, "app.log");

type Nivel = "INFO" | "WARN" | "ERROR" | "AUDIT";

// Mapeia nível interno para o usado na tabela.
const NIVEL_TABELA: Record<Nivel, string> = {
  INFO: "INFO",
  WARN: "WARN",
  ERROR: "ERROR",
  AUDIT: "AUDIT",
};

// ---------------------------------------------------------------------------
// Redação de PII/segredos. Logs não são lugar para e-mail, CPF, telefone,
// token ou corpo de requisição. Aplicamos tanto nas chaves do contexto quanto
// em textos livres (mensagens de erro de terceiros costumam ecoar e-mail).
// ---------------------------------------------------------------------------
const CAMPOS_SENSIVEIS = new Set([
  "email", "e_mail", "mail", "cpf", "cnpj", "telefone", "telefone_celular",
  "telefone_principal", "celular", "phone", "endereco", "logradouro",
  "senha", "password", "token", "access_token", "refresh_token",
  "authorization", "cookie", "set-cookie", "card", "card_token",
  "body", "req_body", "payer", "cliente", "admin", "admin_email",
]);

function mascararTexto(texto: string): string {
  return texto
    .replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, "[email]")
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[cpf]")
    .replace(/\b(?:\+?55\s?)?\(?\d{2}\)?\s?\d{4,5}-?\d{4}\b/g, "[telefone]")
    .replace(/\b[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g, "[token]");
}

function redigir(valor: unknown, profundidade = 0): unknown {
  if (valor === null || valor === undefined) return valor;
  if (typeof valor === "string") return mascararTexto(valor);
  if (typeof valor !== "object") return valor;
  if (profundidade > 4) return "[omitido]";
  if (Array.isArray(valor)) {
    return valor.slice(0, 20).map((item) => redigir(item, profundidade + 1));
  }
  const saida: Record<string, unknown> = {};
  for (const [chave, item] of Object.entries(valor as Record<string, unknown>)) {
    saida[chave] = CAMPOS_SENSIVEIS.has(chave.toLowerCase())
      ? "[redigido]"
      : redigir(item, profundidade + 1);
  }
  return saida;
}

async function gravarSupabase(nivel: Nivel, msg: string, ctx?: Record<string, unknown>) {
  try {
    const sb = supabaseClient();
    if (!sb) return; // Sem Supabase configurado → silencioso.
    await sb.from("admin_logs").insert({
      acao: mascararTexto(msg).slice(0, 200),
      nivel: NIVEL_TABELA[nivel],
      detalhes: ctx ? ctx : null,
      ip: (ctx?.ip as string) || null,
      // Placeholder fixo: admin_logs.admin_email é NOT NULL, mas não gravamos
      // PII. O ator administrativo pode ser identificado por outro meio.
      admin_email: "sistema",
    });
  } catch {
    /* falha de log não deve derrubar a requisição */
  }
}

function escrever(nivel: Nivel, msg: string, ctx?: Record<string, unknown>) {
  const ts = new Date().toISOString();
  const msgSeguro = mascararTexto(msg);
  const ctxSeguro = ctx ? (redigir(ctx) as Record<string, unknown>) : undefined;
  const linha = ctxSeguro
    ? `${ts} [${nivel}] ${msgSeguro} ${JSON.stringify(ctxSeguro)}`
    : `${ts} [${nivel}] ${msgSeguro}`;
  // stdout sempre (Render captura).
  if (nivel === "ERROR") console.error(linha);
  else if (nivel === "WARN") console.warn(linha);
  else console.log(linha);
  // Append em arquivo (best-effort, não bloqueia).
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, linha + "\n");
  } catch {
    /* ignora falha de disco */
  }
  // Gravação assíncrona no Supabase (não aguardada — não bloqueia a resposta).
  void gravarSupabase(nivel, msgSeguro, ctxSeguro);
}

export const log = {
  info: (msg: string, ctx?: Record<string, unknown>) => escrever("INFO", msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => escrever("WARN", msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => escrever("ERROR", msg, ctx),
  audit: (msg: string, ctx?: Record<string, unknown>) => escrever("AUDIT", msg, ctx),
};
