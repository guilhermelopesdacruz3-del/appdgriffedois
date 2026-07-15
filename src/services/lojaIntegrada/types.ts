/**
 * Tipos que espelham o formato de dados retornado pela API REST da Loja Integrada.
 *
 * Referência: https://api-docs.lojaintegrada.com.br/
 * Campos conferidos em: https://ajuda.lojaintegrada.com.br (jun/2026)
 *
 * A API da Loja Integrada segue o padrão Tastypie (Django REST): listagens vêm
 * dentro de um envelope `{ meta, objects }` e cada objeto tem um `resource_uri`.
 * Ajuste os tipos abaixo caso a sua conta retorne campos diferentes — a
 * documentação oficial é renderizada via JS (Postman) e pode variar por plano/versão.
 */

export interface LIMeta {
  limit: number;
  offset: number;
  total_count: number;
  next: string | null;
  previous: string | null;
}

export interface LIListResponse<T> {
  meta: LIMeta;
  objects: T[];
}

/** ---------- PRODUTOS ---------- */

export interface LIImagemProduto {
  id: number;
  principal: boolean;
  posicao: number;
  pequena: string;
  media: string;
  grande: string;
  icone: string;
  mime: string;
  resource_uri: string;
}

export interface LIProduto {
  id: number;
  nome: string;
  apelido: string;
  sku: string;
  gtin: string | null;
  ncm: string | null;
  ativo: boolean;
  removido: boolean;
  bloqueado: boolean;
  destaque: boolean;
  usado: boolean;
  descricao_completa: string;
  preco_cheio: string | number;
  preco_promocional: string | number | null;
  preco_custo: string | number | null;
  preco_sob_consulta: boolean;
  estoque_quantidade: number;
  estoque_gerenciado: boolean;
  estoque_situacao_em_estoque: number;
  estoque_situacao_sem_estoque: number;
  peso: string | number;
  altura: string | number;
  largura: string | number;
  profundidade: string | number;
  marca: string | null;
  pai: string | null;
  tags: string;
  url: string;
  url_video_youtube: string | null;
  imagem_principal: LIImagemProduto | null;
  imagens?: LIImagemProduto[];
  categorias?: string[];
  categoria?: string | null;
  variacoes?: string[];
  resource_uri: string;
  data_criacao: string;
  data_modificacao: string;
}

export interface LICategoria {
  id: number;
  nome: string;
  descricao: string;
  categoria_pai: string | null;
  url: string;
  resource_uri: string;
}

export interface LIMarca {
  id: number;
  nome: string;
  apelido: string;
  ativo: boolean;
  resource_uri: string;
}

export interface LIGradeVariacao {
  id: number;
  nome: string;
  nome_visivel: string;
  resource_uri: string;
}

export interface LIVariacao {
  id: number;
  nome: string;
  grade: string;
  resource_uri: string;
}

/** ---------- CLIENTES ---------- */

export interface LIEnderecoCliente {
  id: number;
  nome: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  pais: string;
  referencia: string;
  principal: boolean;
  resource_uri: string;
}

export interface LICliente {
  id: number;
  tipo: "PF" | "PJ" | string;
  nome: string;
  razao_social: string | null;
  email: string;
  cpf: string | null;
  cnpj: string | null;
  rg: string | null;
  ie: string | null;
  sexo: string | null;
  data_nascimento: string | null;
  telefone_principal: string | null;
  telefone_celular: string | null;
  telefone_comercial: string | null;
  aceita_newsletter: boolean;
  grupo_id?: string | null;
  grupo_nome?: string | null;
  enderecos?: LIEnderecoCliente[];
  data_criacao: string;
  data_modificacao: string;
  resource_uri: string;
}

/** ---------- PEDIDOS ---------- */

export interface LIItemPedido {
  id: number;
  produto: string; // resource_uri do produto
  produto_pai?: string | null;
  sku: string;
  nome: string;
  quantidade: number;
  preco_cheio: string | number;
  preco_promocional?: string | number | null;
  preco_venda: string | number;
  preco_subtotal: string | number;
  variacao?: string | null;
}

export interface LIPagamentoPedido {
  id: number;
  forma_pagamento: {
    id: number;
    nome: string;
    codigo: string;
  };
  valor: string | number;
  valor_pago?: string | number;
  parcelamento_numero_parcelas?: number;
  parcelamento_valor_parcela?: string | number;
  pix_code?: string | null;
  pix_qrcode?: string | null;
  boleto_url?: string | null;
  bandeira?: string | null;
}

export interface LIEnvioPedido {
  id: number;
  forma_envio: {
    id: number;
    nome: string;
    tipo: string;
  };
  valor: string | number;
  prazo: number;
  objeto?: string | null;
}

export interface LISituacaoPedido {
  id: number;
  codigo: string;
  nome: string;
  aprovado: boolean;
  cancelado: boolean;
  final: boolean;
  notificar_comprador: boolean;
  padrao: boolean;
  resource_uri: string;
}

export interface LIPedido {
  id: number;
  numero: string;
  id_externo: string | null;
  cliente: string; // resource_uri
  cliente_id?: number;
  cliente_nome: string;
  cliente_email: string;
  cliente_cpf?: string | null;
  cliente_cnpj?: string | null;
  situacao: LISituacaoPedido;
  data_criacao: string;
  data_modificacao: string;
  valor_subtotal: string | number;
  valor_desconto: string | number;
  valor_envio: string | number;
  valor_total: string | number;
  peso_real?: string | number;
  itens: LIItemPedido[];
  pagamentos?: LIPagamentoPedido[];
  envios?: LIEnvioPedido[];
  endereco_entrega?: {
    nome: string;
    endereco: string;
    numero: string;
    complemento: string;
    bairro: string;
    cidade: string;
    estado: string;
    cep: string;
    pais: string;
  };
  resource_uri: string;
}
