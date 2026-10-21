import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearCart, getCart } from '../services/cart';
import type { CartItem } from '../services/cart';
import { getCliente, getClienteEmail, getClienteToken, isClienteLogado } from '../services/cliente';
import { API_BASE } from '../config';
import { formatPrice } from '../utils/format';
import { Lock, CreditCard, QrCode, Copy, Check, ArrowLeft } from 'lucide-react';

type Meio = 'pix' | 'cartao';
type Etapa = 'dados' | 'pix' | 'cartao' | 'pendente' | 'sucesso' | 'erro';

interface PagamentoResp {
  id: string;
  status?: string;
  status_detail?: string;
  valor_total?: number;
  valor_original?: number;
  desconto_aplicado?: number;
  pix_qr_base64?: string;
  pix_copia_cola?: string;
  demo?: boolean;
}

interface Endereco {
  cep: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
}

const ENDERECO_VAZIO: Endereco = {
  cep: '',
  endereco: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: '',
};

function statusNaoAprovado(r: PagamentoResp): string {
  const detalhe = r.status_detail ? ` (${r.status_detail})` : '';
  return `O pagamento não foi aprovado${detalhe}. Tente novamente com outro cartão ou use o PIX.`;
}

// Carrega o SDK v2 do Mercado Pago uma única vez. O número do cartão é
// tokenizado no navegador; o servidor recebe somente o `card_token`.
async function carregarMP(publicKey: string): Promise<any> {
  const w = window as any;
  if (w.MercadoPago) return new w.MercadoPago(publicKey, { locale: 'pt-BR' });
  const tentaCarregar = (src: string): Promise<void> =>
    new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      const timer = setTimeout(
        () => reject(new Error('Tempo esgotado ao carregar o SDK do Mercado Pago (verifique sua conexão).')),
        20000
      );
      s.onload = () => {
        clearTimeout(timer);
        if (w.MercadoPago) resolve();
        else reject(new Error('SDK do Mercado Pago não carregou.'));
      };
      s.onerror = () => {
        clearTimeout(timer);
        reject(
          new Error(
            'Falha ao carregar o SDK do Mercado Pago. Desative bloqueador de anúncios/extensões para este site e tente de novo.'
          )
        );
      };
      document.body.appendChild(s);
    });
  try {
    await tentaCarregar('https://sdk.mercadopago.com/js/v2');
  } catch (e) {
    if ((e as Error).message.includes('Tempo esgotado')) throw e;
    await tentaCarregar(`https://sdk.mercadopago.com/js/v2?cache=${Date.now()}`);
  }
  return new w.MercadoPago(publicKey, { locale: 'pt-BR' });
}

