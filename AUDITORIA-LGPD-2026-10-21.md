# Auditoria LGPD — D'Griffe Ótica

**Data:** 2026-10-21
**Escopo:** código do repositório `C:\dgriffe-work` (app React/Vite, site `dgriffe-site`, backend Express `server/`, scripts SQL do Supabase e Edge Functions).
**Método:** revisão estática de código com evidência por arquivo:linha. Não houve acesso ao banco de produção, aos contratos com fornecedores nem aos logs reais.
**Natureza:** auditoria técnica de conformidade. **Não substitui parecer jurídico** nem auditoria independente de segurança.

> **Limitação importante:** os scripts SQL do repositório estão conflitantes entre si. O estado real do RLS no Supabase **precisa ser confirmado** com as consultas do Anexo A. Os achados de RLS abaixo descrevem o que o código versionado aplica (ou tenta aplicar).

---

## 1. Sumário executivo

O projeto trata dados pessoais em volume relevante (cadastro, CPF, endereço, pedidos, fidelidade) e **dados pessoais sensíveis de saúde** (receitas oftalmológicas com grau, médico e data). A maturidade de LGPD hoje é **baixa**: existem controles pontuais bons, mas faltam os elementos estruturantes (base legal registrada, consentimento, política acessível, retenção, governança e controle de acesso consistente).

### 1.1 Nota por dimensão

| Dimensão | Maturidade | Comentário |
|---|---|---|
| Governança e responsabilização | 🔴 1/5 | Sem DPO, ROPA, RIPD, plano de incidentes ou treinamento. |
| Transparência | 🟠 2/5 | Política existe, mas está incompleta e não é acessível no app/site. |
| Bases legais e consentimento | 🔴 1/5 | Nenhum consentimento é efetivamente coletado ou registrado. |
| Direitos do titular | 🟠 2/5 | Exclusão existe, mas é incompleta; não há portabilidade. |
| Segurança e controle de acesso | 🔴 1/5 | IDOR em receitas, proxy público da Loja Integrada, RLS permissivo e takeover de conta. |
| Retenção e eliminação | 🔴 1/5 | Dados mantidos indefinidamente; exclusão não cobre todas as tabelas. |
| Terceiros e transferência internacional | 🔴 1/5 | LI, MP, Supabase e Cloudflare sem DPA/documentação de transferência. |
| Dados sensíveis (saúde) | 🔴 1/5 | Receitas armazenadas sem consentimento específico e expostas por endpoint público. |

### 1.2 Riscos que exigem ação imediata (P0)

1. **Takeover de qualquer conta de cliente** pelo endpoint `/api/cliente/login-password` — basta saber o e-mail.
2. **Receitas oftalmológicas (dado sensível) legíveis, alteráveis e apagáveis por qualquer pessoa** que informe o e-mail do titular.
3. **Proxy público da Loja Integrada** expõe clientes (CPF, telefone, endereço) e pedidos, e permite alteração de cadastro.
4. **RLS permissivo/contraditório** no Supabase: políticas `USING (true)` para `authenticated`, script com coluna inexistente e chave anon publicada no repositório.
5. **Função Edge `li-proxy` pública com service_role** (se estiver implantada) — mesmo risco do item 3, sem autenticação.

---

## 2. Inventário de dados pessoais

| Categoria | Dados | Onde ficam | Finalidade | Base legal atual | Retenção |
|---|---|---|---|---|---|
| Conta | nome, e-mail, telefone, CPF, senha (hash), metadados de auth | Supabase Auth + `profiles`; Loja Integrada | Criar/conta, login, comunicação | Execução de contrato (parcial); consentimento não registrado | Indefinida |
| Endereço | nome, logradouro, número, complemento, bairro, cidade, UF, CEP | `enderecos`, Loja Integrada | Entrega | Execução de contrato | Indefinida |
| Pedidos/pagamento | itens, valores, status, `mp_payment_id`, e-mail, cupom, pontos | Loja Integrada, `pedidos`, Mercado Pago | Executar pedido, fiscal, antifraude | Contrato + obrigação legal (fiscal) | Indefinida (fiscal não documentado) |
| Fidelidade | pontos, histórico, cupons, indicações, família | `fidelidade`, `fidelidade_historico`, `cupons*`, `indicacoes`, `familia` | Programa de fidelidade | Contrato/legítimo interesse não documentado | Indefinida |
| **Saúde** | receita óptica: grau OD/OE (longe/perto), cilindro, eixo, adição, DIP, médico, data, observações | `receitas` | Confecção de lentes | **Consentimento específico ausente** (art. 11) | Indefinida |
| Imagem/biometria | vídeo da câmera no provador virtual | Apenas no dispositivo; não é enviado nem salvo | Prova virtual | Não formalizada | Não retido |
| Notificações | e-mail, título/corpo, endpoint e chaves de push | `notificacoes`, `store_config` (`PUSH_SUB_<email>`) | Comunicação | Consentimento ausente | 24h para notificações; push indefinido |
| Técnicos | IP, logs de acesso/erro, tokens, user-agent | Render, Cloudflare, Supabase, arquivo local | Segurança/auditoria | Legítimo interesse não documentado | Indefinida |
| Terceiros | e-mails de familiares e de indicados, dados de afiliados | `familia`, `indicacoes`, `afiliados` | Indicação/família | Consentimento do terceiro ausente | Indefinida |
| Atendimento | observações livres do pedido | Loja Integrada / `pedidos.li_dados` | Entrega/atendimento | Contrato | Indefinida |

**Dados sensíveis:** apenas a receita oftalmológica é formalmente sensível (art. 5º, II, da LGPD). O provador virtual acessa a câmera, mas o fluxo atual não transmite nem armazena a imagem — o risco é de transparência, não de tratamento oculto.

