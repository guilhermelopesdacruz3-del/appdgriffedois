import { useState } from "react";
import { Product } from "../data";
import ProductCard from "../components/ProductCard";

interface CatalogPageProps {
  products: Product[];
  onSelectProduct: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  onTryOn: (product: Product) => void;
  searchQuery?: string;
  isFavorite?: (id: number) => boolean;
  onToggleFavorite?: (id: number) => void;
}

const filterOptions = [
  { id: "all", label: "Todos" },
  { id: "favoritos", label: "Favoritos ❤️" },
  { id: "Sol", label: "Sol ☀️" },
  { id: "Grau", label: "Grau 👓" },
  { id: "Ray-Ban", label: "Ray-Ban" },
  { id: "Michael Kors", label: "MK" },
  { id: "Grazi Massafera", label: "Grazi" },
  { id: "3D", label: "3D" },
  { id: "Provador", label: "Provador 📸" },
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
}: CatalogPageProps) {
  const [activeFilter, setActiveFilter] = useState("all");
  const [activeSort, setActiveSort] = useState("featured");

  const termo = searchQuery.trim().toLowerCase();

  const filteredProducts = products.filter((p) => {
    // Busca textual (nome, marca, categoria)
    if (termo) {
      const alvo = `${p.name} ${p.brand} ${p.category}`.toLowerCase();
      if (!alvo.includes(termo)) return false;
    }
    if (activeFilter === "all") return true;
    if (activeFilter === "favoritos") return isFavorite ? isFavorite(p.id) : false;
    if (activeFilter === "3D") return p.has3D;
    if (activeFilter === "Provador") return p.hasTryOn;
    if (activeFilter === "Sol" || activeFilter === "Grau") {
      const re = activeFilter === "Sol" ? /sol/i : /grau/i;
      return re.test(p.category);
    }
    return p.brand === activeFilter;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (activeSort === "price-asc") return a.price - b.price;
    if (activeSort === "price-desc") return b.price - a.price;
    if (activeSort === "rating") return b.rating - a.rating;
    return 0;
  });

  return (
    <div className="pb-4">
      <div className="px-5 mb-3">
        <h2 className="text-xl font-bold text-luxury-black">Catálogo</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          {termo ? `"${searchQuery}" — ` : ""}
          {sortedProducts.length} produtos encontrados
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 px-4 overflow-x-auto no-scrollbar mb-3">
        {filterOptions.map((filter) => (
          <button
            key={filter.id}
            onClick={() => setActiveFilter(filter.id)}
            className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 flex-shrink-0 ${
              activeFilter === filter.id
                ? "bg-luxury-black text-white shadow-sm"
                : "bg-white text-gray-600 border border-ice-dark hover:border-luxury-black/20"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

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
