import { useState } from "react";
import { Product } from "../data";
import { getProductImage, formatPrice, formatInstallment } from "../utils";
import ImageViewer from "./ImageViewer";

interface ProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  onTryOn?: (product: Product) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (id: number) => void;
}

async function shareProduct(product: Product) {
  const url = `${window.location.origin}${window.location.pathname}#produto-${product.id}`;
  const texto = `Olha esse ${product.brand} ${product.name} na Ótica D'Griffe!`;
  try {
    if (navigator.share) {
      await navigator.share({ title: product.name, text: texto, url });
    } else {
      await navigator.clipboard.writeText(`${texto} ${url}`);
      window.open(`https://wa.me/?text=${encodeURIComponent(`${texto} ${url}`)}`, "_blank");
    }
  } catch {
    /* usuário cancelou o compartilhamento */
  }
}

export default function ProductCard({ product, onSelect, onAddToCart, onTryOn, isFavorite, onToggleFavorite }: ProductCardProps) {
  const discount = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;
  const [enhanced, setEnhanced] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  return (
    <>
      <div
        onClick={() => onSelect(product)}
        className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer group"
      >
        {/* Image Container - shorter ratio */}
        <div
          className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-ice-light to-ice"
          onClick={(e) => {
            e.stopPropagation();
            setViewerOpen(true);
          }}
        >
          <img
            src={getProductImage(product.image)}
            alt={product.name}
            className={`w-full h-full object-cover group-hover:scale-105 transition-all duration-500 ${
              enhanced ? "contrast-110 brightness-105 saturate-110" : ""
            }`}
            loading="lazy"
          />

          {/* Zoom hint on hover */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
            <div className="w-8 h-8 bg-white/80 rounded-full flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1A1A1A" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
                <line x1="11" y1="8" x2="11" y2="14" />
                <line x1="8" y1="11" x2="14" y2="11" />
              </svg>
            </div>
          </div>

          {/* Enhance overlay */}
          {enhanced && (
            <div className="absolute top-1.5 left-1.5 animate-fade-in">
              <span className="px-1.5 py-0.5 bg-gold/90 text-luxury-black text-[7px] font-bold rounded-full">HD</span>
            </div>
          )}

          {/* Badges */}
          <div className="absolute top-1.5 left-1.5 flex flex-col gap-1">
            {product.badge && !enhanced && (
              <span className="px-1.5 py-0.5 bg-luxury-black text-white text-[8px] font-bold uppercase tracking-wider rounded-full">
                {product.badge}
              </span>
            )}
            {discount > 0 && !enhanced && (
              <span className="px-1.5 py-0.5 bg-gold text-luxury-black text-[8px] font-bold rounded-full">
                -{discount}%
              </span>
            )}
          </div>

          {/* Feature Badges */}
          <div className="absolute top-1.5 right-1.5 flex gap-1">
            {onToggleFavorite && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleFavorite(product.id); }}
                className="w-6 h-6 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm hover:bg-red-50 transition-colors"
                title={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill={isFavorite ? "#ef4444" : "none"} stroke={isFavorite ? "#ef4444" : "#1A1A1A"} strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); shareProduct(product); }}
              className="w-6 h-6 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm hover:bg-gold/20 transition-colors"
              title="Compartilhar"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
            </button>
            {product.has3D && (
              <span className="w-6 h-6 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#D4A853" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
              </span>
            )}
            {product.hasTryOn && (
              <button
                onClick={(e) => { e.stopPropagation(); onTryOn?.(product); }}
                className="w-6 h-6 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm hover:bg-gold/20 transition-colors"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#1A1A1A" strokeWidth="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" /></svg>
              </button>
            )}
          </div>

          {/* Enhance + Color row */}
          <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between">
            <div className="flex gap-0.5">
              {product.colors.slice(0, 3).map((color, i) => (
                <span key={i} className="w-3 h-3 rounded-full border-[1.5px] border-white shadow-sm" style={{ backgroundColor: color }} />
              ))}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setEnhanced(!enhanced); }}
              className={`w-6 h-6 rounded-full flex items-center justify-center shadow-sm transition-all ${enhanced ? "bg-gold" : "bg-white/90 backdrop-blur-sm"}`}
              title={enhanced ? "Original" : "Melhorar Foto"}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={enhanced ? "#0A0A0A" : "#1A1A1A"} strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Info - compact */}
        <div className="p-2.5 pb-2">
          <p className="text-[9px] text-gold font-semibold uppercase tracking-wider leading-tight">{product.brand}</p>
          <h3 className="text-[12px] font-semibold text-luxury-black leading-tight line-clamp-1 mt-0.5">{product.name}</h3>
          <div className="mt-1">
            <span className="text-[13px] font-bold text-luxury-black">{formatPrice(product.price)}</span>
            {product.originalPrice && (
              <span className="text-[10px] text-gray-400 line-through ml-1">{formatPrice(product.originalPrice)}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[9px] text-green-600 font-medium">{formatPrice(product.pixPrice)} Pix</span>
            <span className="text-[8px] text-gray-300">•</span>
            <span className="text-[8px] text-gray-400">{formatInstallment(product.installmentCount, product.installmentValue)}</span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onAddToCart(product); }}
            className="mt-2 w-full h-8 bg-luxury-black text-white text-[11px] font-semibold rounded-lg hover:bg-luxury-dark active:scale-[0.98] transition-all flex items-center justify-center gap-1"
          >
            Comprar
          </button>
        </div>
      </div>

      {/* Fullscreen Image Viewer */}
      <ImageViewer
        isOpen={viewerOpen}
        imageUrl={getProductImage(product.image)}
        title={product.name}
        brand={product.brand}
        onClose={() => setViewerOpen(false)}
      />
    </>
  );
}