---

## 3. Bases legais e consentimento

### 3.1 O que o código faz hoje

- O backend aceita `aceiteLgpd` no cadastro (`server/index.ts:2748-2749`), mas **nenhuma tela envia esse campo**. A busca por `aceiteLgpd` em `src/` e `dgriffe-site/src/` não retorna nenhuma ocorrência.
- As colunas `aceite_lgpd` e `aceite_lgpd_em` **não existem em nenhum script SQL do repositório**. O `upsert` em `profiles` com esses campos tende a falhar; o erro é engolido por `try/catch` (`server/index.ts:2752-2754`), então o próprio perfil pode não ser salvo.
- O cadastro por senha do app (`src/pages/ClienteCadastro.tsx:133-167`) **não tem checkbox de termos/privacidade**.
- O site (`dgriffe-site/src/pages/LoginPage.tsx:133-135`) usa consentimento passivo: “Ao continuar, você concorda…”, sem link para os termos e sem registro.
- O checkout coleta CPF e dados de entrega sem aviso de privacidade no ponto de coleta.
- O site coleta CPF e arquivo de receita no modal de lentes (`dgriffe-site/src/components/features/LensesModal.tsx:42-79`). O arquivo **não é enviado**: apenas o nome vai para o carrinho (`recipeFile: recipeFile?.name`, linha 68). Isso gera expectativa falsa no titular.
- Não há consentimento específico para dados de saúde, nem consentimento de marketing, nem registro de versão da política.

### 3.2 Bases legais recomendadas

| Tratamento | Base legal adequada | Observação |
|---|---|---|
| Conta, pedido, entrega, pós-venda | Execução de contrato — art. 7º, V | Não exigir consentimento para o que é necessário ao contrato. |
| Emissão de NF, guarda fiscal | Obrigação legal — art. 7º, II | Definir prazo fiscal com contador. |
| Prevenção a fraude, segurança, logs | Legítimo interesse — art. 7º, IX | Exige teste de balanceamento (LIA) documentado. |
| Marketing, push, newsletter | Consentimento — art. 7º, I | Opt-in, granular, com opt-out fácil. |
| Receita oftalmológica (saúde) | Consentimento específico — art. 11, I | Consentimento separado, destacado, com finalidade e prazo. |
| Indicação de terceiros (e-mail do indicado) | Consentimento do indicado ou legítimo interesse com aviso | O indicador não pode consentir pelo indicado. |

---

## 4. Achados detalhados

Legenda: 🔴 Crítico (P0) · 🟠 Alto (P1) · 🟡 Médio (P2) · 🔵 Baixo (P3)

### 🔴 LGPD-01 — Takeover de qualquer conta de cliente

**Evidência:** `server/index.ts:2860-2910`.

O endpoint `/api/cliente/login-password`:

1. Procura o usuário pelo e-mail (`sb.auth.admin.listUsers()`).
2. Se o usuário existe, tenta `signInWithPassword`.
3. Se a senha falhar, **define a senha informada pelo atacante** com `sb.auth.admin.updateUserById(listUser, { password: s })` e faz login (`:2891-2906`).
4. Se o usuário não existe, cria a conta com `email_confirm: true` (`:2926-2932`), sem verificar posse do e-mail.

**Impacto LGPD:** acesso não autorizado a dados pessoais, pedidos, pontos e receitas; alteração/exclusão de dados; possível fraude. Viola arts. 6º (segurança), 46 e 48.

**Correção:**
- Remover o fallback de reset de senha. Senha errada deve retornar 401 e contabilizar tentativa.
- Redefinição de senha somente via OTP/link no e-mail do titular (`sb.auth.resetPasswordForEmail`).
- Cadastro com senha deve exigir confirmação de e-mail (`email_confirm: false` ou fluxo OTP).
- Rate limit por e-mail **e** por IP; alerta para picos de falha.

---

### 🔴 LGPD-02 — Receitas oftalmológicas expostas por IDOR

**Evidência:** `server/receitas.ts:22-45` (GET), `:47-73` (POST), `:75-122` (PUT), `:124-152` (DELETE); montagem em `server/index.ts:3240`.

As rotas `/api/cliente/receitas` **não usam `requireCliente`**. O e-mail vem de `req.query.email` ou `req.body.email`. Qualquer pessoa com a URL do backend pode:

- listar todas as receitas de um titular pelo e-mail;
- criar, alterar e apagar receitas desse titular.

A resposta do GET usa `select("*")`, incluindo grau, cilindro, eixo, médico e observações — dado de saúde (art. 5º, II).

**Impacto LGPD:** vazamento de dado pessoal sensível (art. 11), acesso não autorizado (art. 46), risco de dano à saúde (lentes erradas) e à privacidade.

**Correção:**
- Aplicar middleware de autenticação em todas as rotas; derivar o e-mail de `sb.auth.getUser(token)`, nunca da query/body.
- Remover `email` dos parâmetros públicos.
- Auditar leitura/escrita de receitas (quem, quando, IP).
- Criptografar os campos de grau em repouso ou restringir a acesso administrativo com necessidade de conhecer.

---

### 🔴 LGPD-03 — Proxy público da Loja Integrada expõe clientes e pedidos

**Evidência:** `server/index.ts:326-341` e `:2558-2600`.

`RECURSOS_PERMITIDOS` inclui `cliente` e `pedido`. A rota `app.all("/api/loja-integrada/:resource/:id?")` **não tem autenticação**. Isso permite:

