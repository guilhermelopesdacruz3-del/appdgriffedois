#!/usr/bin/env node
// Deploy to Cloudflare Pages via direct API (multipart).
// Usage: node scripts/deploy-cf.mjs <deploy-dir> [project-name]
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const TOK = process.env.CLOUDFLARE_API_TOKEN;
const ACCT = process.env.CLOUDFLARE_ACCOUNT_ID || 'a4d6e3cfe8dde83c8cda8c79ad77202a';
const PROJECT = process.argv[3] || 'appdgriffedois';
const dir = process.argv[2];
const API = `https://api.cloudflare.com/client/v4/accounts/${ACCT}/pages/projects/${PROJECT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!TOK) { console.error('CLOUDFLARE_API_TOKEN ausente'); process.exit(1); }
if (!fs.existsSync(dir)) { console.error('dir nao existe:', dir); process.exit(1); }

function walk(d, base, out) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const full = path.join(d, e.name);
    const rel = base ? base + '/' + e.name : e.name;
    if (e.isDirectory()) walk(full, rel, out);
    else out.push({ rel, full });
  }
  return out;
}
const files = walk(dir, '', []);
const manifest = {};
for (const f of files) manifest[f.rel] = crypto.createHash('sha256').update(fs.readFileSync(f.full)).digest('hex');
console.log(`Enviando ${files.length} arquivos...`);

const auth = { Authorization: `Bearer ${TOK}` };

// O endpoint de deploy só promove para produção quando o branch enviado é o
// branch de produção do projeto. Sem isso, o upload fica como preview e o
// alias *.pages.dev continua servindo o bundle antigo.
const projectRes = await fetch(API, { headers: auth });
const projectJson = await projectRes.json();
const project = projectJson?.result;
const branch = project?.production_branch;
if (!projectJson.success || !branch) {
  console.error('Não foi possível ler o branch de produção do projeto:', JSON.stringify(projectJson.errors || projectJson));
  process.exit(1);
}
console.log(`Projeto ${PROJECT}, branch de produção: ${branch}`);

const boundary = '----HermesDeploy' + Date.now();
let body = Buffer.alloc(0);
const add = (s) => { body = Buffer.concat([body, Buffer.from(s)]); };
// manifest primeiro: é o formato que o endpoint espera para Direct Upload.
add(`--${boundary}\r\n`);
add(`Content-Disposition: form-data; name="manifest"\r\n\r\n`);
add(JSON.stringify(manifest) + '\r\n');
add(`--${boundary}\r\n`);
add(`Content-Disposition: form-data; name="branch"\r\n\r\n`);
add(branch + '\r\n');
for (const f of files) {
  const buf = fs.readFileSync(f.full);
  add(`--${boundary}\r\n`);
  add(`Content-Disposition: form-data; name="${f.rel}"; filename="${f.rel}"\r\n`);
  add(`Content-Type: application/octet-stream\r\n\r\n`);
  body = Buffer.concat([body, buf, Buffer.from('\r\n')]);
}
add(`--${boundary}--\r\n`);

const res = await fetch(`${API}/deployments`, {
  method: 'POST',
  headers: {
    ...auth,
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Content-Length': body.length,
  },
  body,
});
const text = await res.text();
let data;
try { data = JSON.parse(text); } catch { console.error('Resposta não-JSON:', text.slice(0, 500)); process.exit(1); }
if (!data.success) {
  console.error('DEPLOY FALHOU:', JSON.stringify(data.errors));
  process.exit(1);
}

// O POST responde antes de o deploy terminar. Sem esperar, o alias de produção
// pode continuar no deployment antigo e o CI mente que deu tudo certo.
let dep = data.result;
for (let i = 0; i < 24; i++) {
  if (dep.latest_stage?.status === 'success' || dep.latest_stage?.status === 'failure') break;
  await sleep(5000);
  const r = await fetch(`${API}/deployments/${dep.id}`, { headers: auth });
  const j = await r.json();
  if (j.success) dep = j.result;
}
console.log('DEPLOY OK ->', dep.url, '| environment:', dep.environment, '| stage:', dep.latest_stage?.status);

// Logs de build (podem explicar falhas de roteamento/arquivos ausentes).
let logs = null;
try {
  const lr = await fetch(`${API}/deployments/${dep.id}/history/logs`, { headers: auth });
  const lj = await lr.json();
  if (lj.success) logs = lj.result;
} catch { /* logs são opcionais */ }

const summary = {
  project: PROJECT,
  production_branch: branch,
  production_deployments_enabled: project.production_deployments_enabled,
  deployment: {
    id: dep.id,
    environment: dep.environment,
    url: dep.url,
    aliases: dep.aliases,
    latest_stage: dep.latest_stage,
    is_skipped: dep.is_skipped,
    skip_reason: dep.skip_reason,
    uses_functions: dep.uses_functions,
  },
  logs,
};
fs.writeFileSync(path.join(process.cwd(), 'deploy-result.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));

if (dep.latest_stage?.status === 'failure') {
  console.error('O deployment terminou com falha.');
  process.exit(1);
}
if (dep.environment !== 'production') {
  console.error('O deployment NÃO foi para produção; o alias pages.dev segue no bundle antigo.');
  process.exit(1);
}
