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

  // ---- Hierarquia de categorias ----
  const categoriasPai = categorias.filter((c) => c.paiId === null);
  const catSelecionada = filtroCategoriaId !== null
    ? categorias.find((c) => c.id === filtroCategoriaId)
    : undefined;
  const filhosDaSelecionada = catSelecionada
    ? categorias.filter((c) => c.paiId === catSelecionada.id)
    : [];
  const subCategorias = catSelecionada
    ? (filhosDaSelecionada.length > 0
        ? filhosDaSelecionada
        : categorias.filter((c) => c.paiId === catSelecionada.paiId))
    : [];
  const paiRaizId = catSelecionada?.paiId === null ? catSelecionada.id : null;

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

  const limparFiltros = () => {
    setActiveFilter("all");
    onFiltroMarca?.(null);
    onFiltroCategoria?.(null);
  };

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

      {/* Filtros: Categorias (principais + subcategorias) */}
      {categoriasPai.length > 0 && (
        <div className="mb-3">
          <div className="flex gap-2 px-4 overflow-x-auto no-scrollbar">
            <button
              onClick={() => onFiltroCategoria?.(null)}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200 flex-shrink-0 border ${
                filtroCategoriaId === null
                  ? "bg-gradient-to-r from-gold to-gold-dark text-black border-gold/50 shadow-lg shadow-gold/20"
                  : "bg-white/70 text-gray-500 border-ice-dark hover:border-gold/40"
              }`}
            >
              Todos
            </button>
            {categoriasPai.map((categoria) => {
              const ativa = paiRaizId === categoria.id;
              return (
                <button
                  key={categoria.id}
                  onClick={() => {
                    setActiveFilter("all");
                    onFiltroCategoria?.(filtroCategoriaId === categoria.id ? null : categoria.id);
                  }}
                  className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200 flex-shrink-0 border ${
                    ativa
                      ? "bg-gradient-to-r from-gold to-gold-dark text-black border-gold/50 shadow-lg shadow-gold/25 scale-[1.03]"
                      : "bg-white text-gray-600 border-ice-dark hover:border-gold/50 hover:text-gold-dark"
                  }`}
                >
                  {categoria.nome}
                </button>
              );
            })}
          </div>

          {subCategorias.length > 0 && (
            <div className="mt-2 px-4">
              <div className="flex gap-2 overflow-x-auto no-scrollbar border-t border-ice-dark/60 pt-2">
                {catSelecionada?.paiId !== null && (
                  <button
                    onClick={() => {
                      setActiveFilter("all");
                      onFiltroCategoria?.(catSelecionada?.paiId ?? null);
                    }}
                    className="px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all duration-200 flex-shrink-0 border border-ice-dark text-gray-400 hover:border-luxury-black/30"
                  >
                    ← {categorias.find((c) => c.id === catSelecionada?.paiId)?.nome}
                  </button>
                )}
                {subCategorias.map((sub) => {
                  const ativa = filtroCategoriaId === sub.id;
                  return (
                    <button
                      key={sub.id}
                      onClick={() => {
                        setActiveFilter("all");
                        onFiltroCategoria?.(filtroCategoriaId === sub.id ? null : sub.id);
                      }}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all duration-200 flex-shrink-0 border ${
                        ativa
                          ? "bg-luxury-black text-white border-luxury-black shadow-md"
                          : "bg-white/60 text-gray-500 border-ice-dark hover:border-luxury-black/30"
                      }`}
                    >
                      {sub.nome}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filtros: Marcas (reais, da loja) */}
      {marcas.length > 0 && (
        <div className="mb-3">
          <p className="px-4 mb-1.5 text-[9px] uppercase tracking-widest font-bold text-gray-400">Marcas</p>
          <div className="flex gap-2 px-4 overflow-x-auto no-scrollbar">
            {marcas.map((marca) => {
              const ativa = filtroMarcaId === marca.id;
              const inicial = marca.nome.charAt(0).toUpperCase();
              return (
                <button
                  key={marca.id}
                  onClick={() => {
                    setActiveFilter("all");
                    onFiltroMarca?.(filtroMarcaId === marca.id ? null : marca.id);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all duration-200 flex-shrink-0 border ${
                    ativa
                      ? "bg-luxury-black text-white border-luxury-black shadow-md"
                      : "bg-white text-gray-600 border-ice-dark hover:border-luxury-black/40"
                  }`}
                >
                  <span
                    className={`w-4.5 h-4.5 min-w-[18px] min-h-[18px] rounded-full flex items-center justify-center text-[9px] font-black ${
                      ativa ? "bg-gold text-black" : "bg-ice text-gray-500"
                    }`}
                  >
                    {inicial}
                  </span>
                  {marca.nome}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Filtro ativo: barra de contexto + limpar */}
      {filtroAtivo && (
        <div className="flex items-center gap-2 px-4 mb-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gold/15 border border-gold/30 text-gold-dark text-[11px] font-bold">
            {nomeFiltro}
            <button
              onClick={limparFiltros}
              className="w-4 h-4 rounded-full bg-gold/20 hover:bg-gold/40 flex items-center justify-center leading-none"
              aria-label="Remover filtro"
            >
              ×
            </button>
          </span>
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

      {/* Load more (paginação server-side, incluindo durante a busca) */}
      {activeFilter === "all" && hasMore && onLoadMore && (
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
