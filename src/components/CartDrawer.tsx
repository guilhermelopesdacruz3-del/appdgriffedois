import { Product } from "../data";
import { getProductImage, formatPrice } from "../utils";

interface CartItem {
  product: Product;
  colorIndex: number;
  quantity: number;
}

interface CartDrawerProps {
  items: CartItem[];
  isOpen: boolean;
  onClose: () => void;
  onUpdateQuantity: (productId: number, colorIndex: number, delta: number) => void;
  onRemove: (productId: number, colorIndex: number) => void;
  onCheckout: () => void;
}

export default function CartDrawer({ items, isOpen, onClose, onUpdateQuantity, onRemove, onCheckout }: CartDrawerProps) {
  if (!isOpen) return null;

  const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/60 animate-fade-in"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed bottom-0 left-0 right-0 z-[70] animate-slide-up">
        <div className="bg-white rounded-t-3xl max-h-[85vh] flex flex-col">
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 pb-3 flex-shrink-0">
            <div>
              <h2 className="text-lg font-bold text-luxury-black">Carrinho</h2>
              <p className="text-[10px] text-gray-400">
                {itemCount} {itemCount === 1 ? "item" : "itens"}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 bg-ice rounded-full flex items-center justify-center"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1A1A1A" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Items */}
          <div className="flex-1 overflow-y-auto no-scrollbar px-5 pb-4">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-16 h-16 bg-ice rounded-full flex items-center justify-center mb-3">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C0C0C0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <path d="M16 10a4 4 0 01-8 0" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-luxury-black mb-1">Carrinho vazio</p>
                <p className="text-xs text-gray-400">Adicione peças para começar</p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div
                    key={`${item.product.id}-${item.colorIndex}`}
                    className="flex gap-3 bg-ice rounded-2xl p-3 animate-scale-in"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    {/* Product Image */}
                    <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-white">
                      <img
                        src={getProductImage(item.product.image)}
                        alt={item.product.name}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <p className="text-[9px] text-gold font-semibold uppercase tracking-wider">
                          {item.product.brand}
                        </p>
                        <p className="text-xs font-bold text-luxury-black leading-tight line-clamp-1">
                          {item.product.name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className="w-3 h-3 rounded-full border border-white shadow-sm"
                            style={{ backgroundColor: item.product.colors[item.colorIndex] }}
                          />
                          <span className="text-[9px] text-gray-400">
                            {item.product.colorNames[item.colorIndex]}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-luxury-black">
                          {formatPrice(item.product.price * item.quantity)}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onUpdateQuantity(item.product.id, item.colorIndex, -1)}
                            className="w-6 h-6 rounded-lg bg-white flex items-center justify-center text-luxury-black hover:bg-gray-100 active:scale-95 transition-all"
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                          </button>
                          <span className="text-xs font-bold text-luxury-black w-4 text-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => onUpdateQuantity(item.product.id, item.colorIndex, 1)}
                            className="w-6 h-6 rounded-lg bg-white flex items-center justify-center text-luxury-black hover:bg-gray-100 active:scale-95 transition-all"
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <line x1="12" y1="5" x2="12" y2="19" />
                              <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                          </button>
                          <button
                            onClick={() => onRemove(item.product.id, item.colorIndex)}
                            className="w-6 h-6 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-50 active:scale-95 transition-all ml-1"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {items.length > 0 && (
            <div className="flex-shrink-0 border-t border-ice-dark px-5 pt-4 pb-6">
              {/* Summary */}
              <div className="space-y-1.5 mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Subtotal</span>
                  <span className="text-xs font-medium text-luxury-black">{formatPrice(total)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Frete</span>
                  <span className="text-xs font-medium text-green-600">Grátis</span>
                </div>
                <div className="h-px bg-ice-dark" />
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-luxury-black">Total</span>
                  <span className="text-lg font-bold text-luxury-black">{formatPrice(total)}</span>
                </div>
              </div>

              {/* Checkout Button */}
              <button onClick={onCheckout} className="w-full h-14 bg-luxury-black text-white font-bold rounded-2xl hover:bg-luxury-dark active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                  <line x1="1" y1="10" x2="23" y2="10" />
                </svg>
                Finalizar Compra
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