- `GET /api/loja-integrada/cliente/search/?cliente_email=...` → nome, e-mail, CPF, telefone e endereço;
- `GET /api/loja-integrada/pedido/` → pedidos com dados do comprador;
- `PUT /api/loja-integrada/cliente/:id` → alteração de cadastro se o e-mail do body coincidir (a checagem de posse é apenas comparação de e-mail, `:2582-2599`).

**Impacto LGPD:** enumeração de titulares e vazamento massivo de PII; integridade de cadastros; art. 46.

**Correção:**
- Remover `cliente` e `pedido` do proxy público.
- Criar rotas internas/admin autenticadas para o que o checkout precisa.
- Rate limit e logging de acesso.
- Revisar se o front realmente precisa buscar cliente por e-mail; preferir buscar pelo token autenticado.

---

### 🔴 LGPD-04 — RLS permissivo, contraditório e com script quebrado

**Evidência:**
- `supabase/migracao-familia-indicacoes.sql:24-45`: políticas `svc_all_*` com `USING (true) WITH CHECK (true)` para `authenticated` em `profiles`, `enderecos`, `fidelidade` e `fidelidade_historico`.
- `server/fix_rls_security.sql:31-34, 52-55, 111-114, 132-135, 154-157, 176-179`: políticas `*_service` com `FOR ALL TO authenticated USING (true) WITH CHECK (true)`.
- `supabase/fix-rls-c1.sql:17-20`: política em `cupons_usuarios` usando coluna `email`, que **não existe** (`supabase/final.sql:12` usa `user_id`).
- `supabase/schema-fidelidade.sql:36-46`: `USING (true)` para `authenticated`.
- Chave anon e URL do projeto versionadas em `hermes app/.env.front` (arquivo rastreado pelo Git).

**Impacto LGPD:** qualquer usuário autenticado — e o cadastro é aberto — pode ler/alterar dados de todos os clientes. Viola arts. 6º, 46 e 49. Mesmo que o front não use o cliente Supabase hoje, a chave anon é pública por natureza e o risco existe para qualquer pessoa que a use.

**Correção:**
- Consolidar **uma única migration canônica** de RLS.
- Políticas de dono: `id = auth.uid()` ou `email = (auth.jwt() ->> 'email')`.
- Políticas de serviço: `TO service_role`, nunca `TO authenticated USING (true)`.
- `cupons_usuarios`: `user_id = auth.uid()`.
- Revogar `anon` de todas as tabelas com PII.
- Remover/arquivar scripts antigos para evitar reaplicação.
- Testar com usuário A e B (matriz de acesso) e com a chave anon.

---

### 🟠 LGPD-05 — Consentimento não é coletado nem registrado

**Evidência:** `server/index.ts:2748-2749`; ausência de `aceiteLgpd` em `src/` e `dgriffe-site/src/`; `src/pages/ClienteCadastro.tsx:133-167`; `dgriffe-site/src/pages/LoginPage.tsx:133-135`; nenhuma coluna `aceite_lgpd` nos SQLs.

**Impacto LGPD:** art. 8º — consentimento deve ser livre, informado, específico e comprovável. Hoje não há prova de consentimento; a política afirma que há checkbox, o que não corresponde ao código.

**Correção:**
- Migration: `aceite_lgpd`, `aceite_lgpd_em`, `aceite_lgpd_versao`, `aceite_marketing`, `aceite_dados_sensiveis`.
- Checkbox obrigatório no cadastro (app e site), com link para a política.
- Backend rejeita cadastro sem `aceiteLgpd === true`.
- Registrar versão da política, data/hora, IP e user-agent.
- Consentimento separado para marketing e para dados de saúde.

---

### 🟠 LGPD-06 — Dados de saúde sem consentimento específico

**Evidência:** `supabase/final.sql:15` (campos de receita); `server/receitas.ts`; `src/pages/ProfilePage.tsx:32-112`; `dgriffe-site/src/components/features/LensesModal.tsx:42-79`.

**Impacto LGPD:** art. 11 exige consentimento específico para dado sensível ou uma das hipóteses legais. Não há consentimento, aviso, RIPD nem controle de acesso proporcional.

**Correção:**
- Tela de consentimento específica antes de salvar a receita, explicando finalidade, prazo e acesso.
- Minimizar: não exigir CPF no cadastro; coletar só o grau necessário à confecção.
- Restringir quem no admin vê receitas; logar cada acesso.
- Criptografar em repouso (pgcrypto) ou isolar em tabela com acesso service_role.
- Elaborar RIPD (art. 38).

---

### 🟠 LGPD-07 — Política de privacidade incompleta e inacessível

**Evidência:** `public/privacidade.html:19-40`; `src/pages/TermosPrivacidade.tsx` existe mas **não é importado em lugar nenhum**; o site não tem link de política; o app não tem rota para a política.

**O que falta na política:**
- CNPJ, endereço e identidade completa do controlador (hoje “CNPJ a ser informado”).
- Encarregado (DPO) e canal de contato.
- Bases legais por finalidade.
- Dados sensíveis (receita) e consentimento específico.
- Retenção por categoria.
- Compartilhamento com operadores e transferência internacional.
- Lista completa de direitos (art. 18) e prazo de resposta (art. 19).
- Cookies e tecnologias similares.
- Segurança e incidentes.
- Menores.
- Versão e histórico de alterações.

**Impacto LGPD:** arts. 6º (transparência), 9º e 18.

**Correção:** publicar política completa, versionada, acessível antes do consentimento, no app, no site e no checkout; link no rodapé e no cadastro.

---

### 🟠 LGPD-08 — Marketing para toda a base sem opt-in

**Evidência:** `server/index.ts:1367-1432` — `/api/admin/notificar` monta a lista com **todos** os clientes da Loja Integrada e envia notificações; não consulta `preferencias`; `server/index.ts:1507-1518` permite assinar push informando apenas o e-mail, sem autenticação.

