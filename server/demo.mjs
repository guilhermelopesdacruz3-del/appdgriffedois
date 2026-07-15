// ===========================================================================
// MODO DEMO — dados fictícios no formato EXATO da API da Loja Integrada.
//
// O front-end não sabe que está em demo: ele recebe os mesmos envelopes
// Tastypie ({ meta, objects }) e os mesmos campos que a API real devolveria,
// então os mappers (src/services/lojaIntegrada/mappers.ts) funcionam 1:1.
//
// Liga/desliga via DEMO_MODE no server/.env. Quando false (ou ausente) e as
// chaves estiverem preenchidas, o proxy volta a chamar a Loja Integrada real.
// ===========================================================================

const API = "https://api.awsli.com.br/api/v1";
const img = (nome) => `/images/${nome}`;

// --- Categorias (usadas para resolver o nome exibido no card) ---------------
const categorias = [
  { id: 1, nome: "Sol", descricao: "", categoria_pai: null, url: "", resource_uri: `${API}/categoria/1/` },
  { id: 2, nome: "Grau", descricao: "", categoria_pai: null, url: "", resource_uri: `${API}/categoria/2/` },
  { id: 3, nome: "Ray-Ban", descricao: "", categoria_pai: null, url: "", resource_uri: `${API}/categoria/3/` },
  { id: 4, nome: "Grazi", descricao: "", categoria_pai: null, url: "", resource_uri: `${API}/categoria/4/` },
  { id: 5, nome: "Michael Kors", descricao: "", categoria_pai: null, url: "", resource_uri: `${API}/categoria/5/` },
  { id: 6, nome: "Infantil", descricao: "", categoria_pai: null, url: "", resource_uri: `${API}/categoria/6/` },
];

// --- Marcas ----------------------------------------------------------------
const marcas = [
  { id: 1, nome: "Ray-Ban", apelido: "rb", ativo: true, resource_uri: `${API}/marca/1/` },
  { id: 2, nome: "Michael Kors", apelido: "mk", ativo: true, resource_uri: `${API}/marca/2/` },
  { id: 3, nome: "Vogue", apelido: "vg", ativo: true, resource_uri: `${API}/marca/3/` },
  { id: 4, nome: "Armani", apelido: "ar", ativo: true, resource_uri: `${API}/marca/4/` },
  { id: 5, nome: "Grazi", apelido: "gz", ativo: true, resource_uri: `${API}/marca/5/` },
  { id: 6, nome: "Aviator", apelido: "av", ativo: true, resource_uri: `${API}/marca/6/` },
];

// --- Produtos (imagem = arquivo real em public/images/) ----------------------
function produto(p) {
  return {
    id: p.id,
    nome: p.nome,
    apelido: "",
    sku: p.sku,
    gtin: null,
    ncm: null,
    ativo: true,
    removido: false,
    bloqueado: false,
    destaque: !!p.destaque,
    usado: false,
    descricao_completa: p.descricao,
    preco_cheio: p.precoCheio,
    preco_promocional: p.precoPromo ?? null,
    preco_custo: null,
    preco_sob_consulta: false,
    estoque_quantidade: p.estoque ?? 10,
    estoque_gerenciado: true,
    estoque_situacao_em_estoque: 1,
    estoque_situacao_sem_estoque: 2,
    peso: "0.050",
    altura: "5",
    largura: "15",
    profundidade: "5",
    marca: `${API}/marca/${p.marcaId}/`,
    pai: null,
    tags: p.tags ?? "",
    url: `/produto/${p.id}/`,
    url_video_youtube: null,
    imagem_principal: {
      id: p.id * 100,
      principal: true,
      posicao: 1,
      pequena: img(p.imagem),
      media: img(p.imagem),
      grande: img(p.imagem),
      icone: img(p.imagem),
      mime: "image/jpeg",
      resource_uri: `${API}/produto_imagem/${p.id * 100}/`,
    },
    imagens: [],
    categorias: [`${API}/categoria/${p.categoriaId}/`],
    categoria: `${API}/categoria/${p.categoriaId}/`,
    variacoes: [],
    resource_uri: `${API}/produto/${p.id}/`,
    data_criacao: "2026-01-10T12:00:00",
    data_modificacao: "2026-06-01T12:00:00",
  };
}

