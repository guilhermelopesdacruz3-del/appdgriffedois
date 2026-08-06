// Entry do build: carrega o .env ANTES de qualquer módulo que leia process.env
// (ex.: db.ts cria o client do Supabase no import). O bundle do esbuild hoista
// os imports, então sem este arquivo as env vars locais não chegariam ao db.ts.
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, ".env") });

await import("./index.ts");