**Impacto LGPD:** art. 7º, I e art. 8º; CDC art. 33 (marketing sem consentimento). Também permite que terceiros inscrevam o e-mail de outra pessoa em push.

**Correção:**
- Opt-in explícito para marketing, separado do contrato.
- Respeitar `profiles.preferencias` antes de enviar.
- Link de descadastro em toda comunicação.
- Autenticar subscribe/unsubscribe e vincular ao token do titular.

---

### 🟠 LGPD-09 — Endpoints públicos com dados de terceiros e fraude de pontos

**Evidência:**
- `GET /api/notificacoes?email=` — `server/index.ts:1440-1450`.
- `GET /api/familia?email=` — `:1270-1280` (retorna e-mails de membros).
- `GET /api/fidelidade/missao?email=` — `:1167-1187`.
- `POST /api/fidelidade/missao/concluir` — `:1229-1242` (concede pontos por e-mail).
- `POST /api/indicacao/converter` e `/registrar` — `:1244-1264` (creditam R$50/pontos).
- `POST /api/notificacoes/:id/lida` — `:1453-1461`.

**Impacto LGPD:** leitura de dados de terceiros por e-mail, concessão indevida de benefícios e criação de indicações com e-mails alheios (arts. 6º e 46).

**Correção:** middleware de autenticação em todas; identidade derivada do token; remover e-mail da query/body; rate limit; idempotência nas missões/indicações.

---

### 🟠 LGPD-10 — CPF e PII expostos na UI e no localStorage

**Evidência:**
- `src/pages/ProfilePage.tsx:925` exibe CPF completo.
- `src/pages/admin/PedidoDetalhe.tsx:117` exibe CPF completo.
- `src/pages/ClienteCadastro.tsx:43-49` grava o objeto do cliente da LI (que inclui `cpf`, telefone e endereço — `src/services/lojaIntegrada/mappers.ts:224-255`) em `localStorage`.
- `src/App.tsx:108-109` e `src/utils/cookies.ts:78-83` guardam access/refresh tokens em `localStorage`.

**Impacto LGPD:** qualquer XSS rouba sessão e PII; o CPF fica legível no dispositivo. Art. 46.

**Correção:**
- Mascarar CPF na UI (`***.***.***-**`), com opção “revelar” apenas quando necessário.
- Não persistir CPF/endereço no localStorage; guardar só token e nome.
- Criptografar/tokenizar CPF no banco; restringir acesso administrativo.
- Migrar tokens para cookie `HttpOnly; Secure; SameSite=Strict`.

---

### 🟠 LGPD-11 — PII em logs sem redação e sem retenção

**Evidência:**
- `server/logger.ts:24-55` grava `ctx` inteiro em arquivo e no Supabase, sem mascarar.
- `server/index.ts:767` loga o body completo de atualização de pedido.
- `server/index.ts:2593` loga e-mail do dono e do body.
- `server/webhook.ts:186` loga e-mail e valor do pagamento.
- `server/index.ts:441` e `:452` logam IP em tentativas de login.

**Impacto LGPD:** art. 46; logs são uma cópia paralela de PII, muitas vezes com acesso mais amplo e retenção maior que o banco.

**Correção:**
- Redigir e-mail, CPF, telefone, tokens e corpo de pagamento antes de logar.
- Nunca logar body completo; usar allowlist de campos.
- Retenção de 90 dias (ou prazo definido) com rotação e expurgo.
- Restringir acesso aos logs e auditar consultas.

---

### 🟠 LGPD-12 — Exclusão incompleta, sem portabilidade e correção limitada

**Evidência:** `server/index.ts:3028-3131`.

A exclusão apaga `profiles`, `enderecos`, `favoritos`, `receitas`, `notificacoes` e `fidelidade`, mas **não apaga**:

- `fidelidade_historico` (histórico de pontos por e-mail);
- `familia` e `indicacoes` (e-mails de terceiros);
- `cupons_usuarios` (`user_id`);
- `afiliados` e `afiliado_vendas`;
- `store_config` → chaves `PUSH_SUB_<email>` (`server/db.ts:905-952`);
- `admin_logs` (detalhes com e-mail);
- `pedidos` (e-mail, valor, `li_dados`) — pode haver retenção fiscal, mas isso precisa ser documentado e minimizado.

Além disso, a exclusão na Loja Integrada é opcional: se as chaves não estiverem configuradas ou a chamada falhar, o código apenas registra warning e segue (`:3085-3100`). Não há comprovante da solicitação nem SLA.

Não existe endpoint de **portabilidade** (art. 18, V). O `PUT /api/cliente/perfil` só aceita nome e telefone (`:3177-3188`); CPF e e-mail não podem ser corrigidos pelo titular (art. 18, III).

**Correção:**
- Ampliar a exclusão para todas as tabelas e para o `store_config`.
- Anonimizar logs em vez de manter PII.
- Definir exceções legais (fiscal) e informar o titular.
- Criar `GET /api/cliente/exportar` com JSON completo.
- Permitir correção de CPF/e-mail com verificação de identidade.
- Registrar solicitação, prazo (15 dias — art. 19) e conclusão.

---

### 🟠 LGPD-13 — Acesso administrativo fraco e auditoria insuficiente

**Evidência:**
- Login único por senha compartilhada (`server/index.ts:429-460`), sem MFA.
- Token de admin em cookie de **30 dias**, sem `HttpOnly` e com `SameSite=Lax` (`src/utils/cookies.ts:18-27, 55-57`).
- `admin_email` é sempre `"admin"` (`server/index.ts:1321`, `1349`, `1431`), pois o token usa `sub: "admin"`.
- Só algumas ações são auditadas; leitura de clientes, pedidos e receitas não é logada.
- Rate limit em memória (`Map`), contornável em múltiplas instâncias.

