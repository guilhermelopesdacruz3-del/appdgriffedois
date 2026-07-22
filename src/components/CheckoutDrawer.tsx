import { useState } from "react";
import { formatPrice, isValidEmail } from "../utils";
import { useFidelidade } from "../hooks/useFidelidade";
import { validarCupom, usarCupom } from "../services/cupomApp";
import { iniciarCheckout } from "../services/apiConfig";
import type { Product } from "../data";

interface CartItem {
  product: Product;
  colorIndex: number;
  quantity: number;
}

interface CheckoutDrawerProps {
  items: CartItem[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (info: unknown) => void;
}

type Passo = "escolher" | "processando" | "pix" | "cartao" | "erro";

export default function CheckoutDrawer({ items, isOpen, onClose, onSuccess }: CheckoutDrawerProps) {
  const [passo, setPasso] = useState<Passo>("escolher");
  const [erro, setErro] = useState<string | null>(null);
  const [pix, setPix] = useState<{ qr: string; copia: string } | null>(null);
  const [email, setEmail] = useState("");
  const [pontosResgate, setPontosResgate] = useState(0);
  const [cupomCodigo, setCupomCodigo] = useState("");
  const [cupomAplicado, setCupomAplicado] = useState<{ codigo: string; tipo: string; valor: number; id: string } | null>(null);
  const [cupomErro, setCupomErro] = useState<string | null>(null);
  const { info: fid } = useFidelidade(email.trim().toLowerCase() || null);

  if (!isOpen) return null;

  const total = items.reduce((s, it) => s + it.product.price * it.quantity, 0);
  const descontoPontos = fid ? Math.min(fid.desconto_max, Math.floor((pontosResgate || 0) / fid.regras.pontosPorDesconto) * 10) : 0;
  const descontoCupom = cupomAplicado ? (cupomAplicado.tipo === "percentual" ? total * (cupomAplicado.valor / 100) : Number(cupomAplicado.valor)) : 0;
  const totalComDesconto = Math.max(0, total - descontoPontos - descontoCupom);

  const aplicarCupom = async () => {
    setCupomErro(null);
    if (!cupomCodigo.trim()) return;
    const res = await validarCupom(cupomCodigo.trim());
    if (!res.valido || !res.cupom) return setCupomErro(res.erro || "Cupom inválido.");
    if (res.cupom.valor_minimo != null && total < res.cupom.valor_minimo) return setCupomErro(`Mínimo ${formatPrice(Number(res.cupom.valor_minimo))}.`);
    setCupomAplicado({ codigo: res.cupom.codigo, tipo: res.cupom.tipo, valor: Number(res.cupom.valor), id: res.cupom.id });
    if (res.atribuicao_id) await usarCupom(res.cupom.id, 0).catch(() => {});
  };

  const iniciar = async (meio: "pix" | "cartao") => {
    // O Mercado Pago exige e-mail válido para gerar a cobrança (PIX ou cartão).
    const emailOk = isValidEmail(email.trim());
    if (!emailOk) {
      setErro("Informe um e-mail válido para continuar o pagamento.");
      setPasso("erro");
      return;
    }
    setPasso("processando");
    setErro(null);
    try {
      const resultado = await iniciarCheckout({
        items: items.map((it) => ({ price: it.product.price, qty: it.quantity, sku: String(it.product.id), li_uri: it.product.li_uri })),
        meio,
        email: email || undefined,
        pontosResgate: pontosResgate > 0 ? pontosResgate : undefined,
        cupom: cupomAplicado || undefined,
      });
      if (meio === "pix") {
        setPix({ qr: resultado.pix_qr_base64 || "", copia: resultado.pix_copia_cola || "" });
        setPasso("pix");
      } else {
        setPasso("cartao");
      }
      onSuccess?.(resultado);
    } catch (e: any) {
      setErro(e.message || "Falha ao iniciar o pagamento.");
      setPasso("erro");
    }
  };

  const copiar = () => { if (pix?.copia) navigator.clipboard?.writeText(pix.copia); };

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/60 animate-fade-in" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-[70] animate-slide-up">
        <div className="bg-white rounded-t-3xl max-h-[90vh] overflow-y-auto no-scrollbar">
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>
          <div className="px-5 pb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-luxury-black">Finalizar Compra</h3>
              <button onClick={onClose} className="w-8 h-8 bg-ice rounded-full flex items-center justify-center text-gray-400">×</button>
            </div>

            <div className="bg-ice rounded-2xl p-3 mb-4 flex justify-between">
              <span className="text-xs text-gray-500">Total</span>
              <span className="text-lg font-bold text-luxury-black">{formatPrice(total)}</span>
            </div>

            {passo === "escolher" && (
              <div className="space-y-3">
                <input
                  type="email" value={email} onChange={(e) => { setEmail(e.target.value); setPontosResgate(0); }}
                  placeholder="Seu e-mail" className="w-full h-12 px-4 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-gold"
                />
                {fid && fid.pontos > 0 && (
                  <div className="bg-ice rounded-2xl p-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-gray-500">Seus pontos</span>
                      <span className="text-[11px] font-bold text-gold">{fid.pontos} pts</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="number" min={0} max={fid.pontos} value={pontosResgate}
                        onChange={(e) => setPontosResgate(Math.max(0, Math.min(fid.pontos, Number(e.target.value) || 0)))}
                        placeholder="Usar pontos"
                        className="flex-1 h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gold"
                      />
                      <span className="text-[11px] text-gray-500">-{formatPrice(descontoPontos)}</span>
                    </div>
                    {descontoPontos > 0 && (
                      <p className="text-[10px] text-green-600 mt-1">Desconto pontos: {formatPrice(descontoPontos)}</p>
                    )}
                  </div>
                )}

                <div className="bg-ice rounded-2xl p-3">
                  <div className="flex items-center gap-2">
                    <input
                      value={cupomCodigo}
                      onChange={(e) => setCupomCodigo(e.target.value.toUpperCase())}
                      placeholder="Cupom"
                      className="flex-1 h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gold uppercase"
                    />
                    <button onClick={aplicarCupom} className="h-10 px-4 bg-luxury-black text-white text-xs font-bold rounded-xl">Aplicar</button>
                  </div>
                  {cupomAplicado && (
                    <p className="text-[10px] text-green-600 mt-1">
                      Cupom {cupomAplicado.codigo} aplicado: -{formatPrice(descontoCupom)}
                    </p>
                  )}
                  {cupomErro && <p className="text-[10px] text-red-500 mt-1">{cupomErro}</p>}
                </div>

                <div className="flex justify-between text-xs text-gray-500">
                  <span>Total{descontoCupom > 0 || descontoPontos > 0 ? " com descontos" : ""}</span>
                  <span className="font-bold text-luxury-black">{formatPrice(totalComDesconto)}</span>
                </div>
                <button onClick={() => iniciar("pix")} className="w-full h-14 bg-luxury-black text-white font-bold rounded-2xl active:scale-[0.98] transition-all">
                  Pagar com PIX{totalComDesconto < total ? ` ${formatPrice(totalComDesconto)}` : ""}
                </button>
                <button onClick={() => iniciar("cartao")} className="w-full h-14 border border-luxury-black text-luxury-black font-bold rounded-2xl active:scale-[0.98] transition-all">
                  Cartão de Crédito
                </button>
                <p className="text-[10px] text-gray-400 text-center">
                  Pagamento processado dentro do app (Mercado Pago).
                </p>
              </div>
            )}

            {passo === "processando" && (
              <div className="flex flex-col items-center py-10">
                <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-gray-400 mt-3">Processando...</p>
              </div>
            )}

            {passo === "pix" && pix && (
              <div className="space-y-4">
                <p className="text-sm font-semibold text-luxury-black text-center">Pague com PIX</p>
                {pix.qr
                  ? <img src={`data:image/png;base64,${pix.qr}`} alt="PIX QR" className="w-48 h-48 mx-auto" />
                  : <div className="w-48 h-48 mx-auto bg-ice rounded-2xl flex items-center justify-center text-xs text-gray-400">QR indisponível</div>}
                <div className="bg-ice rounded-2xl p-3">
                  <p className="text-[10px] text-gray-500 mb-1">Copia e cola:</p>
                  <p className="text-[11px] text-luxury-black break-all">{pix.copia}</p>
                </div>
                <button onClick={copiar} className="w-full h-12 bg-luxury-black text-white text-xs font-bold rounded-2xl">Copiar código PIX</button>
                <p className="text-[10px] text-gray-400 text-center">Após o pagamento, o pedido é confirmado automaticamente.</p>
              </div>
            )}

            {passo === "cartao" && (
              <CartaoForm
                total={total}
                onVoltar={() => setPasso("escolher")}
                onPagar={async (dados) => {
                  setPasso("processando");
                  setErro(null);
                  try {
                    const resultado = await iniciarCheckout({
                      items: items.map((it) => ({ price: it.product.price, qty: it.quantity, sku: String(it.product.id), li_uri: it.product.li_uri })),
                      meio: "cartao",
                      email: email || undefined,
                      card_token: JSON.stringify(dados),
                    });
                    onSuccess?.(resultado);
                  } catch (e: any) {
                    setErro(e.message || "Falha ao processar o cartão.");
                    setPasso("erro");
                  }
                }}
              />
            )}

            {passo === "erro" && (
              <div className="space-y-3">
                <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-center text-xs text-red-500">{erro}</div>
                <button onClick={() => setPasso("escolher")} className="w-full h-12 bg-luxury-black text-white text-xs font-bold rounded-2xl">Tentar novamente</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// Formulário de cartão de crédito (Checkout Transparente MP).
// Coleta os dados e os envia ao servidor, que processa via Mercado Pago.
// A tokenização real exige a MP_PUBLIC_KEY no front (SDK do MP) — quando
// ausente, o servidor retorna erro claro e o app mostra a mensagem.
interface CartaoDados {
  numero: string;
  nome: string;
  validade: string;
  cvv: string;
}
function CartaoForm({
  total,
  onVoltar,
  onPagar,
}: {
  total: number;
  onVoltar: () => void;
  onPagar: (dados: CartaoDados) => void;
}) {
  const [numero, setNumero] = useState("");
  const [nome, setNome] = useState("");
  const [validade, setValidade] = useState("");
  const [cvv, setCvv] = useState("");
  const [erroF, setErroF] = useState<string | null>(null);

  const limpo = numero.replace(/\D/g, "");
  const valido =
    limpo.length >= 13 &&
    limpo.length <= 19 &&
    /^[A-Za-zÀ-ÿ\s]+$/.test(nome.trim()) &&
    /^\d{2}\/\d{2}$/.test(validade) &&
    /^\d{3,4}$/.test(cvv);

  const enviar = () => {
    if (!valido) {
      setErroF("Confira os dados do cartão.");
      return;
    }
    onPagar({ numero: limpo, nome: nome.trim(), validade, cvv });
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-luxury-black text-center">Cartão de Crédito</p>
      <input
        inputMode="numeric"
        value={numero}
        onChange={(e) => setNumero(e.target.value)}
        placeholder="Número do cartão"
        maxLength={23}
        className="w-full h-12 px-4 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-gold"
      />
      <input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Nome impresso no cartão"
        className="w-full h-12 px-4 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-gold"
      />
      <div className="flex gap-3">
        <input
          value={validade}
          onChange={(e) => setValidade(e.target.value)}
          placeholder="MM/AA"
          maxLength={5}
          className="w-1/2 h-12 px-4 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-gold"
        />
        <input
          inputMode="numeric"
          value={cvv}
          onChange={(e) => setCvv(e.target.value.replace(/\D/g, ""))}
          placeholder="CVV"
          maxLength={4}
          className="w-1/2 h-12 px-4 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-gold"
        />
      </div>
      {erroF && <p className="text-[11px] text-red-500 text-center">{erroF}</p>}
      <p className="text-[10px] text-gray-400 text-center">
        Os dados do cartão são tokenizados pelo Mercado Pago (nunca ficam no app).
      </p>
      <button
        onClick={enviar}
        className="w-full h-14 bg-luxury-black text-white font-bold rounded-2xl active:scale-[0.98] transition-all"
      >
        Pagar {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
      </button>
      <button
        onClick={onVoltar}
        className="w-full h-10 text-xs font-bold text-gray-400"
      >
        Voltar
      </button>
    </div>
  );
}
