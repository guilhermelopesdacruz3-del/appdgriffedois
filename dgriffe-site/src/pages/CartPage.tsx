import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCart, removeFromCart, updateCartItem } from '../services/cart';
import { formatPrice } from '../utils/format';
import { ShoppingBag, Plus, Minus, Trash2, ChevronLeft } from 'lucide-react';
import type { CartItem } from '../services/cart';

export default function CartPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    setCart(getCart());
  }, []);

  const total = cart.reduce((acc, item) => acc + item.price * item.quantidade, 0);

  const handleQuantity = (productId: number, delta: number, variacao?: string) => {
    const item = cart.find((i) => i.productId === productId && i.variacao === variacao);
    const newQty = Math.max(0, (item?.quantidade || 1) + delta);
    setCart(updateCartItem(productId, newQty, variacao));
  };

  const handleRemove = (productId: number, variacao?: string) => {
    setCart(removeFromCart(productId, variacao));
  };

  return (
    <div className="container-site py-8">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ChevronLeft size={16} />
        Voltar
      </button>

      <h1 className="section-title mb-6">Carrinho</h1>

      {cart.length === 0 ? (
        <div className="text-center py-12">
          <ShoppingBag size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500 mb-4">Seu carrinho está vazio.</p>
          <button onClick={() => navigate('/catalogo')} className="btn-gold">
            Ver Coleção
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Itens */}
          <div className="lg:col-span-2 space-y-4">
            {cart.map((item, idx) => (
              <div key={`${item.productId}-${item.variacao || ''}-${idx}`} className="flex gap-4 card p-4">
                <img
                  src={item.productImage || ''}
                  alt={item.productName}
                  className="w-20 h-20 object-cover rounded-lg bg-ice"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-luxury-black truncate">{item.productName}</h3>
                  {item.variacao && (
                    <p className="text-xs text-gray-500">Config: {item.variacao}</p>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm font-bold text-luxury-black">
                      {formatPrice(item.price * item.quantidade)}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleQuantity(item.productId, -1, item.variacao)}
                        className="w-7 h-7 rounded-full bg-ice flex items-center justify-center hover:bg-ice-dark transition-colors"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="text-sm font-semibold w-6 text-center">{item.quantidade}</span>
                      <button
                        onClick={() => handleQuantity(item.productId, 1, item.variacao)}
                        className="w-7 h-7 rounded-full bg-ice flex items-center justify-center hover:bg-ice-dark transition-colors"
                      >
                        <Plus size={12} />
                      </button>
                      <button
                        onClick={() => handleRemove(item.productId, item.variacao)}
                        className="ml-2 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Resumo */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl p-6 shadow-card sticky top-24">
              <h2 className="font-display font-bold text-xl text-luxury-black mb-4">Resumo</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>{formatPrice(total)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Frete</span>
                  <span className="text-green-600 font-semibold">Grátis</span>
                </div>
                <div className="border-t border-ice-dark pt-2 flex justify-between font-bold text-luxury-black text-base">
                  <span>Total</span>
                  <span>{formatPrice(total)}</span>
                </div>
              </div>
              <button
                onClick={() => navigate('/checkout')}
                className="mt-6 w-full h-12 btn-gold text-sm flex items-center justify-center gap-2"
              >
                Finalizar Compra
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