function CartaoForm({
  total,
  onVoltar,
  onPagar,
}: {
  total: number;
  onVoltar: () => void;
  onPagar: (cardToken: string, parcelas: number) => Promise<void> | void;
}) {
  const [numero, setNumero] = useState('');
  const [nome, setNome] = useState('');
  const [validade, setValidade] = useState('');
  const [cvv, setCvv] = useState('');
  const [parcelas, setParcelas] = useState(1);
  const [erro, setErro] = useState<string | null>(null);
  const [tokenizando, setTokenizando] = useState(false);

  const limpo = numero.replace(/\D/g, '');
  const [mes, ano] = validade.split('/');
  const valido =
    limpo.length >= 13 &&
    limpo.length <= 19 &&
    /^[A-Za-zÀ-ÿ\s]+$/.test(nome.trim()) &&
    /^\d{2}\/\d{2}$/.test(validade) &&
    /^\d{3,4}$/.test(cvv);

  const enviar = async () => {
    if (!valido) {
      setErro('Confira os dados do cartão.');
      return;
    }
    setTokenizando(true);
    setErro(null);
    try {
      const cfg = await fetch(`${API_BASE}/api/mp-public-key`).then((r) => r.json()).catch(() => ({}));
      const publicKey = (cfg as any)?.public_key || null;
      if (!publicKey) {
        throw new Error('Pagamento por cartão indisponível: a chave pública do Mercado Pago não está configurada.');
      }
      const mp = await carregarMP(publicKey);
      const tokenResp: any = await mp.createCardToken({
        cardNumber: limpo,
        cardholderName: nome.trim(),
        cardExpirationMonth: mes,
        cardExpirationYear: `20${ano}`,
        securityCode: cvv,
      });
      const cardToken = tokenResp?.id;
      if (!cardToken) throw new Error('Não foi possível gerar o token do cartão.');
      await onPagar(String(cardToken), parcelas);
    } catch (e: any) {
      setErro(e?.message || 'Falha ao validar o cartão.');
      setTokenizando(false);
    }
  };

  return (
    <div className="space-y-4">
      <button type="button" onClick={onVoltar} className="text-xs text-neutral-500 flex items-center gap-1">
        <ArrowLeft size={14} /> Voltar
      </button>
      <div className="bg-neutral-900 rounded-2xl p-4 text-white flex justify-between items-center">
        <span className="text-xs text-white/70">Total a pagar</span>
        <span className="text-xl font-bold">{formatPrice(total)}</span>
      </div>
      <div>
        <label className="text-xs font-semibold text-neutral-700">Número do cartão</label>
        <input
          inputMode="numeric"
          autoComplete="cc-number"
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          placeholder="0000 0000 0000 0000"
          maxLength={23}
          className="mt-1 w-full h-11 px-3 border border-neutral-300 rounded-lg text-sm"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-neutral-700">Nome impresso no cartão</label>
        <input
          autoComplete="cc-name"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Como está no cartão"
          className="mt-1 w-full h-11 px-3 border border-neutral-300 rounded-lg text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-neutral-700">Validade</label>
          <input
            inputMode="numeric"
            autoComplete="cc-exp"
            value={validade}
            onChange={(e) => {
              const d = e.target.value.replace(/\D/g, '').slice(0, 4);
              setValidade(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d);
            }}
            placeholder="MM/AA"
            maxLength={5}
            className="mt-1 w-full h-11 px-3 border border-neutral-300 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-neutral-700">CVV</label>
          <input
            inputMode="numeric"
            autoComplete="cc-csc"
            value={cvv}
            onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="123"
            maxLength={4}
            className="mt-1 w-full h-11 px-3 border border-neutral-300 rounded-lg text-sm"
          />
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold text-neutral-700">Parcelas</label>
        <select
          value={parcelas}
          onChange={(e) => setParcelas(Number(e.target.value))}
          className="mt-1 w-full h-11 px-3 border border-neutral-300 rounded-lg text-sm bg-white"
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n}x de {formatPrice(total / n)}
            </option>
          ))}
        </select>
        <p className="text-[10px] text-neutral-400 mt-1">
          Parcelamento sujeito às condições do Mercado Pago. O valor final é confirmado no servidor.
        </p>
      </div>
      {erro && <p className="text-xs text-red-500 text-center">{erro}</p>}
      <button
        type="button"
        onClick={enviar}
        disabled={tokenizando}
        className="w-full h-12 bg-neutral-900 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {tokenizando ? (
          <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <>
            <Lock size={16} /> Pagar {formatPrice(total)}
          </>
        )}
      </button>
    </div>
  );
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [etapa, setEtapa] = useState<Etapa>('dados');
  const [meio, setMeio] = useState<Meio>('pix');
  const [email, setEmail] = useState('');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cpf, setCpf] = useState('');
  const [formaEntrega, setFormaEntrega] = useState<'retirada' | 'entrega'>('retirada');
  const [endereco, setEndereco] = useState<Endereco>(ENDERECO_VAZIO);
  const [observacoes, setObservacoes] = useState('');
  const [pagamento, setPagamento] = useState<PagamentoResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const idemRef = useRef<{ key: string; assinatura: string; meio: Meio } | null>(null);

  useEffect(() => {
    if (!isClienteLogado()) {
      navigate('/login');
      return;
    }
    const c = getCart();
    if (c.length === 0) {
      navigate('/cart');
      return;
    }
    setCart(c);
    setEmail(getClienteEmail() || '');
    getCliente()
      .then((r) => {
        setEmail((prev) => prev || r.cliente.email || '');
        setNome((prev) => prev || r.cliente.nome || '');
        setTelefone((prev) => prev || r.cliente.telefone || '');
        setCpf((prev) => prev || r.cliente.cpf || '');
      })
      .catch(() => {
        /* perfil é opcional para pré-preencher */
      });
  }, [navigate]);

  const total = cart.reduce((acc, item) => acc + item.price * item.quantidade, 0);

  const assinaturaDe = (meioAtual: Meio) =>
    JSON.stringify({
      itens: cart.map((i) => `${i.productId}:${i.quantidade}:${i.variacao || ''}`),
      total: Number(total.toFixed(2)),
      meio: meioAtual,
    });

  const obterIdempotencyKey = (meioAtual: Meio) => {
    const assinatura = assinaturaDe(meioAtual);
    if (idemRef.current && idemRef.current.assinatura === assinatura && idemRef.current.meio === meioAtual) {
      return idemRef.current.key;
    }
    const key =
      (globalThis.crypto as any)?.randomUUID?.() ||
      `site-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    idemRef.current = { key, assinatura, meio: meioAtual };
    return key;
  };

  const validarDados = (): boolean => {
    const e = email.trim();
    if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      setError('Informe um e-mail válido para receber a confirmação.');
      return false;
    }
    if (nome.trim().length < 2) {
      setError('Informe seu nome completo.');
      return false;
    }
    if (cpf && cpf.replace(/\D/g, '').length !== 11) {
      setError('CPF inválido.');
      return false;
    }
    if (formaEntrega === 'entrega') {
      const faltando = [
        endereco.cep,
        endereco.endereco,
        endereco.numero,
        endereco.bairro,
        endereco.cidade,
        endereco.estado,
      ].some((v) => !v.trim());
      if (faltando) {
        setError('Preencha o endereço de entrega.');
        return false;
      }
    }
    setError(null);
    return true;
  };

  const montarPayload = (meioAtual: Meio, extra: Record<string, unknown> = {}) => ({
    items: cart.map((item) => ({
      price: item.price,
      qty: item.quantidade,
      sku: String(item.productId),
      nome: item.productName,
      variacao: item.variacao,
    })),
    cliente: {
      email: email.trim(),
      nome: nome.trim(),
      telefone: telefone.trim() || undefined,
      cpf: cpf.replace(/\D/g, '') || undefined,
      forma_entrega: formaEntrega,
      endereco:
        formaEntrega === 'entrega'
          ? {
              cep: endereco.cep.trim(),
              endereco: endereco.endereco.trim(),
              numero: endereco.numero.trim(),
              complemento: endereco.complemento.trim() || undefined,
              bairro: endereco.bairro.trim(),
              cidade: endereco.cidade.trim(),
              estado: endereco.estado.trim(),
            }
          : undefined,
      observacoes: observacoes.trim() || undefined,
    },
    meio: meioAtual,
    email: email.trim(),
    idempotencyKey: obterIdempotencyKey(meioAtual),
    origem: 'site' as const,
    ...extra,
  });

  const chamarCheckout = async (meioAtual: Meio, extra: Record<string, unknown> = {}): Promise<PagamentoResp> => {
    const token = getClienteToken();
    const res = await fetch(`${API_BASE}/api/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(montarPayload(meioAtual, extra)),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.erro || `Falha ao iniciar o pagamento (${res.status}).`);
    return json as PagamentoResp;
  };

  const finalizar = useCallback(() => {
    clearCart();
    setEtapa('sucesso');
  }, []);

  const pagarPix = async () => {
    if (!validarDados()) return;
    setLoading(true);
    setError(null);
    try {
      const r = await chamarCheckout('pix');
      setPagamento(r);
      setEtapa('pix');
    } catch (e: any) {
      setError(e?.message || 'Não foi possível gerar o PIX.');
      setEtapa('erro');
    } finally {
      setLoading(false);
    }
  };

  const pagarCartao = async (cardToken: string, parcelas: number) => {
    setLoading(true);
    setError(null);
    try {
      const r = await chamarCheckout('cartao', { card_token: cardToken, parcelas });
      setPagamento(r);
      const st = String(r.status || '').toLowerCase();
      if (st === 'approved' || st === 'aprovado') {
        finalizar();
      } else if (['rejected', 'cancelled', 'refunded', 'charged_back'].includes(st)) {
        // Cartão recusado: uma nova tentativa precisa de uma nova chave de
        // idempotência (senão o MP devolve a mesma recusa).
        idemRef.current = null;
        setError(statusNaoAprovado(r));
        setEtapa('erro');
      } else {
        setEtapa('pendente');
      }
    } catch (e: any) {
      setError(e?.message || 'Não foi possível processar o cartão.');
      setEtapa('erro');
    } finally {
      setLoading(false);
    }
  };

  // Consulta o status do pagamento (PIX ou cartão em análise). O endpoint exige
  // o token do cliente e confere se o pedido pertence à conta.
  useEffect(() => {
    if ((etapa !== 'pix' && etapa !== 'pendente') || !pagamento?.id || pagamento.demo) return;
    let ativo = true;
    const consultar = async () => {
      try {
        const token = getClienteToken();
        const res = await fetch(`${API_BASE}/api/checkout/status/${encodeURIComponent(pagamento.id)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) return;
        const j: any = await res.json().catch(() => ({}));
        if (!ativo) return;
        const st = String(j.status || '').toLowerCase();
        if (st === 'approved') {
          finalizar();
        } else if (['rejected', 'cancelled', 'refunded', 'charged_back'].includes(st)) {
          setError('O pagamento não foi aprovado. Tente novamente com outro meio.');
          setEtapa('erro');
        }
      } catch {
        /* falha de rede: tenta no próximo ciclo */
      }
    };
    consultar();
    const timer = setInterval(consultar, 5000);
    return () => {
      ativo = false;
      clearInterval(timer);
    };
  }, [etapa, pagamento?.id, pagamento?.demo, finalizar]);

  if (etapa === 'sucesso') {
    return (
      <div className="container-site py-12">
        <div className="max-w-md mx-auto text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="section-title mb-2">Pagamento confirmado!</h1>
          <p className="text-neutral-500 mb-1">
            Seu pedido foi registrado e você receberá a confirmação por e-mail.
          </p>
          {pagamento?.id && <p className="text-xs text-neutral-400 mb-4">Pedido: {pagamento.id}</p>}
          {typeof pagamento?.valor_total === 'number' && (
            <p className="text-sm font-semibold text-neutral-900 mb-4">Total pago: {formatPrice(pagamento.valor_total)}</p>
          )}
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
        <div>
          {etapa === 'erro' && (
            <div className="bg-white rounded-2xl p-6 shadow-card space-y-4">
              <p className="text-sm text-red-600 text-center">{error}</p>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setEtapa('dados');
                }}
                className="w-full h-12 bg-neutral-900 text-white text-sm font-semibold"
              >
                Tentar novamente
              </button>
            </div>
          )}

          {etapa === 'pix' && pagamento && (
            <div className="bg-white rounded-2xl p-6 shadow-card space-y-4 text-center">
              <h2 className="font-display font-semibold text-lg text-neutral-900">Pague com PIX</h2>
              {pagamento.demo ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                  Modo demonstração: nenhuma cobrança real foi gerada.
                  <button
                    type="button"
                    onClick={finalizar}
                    className="mt-2 w-full h-10 bg-amber-600 text-white text-xs font-bold rounded-lg"
                  >
                    Simular pagamento aprovado
                  </button>
                </div>
              ) : (
                <>
                  {pagamento.pix_qr_base64 ? (
                    <img
                      src={`data:image/png;base64,${pagamento.pix_qr_base64}`}
                      alt="QR Code PIX"
                      className="w-52 h-52 mx-auto border border-neutral-200 rounded-xl"
                    />
                  ) : null}
                  {pagamento.pix_copia_cola ? (
                    <div className="space-y-2">
                      <textarea
                        readOnly
                        value={pagamento.pix_copia_cola}
                        className="w-full h-20 p-2 text-[10px] border border-neutral-300 rounded-lg resize-none"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(pagamento.pix_copia_cola || '');
                            setCopiado(true);
                            setTimeout(() => setCopiado(false), 2000);
                          } catch {
                            /* clipboard bloqueado */
                          }
                        }}
                        className="w-full h-10 bg-neutral-100 text-neutral-800 text-xs font-semibold rounded-lg flex items-center justify-center gap-2"
                      >
                        {copiado ? <Check size={14} /> : <Copy size={14} />}
                        {copiado ? 'Código copiado' : 'Copiar código PIX'}
                      </button>
                    </div>
                  ) : null}
                  <p className="text-xs text-neutral-500">
                    Aguardando a confirmação do pagamento. Esta página atualiza automaticamente.
                  </p>
                  <p className="text-sm font-semibold text-neutral-900">Total: {formatPrice(pagamento.valor_total || total)}</p>
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  setEtapa('dados');
                  setPagamento(null);
                }}
                className="text-xs text-neutral-500 underline"
              >
                Voltar e escolher outro meio
              </button>
            </div>
          )}

          {etapa === 'pendente' && (
            <div className="bg-white rounded-2xl p-6 shadow-card space-y-4 text-center">
              <span className="w-10 h-10 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin inline-block" />
              <h2 className="font-display font-semibold text-lg text-neutral-900">Pagamento em análise</h2>
              <p className="text-xs text-neutral-500">
                O Mercado Pago está analisando o pagamento. Não feche esta página; a confirmação aparece automaticamente.
              </p>
              {pagamento?.id && <p className="text-[10px] text-neutral-400">Pedido: {pagamento.id}</p>}
            </div>
          )}

          {etapa === 'cartao' && (
            <div className="bg-white rounded-2xl p-6 shadow-card">
              <CartaoForm
                total={total}
                onVoltar={() => setEtapa('dados')}
                onPagar={pagarCartao}
              />
            </div>
          )}

          {etapa === 'dados' && (
            <div className="bg-white rounded-2xl p-6 shadow-card space-y-4">
              <h2 className="font-display font-semibold text-lg text-neutral-900">Seus dados</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-neutral-700">E-mail</label>
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 w-full h-11 px-3 border border-neutral-300 rounded-lg text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-neutral-700">Nome completo</label>
                  <input
                    autoComplete="name"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="mt-1 w-full h-11 px-3 border border-neutral-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-neutral-700">Telefone (opcional)</label>
                  <input
                    inputMode="tel"
                    autoComplete="tel"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    className="mt-1 w-full h-11 px-3 border border-neutral-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-neutral-700">CPF (opcional)</label>
                  <input
                    inputMode="numeric"
                    value={cpf}
                    onChange={(e) => setCpf(e.target.value.replace(/\D/g, '').slice(0, 11))}
                    className="mt-1 w-full h-11 px-3 border border-neutral-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormaEntrega('retirada')}
                  className={`flex-1 h-11 rounded-lg border-2 text-xs font-semibold ${
                    formaEntrega === 'retirada' ? 'border-neutral-900 bg-neutral-900/5' : 'border-neutral-300 text-neutral-600'
                  }`}
                >
                  Retirar na loja
                </button>
                <button
                  type="button"
                  onClick={() => setFormaEntrega('entrega')}
                  className={`flex-1 h-11 rounded-lg border-2 text-xs font-semibold ${
                    formaEntrega === 'entrega' ? 'border-neutral-900 bg-neutral-900/5' : 'border-neutral-300 text-neutral-600'
                  }`}
                >
                  Receber em casa
                </button>
              </div>

              {formaEntrega === 'entrega' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-neutral-700">CEP</label>
                    <input
                      inputMode="numeric"
                      autoComplete="postal-code"
                      value={endereco.cep}
                      onChange={(e) => setEndereco((p) => ({ ...p, cep: e.target.value }))}
                      className="mt-1 w-full h-11 px-3 border border-neutral-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-neutral-700">Estado</label>
                    <input
                      value={endereco.estado}
                      onChange={(e) => setEndereco((p) => ({ ...p, estado: e.target.value.toUpperCase().slice(0, 2) }))}
                      className="mt-1 w-full h-11 px-3 border border-neutral-300 rounded-lg text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-neutral-700">Endereço</label>
                    <input
                      autoComplete="street-address"
                      value={endereco.endereco}
                      onChange={(e) => setEndereco((p) => ({ ...p, endereco: e.target.value }))}
                      className="mt-1 w-full h-11 px-3 border border-neutral-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-neutral-700">Número</label>
                    <input
                      value={endereco.numero}
                      onChange={(e) => setEndereco((p) => ({ ...p, numero: e.target.value }))}
                      className="mt-1 w-full h-11 px-3 border border-neutral-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-neutral-700">Complemento</label>
                    <input
                      value={endereco.complemento}
                      onChange={(e) => setEndereco((p) => ({ ...p, complemento: e.target.value }))}
                      className="mt-1 w-full h-11 px-3 border border-neutral-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-neutral-700">Bairro</label>
                    <input
                      value={endereco.bairro}
                      onChange={(e) => setEndereco((p) => ({ ...p, bairro: e.target.value }))}
                      className="mt-1 w-full h-11 px-3 border border-neutral-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-neutral-700">Cidade</label>
                    <input
                      value={endereco.cidade}
                      onChange={(e) => setEndereco((p) => ({ ...p, cidade: e.target.value }))}
                      className="mt-1 w-full h-11 px-3 border border-neutral-300 rounded-lg text-sm"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-neutral-700">Observações (opcional)</label>
                <textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  className="mt-1 w-full h-20 p-2 border border-neutral-300 rounded-lg text-sm resize-none"
                />
              </div>

              <div>
                <h2 className="font-display font-semibold text-lg text-neutral-900 mb-2">Pagamento</h2>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setMeio('pix')}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                      meio === 'pix'
                        ? 'border-neutral-900 bg-neutral-900/5 text-neutral-900'
                        : 'border-neutral-300 text-neutral-600 hover:border-gray-300'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center">
                      <QrCode size={20} />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-sm">PIX</p>
                      <p className="text-[10px] text-neutral-500">{formatPrice(total)}</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMeio('cartao')}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                      meio === 'cartao'
                        ? 'border-neutral-900 bg-neutral-900/5 text-neutral-900'
                        : 'border-neutral-300 text-neutral-600 hover:border-gray-300'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center">
                      <CreditCard size={20} />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-sm">Cartão</p>
                      <p className="text-[10px] text-neutral-500">Em até 5x</p>
                    </div>
                  </button>
                </div>
              </div>

              {error && <p className="text-xs text-red-500 text-center">{error}</p>}

              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  if (meio === 'pix') pagarPix();
                  else {
                    if (!validarDados()) return;
                    setEtapa('cartao');
                  }
                }}
                className="w-full h-12 bg-neutral-900 text-white disabled:opacity-50 flex items-center justify-center gap-2 text-sm font-semibold"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Lock size={16} />
                    {meio === 'pix' ? `Gerar PIX — ${formatPrice(total)}` : 'Continuar para o cartão'}
                  </>
                )}
              </button>
              <p className="text-[10px] text-neutral-400 text-center">
                <Lock size={10} className="inline mr-1" />
                Compra segura • O valor é confirmado no servidor antes da cobrança.
              </p>
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl p-6 shadow-card sticky top-24">
            <h2 className="font-display font-semibold text-lg text-neutral-900 mb-4">Resumo do Pedido</h2>
            <div className="space-y-3">
              {cart.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="text-neutral-600 truncate mr-2">
                    {item.quantidade}x {item.productName}
                    {item.variacao ? ` (${item.variacao})` : ''}
                  </span>
                  <span className="font-semibold">{formatPrice(item.price * item.quantidade)}</span>
                </div>
              ))}
              <div className="border-t border-neutral-300 pt-3 flex justify-between font-bold text-neutral-900 text-base">
                <span>Total</span>
                <span>{formatPrice(total)}</span>
              </div>
            </div>
            <p className="text-[10px] text-neutral-400 mt-3">
              O preço final e a disponibilidade são confirmados na Loja Integrada no momento da cobrança.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
