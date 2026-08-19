// Logger estruturado para o backend D'Griffe.
// Substitui console.* espalhado: nível + timestamp + contexto.
// Em produção (Render) vai para stdout; localmente também append em arquivo.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.join(__dirname, "logs");
const LOG_FILE = path.join(LOG_DIR, "app.log");

type Nivel = "INFO" | "WARN" | "ERROR" | "AUDIT";

function escrever(nivel: Nivel, msg: string, ctx?: Record<string, unknown>) {
  const ts = new Date().toISOString();
  const linha = ctx ? `${ts} [${nivel}] ${msg} ${JSON.stringify(ctx)}` : `${ts} [${nivel}] ${msg}`;
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
}

export const log = {
  info: (msg: string, ctx?: Record<string, unknown>) => escrever("INFO", msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => escrever("WARN", msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => escrever("ERROR", msg, ctx),
  audit: (msg: string, ctx?: Record<string, unknown>) => escrever("AUDIT", msg, ctx),
};
