import { Product } from "../data";
import { categories } from "../data";
import ProductCard from "../components/ProductCard";
import YouTubeSection from "../components/YouTubeSection";

interface HomePageProps {
  products: Product[];
  onSelectProduct: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  onNavigate: (page: string) => void;
  onTryOn: (product: Product) => void;
  recentIds?: number[];
  isFavorite?: (id: number) => boolean;
  onToggleFavorite?: (id: number) => void;
}

export default function HomePage({ products, onSelectProduct, onAddToCart, onNavigate, onTryOn, recentIds = [], isFavorite, onToggleFavorite }: HomePageProps) {
  // O mapeador da LI normalmente retorna o nome real da categoria (ex.:
  // "Óculos de Sol"), não o rótulo curto "Sol". Filtramos por contenção para
  // que as seções da home não fiquem vazias quando a LI usa nomes diferentes.
  const isCategoriaSol = (cat: string) => /sol/i.test(cat);

  const featuredProducts = products.filter(p => p.badge === "Destaque").slice(0, 4);
  const solProducts = products.filter(p => isCategoriaSol(p.category)).slice(0, 4);
  const recentProducts = recentIds
    .map((id) => products.find((p) => p.id === id))
    .filter((p): p is Product => Boolean(p))
    .slice(0, 6);

  return (
    <div className="pb-4">
      {/* Promo Banner */}
      <div className="mx-4 mt-2 mb-5 relative overflow-hidden rounded-3xl bg-luxury-black min-h-[200px]">
        <img
          src="/images/hero-banner.jpg"
          alt="Promoção D'Griffe"
          className="absolute inset-0 w-full h-full object-cover opacity-50"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        <div className="absolute top-0 right-0 w-32 h-32">
          <div className="absolute top-4 right-4 w-20 h-20 border border-gold/30 rounded-full" />
          <div className="absolute top-8 right-8 w-12 h-12 border border-gold/20 rounded-full" />
        </div>
        <div className="relative z-10 p-6 flex flex-col justify-end min-h-[200px]">
          <div className="shimmer-bg inline-block self-start mb-2 px-3 py-1 rounded-full">
            <span className="text-[10px] font-bold text-gold uppercase tracking-widest">
              Ótica D'Griffe
            </span>
          </div>
          <h2 className="text-white text-2xl font-bold leading-tight mb-1">
            Óculos <span className="text-gold-gradient">Originais</span>
          </h2>
          <p className="text-gray-400 text-xs mb-4 max-w-[220px]">
            Ray-Ban, Michael Kors, Vogue e mais. Até 5x sem juros ou desconto no Pix.
          </p>
          <button
            onClick={() => onNavigate("catalog")}
            className="self-start px-6 py-2.5 bg-white text-luxury-black text-xs font-bold rounded-xl hover:bg-gray-100 active:scale-95 transition-all flex items-center gap-1.5"
          >
            Ver Coleção
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Category Carousel */}
      <div className="mb-6">
        <div className="flex items-center justify-between px-5 mb-3">
          <h3 className="text-sm font-bold text-luxury-black">Categorias</h3>
          <button onClick={() => onNavigate("catalog")} className="text-[10px] font-semibold text-gold uppercase tracking-wider">Ver tudo</button>
        </div>
        <div className="flex gap-3 px-5 overflow-x-auto no-scrollbar">
          {categories.map((cat) => (
            <button key={cat.id} onClick={() => onNavigate("catalog")} className="flex flex-col items-center gap-1.5 flex-shrink-0 min-w-[72px]">
              <div className="w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center text-xl hover:shadow-md hover:scale-105 transition-all duration-200 border border-ice-dark/50">
                {cat.icon}
              </div>
              <span className="text-[10px] font-medium text-luxury-black whitespace-nowrap">{cat.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* YouTube Section - Vídeos D'Griffe */}
      <YouTubeSection />

      {/* Featured Products */}
      <div className="mb-6">
        <div className="flex items-center justify-between px-5 mb-3">
          <h3 className="text-sm font-bold text-luxury-black">Destaques</h3>
          <button onClick={() => onNavigate("catalog")} className="text-[10px] font-semibold text-gold uppercase tracking-wider">Ver mais</button>
        </div>
        <div className="grid grid-cols-2 gap-3 px-4">
          {featuredProducts.map((product) => (
            <ProductCard key={product.id} product={product} onSelect={onSelectProduct} onAddToCart={onAddToCart} onTryOn={onTryOn} isFavorite={isFavorite ? isFavorite(product.id) : undefined} onToggleFavorite={onToggleFavorite} />
          ))}
        </div>
      </div>

      {/* Vistos recentemente */}
      {recentProducts.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between px-5 mb-3">
            <h3 className="text-sm font-bold text-luxury-black">Vistos recentemente 👀</h3>
          </div>
          <div className="flex gap-3 px-4 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-1">
            {recentProducts.map((product) => (
              <div key={product.id} className="flex-shrink-0 w-44 snap-start">
                <ProductCard product={product} onSelect={onSelectProduct} onAddToCart={onAddToCart} onTryOn={onTryOn} isFavorite={isFavorite ? isFavorite(product.id) : undefined} onToggleFavorite={onToggleFavorite} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pix Banner */}
      <div className="mx-4 mb-5 relative overflow-hidden rounded-3xl bg-gradient-to-br from-green-900 to-green-800 p-5">
        <div className="absolute top-0 right-0 w-40 h-40">
          <div className="absolute top-4 right-4 w-24 h-24 border border-green-400/20 rounded-full" />
        </div>
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center flex-shrink-0">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>
          </div>
          <div>
            <span className="text-green-300 text-[10px] font-bold uppercase tracking-widest">Desconto Especial</span>
            <h3 className="text-white text-lg font-bold mt-0.5">
              Pague no <span className="text-green-300">Pix</span>
            </h3>
            <p className="text-green-200/60 text-[10px]">Economia em todos os produtos com pagamento via Pix</p>
          </div>
        </div>
      </div>

      {/* Sol Products - Carrossel */}
      <div className="mb-6">
        <div className="flex items-center justify-between px-5 mb-3">
          <h3 className="text-sm font-bold text-luxury-black">Óculos de Sol ☀️</h3>
          <button onClick={() => onNavigate("catalog")} className="text-[10px] font-semibold text-gold uppercase tracking-wider">Ver mais</button>
        </div>
        <div className="flex gap-3 px-4 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-1">
          {solProducts.map((product) => (
            <div key={product.id} className="flex-shrink-0 w-44 snap-start">
              <ProductCard product={product} onSelect={onSelectProduct} onAddToCart={onAddToCart} onTryOn={onTryOn} isFavorite={isFavorite ? isFavorite(product.id) : undefined} onToggleFavorite={onToggleFavorite} />
            </div>
          ))}
        </div>
      </div>

      {/* Second Banner */}
      <div className="mx-4 mb-5 relative overflow-hidden rounded-3xl bg-gradient-to-br from-luxury-dark to-luxury-black p-5">
        <div className="absolute top-0 right-0 w-40 h-40">
          <div className="absolute top-6 right-6 w-28 h-28 border border-silver/20 rounded-full" />
        </div>
        <div className="relative z-10">
          <span className="text-[10px] font-bold text-silver uppercase tracking-widest">Ótica D'Griffe</span>
          <h3 className="text-white text-xl font-bold mt-1 mb-1">
            Marcas <span className="text-gold-gradient">Exclusivas</span>
          </h3>
          <p className="text-gray-500 text-[11px] mb-3 max-w-[200px]">
            Ray-Ban, Michael Kors, Vogue, Grazi Massafera, Armani Exchange e muito mais.
          </p>
          <button onClick={() => onNavigate("catalog")} className="px-5 py-2 bg-white text-luxury-black text-xs font-bold rounded-xl hover:bg-gray-100 active:scale-95 transition-all">
            Explorar Marcas
          </button>
        </div>
      </div>

      {/* Localização da Loja */}
      <div className="mx-4 mb-6">
        <div className="bg-white rounded-3xl overflow-hidden shadow-sm">
          {/* Map */}
          <div className="relative w-full" style={{ paddingBottom: "45%" }}>
            <iframe
              className="absolute inset-0 w-full h-full"
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3300!2d-51.18!3d-30.04!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMzDCsDAyJzI0LjAiUyA1McKwMTAnNDguMCJX!5e0!3m2!1spt-BR!2sbr!4v1"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Localização Ótica D'Griffe"
            />
          </div>

          {/* Info */}
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 bg-luxury-black rounded-2xl flex items-center justify-center flex-shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D4A853" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-luxury-black">Ótica D'Griffe</h4>
                <p className="text-xs text-gray-500 mt-0.5">Av. Paraguassu, 1629</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                    Seg-Sex 9h-18h | Sáb 9h-13h
                  </span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 mt-4">
              <a
                href="https://maps.google.com/?q=Av+Paraguassu+1629"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 h-10 bg-luxury-black text-white text-[11px] font-semibold rounded-xl hover:bg-luxury-dark active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="3 11 22 2 13 21 11 13 3 11" />
                </svg>
                Como Chegar
              </a>
              <a
                href="https://wa.me/5551992809229"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 h-10 bg-green-600 text-white text-[11px] font-semibold rounded-xl hover:bg-green-700 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Redes Sociais */}
      <div className="mx-4 mb-6">
        <div className="text-center mb-4">
          <p className="text-sm font-bold text-luxury-black">Siga a gente nas redes</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Fique por dentro das novidades e promoções</p>
        </div>
        <div className="flex gap-3">
          {/* Instagram */}
          <a
            href="https://www.instagram.com/oticadgriffe"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 bg-white rounded-2xl p-4 shadow-sm hover:shadow-md active:scale-[0.98] transition-all flex flex-col items-center gap-2 group"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
              </svg>
            </div>
            <div className="text-center">
              <p className="text-[11px] font-bold text-luxury-black">Instagram</p>
              <p className="text-[9px] text-gray-400">@oticadgriffe</p>
            </div>
          </a>

          {/* Facebook */}
          <a
            href="https://www.facebook.com/share/1LrEyrpRfD/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 bg-white rounded-2xl p-4 shadow-sm hover:shadow-md active:scale-[0.98] transition-all flex flex-col items-center gap-2 group"
          >
            <div className="w-12 h-12 rounded-2xl bg-[#1877F2] flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </div>
            <div className="text-center">
              <p className="text-[11px] font-bold text-luxury-black">Facebook</p>
              <p className="text-[9px] text-gray-400">Ótica D'Griffe</p>
            </div>
          </a>

          {/* Site */}
          <a
            href="https://www.oticadgriffe.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 bg-white rounded-2xl p-4 shadow-sm hover:shadow-md active:scale-[0.98] transition-all flex flex-col items-center gap-2 group"
          >
            <div className="w-12 h-12 rounded-2xl bg-luxury-black flex items-center justify-center group-hover:scale-110 transition-transform">
              <span className="text-gold-gradient text-sm font-black">D'G</span>
            </div>
            <div className="text-center">
              <p className="text-[11px] font-bold text-luxury-black">Site</p>
              <p className="text-[9px] text-gray-400">oticadgriffe.com</p>
            </div>
          </a>
        </div>
      </div>

      {/* Floating WhatsApp Button */}
      <div className="fixed bottom-20 right-3 z-30">
        <a
          href="https://wa.me/5551992809229"
          target="_blank"
          rel="noopener noreferrer"
          className="w-12 h-12 bg-[#25D366] rounded-full shadow-lg shadow-green-600/30 flex items-center justify-center hover:shadow-xl hover:scale-105 active:scale-95 transition-all"
          title="Conversar no WhatsApp"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </a>
      </div>
    </div>
  );
}