**Impacto LGPD:** art. 46 e responsabilização (art. 6º, X); impossível saber quem acessou PII.

**Correção:** contas individuais + MFA, sessão curta em cookie `HttpOnly`, RBAC (quem vê receita vs. pedido), auditoria de toda leitura de PII e rate limit persistente (Redis).

---

### 🟠 LGPD-14 — Edge Function `li-proxy` pública com service_role

**Evidência:** `supabase/functions/li-proxy/index.ts:105-123`.

A função responde a qualquer origem (`Access-Control-Allow-Origin: *`), usa `SUPABASE_SERVICE_ROLE_KEY` e repassa qualquer `resource` para a Loja Integrada, incluindo `cliente` e `pedido`. Se estiver implantada, é um proxy aberto para PII.

**Correção:** remover a função ou exigir autenticação, allowlist de recursos e autorização por papel; nunca usar service_role em endpoint público; rotacionar chaves se houve exposição.

---

### 🟡 LGPD-15 — Retenção indefinida

**Evidência:** não há TTL para `profiles`, `enderecos`, `pedidos`, `receitas`, `fidelidade_historico`, `familia`, `indicacoes`, `admin_logs`. Só há limpeza de cupons vencidos (`server/index.ts:3251-3268`) e notificações >24h (`:3270-3283`).

**Impacto LGPD:** arts. 15 e 16 — dados devem ser eliminados após a finalidade, ressalvadas obrigações legais.

**Correção:** matriz de retenção por categoria; job agendado de expurgo/anonimização; documentar exceções fiscais; política de backups (o backup também precisa expirar).

---

### 🟡 LGPD-16 — Governança ausente (DPO, ROPA, RIPD, incidentes)

**Evidência:** nenhum documento de ROPA, RIPD, plano de incidentes ou treinamento no repositório; contato é um Gmail (`public/privacidade.html:20`).

**Impacto LGPD:** arts. 37 (registro das operações), 38 (RIPD), 41 (encarregado), 48 (comunicação de incidentes) e 50 (boas práticas).

**Correção:**
- Nomear encarregado e publicar canal.
- ROPA com finalidades, bases legais, retenção e operadores.
- RIPD para receitas/câmera.
- Plano de resposta a incidentes com prazos (ANPD: 3 dias úteis para incidentes relevantes) e comunicação aos titulares.
- Treinamento anual e revisão da política.

---

### 🟡 LGPD-17 — Terceiros e transferência internacional sem documentação

**Evidência:** Loja Integrada, Mercado Pago, Supabase e Cloudflare recebem dados; não há DPA, lista de subprocessadores ou cláusula de transferência no repositório. A região do projeto Supabase não está documentada.

**Impacto LGPD:** art. 33 e art. 46; responsabilidade solidária na cadeia.

**Correção:** inventário de fornecedores, DPAs, verificação de região/transferência (SCCs ou adequação), menção na política e critérios de segurança contratual.

---

### 🟡 LGPD-18 — Menores sem salvaguarda

**Evidência:** não há verificação de idade no cadastro, no checkout ou no site; ótica infantil é um segmento plausível.

**Impacto LGPD:** art. 14 — tratamento de dados de crianças/adolescentes no melhor interesse, com consentimento parental quando aplicável.

**Correção:** declaração de idade, fluxo de consentimento parental para menores, limitação de marketing e revisão de finalidades.

---

### 🟡 LGPD-19 — Câmera e arquivo de receita sem aviso claro

**Evidência:** `src/components/features/VirtualTryOn.tsx:27-58` acessa a câmera; `dgriffe-site/src/components/features/LensesModal.tsx:57-79` pede CPF e arquivo de receita, mas o arquivo não é enviado (só o nome).

**Impacto LGPD:** transparência (art. 6º, VI; art. 9º) e expectativa do titular.

**Correção:** aviso antes de abrir a câmera (“processado no dispositivo, não armazenado”); não pedir arquivo se não for usado; se for usar, upload seguro com consentimento específico.

---

### 🟡 LGPD-20 — Higiene de segredos e configuração

**Evidência:**
- `hermes app/.env.front` rastreado no Git com URL do Supabase e chave anon.
- `dgriffe-site/.env` rastreado com URL do tunnel.
- `server/.fidelidade.json` rastreado com e-mail de teste.
- Chaves de LI/MP/VAPID em `store_config` em texto puro (`server/db.ts`, `server/index.ts:1481-1484`).
- CSP com `script-src 'unsafe-inline'` (`server/index.ts:379-392`).

**Impacto LGPD:** art. 46. A chave anon é pública por design, mas combinada com RLS permissivo vira acesso amplo. Segredos em texto puro no banco ampliam o impacto de um dump.

**Correção:** remover arquivos de ambiente do Git, rotacionar o que foi exposto, usar secrets do provedor, criptografar segredos no banco, migrar CSP para nonce.

---

### 🟡 LGPD-21 — E-mails em URL e endpoints sem rate limit

**Evidência:** `src/services/receitas.ts:16-24` envia `?email=`; `server/index.ts:1440`, `1270`, `1167`, `1088` usam e-mail na query; não há rate limit global nas rotas públicas.

**Impacto LGPD:** e-mail pessoal em histórico do navegador, logs de CDN e proxies; enumeração de titulares.

**Correção:** usar POST/body ou identificador opaco; remover e-mail de URLs; rate limit global e por identidade.

---

### 🔵 LGPD-22 — Cookies e rastreamento