const produtosBase = [
  {
    id: 101, nome: "Ray-Ban Aviador Clássico", sku: "RB3025", precoCheio: 1290.0, precoPromo: 1099.0,
    estoque: 15, marcaId: 1, categoriaId: 1, imagem: "product-gold-aviator.jpg", destaque: true,
    descricao: "Aviador clássico em metal dourado com lentes verdes. Ícone de estilo atemporal.",
    tags: "cor:Dourado, cor:Verde, try-on, bestseller",
  },
  {
    id: 102, nome: "Ray-Ban Wayfarer Preto", sku: "RB2140", precoCheio: 1190.0, precoPromo: null,
    estoque: 8, marcaId: 1, categoriaId: 1, imagem: "product-black-wayfarer.jpg", destaque: true,
    descricao: "Wayfarer em acetato preto fosco. O modelo mais icônico da marca.",
    tags: "cor:Preto, 3d",
  },
  {
    id: 103, nome: "Michael Kors Aviador Rose", sku: "MK5001", precoCheio: 990.0, precoPromo: 840.0,
    estoque: 12, marcaId: 2, categoriaId: 1, imagem: "product-mk-aviator.jpg", destaque: false,
    descricao: "Aviador feminino em rose gold com lentes degradê. Elegância contemporânea.",
    tags: "cor:Rose, cor:Rosé, try-on",
  },
  {
    id: 104, nome: "Vogue Trendy Oversized", sku: "VOTD", precoCheio: 870.0, precoPromo: 699.0,
    estoque: 20, marcaId: 3, categoriaId: 1, imagem: "product-vogue-trendy.jpg", destaque: true,
    descricao: "Modelo oversized da linha Trendy. Proteção UV400 e armação leve.",
    tags: "cor:Preto, cor:Tartaruga, try-on",
  },
  {
    id: 105, nome: "Armani Modern Square", sku: "EA...0", precoCheio: 1450.0, precoPromo: null,
    estoque: 6, marcaId: 4, categoriaId: 1, imagem: "product-armani-modern.jpg", destaque: false,
    descricao: "Formato quadrado moderno em metal. Acabamento premium assinado Armani.",
    tags: "cor:Prata, 3d",
  },
  {
    id: 106, nome: "Grazi Cat Eye", sku: "GZCE", precoCheio: 760.0, precoPromo: 599.0,
    estoque: 14, marcaId: 5, categoriaId: 4, imagem: "product-grazi-cateye.jpg", destaque: false,
    descricao: "Cat eye da linha Grazi. Traço feminino e sofisticado para o dia a dia.",
    tags: "cor:Marrom, cor:Tartaruga, try-on",
  },
  {
    id: 107, nome: "Cat Eye Clássico", sku: "CE001", precoCheio: 540.0, precoPromo: 459.0,
    estoque: 18, marcaId: 6, categoriaId: 2, imagem: "product-cateye.jpg", destaque: false,
    descricao: "Cat eye clássico em acetato. Versátil para prescrição ou sol.",
    tags: "cor:Preto, 3d",
  },
  {
    id: 108, nome: "Redondo Vintage", sku: "RD002", precoCheio: 480.0, precoPromo: null,
    estoque: 22, marcaId: 6, categoriaId: 2, imagem: "product-round.jpg", destaque: false,
    descricao: "Redondo estilo vintage em metal. Nostalgia com conforto moderno.",
    tags: "cor:Dourado, try-on",
  },
];

const produtos = produtosBase.map(produto);

