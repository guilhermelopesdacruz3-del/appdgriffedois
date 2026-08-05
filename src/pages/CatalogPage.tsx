import { useState } from "react";
import { Product } from "../data";
import ProductCard from "../components/features/ProductCard";
import type { FiltroCatalogo } from "../services/lojaIntegrada";

interface CatalogPageProps {
  products: Product[];
  onSelectProduct: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  onTryOn: (product: Product) => void;
  searchQuery?: string;
  isFavorite?: (id: number) => boolean;
  onToggleFavorite?: (id: number) => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
  total?: number;
  /** Categorias reais da loja (chips de filtro). */
  categorias?: FiltroCatalogo[];
  /** Marcas reais da loja (chips de filtro). */
  marcas?: FiltroCatalogo[];
  /** Filtro ativo (server-side): id da marca selecionada ou null. */
  filtroMarcaId?: number | null;
  /** Filtro ativo (server-side): id da categoria selecionada ou null. */
  filtroCategoriaId?: number | null;
  onFiltroMarca?: (id: number | null) => void;
  onFiltroCategoria?: (id: number | null) => void;
}

const filterOptions = [
  { id: "all", label: "Todos" },
  { id: "favoritos", label: "Favoritos ❤️" },
];

const sortOptions = [
  { id: "featured", label: "Destaques" },
  { id: "price-asc", label: "Menor preço" },
  { id: "price-desc", label: "Maior preço" },
  { id: "rating", label: "Avaliação" },
];

export default function CatalogPage({
  products,
  onSelectProduct,
  onAddToCart,
  onTryOn,
  searchQuery = "",
  isFavorite,
  onToggleFavorite,
  hasMore = false,
  onLoadMore,
  loadingMore = false,
  total = 0,
  categorias = [],
  marcas = [],
  filtroMarcaId = null,
  filtroCategoriaId = null,
  onFiltroMarca,
  onFiltroCategoria,
}: CatalogPageProps) {
  const [activeFilter, setActiveFilter] = useState("all");
  const [activeSort, setActiveSort] = useState("featured");

  const termo = searchQuery.trim().toLowerCase();

  const filteredProducts = products.filter((p) => {
    // Busca textual (nome, marca, categoria) — filtro local por cima do server-side
    if (termo) {
      const alvo = `${p.name} ${p.brand} ${p.category}`.toLowerCase();
      if (!alvo.includes(termo)) return false;
    }
    if (activeFilter === "all") return true;
    if (activeFilter === "favoritos") return isFavorite ? isFavorite(p.id) : false;
    return true;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (activeSort === "price-asc") return a.price - b.price;
    if (activeSort === "price-desc") return b.price - a.price;
    if (activeSort === "rating") return b.rating - a.rating;
    return 0;
  });

  const filtroAtivo = filtroMarcaId !== null || filtroCategoriaId !== null;
  const nomeFiltro = filtroMarcaId !== null
    ? marcas.find((m) => m.id === filtroMarcaId)?.nome
    : filtroCategoriaId !== null
      ? categorias.find((c) => c.id === filtroCategoriaId)?.nome
      : undefined;

  return (
    <div className="pb-4">
      <div className="px-5 mb-3">
        <h2 className="text-xl font-bold text-luxury-black">Catálogo</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          {termo ? `"${searchQuery}" — ` : ""}
          {nomeFiltro ? `${nomeFiltro} — ` : ""}
          {total > 0 ? `${total} produtos` : `${sortedProducts.length} produtos encontrados`}
        </p>
      </div>

      {/* Filters gerais */}
      <div className="flex gap-2 px-4 overflow-x-auto no-scrollbar mb-3">
        {filterOptions.map((filter) => (
          <button
            key={filter.id}
            onClick={() => {
              setActiveFilter(filter.id);
              if (filter.id === "all") {
                onFiltroMarca?.(null);
                onFiltroCategoria?.(null);
              }
            }}
            className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 flex-shrink-0 ${
              activeFilter === filter.id && !filtroAtivo
                ? "bg-luxury-black text-white shadow-sm"
                : "bg-white text-gray-600 border border-ice-dark hover:border-luxury-black/20"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Marcas (reais, da loja) */}
      {marcas.length > 0 && (
        <div className="flex gap-2 px-4 overflow-x-auto no-scrollbar mb-2">
          {marcas.map((marca) => (
            <button
              key={marca.id}
              onClick={() => {
                setActiveFilter("all");
                onFiltroMarca?.(filtroMarcaId === marca.id ? null : marca.id);
              }}
              className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 flex-shrink-0 ${
                filtroMarcaId === marca.id
                  ? "bg-luxury-black text-white shadow-sm"
                  : "bg-white text-gray-600 border border-ice-dark hover:border-luxury-black/20"
              }`}
            >
              {marca.nome}
            </button>
          ))}
        </div>
      )}

      {/* Categorias (reais, da loja) */}
      {categorias.length > 0 && (
        <div className="flex gap-2 px-4 overflow-x-auto no-scrollbar mb-3">
          {categorias.map((categoria) => (
            <button
              key={categoria.id}
              onClick={() => {
                setActiveFilter("all");
                onFiltroCategoria?.(filtroCategoriaId === categoria.id ? null : categoria.id);
              }}
              className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 flex-shrink-0 ${
                filtroCategoriaId === categoria.id
                  ? "bg-gold text-luxury-black shadow-sm"
                  : "bg-white text-gray-600 border border-ice-dark hover:border-luxury-black/20"
              }`}
            >
              {categoria.nome}
            </button>
          ))}
        </div>
      )}

      {/* Sort */}
      <div className="flex gap-2 px-4 overflow-x-auto no-scrollbar mb-4">
        {sortOptions.map((sort) => (
          <button
            key={sort.id}
            onClick={() => setActiveSort(sort.id)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-medium whitespace-nowrap transition-all flex-shrink-0 ${
              activeSort === sort.id
                ? "bg-gold/10 text-gold-dark border border-gold/20"
                : "bg-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            {sort.label}
          </button>
        ))}
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-2 gap-3 px-4">
        {sortedProducts.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onSelect={onSelectProduct}
            onAddToCart={onAddToCart}
            onTryOn={onTryOn}
            isFavorite={isFavorite ? isFavorite(product.id) : undefined}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>

      {/* Load more (paginação server-side; oculto quando há filtro local ativo) */}
      {!termo && activeFilter === "all" && hasMore && onLoadMore && (
        <div className="flex justify-center pt-5 pb-2">
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            className="px-6 py-2.5 rounded-xl border border-luxury-black/15 text-xs font-bold text-luxury-black hover:bg-luxury-black hover:text-white active:scale-95 transition-all disabled:opacity-50"
          >
            {loadingMore ? "Carregando..." : `Carregar mais (${products.length} de ${total})`}
          </button>
        </div>
      )}

      {sortedProducts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="text-4xl mb-3">{activeFilter === "favoritos" ? "🤍" : "🔍"}</div>
          <p className="text-sm text-gray-500">
            {activeFilter === "favoritos"
              ? "Você ainda não favoritou nenhum produto"
              : "Nenhum produto encontrado"}
          </p>
          {activeFilter === "favoritos" && (
            <button
              onClick={() => setActiveFilter("all")}
              className="mt-3 px-5 py-2 bg-luxury-black text-white text-xs font-bold rounded-xl active:scale-95"
            >
              Ver catálogo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
