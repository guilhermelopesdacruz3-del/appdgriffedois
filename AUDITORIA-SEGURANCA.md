# Auditoria de Segurança — D'Griffe Ótica
**Data:** 2026-07-29  
**Escopo:** frontend React+Vite, proxy Express, Supabase, Cloudflare Pages, Mercado Pago, Loja Integrada  
**Objetivo:** identificação objetiva de riscos que afetam receita, dado de cliente e operação B2B/Play Store

---

## 1. Resumo Executivo

O sistema tem uma base razoável para um SaaS pequeno: há rate-limit no admin, webhook do MP valida assinatura, preço é conferido no servidor e há isolamento por e-mail no cliente. Porém, em múltiplos pontos o código assume modos demo/mock como estado normal, políticas RLS estão abertas e tokens/sessões ficam expostos no browser. Isso não é aceitável para escala enterprise ou para exposição pública contínua.

A auditoria usou como evidência direta:
- `server/index.ts`
- `server/webhook.ts`
- `server/pagamento.ts`
- `server/cupom.ts`
- `src/services/admin.ts`
- `src/services/cupomApp.ts`
- `src/utils/cookies.ts`
- `supabase/schema-fidelidade.sql`
- `functions/api/[[path]].js`
- relatório de auditoria LGPD salvo em `C:\dgriffe-work\auditoria-seguranca-lgpd.md`

Limitação declarada: esta é uma auditoria de código/funções, não um pentest externo completo. Riscos que dependem de configuração externa podem ser hipóteses até validação real em ambiente provisionado.

---

## 2. Vulnerabilidades Encontradas

| Código | Severidade | Tema | Arquivo(s) | Risco | Impacto comercial |
|--------|-----------|------|-----------|-------|-------------------|
| A1 | Crítica | RBAC / IDOR | `server/index.ts:387`, `server/index.ts:219`, `server/cupom.ts:28` | Admin é single-role sem RBAC por módulo/recurso/ação | Exposição total do painel se um token vazar |
| A2 | Crítica | IDOR cliente | `server/index.ts:1473-1522` | `emailDoToken` decodifica payload sem validar assinatura | Forjamento de token JWT cliente |
| A3 | Crítica | Isolation dados | `supabase/schema-fidelidade.sql:35-46` | `USING (true)` para `authenticated` em fidelidade e histórico | Qualquer usuário logado vê/altera pontos de terceiros |
| A4 | Crítica | Exposição PII | `src/utils/cookies.ts:52-75`, consultas Supabase | CPF, e-mail, token de cliente em cookie/localstorage | Vazamento + LGPD + roubo de sessão |
| A5 | Alta | Auth bypass demo | `server/webhook.ts:60-73` | Demo aceita webhook forjado sem assinatura | Credita pontos sem pagamento real |
| A6 | Alta | Rate-limit local | `server/index.ts:113-140` | Contador de bloqueio em memória por IP | Força bruta distribuída nos admins |
| A7 | Alta | CORS default aberto | `server/.env.example`, `server/index.ts:329-337` | `*` em exemplo/default pode vazar para produção | CSRF/abuso por origem não confiável |
| A8 | Alta | Cartão checkout | `server/pagamento.ts:93-118` | Cartão só é liberado quando `MP_PUBLIC_KEY` existe | Venda travada enquanto chave faltar |
| A9 | Alta | Logs com PII | `server/webhook.ts:150`, `server/index.ts:415,1210` | Logs armazenam email, endpoint de pagamento, ações admin | Forense e compliance prejudicados |
| A10 | Média | Logout admin-fragile | `server/index.ts:420-431` | Logout por revogação em memória; em multi-instância não encerra sessão global | Token continua válido em outra instância |
| A11 | Média | CSRF em cupons | `src/services/cupomApp.ts:70-104` | Cupons/admin usam `Authorization` mas sem CSRF token | Abuso por site malicioso aberto no mesmo browser |
| A12 | Média | CORS por instância | `functions/api/[[path]].js` | Proxy Cloudflare não restringe origins além do backend | Mesmo efeito do CORS do backend |
| A13 | Média | Exclusão LGPD frágil | `server/index.ts:1378-1474` | Se `supabaseClient()` for `null`, exclusão retorna 503 | Descumprimento do direito de exclusão |
| A14 | Média | PII em mock | `server/index.ts:254-258` | Nomes/emails/telefones plausíveis no código | Confusão operacional e risco em vazamento |
| A15 | Baixa | Headers/Monitoring | Cloudflare/Render | Falta WAF/alertas explícitos confirmados nos arquivos auditados | Incidentes sem aviso em tempo real |

---

## 3. Evidências

