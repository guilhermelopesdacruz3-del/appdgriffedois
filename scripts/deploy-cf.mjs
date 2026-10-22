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

// O endpoint de deploy só promove para produção quando o branch enviado é o
// branch de produção do projeto. Sem isso, o upload fica como preview e o
// alias *.pages.dev continua servindo o bundle antigo.
const projectRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCT}/pages/projects/${PROJECT}`, {
  headers: { Authorization: `Bearer ${TOK}` },
});
const projectJson = await projectRes.json();
const branch = projectJson?.result?.production_branch;
if (!projectJson.success || !branch) {
  console.error('Não foi possível ler o branch de produção do projeto:', JSON.stringify(projectJson.errors || projectJson));
  process.exit(1);
}
console.log(`Projeto ${PROJECT}, branch de produção: ${branch}`);

const boundary = '----HermesDeploy' + Date.now();
let body = Buffer.alloc(0);
const add = (s) => { body = Buffer.concat([body, Buffer.from(s)]); };
add(`--${boundary}\r\n`);
add(`Content-Disposition: form-data; name="branch"\r\n\r\n`);
add(branch + '\r\n');
add(`--${boundary}\r\n`);
add(`Content-Disposition: form-data; name="manifest"\r\n\r\n`);
add(JSON.stringify(manifest) + '\r\n');
for (const f of files) {
  const buf = fs.readFileSync(f.full);
  add(`--${boundary}\r\n`);
  add(`Content-Disposition: form-data; name="${f.rel}"; filename="${f.rel}"\r\n`);
  add(`Content-Type: application/octet-stream\r\n\r\n`);
  body = Buffer.concat([body, buf, Buffer.from('\r\n')]);
}
add(`--${boundary}--\r\n`);

const url = `https://api.cloudflare.com/client/v4/accounts/${ACCT}/pages/projects/${PROJECT}/deployments`;
const res = await fetch(url, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${TOK}`,
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Content-Length': body.length,
  },
  body,
});
const text = await res.text();
let data;
try { data = JSON.parse(text); } catch { console.error('Resposta não-JSON:', text.slice(0, 500)); process.exit(1); }
if (data.success) { console.log('DEPLOY OK ->', data.result.url); process.exit(0); }
else { console.error('DEPLOY FALHOU:', JSON.stringify(data.errors)); process.exit(1); }
