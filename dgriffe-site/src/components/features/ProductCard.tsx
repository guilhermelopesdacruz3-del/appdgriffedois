import type { Product } from '../../data/types';
import { formatPrice } from '../../utils/format';
import { useNavigate } from 'react-router-dom';
import { addToCart } from '../../services/cart';
import LensesModal from './LensesModal';
import { useState } from 'react';

interface ProductCardProps {
  product: Product;
}

// Verifica se o produto é um óculos (categorias 6299628 = Sol, 6299649 = Grau)
function isEyewear(product: Product): boolean {
  const cat = (product.category || '').toLowerCase();
  return cat.includes('sol') || cat.includes('grau') || cat.includes('óculos') || cat.includes('oculos');
}

export default function ProductCard({ product }: ProductCardProps) {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const discount = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  const handleBuyFrame = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToCart({
      productId: product.id,
      productName: product.name,
      productImage: product.image,
      price: product.price,
      quantidade: 1,
      frameOnly: true,
    });
    navigate('/cart');
  };

  const handleBuyWithLenses = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowModal(true);
  };

  return (
    <div className="rb-card group animate-fade-in">
      {/* Imagem — fundo cinza #f2f2f2 estilo Ray-Ban */}
      <div
        className="relative aspect-square overflow-hidden rb-card-img"
        onClick={() => navigate(`/produto/${product.id}`)}
      >
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        {product.badge && (
          <span className="absolute top-2 left-2 px-2 py-0.5 bg-neutral-900 text-white text-[8px] font-bold uppercase tracking-wider">
            {product.badge}
          </span>
        )}
        {discount > 0 && (
          <span className="absolute top-2 right-2 px-2 py-0.5 bg-white text-neutral-900 text-[8px] font-bold uppercase tracking-wider border border-neutral-200">
            -{discount}%
          </span>
        )}
      </div>

      {/* Info */}
      <div className="pt-3 pb-2 px-0" onClick={() => navigate(`/produto/${product.id}`)}>
        {product.brand && (
          <p className="text-[9px] text-neutral-500 font-medium uppercase tracking-wider mb-0.5">{product.brand}</p>
        )}
        <h3 className="text-[12px] font-semibold text-neutral-900 leading-tight line-clamp-1 uppercase tracking-wide">
          {product.name}
        </h3>

        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="text-[13px] font-bold text-neutral-900">{formatPrice(product.price)}</span>
          {product.originalPrice && (
            <span className="text-[10px] text-neutral-400 line-through">
              {formatPrice(product.originalPrice)}
            </span>
          )}
        </div>

        {product.variacoes && product.variacoes.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {product.variacoes.slice(0, 3).map((v, i) => (
              <span key={i} className="text-[8px] text-neutral-600 border border-neutral-200 px-1.5 py-0.5 rounded-full">
                {v}
              </span>
            ))}
            {product.variacoes.length > 3 && (
              <span className="text-[8px] text-neutral-400">+{product.variacoes.length - 3}</span>
            )}
          </div>
        )}
      </div>

      {/* Botões de Compra — estilo Ray-Ban (contornado + preto) */}
      <div className="space-y-1.5">
        {isEyewear(product) ? (
          <>
            <button onClick={handleBuyFrame} className="rb-btn-outline flex items-center justify-center gap-1">
              COMPRAR ARMAÇÃO
            </button>
            <button onClick={handleBuyWithLenses} className="rb-btn-dark flex items-center justify-center gap-1">
              COM LENTES
            </button>
          </>
        ) : (
          <button onClick={handleBuyFrame} className="rb-btn-dark flex items-center justify-center gap-1">
            ADICIONAR AO CARRINHO
          </button>
        )}
      </div>

      {/* Modal de Lentes — apenas para óculos */}
      {isEyewear(product) && showModal && (
        <LensesModal
          product={product}
          onClose={() => setShowModal(false)}
          onAddToCart={(item) => {
            addToCart(item);
            setShowModal(false);
            navigate('/cart');
          }}
        />
      )}
    </div>
  );
}