- `server/index.ts:387-417` — login admin sem segundo fator e sem escopo por função.
- `server/index.ts:219-226` — `requireAdmin` valida bearer e autoriza tudo; nenhum módulo/recurso separado.
- `server/index.ts:1473-1522` — `emailDoToken` só decodifica base64; sem `Verify`.
- `supabase/schema-fidelidade.sql:35-46` — policy com `using (true)` para `authenticated`.
- `src/utils/cookies.ts:52-75` — cookie `dg_admin_token` e `dgriffe:cliente_token` sem `HttpOnly`.
- `server/webhook.ts:60-73` — bloco demo aceita payload arbitrário e credita pontos/pedido.
- `server/index.ts:113-140` — rate-limit em `Map()` em memória; escala por instância zero.
- `functions/api/[[path]].js` — proxy `/api/*` sem controle de origem próprio.
- `server/cupom.ts:208-305` — rotas de cupom sem estado adicional de ownership/escopo.

Limitação: ainda estamos sem validação real de deploy cloudflare/render para WAF/DDOS/SSRF externo; os riscos dessa camada são inferidos.

---

## 4. Impacto no Negócio

| Achado | Impacto financeiro | Impacto LGPD/legal | Bloqueio B2B/Play |
|--------|-------------------|--------------------|-------------------|
| A1/A2 | Médio | — | Médio |
| A3 | Alto | Alto | Alto |
| A4 | Alto | Alto | Alto |
| A5 | Alto | — | Médio |
| A6 | Médio | — | Baixo |
| A7/A8 | Alto | — | Alto |
| A9 | Médio | Médio | Médio |
| A10 | Médio | — | Baixo |
| A11 | Médio | — | Médio |
| A12 | Médio | — | Médio |
| A13 | Baixo | Alto | Baixo |
| A14 | Baixo | Baixo | Baixo |
| A15 | Médio | — | Médio |

---

## 5. Correções Recomendadas

**Corrigir agora**
1. Substituir `emailDoToken` por validação oficial via Supabase (`sb.auth.getUser(token)`).
2. Revisar RLS do Supabase para `profiles`, `fidelidade`, `fidelidade_historico`, `enderecos`, `notificacoes`, `cupons_*` com `auth.uid()`/email do proprietário do registro; remover políticas `using (true)`.
3. Migrar cookies de admin e cliente para `HttpOnly; Secure; SameSite=Strict` + rotação periódica; parar de guardar token/cliente em `localStorage`.
4. Separar RBAC no admin com papéis e permissões por módulo/recurso/ação.
5. Impedir que `DEMO` mode aceite webhook live; usar flag exclusiva `DEMO_MODE`.
6. Centralizar rate limit em Redis/Cache.
7. Impedir blind `FRONTEND_ORIGIN=*` em produção; injetar lista de origins permitidas.
8. Mascarar/criptografar CPF e evitar armazenamento desnecessário de PII sensível.

**Acompanhar**
9. Garantir que `MP_PUBLIC_KEY` sempre esteja preenchida antes de abrir checkout cartão para clientes.
10. Implementar endpoint de exportação/portabilidade do cliente (LGPD art. 18, V).
11. Definir política de retenção em logs e PII mascarada por default.
12. Planejar 2FA para admin e limitar sessões simultâneas.

**Validar com humano**
13. Validar WAF/DDOS/SSRF via pentest com fornecedor especializado.
14. Validar integração real de webhook MP em produção depois das chaves reais.
15. Revisar termos/política/consentimento com advogado LGPD.

---

## 6. Checklist Priorizado

| # | Vulnerabilidade | Status | Corrigir | Responsável | Prioridade | Prazo |
|---|-----------------|--------|----------|-------------|-----------|-------|
| A1 | RBAC inexistente/admin único | Aberto | Implementar papéis admin | Backend | Crítica | Imediato |
| A2 | `emailDoToken` sem verificação | Aberto | Usar `sb.auth.getUser` | Backend | Crítica | Imediato |
| A3 | RLS `using (true)` | Aberto | Revisar policies Supabase | Backend | Crítica | 48h |
| A4 | PII em cookie/localstorage | Aberto | HttpOnly + remover localStorage | Fullstack | Crítica | 72h |
| A5 | Demo aceita webhook forjado | Aberto | Desativar se `DEMO_MODE` produção | Backend | Alta | 24h |
| A6 | Rate-limit em memória | Aberto | Redis | Backend | Alta | 7 dias |
| A7 | CORS default aberto | Aberto | Bloquear em produção | Backend | Alta | 24h |
| A8 | MP_PUBLIC_KEY ausente | Aberto | Configurar chave pública | Admin | Alta | 24h |
| A9 | Logs com PII | Aberto | Mascarar IP/emails/valores | Backend | Média | 7 dias |
| A10 | Logout revogável só em memória | Aberto | Redis distributed revoke | Backend | Média | 14 dias |
| A11 | CSRF em cupons | Aberto | CSRF token ou Origin verification | Fullstack | Média | 7 dias |
| A12 | Proxy CF sem restrição | Aberto | Adicionar origem/method allowlist | Infra | Média | 14 dias |
| A13 | Exclusão LGPD 503 | Aberto | Fallback para fila/exclusão assíncrona | Backend | Média | 7 dias |
| A14 | Mock com PII | Aberto | Remover dados plausíveis do código | Backend | Baixa | 14 dias |