**Evidência:** não foram encontrados Google Analytics, Meta Pixel, Hotjar, Sentry ou similares em `src/` ou `dgriffe-site/src/`. Há apenas cookies funcionais (`dg_admin_token`) e `localStorage`.

**Impacto LGPD:** baixo. Se não há rastreamento, não é obrigatório banner de cookies, mas a política deve explicar os cookies essenciais.

**Correção:** manter a ausência de rastreamento; se adicionar analytics, implementar consentimento prévio e inventário de cookies.

---

### 🔵 LGPD-23 — Decisões automatizadas de fidelidade

**Evidência:** níveis, cashback e validade são calculados automaticamente (`server/db.ts`, `server/index.ts:1101-1122`).

**Impacto LGPD:** art. 20 — o titular tem direito a revisão de decisões automatizadas que afetem seus interesses. O impacto aqui é baixo (benefício), mas as regras devem ser transparentes.

**Correção:** publicar regras de nível/cashback e canal de revisão humana.

---

## 5. O que já está adequado (manter)

- **Bloqueio de admin fraco em produção:** `ADMIN_PASSWORD` e `ADMIN_SECRET` fracos bloqueiam o login (`server/index.ts:71-99`).
- **Fluxo de exclusão com OTP:** existe e é self-service (`server/index.ts:3028-3131`), ainda que incompleto.
- **Não armazenamento de cartão:** o backend recebe apenas `card_token` (`server/pagamento.ts:99`).
- **Service worker não cacheia API:** `public/sw.js:28-31`.
- **Cabeçalhos de segurança:** HSTS, CSP, `X-Frame-Options`, `nosniff` (`server/index.ts:367-392`).
- **`requireCliente` valida assinatura no Supabase** nas rotas em que é usado (`server/index.ts:3143-3167`).
- **Sem rastreadores de terceiros** no front.
- **Provador virtual não envia imagem** para o servidor.

---

## 6. Matriz de risco e priorização

| Prioridade | Achados | Prazo sugerido |
|---|---|---|
| **P0 — conter** | LGPD-01, LGPD-02, LGPD-03, LGPD-04, LGPD-14 | 0–7 dias |
| **P1 — corrigir** | LGPD-05, LGPD-06, LGPD-07, LGPD-08, LGPD-09, LGPD-10, LGPD-11, LGPD-12, LGPD-13 | 7–30 dias |
| **P2 — estruturar** | LGPD-15, LGPD-16, LGPD-17, LGPD-18, LGPD-19, LGPD-20, LGPD-21 | 30–90 dias |
| **P3 — melhorar** | LGPD-22, LGPD-23 | 90 dias |

### 6.1 Plano P0 (contenção imediata)

1. **Desativar o reset de senha do `login-password`** e exigir OTP para redefinição.
2. **Aplicar autenticação em `receitas` e `favoritos`**; derivar e-mail do token.
3. **Bloquear `cliente` e `pedido` no proxy público** da Loja Integrada; mover para admin/interno.
4. **Corrigir RLS**: remover `USING (true)` para `authenticated`; aplicar migration canônica; testar com dois usuários.
5. **Despublicar/proteger a Edge Function `li-proxy`**; rotacionar chaves se necessário.
6. **Redigir logs** de e-mail/CPF/telefone e limitar retenção.

### 6.2 Plano P1 (30 dias)

- Consentimento (migration + UI + API + registro).
- Consentimento específico para receita e aviso de câmera.
- Política completa e acessível.
- Opt-in de marketing e respeito a preferências.
- Autenticar notificações/família/indicações.
- Mascarar CPF e remover PII do localStorage.
- Exclusão completa + exportação + correção de CPF.
- Admin com MFA, cookie `HttpOnly` e auditoria de leitura.

### 6.3 Plano P2/P3 (90 dias)

- Retenção e expurgo automatizados.
- DPO, ROPA, RIPD, plano de incidentes, treinamento.
- DPAs e transferência internacional.
- Menores.
- Higiene de segredos e CSP nonce.
- Revisão anual.

---

## 7. Correções técnicas sugeridas (esboços)

### 7.1 Middleware único de cliente

Mover `requireCliente` para `server/auth.ts` e reutilizar:

```ts
// server/auth.ts
export async function requireClienteEmail(req, res): Promise<string | null> {
  const token = (req.headers.authorization || "").replace("Bearer ", "").trim();
  if (!token) { res.status(401).json({ erro: "Não autorizado." }); return null; }
  const sb = supabaseClient();
  if (!sb) { res.status(503).json({ erro: "Indisponível." }); return null; }
  const { data: { user }, error } = await sb.auth.getUser(token);
  const email = (user?.email || "").trim().toLowerCase();
  if (error || !user || !email.includes("@")) {
    res.status(401).json({ erro: "Sessão inválida." });
    return null;
  }
  return email;
}
```

Aplicar em `receitas.ts`, `favoritos.ts` e nas rotas de fidelidade/notificações/família:

```ts
receitasApp.use(async (req, res, next) => {
  const email = await requireClienteEmail(req, res);
  if (!email) return;
  (req as any).clienteEmail = email;
  next();
});
```

E usar `(req as any).clienteEmail` — nunca `req.query.email`.

### 7.2 Corrigir o takeover

```ts
if (listUser) {
  const { data, error } = await sb.auth.signInWithPassword({ email: e, password: s });
  if (error) {
    registrarTentativaFalha(ip);
    return res.status(401).json({ erro: "E-mail ou senha inválidos." });
  }
  registrarTentativaSucesso(ip);
  return res.json({ ok: true, session: data.session, user: data.user });
}
```

Redefinição:

