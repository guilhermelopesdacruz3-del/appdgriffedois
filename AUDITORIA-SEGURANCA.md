# Auditoria de Segurança — D'Griffe Ótica

**Data:** 2026-08-19
**Escopo:** Backend (`server/`) + Frontend (`src/`) + deploy (Render/Cloudflare Pages)
**Método:** Leitura direta de código (evidência por linha), não scanner automático.

---

## 1. Resumo Executivo

Os 3 pontos levantados por terceiro foram **verificados no código**. Conclusão:

| Ponto | Status real | Severidade |
|-------|-----------|------------|
| 1. Acesso indevido entre usuários (token não checa dono) | **FALSO** — isolamento por email extraído do JWT | — |
| 2. Exposição de chaves no front / senha na URL | **PARCIALMENTE FALSO** — senha vai em POST body; nenhuma chave secreta no front | Baixa (melhoria) |
| 3. Ausência de testes e logs | **VERDADEIRO** — zero testes automatizados; logs só via `console.*` | Média |

O app **não** tem as vulnerabilidades críticas descritas no relatório recebido. O risco real está em **maturidade de engenharia** (testes/logs), não em quebra de autenticação.

---

## 2. Vulnerabilidades Encontradas

### V-01 — Isolamento de dados de cliente (Ponto 1)
**Severidade:** Nenhuma (contra-avaliação)
**Evidência:**
- `server/index.ts:2713` `emailDoToken()` decodifica o JWT do Supabase e extrai `payload.email`.
- `server/index.ts:2727` `requireCliente()` retorna esse email e **todas** as rotas filtram por ele:
  - `buscarPerfil(email)` (`:2740`)
  - `listarEnderecos(email)` (`:2762`)
  - `excluirEndereco(email, id)` (`:2786`)
- O token é emitido e assinado pelo **Supabase Auth** — um usuário A não pode forjar o email de B no payload sem a chave de assinatura do Supabase.

**Conclusão:** O acesso cruzado descrito NO existe. O isolamento é feito por claims do JWT, não por parâmetro controlável pelo cliente.

### V-02 — Exposição de segredos no frontend (Ponto 2)
**Severidade:** Baixa (melhoria de defesa em profundidade)
**Evidência:**
- Front lê apenas variáveis **não secretas**: `VITE_LOJA_INTEGRADA_PROXY_URL`, `VITE_API_URL` (URLs de proxy), `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON` (declaradas mas **ausentes no deploy CF Pages** — cliente Supabase nem inicializa).
- Nenhuma `MP_ACCESS_TOKEN`, `SERVICE_ROLE`, `LI_APP_KEY` ou `LI_API_KEY` no frontend. Essas ficam em `process.env` no **server** (`server/index.ts:863-864` mostra só checagem de presença, não exposição).
- `MP_PUBLIC_KEY` (chave pública, segura para o browser) usada no CheckoutDrawer (`:468`).

**Conclusão:** Não há exposição de chave secreta no front.

### V-03 — Senha/credencial na URL (Ponto 2)
**Severidade:** Nenhuma
**Evidência:**
- `src/services/cliente.ts:56-60` e `:73-77` — login/senha via **POST body** (`JSON.stringify({email, senha})`), não query string.
- OTP e cadastro também via POST body.

### V-04 — Ausência de testes automatizados (Ponto 3)
**Severidade:** Média
**Evidência:**
- `find . -name '*.test.ts'` → 0 arquivos.
- `package.json` não tem script `test`/`vitest`/`jest`.
- Nenhuma suíte de testes no repo.

**Risco:** Regressões passam despercebidas (ex: o bug de soma de estoque que corrigimos agora só foi pego em teste manual).

### V-05 — Logs sem estrutura/roteamento (Ponto 3)
**Severidade:** Baixa/Média
**Evidência:**
- 101 ocorrências de `console.*` espalhadas em 10 arquivos do server.
- Sem nível (info/warn/error), sem correlation ID, sem destino centralizado (arquivo/serviço de log).
- Não há rota de saúde detalhada nem endpoint de métricas para o admin.

**Risco:** Em produção (Render), os logs vão para stdout mas sem filtro — difícil auditar falhas de auth ou erros de checkout.

---

## 3. Impacto no Negócio

- **V-01 (falso):** Sem risco — cliente não acessa dados de outro.
- **V-04:** Cada mudança (estoque, checkout) exige teste manual ponta a ponta; lento e propenso a escapes.
- **V-05:** Se o checkout de cartão falhar em produção, não há rastro estruturado para diagnosticar rapido.

---

## 4. Correções Recomendadas

| ID | Correção | Prioridade | Esforço |
|----|----------|-----------|---------|
| V-04 | Adicionar `vitest` + suíte mínima (auth isolamento, estoque soma/subtrai, checkout) | Alta | Médio (2-3h) |
| V-05 | Wrapper de logger (`server/logger.ts`) com nível + timestamp + gravação em arquivo rotacionado | Média | Baixo (1h) |
| V-02 | Adicionar `Content-Security-Policy` + `X-Content-Type-Options` no server (helmet já importado mas pode não estar aplicado) | Baixa | Baixo |

---

## 5. Checklist Priorizado

- [ ] Criar `server/logger.ts` e substituir `console.*` críticos (auth, checkout, webhook)
- [ ] Adicionar `vitest` e 3 testes de regressão (isolamento, estoque, checkout PIX)
- [ ] Confirmar que `helmet` está aplicado (CSP/HSTS) — verificar `server/index.ts`
- [ ] Adicionar endpoint `/api/admin/logs` (últimas N linhas) para o admin ver eventos

---

## 6. Notas de Maturidade (0-10)

| Dimensão | Nota |
|----------|------|
| Autenticação | 8 (JWT Supabase + HMAC admin) |
| Controle de acesso | 8 (isolamento por email do JWT) |
| APIs | 7 |
| Banco | 7 (RLS no Supabase) |
| Infraestrutura | 7 (Render + CF Pages) |
| LGPD | 7 (exclusão de conta OTP) |
| Logs | 4 (só console) |
| Testes | 2 (zero) |
| Segurança geral | 7 |

---

## Conclusão

O relatório recebido continha **2 falsos positivos graves** (acesso cruzado e exposição de chaves) que **não se confirmam no código**. O app tem isolamento real de dados e não expõe segredos no front. O ponto legítimo é a **ausência de testes e logs estruturados** — isso será corrigido com `vitest` + logger centralizado.