// --- Cliente(s) demo --------------------------------------------------------
function clienteDemo(email) {
  return {
    id: 1,
    tipo: "PF",
    nome: "Maria Cliente Demo",
    razao_social: null,
    email: email || "cliente@demo.com.br",
    cpf: "123.456.789-00",
    cnpj: null,
    rg: null,
    ie: null,
    sexo: "F",
    data_nascimento: "1990-05-20",
    telefone_principal: "(11) 4000-0000",
    telefone_celular: "(11) 99999-0000",
    telefone_comercial: null,
    aceita_newsletter: true,
    grupo_id: null,
    grupo_nome: null,
    enderecos: [
      {
        id: 1, nome: "Casa", endereco: "Rua Demo", numero: "100", complemento: "Apto 1",
        bairro: "Centro", cidade: "São Paulo", estado: "SP", cep: "01000-000",
        pais: "BR", referencia: "", principal: true, resource_uri: `${API}/cliente_endereco/1/`,
      },
    ],
    data_criacao: "2026-02-01T10:00:00",
    data_modificacao: "2026-06-15T10:00:00",
    resource_uri: `${API}/cliente/1/`,
  };
}

// --- Pedidos demo -----------------------------------------------------------
const situacoes = [
  { id: 8, codigo: "em_producao", nome: "Em produção", aprovado: false, cancelado: false, final: false, notificar_comprador: true, padrao: false, resource_uri: `${API}/situacaopedido/8/` },
  { id: 11, codigo: "aguardando_pagamento", nome: "Aguardando pagamento", aprovado: false, cancelado: false, final: false, notificar_comprador: true, padrao: false, resource_uri: `${API}/situacaopedido/11/` },
  { id: 3, codigo: "entregue", nome: "Entregue", aprovado: true, cancelado: false, final: true, notificar_comprador: true, padrao: false, resource_uri: `${API}/situacaopedido/3/` },
];

function pedidoDemo(id, numero, clienteId, clienteNome, clienteEmail, codSituacao, nomeSituacao, data, itens, total) {
  return {
    id, numero, id_externo: null,
    cliente: `${API}/cliente/${clienteId}/`, cliente_id: clienteId,
    cliente_nome: clienteNome, cliente_email: clienteEmail, cliente_cpf: null, cliente_cnpj: null,
    situacao: { id: codSituacao === "entregue" ? 3 : codSituacao === "em_producao" ? 8 : 11, codigo: codSituacao, nome: nomeSituacao, aprovado: codSituacao === "entregue", cancelado: false, final: codSituacao === "entregue", notificar_comprador: true, padrao: false, resource_uri: `${API}/situacaopedido/${codSituacao === "entregue" ? 3 : codSituacao === "em_producao" ? 8 : 11}/` },
    data_criacao: data, data_modificacao: data,
    valor_subtotal: total, valor_desconto: 0, valor_envio: 0, valor_total: total,
    peso_real: "0.200",
    itens: itens.map((it, i) => ({
      id: id * 10 + i, produto: `${API}/produto/${it.id}/`, produto_pai: null, sku: it.sku,
      nome: it.nome, quantidade: it.qtd, preco_cheio: it.preco, preco_promocional: null,
      preco_venda: it.preco, preco_subtotal: it.preco * it.qtd, variacao: null,
    })),
    pagamentos: [{ id: id * 10, forma_pagamento: { id: 5, nome: "Pix", codigo: "pix" }, valor: total, valor_pago: total, parcelamento_numero_parcelas: 1, parcelamento_valor_parcela: total, pix_code: null, pix_qrcode: null, boleto_url: null, bandeira: null }],
    envios: [{ id: id * 10, forma_envio: { id: 1, nome: "Frete Grátis", tipo: "sedex" }, valor: 0, prazo: 5, objeto: codSituacao === "entregue" ? "BR123456789BR" : null }],
    endereco_entrega: { nome: "Maria Cliente Demo", endereco: "Rua Demo", numero: "100", complemento: "Apto 1", bairro: "Centro", cidade: "São Paulo", estado: "SP", cep: "01000-000", pais: "BR" },
    resource_uri: `${API}/pedido/${id}/`,
  };
}

