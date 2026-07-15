import { useState, useEffect } from "react";
import { Product } from "../data";
import { getProductImage, formatPrice, formatInstallment } from "../utils";
import ImageViewer from "../components/ImageViewer";

interface ProductPageProps {
  product: Product;
  onBack: () => void;
  onAddToCart: (product: Product) => void;
  onTryOn: (product: Product) => void;
}

export default function ProductPage({ product, onBack, onAddToCart, onTryOn }: ProductPageProps) {
  const [selectedColor, setSelectedColor] = useState(0);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [show3D, setShow3D] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [enhanced, setEnhanced] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);

  const discount = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  useEffect(() => {
    if (!show3D) { setRotation(0); return; }
    let animFrame: number;
    let start: number | null = null;
    const animate = (timestamp: number) => {
      if (!start) start = timestamp;
      const elapsed = timestamp - start;
      setRotation((elapsed / 8) % 360);
      if (elapsed < 6000) animFrame = requestAnimationFrame(animate);
    };
    animFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrame);
  }, [show3D]);

  const handleDragStart = (clientX: number) => { if (!show3D) return; setIsDragging(true); setDragStartX(clientX); };
  const handleDragMove = (clientX: number) => { if (!isDragging || !show3D) return; const delta = clientX - dragStartX; setRotation((prev) => prev + delta * 0.5); setDragStartX(clientX); };
  const handleDragEnd = () => { setIsDragging(false); };

  return (
    <div className="pb-28">
      {/* Image Gallery */}
      <div className="relative">
        <div
          className="aspect-square bg-gradient-to-br from-ice-light to-ice overflow-hidden select-none"
          onTouchStart={(e) => handleDragStart(e.touches[0].clientX)}
          onTouchMove={(e) => handleDragMove(e.touches[0].clientX)}
          onTouchEnd={handleDragEnd}
          onMouseDown={(e) => handleDragStart(e.clientX)}
          onMouseMove={(e) => handleDragMove(e.clientX)}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
        >
          <img
            src={getProductImage(product.image)}
            alt={product.name}
            className={`w-full h-full object-cover transition-all duration-300 ${enhanced ? "contrast-110 brightness-105 saturate-110" : ""}`}
            style={show3D ? { transform: `perspective(800px) rotateY(${rotation}deg)`, transition: isDragging ? "none" : "transform 0.1s ease-out" } : undefined}
            onClick={() => { if (!show3D) setViewerOpen(true); }}
          />
          {show3D && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-3 left-1/2 -translate-x-1/2">
                <span className="px-3 py-1 bg-gold/90 text-luxury-black text-[9px] font-bold rounded-full flex items-center gap-1 animate-fade-in">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /></svg>
                  3D — Arraste para girar
                </span>
              </div>
            </div>
          )}
          {enhanced && !show3D && (
            <div className="absolute top-3 left-3 animate-fade-in">
              <span className="px-2 py-0.5 bg-gold/90 text-luxury-black text-[8px] font-bold rounded-full flex items-center gap-0.5">
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                HD
              </span>
            </div>
          )}
        </div>

        {/* Back button */}
        <button onClick={onBack} className="absolute top-4 left-4 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm hover:bg-white transition-colors z-10">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        </button>

        {/* Favorite button */}
        <button onClick={() => setIsFavorite(!isFavorite)} className="absolute top-4 right-4 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm hover:bg-white transition-colors z-10">
          {isFavorite ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#D4A853" stroke="#D4A853" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A1A1A" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>
          )}
        </button>

        {/* Image indicators */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          {[0, 1, 2].map((i) => (
            <button key={i} onClick={() => setActiveImageIndex(i)} className={`transition-all duration-200 rounded-full ${activeImageIndex === i ? "w-6 h-1.5 bg-gold" : "w-1.5 h-1.5 bg-white/60"}`} />
          ))}
        </div>

        {/* Badges */}
        <div className="absolute bottom-4 left-4 flex gap-1.5 z-10">
          {product.badge && <span className="px-2.5 py-1 bg-luxury-black text-white text-[9px] font-bold uppercase tracking-wider rounded-full">{product.badge}</span>}
          {discount > 0 && <span className="px-2.5 py-1 bg-gold text-luxury-black text-[9px] font-bold rounded-full">-{discount}%</span>}
        </div>
      </div>

      {/* Product Info */}
      <div className="px-5 pt-5">
        {/* Brand & Code */}
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-gold font-bold uppercase tracking-widest">{product.brand}</span>
          <span className="text-[10px] text-gray-400">Cód: {product.code}</span>
        </div>

        {/* Name */}
        <h1 className="text-xl font-bold text-luxury-black leading-tight mb-2">{product.name}</h1>

        {/* Rating */}
        <div className="flex items-center gap-1 mb-3">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="#D4A853" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
          <span className="text-xs font-semibold text-luxury-black">{product.rating}</span>
          <span className="text-[10px] text-gray-400">({product.reviews} reviews)</span>
        </div>

        {/* Price */}
        <div className="bg-ice rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl font-bold text-luxury-black">{formatPrice(product.price)}</span>
            {product.originalPrice && <span className="text-sm text-gray-400 line-through">{formatPrice(product.originalPrice)}</span>}
          </div>
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center gap-1 bg-green-50 rounded-lg px-2 py-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>
              <span className="text-[11px] text-green-700 font-bold">{formatPrice(product.pixPrice)} via Pix</span>
            </div>
          </div>
          <p className="text-[10px] text-gray-400">
            {formatInstallment(product.installmentCount, product.installmentValue)} sem juros
          </p>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-500 leading-relaxed mb-5">{product.description}</p>

        {/* Color Selection */}
        {product.colors.length > 0 && (
          <div className="mb-5">
            <p className="text-xs font-semibold text-luxury-black mb-3">
              Cor: <span className="text-gold">{product.colorNames[selectedColor] ?? product.colorNames[0]}</span>
            </p>
            <div className="flex gap-3">
              {product.colors.map((color, index) => (
              <button
                key={index}
                onClick={() => setSelectedColor(index)}
                className={`relative w-12 h-12 rounded-full transition-all duration-200 ${selectedColor === index ? "ring-2 ring-gold ring-offset-2 scale-110" : "ring-1 ring-gray-200 hover:ring-gray-400"}`}
                style={{ backgroundColor: color }}
              >
                {selectedColor === index && (
                  <svg className="absolute inset-0 m-auto" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                )}
              </button>
            ))}
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="h-px bg-ice-dark mb-5" />

        {/* Feature Buttons */}
        <div className="flex gap-3 mb-4">
          {product.has3D && (
            <button onClick={() => setShow3D(!show3D)} className={`flex-1 h-12 rounded-2xl border flex items-center justify-center gap-2 text-xs font-semibold transition-all ${show3D ? "border-gold bg-gold/10 text-gold" : "border-gold/30 text-gold hover:bg-gold/5"}`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
              {show3D ? "3D Ativo" : "Visualização 3D"}
            </button>
          )}
          {product.hasTryOn && (
            <button onClick={() => onTryOn(product)} className="flex-1 h-12 rounded-2xl border border-luxury-black/20 bg-luxury-black text-white text-xs font-semibold transition-all hover:bg-luxury-dark active:scale-[0.98] flex items-center justify-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" /></svg>
              Provador Virtual
            </button>
          )}
        </div>

        {/* Enhance Photo Toggle */}
        <button onClick={() => setEnhanced(!enhanced)} className={`w-full h-10 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold transition-all mb-5 ${enhanced ? "border-gold bg-gold/10 text-gold" : "border-ice-dark text-gray-500 hover:border-gold/30 hover:text-gold"}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
          {enhanced ? "Foto HD Ativada" : "Melhorar Foto"}
        </button>

        {/* Features List */}
        <div className="bg-ice rounded-2xl p-4 mb-5">
          <h4 className="text-xs font-bold text-luxury-black mb-3">Características</h4>
          <div className="space-y-2">
            {[
              { label: "Marca", value: product.brand },
              { label: "Código", value: product.code },
              { label: "Tipo", value: product.category === "Sol" ? "Óculos de Sol" : "Óculos de Grau" },
              { label: "Lentes", value: product.category === "Sol" ? "Polarizadas UV400" : "Compatível com receita" },
              { label: "Garantia", value: "Original com nota fiscal" },
              { label: "Entrega", value: "Até 20 dias úteis" },
            ].map((feature, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-[11px] text-gray-500">{feature.label}</span>
                <span className="text-[11px] font-medium text-luxury-black">{feature.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Fixed Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-4 max-w-lg mx-auto">
        <div className="glass rounded-2xl p-3 shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-luxury-black">{formatPrice(product.price)}</span>
                <span className="text-[10px] text-green-600 font-semibold">{formatPrice(product.pixPrice)} Pix</span>
              </div>
              <p className="text-[9px] text-gray-400">{formatInstallment(product.installmentCount, product.installmentValue)} s/ juros</p>
            </div>
            <button
              onClick={() => onAddToCart(product)}
              className="flex-1 h-12 bg-luxury-black text-white font-bold rounded-xl hover:bg-luxury-dark active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 01-8 0" />
              </svg>
              Comprar
            </button>
          </div>
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
    </div>
  );
}
