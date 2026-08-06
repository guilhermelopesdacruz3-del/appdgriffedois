import { useEffect, useState } from "react";
import { formatPrice } from "../../utils";
import { useCliente } from "../../hooks/useCliente";
import { validarCupom, usarCupom } from "../../services/cupomApp";
import { iniciarCheckout } from "../../services/apiConfig";
import type { Product } from "../../data";

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

type Passo = "resumo" | "dados" | "escolher" | "processando" | "pix" | "cartao" | "sucesso" | "erro";

const ETAPAS: { id: Passo; rotulo: string }[] = [
  { id: "resumo", rotulo: "Carrinho" },
  { id: "dados", rotulo: "Seus dados" },
  { id: "escolher", rotulo: "Pagamento" },
];

function mascaraCpf(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export default function CheckoutDrawer({ items, isOpen, onClose, onSuccess, fidelidade: fid }: CheckoutDrawerProps & { fidelidade?: any }) {
  const { cliente, perfil, enderecos } = useCliente();
  const [passo, setPasso] = useState<Passo>("resumo");
  const [erro, setErro] = useState<string | null>(null);
  const [pix, setPix] = useState<{ qr: string; copia: string } | null>(null);
  const [pontosC, setPontosC] = useState(0);
  const [pontosResgate, setPontosResgate] = useState(0);
  const [cupomCodigo, setCupomCodigo] = useState("");
  const [cupomAplicado, setCupomAplicado] = useState<{ codigo: string; tipo: string; valor: number; id: string } | null>(null);
  const [cupomErro, setCupomErro] = useState<string | null>(null);

  const [email, setEmail] = useState(cliente?.email || perfil?.email || "");
  const [nome, setNome] = useState(perfil?.nome || cliente?.nome || "");
  const [telefone, setTelefone] = useState(perfil?.telefone || cliente?.telefone || "");
  const [cpf, setCpf] = useState(cliente?.cpf || "");
  const [forma, setForma] = useState<"retirada" | "entrega">("retirada");
  const [endereco, setEndereco] = useState({ endereco: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "", cep: "" });
  const [observacoes, setObservacoes] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setPasso("resumo");
    setErro(null);
    setPix(null);
    setCupomErro(null);
  }, [isOpen]);

  useEffect(() => {
    if (cliente?.email) setEmail(cliente.email);
    if (perfil?.nome) setNome(perfil.nome);
    if (perfil?.telefone) setTelefone(perfil.telefone);
  }, [cliente, perfil]);

  useEffect(() => {
    const prim = enderecos.find((e) => e.principal) || enderecos[0];
    if (prim) {
      setEndereco({
        endereco: prim.endereco || "",
        numero: prim.numero || "",
        complemento: prim.complemento || "",
        bairro: prim.bairro || "",
        cidade: prim.cidade || "",
        estado: prim.estado || "",
        cep: prim.cep || "",
      });
    }
  }, [enderecos]);

  if (!isOpen) return null;

  const total = items.reduce((s, it) => s + it.product.price * it.quantity, 0);
  const descontoPontos = fid ? Math.min(fid.desconto_max, Math.floor((pontosResgate || 0) / fid.regras.pontosPorDesconto) * 10) : 0;
  const descontoCupom = cupomAplicado ? (cupomAplicado.tipo === "percentual" ? total * (cupomAplicado.valor / 100) : Number(cupomAplicado.valor)) : 0;
  const totalComDesconto = Math.max(0, total - descontoPontos - descontoCupom);

  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const dadosValidos =
    emailValido &&
    nome.trim().length >= 2 &&
    (forma === "retirada" ||
      (endereco.endereco.trim().length >= 3 && endereco.cidade.trim().length >= 2 && endereco.estado.trim().length >= 2 && endereco.cep.replace(/\D/g, "").length === 8));

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
    setPasso("processando");
    setErro(null);
    try {
      const resultado = await iniciarCheckout({
        items: items.map((it) => ({ price: it.product.price, qty: it.quantity, sku: String(it.product.id), li_uri: it.product.li_uri, nome: it.product.name })),
        cliente: {
          email: email.trim(),
          nome: nome.trim(),
          telefone: telefone.trim() || undefined,
          cpf: cpf.replace(/\D/g, "") || undefined,
          forma_entrega: forma,
          endereco: forma === "entrega" ? endereco : undefined,
          observacoes: observacoes.trim() || undefined,
        },
        meio,
        email: email.trim(),
        pontosResgate: pontosResgate > 0 ? pontosResgate : undefined,
        cupom: cupomAplicado || undefined,
      });
      if (meio === "pix") {
        setPix({ qr: resultado.pix_qr_base64 || "", copia: resultado.pix_copia_cola || "" });
        if (resultado.demo) {
          setPontosC(Number(resultado.pontos_creditados || 0));
          setPasso("sucesso");
        } else {
          setPasso("pix");
        }
      } else {
        setPontosC(Number(resultado.pontos_creditados || 0));
        setPasso("sucesso");
      }
      onSuccess?.(resultado);
      window.dispatchEvent(new Event("fidelidade-atualizada"));
    } catch (e: any) {
      setErro(e.message || "Falha ao iniciar o pagamento.");
      setPasso("erro");
    }
  };

  const copiar = () => { if (pix?.copia) navigator.clipboard?.writeText(pix.copia); };

  const etapaAtual = ETAPAS.findIndex((e) => e.id === passo);
  const emFluxo = passo === "resumo" || passo === "dados" || passo === "escolher";

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/60 animate-fade-in" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-[70] animate-slide-up">
        <div className="bg-white rounded-t-3xl max-h-[92vh] overflow-y-auto no-scrollbar">
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>

          {/* Cabeçalho + barra de progresso */}
          {emFluxo && (
            <div className="px-5 pt-2 pb-1">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-luxury-black">Finalizar Compra</h3>
                <button onClick={onClose} className="w-8 h-8 bg-ice rounded-full flex items-center justify-center text-gray-400">×</button>
              </div>
              <div className="flex items-center gap-1">
                {ETAPAS.map((et, i) => (
                  <div key={et.id} className="flex-1 flex items-center gap-1">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 transition-all ${passo === et.id || etapaAtual > i ? "bg-luxury-black text-white" : "bg-gray-200 text-gray-400"}`}>
                        {etapaAtual > i ? "✓" : i + 1}
                      </span>
                      <span className={`text-[9px] font-bold truncate transition-colors ${passo === et.id ? "text-luxury-black" : etapaAtual > i ? "text-gray-500" : "text-gray-300"}`}>{et.rotulo}</span>
                    </div>
                    {i < ETAPAS.length - 1 && <div className={`h-0.5 flex-1 rounded-full ${etapaAtual > i ? "bg-luxury-black" : "bg-gray-200"}`} />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!emFluxo && passo !== "erro" && (
            <div className="px-5 pt-2 pb-1">
              <h3 className="text-lg font-bold text-luxury-black">Finalizar Compra</h3>
            </div>
          )}

          <div className="px-5 pb-8 pt-3">
            {/* ETAPA 1 — RESUMO DO CARRINHO */}
            {passo === "resumo" && (
              <div className="space-y-3">
                <div className="bg-ice rounded-2xl p-3 space-y-2.5">
                  {items.map((it) => (
                    <div key={`${it.product.id}-${it.colorIndex}`} className="flex items-center gap-3">
                      {it.product.image ? (
                        <img src={it.product.image} alt={it.product.name} className="w-12 h-12 rounded-xl object-cover bg-white flex-shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-luxury-black to-gray-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {(it.product.name || "D").charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-luxury-black truncate">{it.product.name}</p>
                        <p className="text-[10px] text-gray-400">Qtd: {it.quantity}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-bold text-luxury-black">{formatPrice(it.product.price * it.quantity)}</p>
                        <p className="text-[9px] text-gray-400">{formatPrice(it.product.price)} cada</p>
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Carrinho vazio.</p>}
                </div>

                <div className="bg-luxury-black rounded-2xl p-4 text-white">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-white/70">Total</span>
                    <span className="text-xl font-bold text-gold">{formatPrice(total)}</span>
                  </div>
                  <p className="text-[10px] text-white/40 mt-1">Retirada na loja ou entrega — sem custo de frete.</p>
                </div>

                <button onClick={() => setPasso("dados")} disabled={items.length === 0} className="w-full h-14 bg-luxury-black text-white font-bold rounded-2xl active:scale-[0.98] transition-all disabled:opacity-40">
                  Continuar
                </button>
              </div>
            )}

            {/* ETAPA 2 — DADOS DO CLIENTE */}
            {passo === "dados" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setForma("retirada")} className={`h-14 rounded-2xl border-2 text-xs font-bold transition-all ${forma === "retirada" ? "border-luxury-black bg-luxury-black text-white" : "border-gray-200 text-gray-500"}`}>
                    🏬 Retirada na loja
                  </button>
                  <button onClick={() => setForma("entrega")} className={`h-14 rounded-2xl border-2 text-xs font-bold transition-all ${forma === "entrega" ? "border-luxury-black bg-luxury-black text-white" : "border-gray-200 text-gray-500"}`}>
                    📦 Entrega
                  </button>
                </div>

                <div className="bg-ice rounded-2xl p-3 space-y-2">
                  <input
                    type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="E-mail *" className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gold"
                  />
                  <input
                    value={nome} onChange={(e) => setNome(e.target.value)}
                    placeholder="Nome completo *" className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gold"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={telefone} onChange={(e) => setTelefone(e.target.value)}
                      placeholder="Telefone (opcional)" inputMode="tel" className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gold"
                    />
                    <input
                      value={cpf} onChange={(e) => setCpf(mascaraCpf(e.target.value))}
                      placeholder="CPF (opcional)" inputMode="numeric" className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gold"
                    />
                  </div>
                </div>

                {forma === "entrega" && (
                  <div className="bg-ice rounded-2xl p-3 space-y-2">
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Endereço de entrega</p>
                    <input value={endereco.endereco} onChange={(e) => setEndereco((s) => ({ ...s, endereco: e.target.value }))} placeholder="Rua / Av. *" className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gold" />
                    <div className="grid grid-cols-3 gap-2">
                      <input value={endereco.numero} onChange={(e) => setEndereco((s) => ({ ...s, numero: e.target.value }))} placeholder="Nº" className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gold" />
                      <input value={endereco.complemento} onChange={(e) => setEndereco((s) => ({ ...s, complemento: e.target.value }))} placeholder="Compl." className="col-span-2 w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gold" />
                    </div>
                    <input value={endereco.bairro} onChange={(e) => setEndereco((s) => ({ ...s, bairro: e.target.value }))} placeholder="Bairro" className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gold" />
                    <div className="grid grid-cols-[1fr_1fr_90px] gap-2">
                      <input value={endereco.cidade} onChange={(e) => setEndereco((s) => ({ ...s, cidade: e.target.value }))} placeholder="Cidade *" className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gold" />
                      <input value={endereco.estado} onChange={(e) => setEndereco((s) => ({ ...s, estado: e.target.value.toUpperCase() }))} placeholder="UF *" maxLength={2} className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gold" />
                      <input value={endereco.cep} onChange={(e) => setEndereco((s) => ({ ...s, cep: e.target.value.replace(/\D/g, "").slice(0, 8) }))} placeholder="CEP *" inputMode="numeric" className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gold" />
                    </div>
                  </div>
                )}

                <input
                  value={observacoes} onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Observações (ex.: grau das lentes, preferências) — opcional" maxLength={500}
                  className="w-full h-14 px-4 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-gold"
                />

                {!emailValido && <p className="text-[10px] text-red-500 px-1">Informe um e-mail válido para receber a cobrança.</p>}
                {emailValido && !dadosValidos && nome.trim().length < 2 && <p className="text-[10px] text-red-500 px-1">Informe seu nome completo.</p>}
                {emailValido && nome.trim().length >= 2 && !dadosValidos && forma === "entrega" && (
                  <p className="text-[10px] text-red-500 px-1">Preencha o endereço de entrega (rua, cidade, UF e CEP de 8 dígitos).</p>
                )}

                <div className="flex gap-2">
                  <button onClick={() => setPasso("resumo")} className="h-14 px-4 border border-gray-200 text-gray-500 text-xs font-bold rounded-2xl active:scale-[0.98] transition-all">Voltar</button>
                  <button onClick={() => setPasso("escolher")} disabled={!dadosValidos} className="flex-1 h-14 bg-luxury-black text-white font-bold rounded-2xl active:scale-[0.98] transition-all disabled:opacity-40">
                    Ir para pagamento
                  </button>
                </div>
              </div>
            )}

            {/* ETAPA 3 — PAGAMENTO */}
            {passo === "escolher" && (
              <div className="space-y-3">
                <div className="bg-luxury-black rounded-2xl p-4 text-white flex justify-between items-center">
                  <span className="text-xs text-white/70">Total a pagar</span>
                  <span className="text-xl font-bold text-gold">{formatPrice(totalComDesconto)}</span>
                </div>
                <p className="text-[10px] text-gray-400 px-1">Recebendo em: {forma === "retirada" ? "retirada na loja" : "entrega no endereço informado"} · {nome.split(" ")[0]} · {email}</p>

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
                  Pagar com PIX
                </button>
                <button onClick={() => iniciar("cartao")} className="w-full h-14 border border-luxury-black text-luxury-black font-bold rounded-2xl active:scale-[0.98] transition-all">
                  Cartão de Crédito
                </button>
                <div className="flex gap-2">
                  <button onClick={() => setPasso("dados")} className="h-10 px-4 text-xs font-bold text-gray-400">Voltar</button>
                  <p className="flex-1 text-[10px] text-gray-400 text-right self-center">
                    Pagamento processado dentro do app (Mercado Pago).
                  </p>
                </div>
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
                <p className="text-[10px] text-gray-400 text-center">Valor: <span className="font-bold text-luxury-black">{formatPrice(totalComDesconto)}</span></p>
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

            {passo === "sucesso" && (
              <div className="flex flex-col items-center py-8 space-y-3">
                <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
                <p className="text-base font-bold text-luxury-black">Pagamento confirmado!</p>
                <p className="text-xs text-gray-500 text-center px-6">
                  {forma === "retirada" ? "Retire na loja D'Griffe. Seu pedido foi enviado e o estoque atualizado." : "Seu pedido foi enviado para entrega e o estoque foi atualizado."}
                </p>
                {pontosC > 0 && (
                  <div className="bg-ice rounded-2xl p-3 text-center">
                    <p className="text-[11px] text-gray-500">Pontos de fidelidade creditados</p>
                    <p className="text-lg font-bold text-gold">+{pontosC} pts</p>
                  </div>
                )}
                <button onClick={onClose} className="w-full h-12 bg-luxury-black text-white text-xs font-bold rounded-2xl">
                  Concluir
                </button>
              </div>
            )}

            {passo === "cartao" && (
              <CartaoForm
                total={totalComDesconto}
                onVoltar={() => setPasso("escolher")}
                onPagar={async (cardToken: string) => {
                  setPasso("processando");
                  setErro(null);
                  try {
                    const resultado = await iniciarCheckout({
                      items: items.map((it) => ({ price: it.product.price, qty: it.quantity, sku: String(it.product.id), li_uri: it.product.li_uri, nome: it.product.name })),
                      cliente: {
                        email: email.trim(),
                        nome: nome.trim(),
                        telefone: telefone.trim() || undefined,
                        cpf: cpf.replace(/\D/g, "") || undefined,
                        forma_entrega: forma,
                        endereco: forma === "entrega" ? endereco : undefined,
                        observacoes: observacoes.trim() || undefined,
                      },
                      meio: "cartao",
                      email: email.trim(),
                      card_token: cardToken,
                      pontosResgate: pontosResgate > 0 ? pontosResgate : undefined,
                      cupom: cupomAplicado || undefined,
                    });
                    setPontosC(Number(resultado.pontos_creditados || 0));
                    setPasso("sucesso");
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
// Os dados do cartão são TOKENIZADOS no navegador pelo SDK do Mercado Pago
// (usando a MP_PUBLIC_KEY) — o número NUNCA passa pelo nosso servidor.
// O servidor recebe apenas o `card_token` (id do token gerado pelo MP).
async function carregarMP(publicKey: string): Promise<any> {
  const w = window as any;
  if (w.MercadoPago) return new w.MercadoPago(publicKey, { locale: "pt-BR" });
  const tentaCarregar = (src: string): Promise<void> =>
    new Promise<void>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      const timer = setTimeout(() => reject(new Error("Tempo esgotado ao carregar o SDK do Mercado Pago (verifique sua conexão).")), 20000);
      s.onload = () => { clearTimeout(timer); w.MercadoPago ? resolve() : reject(new Error("SDK do Mercado Pago não carregou.")); };
      s.onerror = () => { clearTimeout(timer); reject(new Error("Falha ao carregar o SDK do Mercado Pago. Desative bloqueador de anúncios/extensões para este site e tente de novo.")); };
      document.body.appendChild(s);
    });
  try {
    await tentaCarregar("https://sdk.mercadopago.com/js/v2");
  } catch (e) {
    if ((e as Error).message.includes("Tempo esgotado")) throw e;
    try {
      await tentaCarregar(`https://sdk.mercadopago.com/js/v2?cache=${Date.now()}`);
    } catch (e2) {
      throw new Error(`${(e as Error).message} ${(e2 as Error).message}`);
    }
  }
  return new w.MercadoPago(publicKey, { locale: "pt-BR" });
}

function CartaoForm({
  total,
  onVoltar,
  onPagar,
}: {
  total: number;
  onVoltar: () => void;
  onPagar: (cardToken: string) => void;
}) {
  const [numero, setNumero] = useState("");
  const [nome, setNome] = useState("");
  const [validade, setValidade] = useState("");
  const [cvv, setCvv] = useState("");
  const [erroF, setErroF] = useState<string | null>(null);
  const [tokenizando, setTokenizando] = useState(false);

  const limpo = numero.replace(/\D/g, "");
  const [mes, ano] = validade.split("/");
  const valido =
    limpo.length >= 13 &&
    limpo.length <= 19 &&
    /^[A-Za-zÀ-ÿ\s]+$/.test(nome.trim()) &&
    /^\d{2}\/\d{2}$/.test(validade) &&
    /^\d{3,4}$/.test(cvv);

  const enviar = async () => {
    if (!valido) {
      setErroF("Confira os dados do cartão.");
      return;
    }
    setTokenizando(true);
    setErroF(null);
    try {
      const cfg = await fetch("/api/mp-public-key").then((r) => r.json()).catch(() => ({ public_key: null }));
      const publicKey = cfg?.public_key || null;
      if (!publicKey) throw new Error("Pagamento por cartão indisponível (configure a chave do Mercado Pago no admin).");

      const mp = await carregarMP(publicKey);
      const tokenResp: any = await mp.createCardToken({
        cardNumber: limpo,
        cardholderName: nome.trim(),
        cardExpirationMonth: mes,
        cardExpirationYear: `20${ano}`,
        securityCode: cvv,
      });
      const cardToken = tokenResp?.id;
      if (!cardToken) throw new Error("Não foi possível gerar o token do cartão.");

      onPagar(String(cardToken));
    } catch (e: any) {
      setErroF(e?.message || "Falha ao tokenizar o cartão.");
      setTokenizando(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-luxury-black text-center">Cartão de Crédito</p>
      <div className="bg-luxury-black rounded-2xl p-4 text-white flex justify-between items-center">
        <span className="text-xs text-white/70">Total a pagar</span>
        <span className="text-xl font-bold text-gold">{total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
      </div>
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
        disabled={tokenizando}
        className="w-full h-14 bg-luxury-black text-white font-bold rounded-2xl active:scale-[0.98] transition-all disabled:opacity-60"
      >
        {tokenizando ? "Processando..." : `Pagar ${total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`}
      </button>
      <button
        onClick={onVoltar}
        disabled={tokenizando}
        className="w-full h-10 text-xs font-bold text-gray-400"
      >
        Voltar
      </button>
    </div>
  );
}
