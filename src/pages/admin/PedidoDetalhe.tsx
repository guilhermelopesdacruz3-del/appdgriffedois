import { useState, useEffect } from "react";
import { formatPrice } from "../../utils";
import type { AdminPedido, SituacaoPedido } from "../../services/admin";

interface Props {
  pedido: AdminPedido | null;
  onClose: () => void;
  onStatusChange: (novoStatus: string) => void;
}

export default function PedidoDetalhe({ pedido, onClose, onStatusChange }: Props) {
  const [situacoes, setSituacoes] = useState<SituacaoPedido[]>([]);
  const [statusSelecionado, setStatusSelecionado] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!pedido) return;
    setStatusSelecionado(pedido.status_id ? String(pedido.status_id) : "");
  }, [pedido]);

  useEffect(() => {
    if (!pedido) return;
    let ativo = true;
    setCarregando(true);
    fetch("/api/admin/situacoes", {
      headers: { Accept: "application/json" },
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: SituacaoPedido[]) => {
        if (ativo) setSituacoes(data);
      })
      .catch(() => {
        /* silencioso */
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [pedido]);

  const salvarStatus = async () => {
    if (!pedido || !statusSelecionado) return;
    setSalvando(true);
    setErro(null);
    try {
      await onStatusChange(statusSelecionado);
      onClose();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  if (!pedido) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between rounded-t-3xl z-10">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Pedido #{pedido.numero}</h2>
            <p className="text-xs text-slate-400">{pedido.data}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Status atual */}
        <div className="px-6 pt-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Status atual:</span>
            <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold border ${
              pedido.status === "Entregue" ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
              pedido.status === "Pedido Pago" ? "bg-green-50 text-green-600 border-green-200" :
              pedido.status === "Em produção" ? "bg-violet-50 text-violet-600 border-violet-200" :
              pedido.status === "Pedido Cancelado" ? "bg-red-50 text-red-600 border-red-200" :
              "bg-slate-50 text-slate-500 border-slate-200"
            }`}>{pedido.status}</span>
          </div>
        </div>

        {/* Cliente */}
        <div className="px-6 pt-4">
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-2">
            <p className="text-xs font-bold text-slate-800 flex items-center gap-2">
              <span className="w-1 h-3.5 rounded-full bg-violet-600 inline-block" />Cliente
            </p>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-slate-400">Nome</span>
                <p className="font-semibold text-slate-700">{pedido.cliente_nome || "—"}</p>
              </div>
              <div>
                <span className="text-slate-400">E-mail</span>
                <p className="font-semibold text-slate-700">{pedido.cliente_email || "—"}</p>
              </div>
              <div>
                <span className="text-slate-400">Telefone</span>
                <p className="font-semibold text-slate-700">{pedido.cliente_telefone || "—"}</p>
              </div>
              <div>
                <span className="text-slate-400">CPF</span>
                <p className="font-semibold text-slate-700">{pedido.cliente_cpf || "—"}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Endereço de entrega */}
        <div className="px-6 pt-3">
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-2">
            <p className="text-xs font-bold text-slate-800 flex items-center gap-2">
              <span className="w-1 h-3.5 rounded-full bg-violet-600 inline-block" />Entrega
            </p>
            <div className="text-[11px]">
              <span className="text-slate-400">Forma: </span>
              <span className="font-semibold text-slate-700">{pedido.forma_entrega === "entrega" ? "Entrega" : "Retirada na loja"}</span>
            </div>
            {pedido.endereco_entrega ? (
              <div className="text-[11px]">
                <span className="text-slate-400">Endereço: </span>
                <span className="font-semibold text-slate-700">{pedido.endereco_entrega}</span>
              </div>
            ) : pedido.forma_entrega === "retirada" ? (
              <div className="text-[11px]">
                <span className="text-slate-400">Retirada: </span>
                <span className="font-semibold text-slate-700">Loja D'Griffe — Av. Paraguassu, 1629</span>
              </div>
            ) : (
              <div className="text-[11px] text-slate-400">Endereço não informado</div>
            )}
            {pedido.envio_rastreio && (
              <div className="text-[11px]">
                <span className="text-slate-400">Rastreio: </span>
                <span className="font-semibold text-violet-600">{pedido.envio_rastreio}</span>
              </div>
            )}
          </div>
        </div>

        {/* Itens do pedido */}
        <div className="px-6 pt-3">
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-2">
            <p className="text-xs font-bold text-slate-800 flex items-center gap-2">
              <span className="w-1 h-3.5 rounded-full bg-violet-600 inline-block" />Itens ({pedido.itens?.length || 0})
            </p>
            <div className="space-y-1.5">
              {(pedido.itens || []).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-[11px] bg-white border border-slate-100 rounded-xl px-3 py-2">
                  <div>
                    <p className="font-semibold text-slate-700">{item.nome}</p>
                    {item.variacao && <p className="text-[9px] text-slate-400">{item.variacao}</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-800">{item.quantidade}x {formatPrice(item.preco_venda)}</p>
                    <p className="text-[9px] text-slate-400">SKU: {item.sku}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <span className="text-[11px] font-bold text-slate-600">Total</span>
              <span className="text-sm font-bold text-slate-800">{formatPrice(pedido.total)}</span>
            </div>
          </div>
        </div>

        {/* Pagamento */}
        <div className="px-6 pt-3">
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-2">
            <p className="text-xs font-bold text-slate-800 flex items-center gap-2">
              <span className="w-1 h-3.5 rounded-full bg-violet-600 inline-block" />Pagamento
            </p>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-slate-400">Forma</span>
                <p className="font-semibold text-slate-700">{pedido.pagamento || "—"}</p>
              </div>
              <div>
                <span className="text-slate-400">Status</span>
                <p className="font-semibold text-slate-700">{pedido.pagamento_status || "—"}</p>
              </div>
            </div>
            {pedido.pagamento_detalhes && (
              <div className="text-[11px]">
                <span className="text-slate-400">Detalhes: </span>
                <span className="font-semibold text-slate-700">{pedido.pagamento_detalhes}</span>
              </div>
            )}
          </div>
        </div>

        {/* Observações */}
        {pedido.observacoes && (
          <div className="px-6 pt-3">
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-2">
              <p className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <span className="w-1 h-3.5 rounded-full bg-violet-600 inline-block" />Observações
              </p>
              <p className="text-[11px] text-slate-600">{pedido.observacoes}</p>
            </div>
          </div>
        )}

        {/* Atualizar status */}
        <div className="px-6 pt-3 pb-6">
          <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-bold text-violet-800 flex items-center gap-2">
              <span className="w-1 h-3.5 rounded-full bg-violet-600 inline-block" />Atualizar status
            </p>
            <div className="flex gap-2">
              <select
                value={statusSelecionado}
                onChange={(e) => setStatusSelecionado(e.target.value)}
                className="flex-1 h-10 px-3 rounded-xl border border-violet-200 bg-white text-slate-800 text-xs focus:outline-none focus:border-violet-500"
                disabled={carregando || salvando}
              >
                <option value="">Selecionar status...</option>
                {situacoes.map((s) => (
                  <option key={s.id} value={String(s.id)}>{s.nome}</option>
                ))}
              </select>
              <button
                onClick={salvarStatus}
                disabled={salvando || !statusSelecionado || carregando}
                className="h-10 px-5 bg-gradient-to-r from-violet-600 to-purple-500 text-white text-[11px] font-bold rounded-xl active:scale-95 disabled:opacity-50 transition-all"
              >
                {salvando ? "Salvando..." : "Salvar"}
              </button>
            </div>
            {erro && <p className="text-[11px] text-red-500">{erro}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
