import type { Product } from "../../data";
import { getResource, listResource } from "./client";
import { mapProdutoParaProduct } from "./mappers";
import type { LICategoria, LIMarca, LIProduto } from "./types";

export interface ListarProdutosOpts {
  /** número de produtos por página (padrão 20) */
  limit?: number;
  offset?: number;
  /** filtra por categoria (id da categoria na Loja Integrada) */
  categoriaId?: number;
  /** filtra por marca (id da marca na Loja Integrada) */
  marcaId?: number;
  /** busca textual pelo nome do produto */
  busca?: string;
  /** apenas produtos ativos e não removidos (padrão true) */
  apenasAtivos?: boolean;
}

interface CategoriaInfo {
  id: number;
  nome: string;
  paiId: number | null;
  uri: string;
}

let categoriasCache: CategoriaInfo[] | null = null;

async function getCategorias(): Promise<CategoriaInfo[]> {
  if (categoriasCache) return categoriasCache;
  const todas: LICategoria[] = [];
  const pagina = 100;
  let offset = 0;
  for (;;) {
    const resposta = await listResource<LICategoria>("categoria", { limit: pagina, offset });
    todas.push(...resposta.objects);
    if (resposta.objects.length < pagina) break;
    offset += pagina;
  }
  categoriasCache = todas.map((c) => ({
    id: c.id,
    nome: c.nome.trim(),
    paiId: extrairIdDaUri(c.categoria_pai),
    uri: c.resource_uri,
  }));
  return categoriasCache;
}

async function getCategoriasLookup(): Promise<Record<string, string>> {
  const cats = await getCategorias();
  const lookup: Record<string, string> = {};
  for (const c of cats) lookup[String(c.id)] = c.nome;
  return lookup;
}

/** A LI só filtra por categoria usando resource_uri e NÃO inclui subcategorias.
 *  Para categoria principal, envia a própria + TODAS as descendentes (união). */
async function urisDaCategoria(id: number): Promise<string[] | undefined> {
  const cats = await getCategorias();
  const alvo = cats.find((c) => c.id === id);
  if (!alvo) return [`/api/v1/categoria/${id}/`];
  const descendentes = new Set<string>();
  const fila = [alvo];
  while (fila.length > 0) {
    const atual = fila.shift()!;
    descendentes.add(atual.uri);
    for (const c of cats) if (c.paiId === atual.id) fila.push(c);
  }
  return [...descendentes];
}

let marcasCacheFull: CategoriaInfo[] | null = null;

async function getMarcas(): Promise<CategoriaInfo[]> {
  if (marcasCacheFull) return marcasCacheFull;
  const resposta = await listResource<LIMarca>("marca", { limit: 100 });
  marcasCacheFull = resposta.objects.map((m) => ({ id: m.id, nome: m.nome.trim(), paiId: null, uri: m.resource_uri }));
  return marcasCacheFull;
}

async function getMarcasLookup(): Promise<Record<string, string>> {
  const marcas = await getMarcas();
  const lookup: Record<string, string> = {};
  for (const m of marcas) lookup[String(m.id)] = m.nome;
  return lookup;
}

/** Lista produtos da loja, já convertidos para o formato usado pelos componentes (Product). */
export async function listarProdutos(opts: ListarProdutosOpts = {}): Promise<{
  produtos: Product[];
  total: number;
}> {
  const { limit = 20, offset = 0, categoriaId, marcaId, busca, apenasAtivos = true } = opts;
  const categoriasParam = categoriaId !== undefined ? await urisDaCategoria(categoriaId) : undefined;

  const [resposta, categoriasLookup, marcasLookup] = await Promise.all([
    listResource<LIProduto>("produto", {
      limit,
      offset,
      categorias: categoriasParam,
      marca: marcaId,
      nome__icontains: busca,
      ativo: apenasAtivos ? true : undefined,
      removido: apenasAtivos ? false : undefined,
    }),
    getCategoriasLookup(),
    getMarcasLookup(),
  ]);

  return {
    produtos: resposta.objects.map((p) => mapProdutoParaProduct(p, categoriasLookup, marcasLookup)),
    total: resposta.meta.total_count,
  };
}

export interface FiltroCatalogo {
  id: number;
  nome: string;
  /** id da categoria pai (null = categoria principal) */
  paiId: number | null;
}

function extrairIdDaUri(uri: string | null | undefined): number | null {
  if (!uri) return null;
  const partes = uri.split("/").filter(Boolean);
  const ultimo = partes[partes.length - 1];
  return /^\d+$/.test(ultimo) ? Number(ultimo) : null;
}

/** Lista as categorias da loja (para os chips de filtro), com hierarquia. */
export async function listarCategorias(): Promise<FiltroCatalogo[]> {
  const cats = await getCategorias();
  return cats
    .map((c) => ({ id: c.id, nome: c.nome, paiId: c.paiId }))
    .filter((c) => c.nome.length > 0)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Lista as marcas da loja (para os chips de filtro). */
export async function listarMarcas(): Promise<FiltroCatalogo[]> {
  const marcas = await getMarcas();
  return marcas
    .map((m) => ({ id: m.id, nome: m.nome, paiId: null }))
    .filter((m) => m.nome.length > 0)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Busca um produto específico por id, com dados atualizados (preço/estoque em tempo real). */
export async function buscarProduto(id: number | string): Promise<Product> {
  const [produto, categoriasLookup, marcasLookup] = await Promise.all([
    getResource<LIProduto>("produto", id),
    getCategoriasLookup(),
    getMarcasLookup(),
  ]);
  return mapProdutoParaProduct(produto, categoriasLookup, marcasLookup);
}

/** Consulta rápida de estoque disponível para um produto (útil antes de confirmar o carrinho). */
export async function consultarEstoque(id: number | string): Promise<number> {
  const produto = await getResource<LIProduto>("produto", id);
  return produto.estoque_quantidade ?? 0;
}