---

## 7. Roadmap de Implementação

**Sprint 1 — Crítico (até 7 dias)**
- Implementar RBAC admin + módulos/recurso/ação.
- Corrigir JWT cliente e admin com validação real + revogação global.
- Corrigir RLS Supabase em massa.
- Retirar PII de localStorage/cookie e migrar para HttpOnly.
- Anular webhook demo fake para produção.
- Bloquear CORS aberto e medir proxy por origem.

**Sprint 2 — Importante (15 dias)**
- Rate-limit distribuído em Redis.
- Configurar MP_PUBLIC_KEY e testar checkout cartão.
- Sanitizar logs + definir retenção/rotação.
- Garantir exportação LGPD para o usuário.
- CSRF protection standard em todos os formulários mutantes do front.

**Sprint 3 — Melhorias (30 dias)**
- 2FA admin, sessões simultâneas e histórico de mudanças por admin.
- PII mascarada em todo front/export CSV.
- Testes automatizados de auth, checkout e webhook idempotente.
- Documentação operacional de incidentes.

**Sprint 4 — Otimizações/Compliance final (45 dias)**
- Cache estratégico com TTL por domínio.
- Alertas em produção (Render + Cloudflare).
- Play readiness final (manifest/privacidade/screenshots/termos consistentes com código).
- Revisão legal do ciclo de consentimento LGPD.

---

## 8. Boas Práticas Adicionais

- Manter evidências de validação antes de cortar modo demo.
- Controlar inventário de segredos em uma única store (`store_config`) sem fallback local em produção.
- Registrar alterações de configuração com `admin_email`, `ip`, `acao`.
- Unificar performance e segurança via cache controlado e tempo de expiração.

---

## 9. Conclusão

O D'Griffe tem código funcional e já avançou em segurança relativa, mas ainda não está em nível enterprise/play-store robusto. Os riscos mais graves estão em isolamento de dados e autenticação confiável, não na UI. Correções curtas removem os riscos mais críticos em poucas sprints.

---

## 10. Nota Final do Sistema

| Eixo | Nota | Justificativa curta |
|------|------|----------------------|
| Segurança | 6/10 | Há rate-limit, logging e headers, mas RLS fraca, JWT mal validado e PII exposta reduzem a nota. |
| Escalabilidade | 5/10 | Arquitetura simples e modelo demo-friendly, porém algumas camadas dependem de memória local e sem filas/observabilidade. |
| Arquitetura | 6/10 | Separação front/backend/proxy funciona, mas single-role, acesso por write direto e policies broad limitam maturidade. |
| LGPD | 5/10 | Exclusão e termos existem, mas PII em texto puro, pseudonimização fraca e ausência de portabilidade reduzem conformidade. |
| APIs | 6/10 | Endpoints organizados e webhook idempotente, porém falta rate-limit consistente, CSRF por padrão e validação JWT correta. |
| Banco | 6/10 | Estrutura limpa, mas RLS excessivamente permissiva e políticas excessivas a `authenticated` chegam a risco alto. |
| Infraestrutura | 6/10 | Deploy em Render + Cloudflare Viable; faltam WAF/alertas claramente configurados nas configurações auditadas. |
| Autenticação | 5/10 | Login admin protegido, mas sem RBAC/MFA; JWT cliente e cookies expostos. |
| Controle de acesso | 5/10 | Proteção básica existe, porém fraca contra IDOR/JWT forge e escalada de privilégio horizontal. |
| Performance | 6/10 | Build otimizado e cache consultado, porém rate-limit, filas e monitoramento precisam evoluir. |
| UX de segurança | 6/10 | Fluxo de pagamento sem e-mail no demo melhora conversão; ainda falta feedback e controle de sessão estável. |
| Governança | 5/10 | Logs básicos e exclusão cliente existem; ausência de RBAC, revisão por função e pentest满是 lacunas. |
| Maturidade | 5/10 | Produto utilizável para escala baixa/média; precisa endurecer auth/isolamento/privacidade para enterprise/Play. |

**Nota geral: 5,6 / 10**
