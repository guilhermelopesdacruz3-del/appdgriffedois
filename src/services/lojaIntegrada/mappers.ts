import type { Product } from "../../data";
import type { LICategoria, LICliente, LIMarca, LIPedido, LIProduto } from "./types";

/** A API retorna preços/números às vezes como string ("199.90"), às vezes como number. */
function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  return typeof value === "number" ? value : parseFloat(value);
}

/** Remove tags HTML simples da descrição completa (a LI guarda a descrição em HTML). */
function stripHtml(html: string | undefined | null): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parcelamento: a Loja Integrada não expõe "número de parcelas" no cadastro do
 * produto (isso normalmente vem da configuração do meio de pagamento no
 * checkout). Aqui aplicamos um padrão de 5x sem juros só para manter a UI
 * funcionando — troque por regra real se você tiver uma tabela de parcelamento.
 */
function calcularParcelamento(preco: number): { installmentCount: number; installmentValue: number } {
  const installmentCount = 5;
  return { installmentCount, installmentValue: preco / installmentCount };
}

/**
 * PIX: a LI não retorna um "preço PIX" pronto no cadastro de produto. Se a sua
 * loja aplica desconto fixo no PIX (ex.: 8%), ajuste PIX_DISCOUNT abaixo.
 * Deixando em 0 o preço PIX fica igual ao preço normal.
 */
const PIX_DISCOUNT = 0; // ex.: 0.08 para 8% de desconto

/**
 * A Loja Integrada não guarda cor em hexadecimal por padrão. Para exibir os
 * "chips" de cor no catálogo sem precisar buscar grades/variações produto a
 * produto (custaria 1 chamada extra por produto), este mapeador lê tags no
 * formato "cor:NomeDaCor" cadastradas no produto (campo Tags, separadas por
 * vírgula — ex.: "cor:Preto, cor:Dourado, bestseller").
 *
 * Se preferir usar as variações reais da Loja Integrada (grade "Cor"), troque
 * esta função por uma chamada a /produtos_grade/ e /produtos_grade_variacoes/.
 */
const HEX_POR_NOME_COR: Record<string, string> = {
  preto: "#1A1A1A",
  "preto fosco": "#1A1A1A",
  branco: "#F5F5F5",
  prata: "#C0C0C0",
  dourado: "#D4A853",
  "light gold": "#D4A853",
  "rose gold": "#E8B4B8",
  rose: "#FFB6C1",
  rosé: "#FFB6C1",
  havana: "#8B4513",
  tartaruga: "#8B4513",
  marrom: "#8B4513",
  azul: "#2C3E50",
  "azul marinho": "#2C3E50",
  "azul escuro": "#2C3E50",
  navy: "#2C3E50",
  cinza: "#696969",
  "cinza fosco": "#696969",
  lead: "#696969",
  vermelho: "#B22222",
  verde: "#2E7D32",
};

function extrairCoresDasTags(tagsBrutas: string | undefined): { colors: string[]; colorNames: string[] } {
  const tags = (tagsBrutas || "").split(",").map((t) => t.trim());
  const coresTags = tags.filter((t) => t.toLowerCase().startsWith("cor:"));

  const colorNames = coresTags.map((t) => t.slice(4).trim());
  const colors = colorNames.map((nome) => HEX_POR_NOME_COR[nome.toLowerCase()] || "#9CA3AF");

  return { colors, colorNames };
}

/**
 * Extrai o id numérico de uma referência que pode vir como resource_uri
 * ("/api/v1/categoria/12/") ou como id puro ("12"). Usado para cruzar o
 * produto com o lookup de categorias/marcas independente do prefixo da URI
 * que a Loja Integrada retornar.
 */
function extrairId(ref: string | number | null | undefined): number | null {
  if (ref === null || ref === undefined || ref === "") return null;
  if (typeof ref === "number") return ref;
  const match = String(ref).match(/(\d+)\/?$/);
  return match ? Number(match[1]) : null;
}

/** Monta um dicionário id/resource_uri -> nome de categoria, para resolver o nome exibido no card do produto. */
export function mapCategoriasParaLookup(categorias: LICategoria[]): Record<string, string> {
  const lookup: Record<string, string> = {};
  categorias.forEach((categoria) => {
    lookup[String(categoria.id)] = categoria.nome;
    lookup[categoria.resource_uri] = categoria.nome;
    const id = extrairId(categoria.resource_uri);
    if (id !== null) lookup[String(id)] = categoria.nome;
  });
  return lookup;
}

/**
 * Monta um dicionário id/resource_uri -> nome de marca. O campo `produto.marca`
 * vem como resource_uri (ex.: "/api/v1/marca/12/"), então sem esse lookup o
 * card do produto mostraria o ID numérico da marca em vez do nome (ex.: "Ray-Ban").
 */
