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
    <div className="card overflow-hidden cursor-pointer group animate-fade-in">
      {/* Image */}
      <div
        className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-ice-light to-ice"
        onClick={() => navigate(`/produto/${product.id}`)}
      >
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        {product.badge && (
          <span className="absolute top-2 left-2 px-2 py-0.5 bg-luxury-black text-white text-[8px] font-bold uppercase tracking-wider rounded-full z-10">
            {product.badge}
          </span>
        )}
        {discount > 0 && (
          <span className="absolute top-2 right-2 px-2 py-0.5 bg-gold text-luxury-black text-[8px] font-bold rounded-full z-10">
            -{discount}%
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-3" onClick={() => navigate(`/produto/${product.id}`)}>
        <p className="text-[9px] text-gold font-semibold uppercase tracking-wider">{product.brand}</p>
        <h3 className="text-[12px] font-semibold text-luxury-black leading-tight line-clamp-1 mt-0.5">
          {product.name}
        </h3>

        <div className="mt-1">
          <span className="text-[13px] font-bold text-luxury-black">{formatPrice(product.price)}</span>
          {product.originalPrice && (
            <span className="text-[10px] text-gray-400 line-through ml-1">
              {formatPrice(product.originalPrice)}
            </span>
          )}
        </div>

        {product.variacoes && product.variacoes.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {product.variacoes.slice(0, 3).map((v, i) => (
              <span key={i} className="text-[7px] text-gray-500 bg-ice px-1.5 py-0.5 rounded">
                {v}
              </span>
            ))}
            {product.variacoes.length > 3 && (
              <span className="text-[7px] text-gray-400">+{product.variacoes.length - 3}</span>
            )}
          </div>
        )}

        <p className="text-[8px] text-gray-400 mt-1">
          {formatPrice(product.pixPrice || product.price)} Pix • {product.installmentCount || 5}x de {formatPrice(product.installmentValue || product.price / (product.installmentCount || 5))}
        </p>
      </div>

      {/* Botões de Compra */}
      <div className="px-3 pb-3 space-y-1.5">
        {isEyewear(product) ? (
          <>
            <button
              onClick={handleBuyFrame}
              className="w-full h-8 rounded-lg border border-ice-dark text-gray-600 text-[10px] font-medium hover:border-gold/30 hover:text-luxury-black transition-all flex items-center justify-center gap-1"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 01-8 0" /></svg>
              COMPRAR APENAS A ARMAÇÃO
            </button>
            <button
              onClick={handleBuyWithLenses}
              className="w-full h-8 rounded-lg btn-gold text-[10px] font-bold hover:brightness-110 transition-all flex items-center justify-center gap-1"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
              COMPRAR COM LENTES
            </button>
          </>
        ) : (
          <button
            onClick={handleBuyFrame}
            className="w-full h-8 rounded-lg bg-luxury-black text-white text-[10px] font-semibold hover:bg-luxury-dark transition-colors flex items-center justify-center gap-1"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 01-8 0" /></svg>
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