```ts
await sb.auth.resetPasswordForEmail(e, { redirectTo: `${siteUrl}/auth/callback` });
```

### 7.3 Bloquear o proxy público

```ts
const RECURSOS_PERMITIDOS = new Set([
  "produto", "produto_preco", "produto_estoque", "produto_imagem",
  "categoria", "marca", "formapagamento", "formaenvio", "situacao", "grades",
]);
// cliente e pedido saem do proxy público.
```

Para o checkout, usar `chamarLI` interno (já é server-side).

### 7.4 Migration de consentimento

```sql
alter table public.profiles
  add column if not exists aceite_lgpd boolean not null default false,
  add column if not exists aceite_lgpd_em timestamptz,
  add column if not exists aceite_lgpd_versao text,
  add column if not exists aceite_marketing boolean not null default false,
  add column if not exists aceite_dados_sensiveis boolean not null default false,
  add column if not exists aceite_dados_sensiveis_em timestamptz;
```

No backend:

```ts
if (req.body?.aceiteLgpd !== true) {
  return res.status(400).json({ erro: "É necessário aceitar a Política de Privacidade." });
}
```

### 7.5 RLS canônico (exemplo)

```sql
alter table public.profiles enable row level security;

drop policy if exists profiles_owner on public.profiles;
create policy profiles_owner on public.profiles
  for all to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

alter table public.enderecos enable row level security;

drop policy if exists enderecos_owner on public.enderecos;
create policy enderecos_owner on public.enderecos
  for all to authenticated
  using (email = (select auth.jwt() ->> 'email'))
  with check (email = (select auth.jwt() ->> 'email'));

-- cupons_usuarios usa user_id, não email
drop policy if exists cupons_usuarios_owner on public.cupons_usuarios;
create policy cupons_usuarios_owner on public.cupons_usuarios
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Nunca criar policy de serviço para authenticated:
-- o service_role já ignora RLS no Supabase.
```

### 7.6 Exportação de dados

```ts
app.get("/api/cliente/exportar", async (req, res) => {
  const email = await requireClienteEmail(req, res);
  if (!email) return;
  const [perfil, enderecos, pedidos, fidelidade, historico, receitas] = await Promise.all([
    buscarPerfil(email), listarEnderecos(email), listarPedidos(email),
    getPontos(email), getHistoricoFidelidade(email, 1000), listarReceitas(email),
  ]);
  res.json({ gerado_em: new Date().toISOString(), perfil, enderecos, pedidos, fidelidade, historico, receitas });
});
```

### 7.7 Redação de logs

```ts
const mascarar = (v: unknown) => String(v ?? "")
  .replace(/[^@\s]+@[^@\s]+\.[^@\s]+/g, "***@***")
  .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "***.***.***-**")
  .replace(/\b\d{10,11}\b/g, "***********");
```

Aplicar em `logger.ts` e remover `req.body` dos logs.

---

## 8. Anexo A — Consultas para confirmar o estado real do Supabase

Executar no SQL Editor (somente leitura):

```sql
-- 1) Quais tabelas têm RLS?
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;

-- 2) Todas as policies
select tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- 3) Policies perigosas (liberam tudo)
select tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and (qual = 'true' or with_check = 'true')
order by tablename;

-- 4) Tabelas sem RLS
select tablename
from pg_tables
where schemaname = 'public' and rowsecurity = false
order by tablename;

-- 5) Colunas de consentimento
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and column_name like 'aceite%'
order by table_name, column_name;

-- 6) Confirmação da coluna usada pela policy de cupons_usuarios
select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'cupons_usuarios';
```

Teste funcional com **usuário de teste** (nunca com dados reais): criar dois usuários A e B; autenticar como A e tentar ler `profiles`, `enderecos`, `fidelidade`, `receitas` de B. O esperado é **0 linhas / 401**, não sucesso.

---

## 9. Anexo B — Estrutura mínima da política de privacidade

1. Identificação do controlador (razão social, CNPJ, endereço).
2. Encarregado (DPO) e canal de contato.
3. Quais dados são coletados, em que momento e por quê.
4. Bases legais por finalidade.
5. Dados sensíveis (receita oftalmológica) e consentimento específico.
6. Compartilhamento com operadores e lista de subprocessadores.
7. Transferência internacional e salvaguardas.
8. Retenção por categoria e critérios de eliminação.
9. Direitos do titular (art. 18) e como exercê-los; prazo de 15 dias.
10. Segurança da informação.
11. Cookies e tecnologias similares.
12. Menores.
13. Incidentes de segurança.
14. Versão, data e histórico de alterações.

---

## 10. Anexo C — Evidências principais

| Tema | Evidência |
|---|---|
| Takeover | `server/index.ts:2860-2910`, `2926-2932` |
| Receitas por e-mail | `server/receitas.ts:22-152`; `server/index.ts:3240` |
| Favoritos por e-mail | `server/favoritos.ts:21-101` |
| Proxy LI público | `server/index.ts:326-341`, `2558-2600` |
| RLS permissivo | `supabase/migracao-familia-indicacoes.sql:24-45`; `server/fix_rls_security.sql:31-179` |
| RLS quebrado | `supabase/fix-rls-c1.sql:17-20`; `supabase/final.sql:12` |
| Edge pública | `supabase/functions/li-proxy/index.ts:105-123` |
| Consentimento ausente | `server/index.ts:2748-2749`; `src/pages/ClienteCadastro.tsx:133-167`; `dgriffe-site/src/pages/LoginPage.tsx:133-135` |
| Política inacessível | `public/privacidade.html:19-40`; `src/pages/TermosPrivacidade.tsx` (não importado) |
| CPF na UI | `src/pages/ProfilePage.tsx:925`; `src/pages/admin/PedidoDetalhe.tsx:117` |
| CPF no localStorage | `src/pages/ClienteCadastro.tsx:43-49`; `src/services/lojaIntegrada/mappers.ts:224-255` |
| PII em logs | `server/logger.ts:24-55`; `server/index.ts:767`, `2593`; `server/webhook.ts:186` |
| Exclusão incompleta | `server/index.ts:3028-3131` |
| Push por e-mail | `server/db.ts:905-952`; `server/index.ts:1507-1518` |
| Marketing em massa | `server/index.ts:1367-1432` |
| Notificações públicas | `server/index.ts:1440-1461` |
| Família pública | `server/index.ts:1270-1291` |
| Câmera local | `src/components/features/VirtualTryOn.tsx:27-58` |
| Arquivo de receita não enviado | `dgriffe-site/src/components/features/LensesModal.tsx:57-70` |
| Cookie admin 30 dias | `src/utils/cookies.ts:18-27`, `55-57` |
| Segredos versionados | `hermes app/.env.front`, `dgriffe-site/.env`, `server/.fidelidade.json` |

