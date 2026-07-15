# Integração com a Loja Integrada

Este projeto agora busca **produtos**, **clientes** e **pedidos** diretamente
da sua loja na [Loja Integrada](https://www.lojaintegrada.com.br/), em vez de
usar os dados fixos que existiam antes em `src/data.ts`.

## Como está organizado

```
src/services/lojaIntegrada/
  types.ts      → tipos que espelham o formato retornado pela API
  client.ts     → cliente HTTP genérico (fala com o proxy, nunca direto)
  mappers.ts    → converte os dados da API para o formato usado nas telas
  produtos.ts   → listarProdutos(), buscarProduto(), consultarEstoque()
  clientes.ts   → buscarClientePorEmail(), criarCliente(), etc.
  pedidos.ts    → listarPedidosDoCliente(), buscarPedido()

src/hooks/
  useProdutos.ts  → usado em App.tsx para carregar a vitrine
  useCliente.ts   → usado em ProfilePage.tsx para "logar" pelo e-mail
  usePedidos.ts   → usado em ProfilePage.tsx para listar pedidos do cliente

server/index.mjs → proxy Node/Express (guarda as chaves da API)
api/loja-integrada/[...path].js → mesma coisa, versão serverless (Vercel)
```

## Por que existe um servidor proxy no meio

A Loja Integrada exige duas credenciais para autenticar as requisições:
`chave_aplicacao` e `chave_api`. Essas chaves são **secretas** — quem as tiver
consegue ler (e em alguns endpoints, alterar) os dados da sua loja.

Este projeto é buildado como **um único arquivo HTML** que roda inteiramente
no navegador do visitante (`vite-plugin-singlefile`). Qualquer coisa colocada
no código do front-end — inclusive variáveis `VITE_*` — fica visível para
qualquer pessoa que abrir "Ver código-fonte" da página. Por isso as chaves
nunca podem estar no front-end.

A solução é um pequeno servidor (`/server`) que guarda as chaves em variáveis
de ambiente **do servidor** e repassa as chamadas para a Loja Integrada. O
front-end só conhece a URL pública desse proxy.

```
Navegador (React)  →  seu proxy (/server)  →  api.awsli.com.br (Loja Integrada)
   sem chaves            tem as chaves            valida as chaves
```

## Passo a passo para configurar

### 1. Consiga as credenciais da API

1. No painel da sua loja: **Configurações → Chave para API** para gerar a
   `chave_api` (recurso de planos pagos).
2. Solicite a `chave_aplicacao` à Loja Integrada — normalmente pelo e-mail
   `integrador@lojaintegrada.com.br` ou pelo formulário oficial de parceiros.
   Esse passo pode levar alguns dias úteis.
3. Confirme a URL base atual da API em
   https://api-docs.lojaintegrada.com.br/ antes de ir para produção — o
   endpoint usado por padrão aqui é `https://api.awsli.com.br/api/v1`.

### 2. Configure e rode o proxy localmente

```bash
cp server/.env.example server/.env
# edite server/.env e preencha LOJA_INTEGRADA_APP_KEY e LOJA_INTEGRADA_API_KEY

npm install
npm run server
# proxy rodando em http://localhost:8787
```

### 3. Aponte o front-end para o proxy

```bash
cp .env.example .env
# .env já vem com:
# VITE_LOJA_INTEGRADA_PROXY_URL=http://localhost:8787/api/loja-integrada

npm run dev
```

Abra o app — a vitrine (Home/Catálogo) deve carregar os produtos reais da sua
loja. Se aparecer uma mensagem de erro vermelha, confira o console do proxy
(`npm run server`) para ver o motivo (chaves erradas, loja sem produtos
ativos, etc).

### 4. Hospedando em produção

- **Proxy**: qualquer serviço que rode Node — Render, Railway, Fly.io, um
  VPS, etc. Ou use a versão serverless em `api/loja-integrada/[...path].js`
  se for hospedar na Vercel.
- **Front-end**: continua sendo o arquivo HTML único gerado por
  `npm run build` (pasta `dist/`), hospedado onde você já hospeda hoje.
- Depois de hospedar o proxy, atualize `VITE_LOJA_INTEGRADA_PROXY_URL` (no
  ambiente de build do front-end) para a URL pública do proxy em produção, e
  `FRONTEND_ORIGIN` (no ambiente do proxy) para o domínio do seu site — isso
  evita que outros sites usem seu proxy.

## O que já está conectado

- **Produtos** (Home + Catálogo): `useProdutos()` busca a lista real de
  produtos ativos, com nome, preço, promoção, imagem, categoria e estoque.
- **Clientes**: a aba "Perfil" agora pede o e-mail cadastrado na loja e busca
  o cliente correspondente via API (veja a nota de segurança abaixo).
- **Pedidos**: depois de "logado", a aba "Perfil" lista os pedidos reais
  daquele cliente (número, status, total, itens).

## Limitações e decisões que você deve revisar

- **Login por e-mail não é autenticação forte.** A API da Loja Integrada não
  expõe login/senha do cliente final. O fluxo atual apenas busca o cadastro
  pelo e-mail informado — qualquer pessoa que souber o e-mail de outra
  consegue ver os pedidos dela. Para produção, adicione uma verificação (ex.:
  código enviado por e-mail/SMS) antes de exibir os dados.
- **Cores dos produtos**: a Loja Integrada não guarda cor em hexadecimal. O
  código lê tags no formato `cor:NomeDaCor` (ex.: `cor:Preto, cor:Dourado`)
  cadastradas no campo "Tags" do produto. Se você preferir usar as variações
  reais (grade "Cor"), isso pode ser trocado por uma chamada aos endpoints de
  grade/variação — avise que eu implemento.
- **Parcelamento e preço PIX**: a API não retorna "parcelas" nem "preço PIX"
  prontos no cadastro do produto (isso normalmente vem da configuração do
  meio de pagamento no checkout). Por padrão o código assume 5x sem juros e
  preço PIX igual ao preço normal — ajuste as constantes em
  `src/services/lojaIntegrada/mappers.ts` (`calcularParcelamento` e
  `PIX_DISCOUNT`) para refletir as regras reais da sua loja.
- **Avaliações/reviews**: a Loja Integrada não tem um sistema de avaliações
  na API padrão — os campos `rating`/`reviews` ficam zerados. Se você usa um
  app de reviews (Trustvox, Avaliação Verificada, etc.), dá para integrar à
  parte.
- **Carrinho e finalização de compra**: este projeto ainda usa um carrinho
  local (em memória) e não fecha pedido pela API. Para o botão de comprar
  levar a um checkout real, o caminho mais simples costuma ser redirecionar
  para a URL da própria loja (`produto.url` já vem no mapeamento) — posso
  implementar esse redirecionamento se você quiser.

## Endpoints usados hoje

| Recurso | Endpoint | Uso |
|---|---|---|
| Produtos | `GET /produto/` | Home, Catálogo |
| Categorias | `GET /categoria/` | Nome da categoria de cada produto |
| Clientes | `GET /cliente/?email=...` | Login simples por e-mail |
| Pedidos | `GET /pedido/?cliente=...` | Aba "Meus Pedidos" |
| Situações | `GET /situacaopedido/` | Status de pedido (usado no admin) |

Todos passam pelo proxy em `/api/loja-integrada/<recurso>/`, nunca
diretamente do navegador para `api.awsli.com.br`.

## Área de administrador (`/admin`)

Há um painel protegido para o dono da loja gerenciar pedidos. Acessível pela
URL `index.html#/admin` (ou `#/admin` em produção). Funcionalidades:

- **Login por senha** — validada no proxy (`ADMIN_PASSWORD` em `server/.env`),
  que devolve um token HMAC assinado (válido por 1h, guardado em
  `sessionStorage`). A senha e o segredo **nunca** ficam no front-end.
- **Listar todos os pedidos** (não só de um cliente), com busca por nº/e-mail,
  filtro por status e **exportação CSV**.
- **Mudar o status** de um pedido (`PUT /pedido/<id>/` com a nova situação).
- **Marcar como verificado** — flag persistida em `server/.admin-state.json`
  (no servidor Node). Na Vercel (serverless), fica em memória por instância.

Endpoints (todos exigem `Authorization: Bearer <token>`):

| Método | Endpoint | Uso |
|---|---|---|
| POST | `/api/admin/login` | Validar senha e obter token |
| GET | `/api/admin/pedidos` | Lista de pedidos + flag `verificado` |
| GET | `/api/admin/pedidos/:id` | Detalhe de um pedido |
| PUT | `/api/admin/pedidos/:id` | Mudar `situacao` do pedido |
| POST | `/api/admin/pedidos/:id/verificar` | Marcar/desmarcar verificado |
| GET | `/api/admin/situacoes` | Situações disponíveis (dropdown) |

Para usar: defina `ADMIN_PASSWORD` (e, de preferência, `ADMIN_SECRET`) em
`server/.env`. Em produção, ajuste `FRONTEND_ORIGIN` e aponte o front-end para
a URL pública do proxy — o front-end deriva a base `/api/admin` a partir de
`VITE_LOJA_INTEGRADA_PROXY_URL`.

