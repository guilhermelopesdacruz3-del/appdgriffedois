// Build script: compila server/index.ts (com imports .ts) em um bundle JS puro.
// O Render roda `node dist/index.js` (sem tsx em runtime).
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: [path.join(__dirname, "index.ts")],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outfile: path.join(__dirname, "dist", "index.js"),
  // .mjs/.ts são TypeScript aqui
  loader: { ".ts": "ts", ".mjs": "ts" },
  // packages nativos/node builtins ficam externos (resolvidos por npm install)
  external: ["express", "cors", "dotenv", "@supabase/supabase-js"],
  logLevel: "info",
});

console.log("Build do servidor concluído: server/dist/index.js");
