import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { buscarProduto } from '../services/api';
import type { Product } from '../data/types';
import { formatPrice, formatInstallment, getProductImage } from '../utils/format';
import LensesModal from '../components/features/LensesModal';
import { addToCart } from '../services/cart';

// Verifica se o produto é um óculos (categorias Sol/Grau)
function isEyewear(product: Product): boolean {
  const cat = (product.category || '').toLowerCase();
  return cat.includes('sol') || cat.includes('grau') || cat.includes('óculos') || cat.includes('oculos');
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedColor, setSelectedColor] = useState(0);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showLensesModal, setShowLensesModal] = useState(false);
  const [cep, setCep] = useState('');
  const [freteResult, setFreteResult] = useState<string | null>(null);
  const [freteLoading, setFreteLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    buscarProduto(id)
      .then(setProduct)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const calcularFrete = async () => {
    if (cep.length < 8) return;
    setFreteLoading(true);
    setFreteResult(null);
    // Simulação de cálculo de frete (integração real com Correios/API)
    await new Promise(r => setTimeout(r, 1200));
    const valor = (Math.random() * 30 + 15).toFixed(2).replace('.', ',');
    setFreteResult(`R$ ${valor} • Chega em 3-5 dias úteis`);
    setFreteLoading(false);
  };

  if (loading) {
    return (
      <div className="container-site py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="aspect-square bg-ice-dark rounded-2xl animate-pulse" />
          <div className="space-y-4">
            <div className="h-4 bg-ice-dark rounded w-1/4" />
            <div className="h-8 bg-ice-dark rounded w-3/4" />
            <div className="h-4 bg-ice-dark rounded w-1/2" />
            <div className="h-12 bg-ice-dark rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container-site py-8 text-center">
        <p className="text-gray-500">Produto não encontrado.</p>
        <Link to="/catalogo" className="text-gold text-sm font-semibold hover:underline mt-4 inline-block">
          ← Voltar ao catálogo
        </Link>
      </div>
    );
  }

  const images = [product.image, ...(product.imagens || [])].filter(Boolean);

  return (
    <div className="container-site py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-gray-500 mb-6">
        <Link to="/" className="hover:text-gold">Início</Link>
        <span>/</span>
        <Link to="/catalogo" className="hover:text-gold">Coleção</Link>
        <span>/</span>
        <span className="text-luxury-black font-medium">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Galeria */}
        <div>
          <div className="aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-ice-light to-ice mb-4">
            <img
              src={getProductImage(images[activeImageIndex] || product.image)}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImageIndex(i)}
                  className={`w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 transition-all ${
                    activeImageIndex === i ? 'ring-2 ring-gold' : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={getProductImage(img)} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          <p className="text-xs text-gold font-semibold uppercase tracking-widest mb-1">{product.brand}</p>
          <h1 className="text-2xl md:text-3xl font-bold text-luxury-black mb-2">{product.name}</h1>
          <p className="text-xs text-gray-400 mb-4">Cód: {product.code}</p>

          {/* Preço */}
          <div className="bg-ice rounded-2xl p-4 mb-4">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-2xl font-bold text-luxury-black">{formatPrice(product.price)}</span>
              {product.originalPrice && (
                <span className="text-sm text-gray-400 line-through">{formatPrice(product.originalPrice)}</span>
              )}
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

          {/* Variações */}
          {product.variacoes && product.variacoes.length > 0 && (
            <div className="mb-5">
              <p className="text-xs font-semibold text-luxury-black mb-3">
                Variação: <span className="text-gold">{product.variacoes[selectedColor]}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {product.variacoes.map((v, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedColor(i)}
                    className={`h-12 px-5 rounded-xl border transition-all duration-200 ${
                      selectedColor === i
                        ? 'border-gold bg-gold/10 text-gold font-semibold'
                        : 'border-ice-dark text-gray-600 hover:border-gold/30'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Cores */}
          {product.colors.length > 0 && (
            <div className="mb-5">
              <p className="text-xs font-semibold text-luxury-black mb-3">
                Cor: <span className="text-gold">{product.colorNames[selectedColor] || product.colorNames[0]}</span>
              </p>
              <div className="flex gap-3">
                {product.colors.map((color, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedColor(i)}
                    className={`relative w-12 h-12 rounded-full transition-all duration-200 ${
                      selectedColor === i ? 'ring-2 ring-gold ring-offset-2 scale-110' : 'ring-1 ring-gray-200 hover:ring-gray-400'
                    }`}
                    style={{ backgroundColor: color }}
                  >
                    {selectedColor === i && (
                      <svg className="absolute inset-0 m-auto" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tamanhos */}
          {product.tamanhos && product.tamanhos.length > 0 && (
            <div className="mb-5">
              <p className="text-xs font-semibold text-luxury-black mb-3">Tamanho</p>
              <div className="flex flex-wrap gap-2">
                {product.tamanhos.map((t, i) => (
                  <button
                    key={i}
                    className="h-10 px-4 rounded-xl border border-ice-dark text-gray-600 hover:border-gold/30 transition-all"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Banner explicativo */}
          {isEyewear(product) && (
            <div className="mb-5 bg-gradient-to-r from-luxury-black to-luxury-dark rounded-2xl p-5 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gold/10 rounded-full blur-2xl" />
              <div className="relative flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center flex-shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D4A017" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
                </div>
                <div>
                  <p className="font-bold text-sm mb-1">Monte seu óculos do seu jeito</p>
                  <p className="text-xs text-gray-300 leading-relaxed">
                    Escolha a armação, personalize as lentes com seu grau e receba em casa. 
                    Nosso time de especialistas está pronto para ajudar!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Botões de Compra */}
          <div className="space-y-3 mb-4">
            {isEyewear(product) ? (
              <>
                <button
                  onClick={() => {
                    addToCart({
                      productId: product.id,
                      productName: product.name,
                      productImage: product.image,
                      price: product.price,
                      quantidade: 1,
                      frameOnly: true,
                    });
                    navigate('/cart');
                  }}
                  className="w-full h-12 rounded-xl bg-luxury-black text-white text-sm font-semibold hover:bg-luxury-dark transition-colors flex items-center justify-center gap-2"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 01-8 0" /></svg>
                  COMPRAR APENAS A ARMAÇÃO — {formatPrice(product.price)}
                </button>
                <button
                  onClick={() => setShowLensesModal(true)}
                  className="w-full h-12 rounded-xl btn-gold text-sm font-bold hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-lg shadow-gold/20"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
                  COMPRAR ÓCULOS COMPLETO COM AS LENTES
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  addToCart({
                    productId: product.id,
                    productName: product.name,
                    productImage: product.image,
                    price: product.price,
                    quantidade: 1,
                    frameOnly: false,
                  });
                  navigate('/cart');
                }}
                className="w-full h-12 rounded-xl bg-luxury-black text-white text-sm font-semibold hover:bg-luxury-dark transition-colors flex items-center justify-center gap-2"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 01-8 0" /></svg>
                ADICIONAR AO CARRINHO — {formatPrice(product.price)}
              </button>
            )}
          </div>

          {/* Ações rápidas: WhatsApp + Frete */}
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <a
              href={`https://wa.me/5551999999999?text=${encodeURIComponent(`Olá! Tenho dúvidas sobre o produto: ${product.name} (${product.code})`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 h-11 rounded-xl border-2 border-green-500/30 text-green-700 text-sm font-semibold hover:bg-green-50 transition-all flex items-center justify-center gap-2"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Falar com Especialista
            </a>

            {/* Calculadora de Frete */}
            <div className="flex-1 flex gap-2">
              <input
                type="text"
                value={cep}
                onChange={(e) => setCep(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="CEP para frete"
                className="flex-1 h-11 px-3 rounded-xl border border-ice-dark text-sm focus:outline-none focus:border-gold"
              />
              <button
                onClick={calcularFrete}
                disabled={cep.length < 8 || freteLoading}
                className="h-11 px-4 rounded-xl bg-ice text-luxury-black text-xs font-semibold hover:bg-ice-dark transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {freteLoading ? '...' : 'Calcular'}
              </button>
            </div>
          </div>
          {freteResult && (
            <div className="mb-4 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2"><path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
              <span className="text-xs text-green-700 font-medium">{freteResult}</span>
            </div>
          )}

          {/* Descrição */}
          {product.description && (
            <div className="mt-6">
              <h4 className="text-xs font-bold text-luxury-black mb-2">Sobre este produto</h4>
              <p className="text-[13px] text-gray-600 leading-relaxed whitespace-pre-line">
                {product.description.replace(/<[^>]*>/g, '').trim()}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Lentes — apenas para óculos */}
      {showLensesModal && product && isEyewear(product) && (
        <LensesModal
          product={product}
          onClose={() => setShowLensesModal(false)}
          onAddToCart={(item) => {
            addToCart(item);
            setShowLensesModal(false);
            navigate('/cart');
          }}
        />
      )}
    </div>
  );
}
