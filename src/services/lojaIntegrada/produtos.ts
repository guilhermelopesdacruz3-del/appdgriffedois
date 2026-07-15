import type { Product } from "../../data";
import { getResource, listResource } from "./client";
import { mapCategoriasParaLookup, mapMarcasParaLookup, mapProdutoParaProduct } from "./mappers";
import type { LICategoria, LIMarca, LIProduto } from "./types";

export interface ListarProdutosOpts {
  /** número de produtos por página (padrão 20) */
  limit?: number;
  offset?: number;
  /** filtra por categoria (id da categoria na Loja Integrada) */
  categoriaId?: number;
  /** busca textual pelo nome do produto, quando suportado pela API */
  busca?: string;
  /** apenas produtos ativos e não removidos (padrão true) */
  apenasAtivos?: boolean;
}

let categoriasCache: Record<string, string> | null = null;
let marcasCache: Record<string, string> | null = null;

async function getCategoriasLookup(): Promise<Record<string, string>> {
  if (categoriasCache) return categoriasCache;
  const resposta = await listResource<LICategoria>("categoria", { limit: 200 });
  categoriasCache = mapCategoriasParaLookup(resposta.objects);
  return categoriasCache;
}

async function getMarcasLookup(): Promise<Record<string, string>> {
  if (marcasCache) return marcasCache;
  const resposta = await listResource<LIMarca>("marca", { limit: 200 });
  marcasCache = mapMarcasParaLookup(resposta.objects);
  return marcasCache;
}

/** Lista produtos da loja, já convertidos para o formato usado pelos componentes (Product). */
export async function listarProdutos(opts: ListarProdutosOpts = {}): Promise<{
  produtos: Product[];
  total: number;
}> {
  const { limit = 20, offset = 0, categoriaId, busca, apenasAtivos = true } = opts;

  const [resposta, categoriasLookup, marcasLookup] = await Promise.all([
    listResource<LIProduto>("produto", {
      limit,
      offset,
      categorias: categoriaId,
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
