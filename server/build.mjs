// Build script: compila server/start.ts (com imports .ts) em um bundle JS puro.
// start.ts carrega o .env antes do index.ts, pois os imports são hoisted no
// bundle (o db.ts leria process.env antes do dotenv.config caso contrário).
// O Render roda `node dist/index.js` (sem tsx em runtime).
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { execFileSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// SHA do commit no momento do build — exposto em GET /health para que sempre
// seja possível verificar qual código está rodando no host (deploy visível).
let sha = "sem-git";
try {
  sha = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: path.join(__dirname, "..") })
    .toString()
    .trim();
} catch {}

await build({
  entryPoints: [path.join(__dirname, "start.ts")],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outfile: path.join(__dirname, "dist", "index.js"),
  // .mjs/.ts são TypeScript aqui
  loader: { ".ts": "ts", ".mjs": "ts" },
  // packages nativos/node builtins ficam externos (resolvidos por npm install)
  external: ["express", "cors", "dotenv", "@supabase/supabase-js", "web-push"],
  define: { __BUILD_SHA__: JSON.stringify(sha) },
  logLevel: "info",
});

console.log("Build do servidor concluído: server/dist/index.js");
