import { useState } from "react";
import { Product } from "../data";
import { getProductImage, formatPrice, formatInstallment } from "../utils";

interface PurchaseDrawerProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (product: Product, colorIndex: number, quantity: number) => void;
}

export default function PurchaseDrawer({ product, isOpen, onClose, onConfirm }: PurchaseDrawerProps) {
  const [selectedColor, setSelectedColor] = useState(0);
  const [quantity, setQuantity] = useState(1);

  if (!product || !isOpen) return null;

  const handleConfirm = () => {
    onConfirm(product, selectedColor, quantity);
    onClose();
  };

  const total = product.price * quantity;
  const pixTotal = product.pixPrice * quantity;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/60 animate-fade-in"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed bottom-0 left-0 right-0 z-[70] animate-slide-up">
        <div className="bg-white rounded-t-3xl max-h-[85vh] overflow-y-auto no-scrollbar">
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>

          {/* Content */}
          <div className="px-5 pb-8">
            {/* Product Preview */}
            <div className="flex gap-4 mb-5">
              <div className="w-24 h-24 rounded-2xl overflow-hidden bg-ice flex-shrink-0">
                <img
                  src={getProductImage(product.image)}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-gold font-semibold uppercase tracking-wider">
                  {product.brand}
                </p>
                <h3 className="text-lg font-bold text-luxury-black leading-tight mb-1">
                  {product.name}
                </h3>
                <p className="text-[9px] text-gray-400">Cód: {product.code}</p>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-ice-dark mb-5" />

            {/* Color Selection */}
            <div className="mb-5">
              <p className="text-xs font-semibold text-luxury-black mb-3">
                Cor: <span className="text-gold">{product.colorNames[selectedColor]}</span>
              </p>
              <div className="flex gap-3">
                {product.colors.map((color, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedColor(index)}
                    className={`relative w-10 h-10 rounded-full transition-all duration-200 ${
                      selectedColor === index
                        ? "ring-2 ring-gold ring-offset-2 scale-110"
                        : "ring-1 ring-gray-200 hover:ring-gray-400"
                    }`}
                    style={{ backgroundColor: color }}
                  >
                    {selectedColor === index && (
                      <svg
                        className="absolute inset-0 m-auto"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="white"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity */}
            <div className="mb-5">
              <p className="text-xs font-semibold text-luxury-black mb-3">Quantidade</p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-10 h-10 rounded-xl border border-ice-dark flex items-center justify-center text-luxury-black hover:bg-ice transition-colors active:scale-95"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
                <span className="w-10 text-center text-lg font-bold text-luxury-black">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity(Math.min(10, quantity + 1))}
                  className="w-10 h-10 rounded-xl border border-ice-dark flex items-center justify-center text-luxury-black hover:bg-ice transition-colors active:scale-95"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* 3D & Try-On Quick Actions */}
            <div className="flex gap-2 mb-5">
              {product.has3D && (
                <button className="flex-1 h-10 rounded-xl border border-gold/30 bg-gold/5 flex items-center justify-center gap-1.5 text-gold text-xs font-medium hover:bg-gold/10 transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                  3D
                </button>
              )}
              {product.hasTryOn && (
                <button className="flex-1 h-10 rounded-xl border border-luxury-black/20 bg-luxury-black/5 flex items-center justify-center gap-1.5 text-luxury-black text-xs font-medium hover:bg-luxury-black/10 transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  Provador
                </button>
              )}
            </div>

            {/* Summary */}
            <div className="bg-ice rounded-2xl p-4 mb-5">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-500">Subtotal</span>
                <span className="text-sm font-semibold text-luxury-black">
                  {formatPrice(total)}
                </span>
              </div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-500">Frete</span>
                <span className="text-xs font-medium text-green-600">Grátis</span>
              </div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-500">Parcelas</span>
                <span className="text-xs font-medium text-gray-600">
                  {formatInstallment(product.installmentCount, product.installmentValue * quantity)} s/ juros
                </span>
              </div>
              <div className="h-px bg-ice-dark my-2" />
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-luxury-black">Total</span>
                <span className="text-lg font-bold text-luxury-black">
                  {formatPrice(total)}
                </span>
              </div>
              <div className="mt-1 bg-green-50 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2">
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                  <path d="M2 10h20" />
                </svg>
                <span className="text-[10px] text-green-700 font-semibold">
                  {formatPrice(pixTotal)} via Pix
                </span>
              </div>
            </div>

            {/* Confirm Button */}
            <button
              onClick={handleConfirm}
              className="w-full h-14 bg-luxury-black text-white font-bold rounded-2xl hover:bg-luxury-dark active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 01-8 0" />
              </svg>
              Adicionar ao Carrinho
            </button>

            {/* Continue Shopping */}
            <button
              onClick={onClose}
              className="w-full h-12 text-gray-500 text-xs font-medium mt-2 hover:text-luxury-black transition-colors"
            >
              Continuar comprando
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