export function mapMarcasParaLookup(marcas: LIMarca[]): Record<string, string> {
  const lookup: Record<string, string> = {};
  marcas.forEach((marca) => {
    lookup[String(marca.id)] = marca.nome;
    lookup[marca.resource_uri] = marca.nome;
    const id = extrairId(marca.resource_uri);
    if (id !== null) lookup[String(id)] = marca.nome;
  });
  return lookup;
}

/** Converte um LIProduto (Loja Integrada) para o tipo Product usado pelos componentes existentes. */
export function mapProdutoParaProduct(
  produto: LIProduto,
  categoriasLookup: Record<string, string> = {},
  marcasLookup: Record<string, string> = {}
): Product {
  const precoCheio = toNumber(produto.preco_cheio);
  const precoPromocional = toNumber(produto.preco_promocional);
  const price = precoPromocional > 0 && precoPromocional < precoCheio ? precoPromocional : precoCheio;
  const originalPrice = precoPromocional > 0 && precoPromocional < precoCheio ? precoCheio : undefined;

  const tags = (produto.tags || "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  // A Loja Integrada pode retornar as categorias do produto em `categorias`
  // (lista de resource_uris) ou em `categoria` (resource_uri única). Resolvemos
  // o nome real usando os dois formatos e também o id numérico, para não
  // depender do prefixo exato da URI que a API devolver.
  const categoriaRefs = [
    ...(produto.categorias || []),
    produto.categoria,
  ].filter((ref): ref is string => typeof ref === "string" && ref.length > 0);

  const categoriaNome =
    categoriaRefs.length > 0
      ? (categoriaRefs
          .map((ref) => categoriasLookup[ref] || categoriasLookup[String(extrairId(ref))])
          .find((nome): nome is string => Boolean(nome)) || "Geral")
      : "Geral";

  const imagem =
    produto.imagem_principal?.grande ||
    produto.imagem_principal?.media ||
    produto.imagens?.[0]?.grande ||
    "";

  const { colors, colorNames } = extrairCoresDasTags(produto.tags);

  // produto.marca vem como resource_uri (ex.: "/api/v1/marca/12/") — resolvemos
  // o nome real via marcasLookup (por URI e por id); sem isso o card mostraria
  // só o ID numérico.
  const marcaRef = produto.marca || "";
  const brand = marcaRef
    ? marcasLookup[marcaRef] || marcasLookup[String(extrairId(marcaRef))] || ""
    : "";

  return {
    id: produto.id,
    name: produto.nome,
    brand,
    code: produto.sku,
    price,
    originalPrice,
    pixPrice: PIX_DISCOUNT > 0 ? price * (1 - PIX_DISCOUNT) : price,
    description: stripHtml(produto.descricao_completa),
    category: categoriaNome,
    // Cores lidas de tags "cor:NomeDaCor" — veja extrairCoresDasTags acima.
    colors,
    colorNames,
    has3D: tags.includes("3d"),
    hasTryOn: tags.includes("try-on") || tags.includes("prova-virtual"),
    image: imagem,
    badge: produto.destaque ? "Destaque" : undefined,
    rating: 0,
    reviews: 0,
    ...calcularParcelamento(price),
    li_uri: produto.resource_uri,
  };
}

export interface ClienteApp {
  id: number;
  nome: string;
  email: string;
  cpf: string | null;
  telefone: string | null;
  dataCriacao: string;
  rua?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
}

export function mapClienteParaApp(cliente: LICliente): ClienteApp {
  const enderecoPrincipal = cliente.enderecos?.find((e) => e.principal) || cliente.enderecos?.[0];
  return {
    id: cliente.id,
    nome: cliente.nome || "",
    email: cliente.email,
    cpf: cliente.cpf,
    telefone: cliente.telefone_celular || cliente.telefone_principal,
    dataCriacao: cliente.data_criacao,
    rua: enderecoPrincipal?.logradouro,
    numero: enderecoPrincipal?.numero,
    bairro: enderecoPrincipal?.bairro,
    cidade: enderecoPrincipal?.cidade,
    estado: enderecoPrincipal?.estado,
    cep: enderecoPrincipal?.cep,
  };
}

export interface PedidoApp {
  id: string;
  numero: string;
  date: string;
  status: string;
  total: number;
  items: number;
}

export function mapPedidoParaApp(pedido: LIPedido): PedidoApp {
  const totalItens = (pedido.itens || []).reduce((sum, item) => sum + (item.quantidade || 0), 0);
  return {
    id: pedido.numero || String(pedido.id),
    numero: pedido.numero,
    date: new Date(pedido.data_criacao).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    status: pedido.situacao?.nome || "—",
    total: toNumber(pedido.valor_total),
    items: totalItens,
  };
}