---

## 11. Limitações e próximos passos

**Limitações:**
- Não houve acesso ao Supabase de produção; o estado real do RLS precisa ser confirmado (Anexo A).
- Não foram analisados contratos, DPAs, backups, região do Supabase nem logs reais.
- A análise é técnica; a validação jurídica da política, bases legais e transferência internacional deve ser feita por advogado.

**Próximos passos recomendados:**
1. Aprovar e executar o plano P0 (7 dias).
2. Rodar o Anexo A e enviar o resultado para confirmar o RLS.
3. Implementar consentimento, política e exclusão/portabilidade (P1).
4. Nomear encarregado e iniciar ROPA/RIPD (P2).
5. Revisar contratos com LI, MP, Supabase e Cloudflare (P2).

---

*Documento gerado em 2026-10-21 a partir do código em `C:\dgriffe-work`. Atualizar após cada correção.*

---

## 12. Status da remediação P0 (implementação)

Implementado no código em 2026-10-21, sem aplicar nada no Supabase de produção:

| Achado | Status | Evidência da correção |
|---|---|---|
| LGPD-01 — takeover de conta | Corrigido no código | `server/index.ts` (`/api/cliente/login-password`): removido o fallback que redefinia a senha; login agora só aceita `signInWithPassword` válido. Cadastro usa `auth.signUp` em vez de `admin.createUser({ email_confirm: true })`. |
| LGPD-02 — IDOR em receitas/favoritos | Corrigido no código | `server/auth.ts` + `server/receitas.ts` + `server/favoritos.ts`: identidade vem do Bearer validado; filtros por `user_id`; e-mail em query/body ignorado. |
| LGPD-03 — proxy público da LI | Corrigido no código | `server/index.ts`: `cliente` e `pedido` removidos do allowlist público; escritas públicas desabilitadas. Rotas autenticadas `GET/PUT /api/cliente/loja` e `GET /api/cliente/loja/:id` substituem o acesso. Front atualizado em `src/services/lojaIntegrada/clientes.ts` e `src/hooks/useCliente.tsx`. |
| LGPD-04 — RLS | Migração criada; usuário informou que aplicou no Supabase (verificação pendente) | `supabase/migrations/20261021_rls_canonical.sql` remove policies `USING (true)`, religa RLS, remove acesso `anon` e recria policies de dono. Instruções em `supabase/migrations/README.md`. |
| LGPD-11 — PII em logs | Parcialmente corrigido | `server/logger.ts` redige e-mail/CPF/telefone/token/campos sensíveis recursivamente; logs de body/e-mail removidos de `server/index.ts`, `server/webhook.ts`, `server/cupom.ts` e `server/notif.worker.ts`. Retenção/rotação ainda pendente (P1). |
| LGPD-14 — Edge Function `li-proxy` | Fechada por padrão | `supabase/functions/li-proxy/index.ts` e cópia em `hermes app/`: exigem `LI_PROXY_TOKEN`, permitem só GET de catálogo e bloqueiam `cliente`/`pedido`. Sem o secret, respondem 503. |

### Verificações executadas

- `server`: `npm run build` — OK.
- app: `npm run build` e `npx tsc --noEmit` — OK.
- site: `npm run build` (com `tsc -b`) — OK.
- Servidor local (modo demo): `/api/loja-integrada/cliente` e `/api/loja-integrada/pedido` retornam 404; `/api/cliente/receitas`, `/api/cliente/favoritos` e `/api/cliente/loja` sem token retornam 401.

### Pendências para concluir o P0

0. O workflow `.github/workflows/deploy.yml` foi ajustado: ele ainda aplica os
   schemas antigos (que recriam policies `USING (true)`), mas agora executa a
   migração canônica **por último** e falha o deploy se ela falhar. Sem esse
   ajuste, cada push desfaria o RLS aplicado manualmente.
1. Aplicar `supabase/migrations/20261021_rls_canonical.sql` no Supabase de produção e rodar as consultas de verificação do README.
2. Fazer deploy do backend e das Edge Functions (ou remover o deploy da `li-proxy` se não for usada).
3. Testar com uma conta real: login com senha errada (deve 401, sem trocar senha), cadastro com e-mail já existente, leitura/edição de receitas/favoritos de outra conta (deve 401/404) e `GET/PUT /api/cliente/loja`.
4. Configurar `LI_PROXY_TOKEN` apenas se a Edge Function for realmente necessária; caso contrário, deixá-la desativada.
5. Confirmar o estado do RLS com o Anexo A e seguir para o P1 (consentimento, política de privacidade, exclusão/portabilidade, CPF mascarado).
