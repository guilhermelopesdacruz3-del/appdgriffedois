import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCart, clearCart, isClienteLogado } from '../services/cart';
import { formatPrice } from '../utils/format';
import { Lock, CreditCard, QrCode } from 'lucide-react';
import type { CartItem } from '../services/cart';

export default function CheckoutPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [pagamento, setPagamento] = useState<'pix' | 'cartao'>('pix');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isClienteLogado()) {
      navigate('/login');
      return;
    }
    const c = getCart();
    if (c.length === 0) navigate('/cart');
    setCart(c);
  }, []);

  const total = cart.reduce((acc, item) => acc + item.price * item.quantidade, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // Simular criação de pedido
      await new Promise((r) => setTimeout(r, 1500));
      clearCart();
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Erro ao finalizar pedido.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="container-site py-12">
        <div className="max-w-md mx-auto text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="section-title mb-2">Pedido Realizado!</h1>
          <p className="text-gray-500 mb-4">
            Recebemos seu pedido. Você receberá um e-mail com os detalhes.
          </p>
          <button onClick={() => navigate('/catalogo')} className="btn-primary">
            Continuar Comprando
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container-site py-8">
      <h1 className="section-title mb-6">Finalizar Compra</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Pagamento */}
        <div>
          <div className="bg-white rounded-2xl p-6 shadow-card space-y-4">
            <h2 className="font-display font-semibold text-lg text-luxury-black">Pagamento</h2>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setPagamento('pix')}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                  pagamento === 'pix'
                    ? 'border-gold bg-gold/5 text-luxury-black'
                    : 'border-ice-dark text-gray-600 hover:border-gray-300'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-ice flex items-center justify-center">
                  <QrCode size={20} className={pagamento === 'pix' ? 'text-gold' : 'text-gray-500'} />
                </div>
                <div>
                  <p className="font-semibold text-sm">PIX</p>
                  <p className="text-xs text-gray-500">{formatPrice(total)}</p>
                </div>
              </button>
              <button
                onClick={() => setPagamento('cartao')}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                  pagamento === 'cartao'
                    ? 'border-gold bg-gold/5 text-luxury-black'
                    : 'border-ice-dark text-gray-600 hover:border-gray-300'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-ice flex items-center justify-center">
                  <CreditCard size={20} className={pagamento === 'cartao' ? 'text-gold' : 'text-gray-500'} />
                </div>
                <div>
                  <p className="font-semibold text-sm">Cartão</p>
                  <p className="text-xs text-gray-500">Até 5x sem juros</p>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Resumo */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl p-6 shadow-card sticky top-24">
            <h2 className="font-display font-semibold text-lg text-luxury-black mb-4">Resumo do Pedido</h2>
            <div className="space-y-3">
              {cart.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="text-gray-600 truncate mr-2">
                    {item.quantidade}x {item.productName}
                  </span>
                  <span className="font-semibold">{formatPrice(item.price * item.quantidade)}</span>
                </div>
              ))}
              <div className="border-t border-ice-dark pt-3 flex justify-between font-bold text-luxury-black text-base">
                <span>Total</span>
                <span>{formatPrice(total)}</span>
              </div>
            </div>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="mt-6 w-full h-12 btn-gold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-luxury-black/30 border-t-luxury-black rounded-full animate-spin" />
              ) : (
                <>
                  <Lock size={16} />
                  Finalizar Compra — {formatPrice(total)}
                </>
              )}
            </button>
            {error && <p className="text-xs text-red-500 mt-2 text-center">{error}</p>}
            <p className="text-[10px] text-gray-400 text-center mt-3">
              <Lock size={10} className="inline mr-1" />
              Compra segura • Seus dados estão protegidos
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