const pedidosDemo = [
  pedidoDemo(901, "DG-2026001", 1, "Maria Cliente Demo", "cliente@demo.com.br", "em_producao", "Em produção", "2026-06-20T14:30:00",
    [{ id: 101, sku: "RB3025", nome: "Ray-Ban Aviador Clássico", qtd: 1, preco: 1099.0 }], 1099.0),
  pedidoDemo(902, "DG-2026002", 1, "Maria Cliente Demo", "cliente@demo.com.br", "entregue", "Entregue", "2026-05-12T09:10:00",
    [{ id: 104, sku: "VOTD", nome: "Vogue Trendy Oversized", qtd: 2, preco: 699.0 }], 1398.0),
];

// ===========================================================================
// Helpers de resposta
// ===========================================================================
function envelope(objects, query) {
  const limit = Number(query.limit ?? 20);
  const offset = Number(query.offset ?? 0);
  return {
    meta: {
      limit,
      offset,
      total_count: objects.length,
      next: null,
      previous: null,
    },
    objects,
  };
}

export const demoLoginPassword = "demo123";

/**
 * Responde rotas de dados públicas (/api/loja-integrada/*) em modo demo.
 * Retorna null se o recurso não for tratado (cai no fluxo real).
 */
export function demoResponder(resource, id, method, query) {
  switch (resource) {
    case "produto": {
      if (id) {
        const p = produtos.find((x) => String(x.id) === String(id));
        return p ? { status: 200, body: p } : { status: 404, body: { erro: "Produto não encontrado (demo)." } };
      }
      let lista = produtos;
      if (query.nome__icontains) {
        const t = String(query.nome__icontains).toLowerCase();
        lista = lista.filter((p) => p.nome.toLowerCase().includes(t));
      }
      if (query.categorias) {
        const cid = String(query.categorias);
        lista = lista.filter((p) => p.categorias.includes(`${API}/categoria/${cid}/`));
      }
      return { status: 200, body: envelope(lista, query) };
    }
    case "categoria":
      return { status: 200, body: envelope(categorias, query) };
    case "marca":
      return { status: 200, body: envelope(marcas, query) };
    case "cliente": {
      // Login por e-mail: devolve o cliente demo para qualquer e-mail digitado.
      const email = query.email ? String(query.email) : undefined;
      return { status: 200, body: envelope([clienteDemo(email)], query) };
    }
    case "pedido": {
      const cid = query.cliente ? String(query.cliente) : null;
      const lista = cid ? pedidosDemo.filter((p) => String(p.cliente_id) === cid) : pedidosDemo;
      return { status: 200, body: envelope(lista, query) };
    }
    default:
      return null;
  }
}

/** POST /api/loja-integrada/cliente — cria cliente fake em demo. */
export function demoCriarCliente(payload) {
  return {
    status: 201,
    body: clienteDemo(payload?.email),
  };
}

/** GET /api/admin/pedidos — lista todos os pedidos demo (com flag de verificação). */
export function demoAdminPedidos() {
  const objects = pedidosDemo.map((p) => ({ ...p, verificado: false, verificado_em: null }));
  return { ...envelope(objects, {}), objects };
}

/** GET /api/admin/pedidos/:id */
export function demoAdminPedido(id) {
  const p = pedidosDemo.find((x) => String(x.id) === String(id));
  if (!p) return { status: 404, body: { erro: "Pedido não encontrado (demo)." } };
  return { status: 200, body: { ...p, verificado: false, verificado_em: null } };
}

/** GET /api/admin/situacoes */
export function demoAdminSituacoes() {
  return situacoes;
}
