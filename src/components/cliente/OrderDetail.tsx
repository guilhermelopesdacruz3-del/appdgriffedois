import { formatPrice } from "../../utils";
import type { LIPedido, LISituacaoPedido } from "../../services/lojaIntegrada";

function toNumber(v: string | number | null | undefined): number {
  if (v === null || v === undefined || v === "") return 0;
  return typeof v === "number" ? v : parseFloat(v);
}

const STATUS_LABEL: Record<string, string> = {
  novo: "Recebido",
  aguardando_pagamento: "Aguardando pagamento",
  aprovado: "Aprovado",
  em_separacao: "Em separação",
  em_producao: "Em produção (laboratório)",
  enviado: "Enviado",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

function statusLabel(s: LISituacaoPedido | undefined): string {
  if (!s) return "Em andamento";
  return STATUS_LABEL[s.codigo] || s.nome || "Em andamento";
}

function fmtDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

// Link de rastreio genérico (Correios/rastreador nacional).
function rastreioUrl(codigo: string): string {
  return `https://www.linkcorreios.com.br/?codigo=${encodeURIComponent(codigo)}`;
}

export default function OrderDetail({ pedido, onClose }: { pedido: LIPedido; onClose: () => void }) {
  const itens = pedido.itens || [];
  const pagamento = pedido.pagamentos?.[0];
  const envio = pedido.envios?.[0];
  const total = toNumber(pedido.valor_total);

  const Voltar = (
    <button
      onClick={onClose}
      className="flex items-center gap-1 text-xs font-bold text-luxury-black mb-3"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      Voltar
    </button>
  );

  const Bloco = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <p className="text-[11px] font-semibold text-luxury-black mb-2">{titulo}</p>
      {children}
    </div>
  );

  const Linha = ({ k, v }: { k: string; v?: React.ReactNode }) => (
    <div className="flex justify-between py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-400">{k}</span>
      <span className="text-xs font-semibold text-luxury-black text-right max-w-[60%] truncate">{v ?? "—"}</span>
    </div>
  );

  return (
    <div className="px-5 pt-6 pb-4">
      {Voltar}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold text-luxury-black">Pedido {pedido.numero || pedido.id}</h3>
          <p className="text-[10px] text-gray-400">{fmtDate(pedido.data_criacao)}</p>
        </div>
        <span className="px-2.5 py-1 bg-green-50 text-green-600 text-[10px] font-bold rounded-full">
          {statusLabel(pedido.situacao)}
        </span>
      </div>

      <div className="space-y-3">
        <Bloco titulo={`Itens (${itens.reduce((s, i) => s + (i.quantidade || 0), 0)})`}>
          {itens.length === 0 && <p className="text-xs text-gray-400">Sem itens.</p>}
          {itens.map((i) => (
            <div key={i.id} className="flex items-center justify-between gap-2 py-2 border-b border-gray-50 last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-luxury-black truncate">{i.nome}</p>
                <p className="text-[10px] text-gray-400">
                  {i.quantidade}x · {formatPrice(toNumber(i.preco_venda))}
                </p>
              </div>
              <span className="text-[11px] font-bold text-luxury-black flex-shrink-0">
                {formatPrice(toNumber(i.preco_venda) * (i.quantidade || 0))}
              </span>
            </div>
          ))}
        </Bloco>

        {pagamento && (
          <Bloco titulo="Pagamento">
            <Linha k="Forma" v={pagamento.forma_pagamento?.nome} />
            <Linha k="Valor" v={formatPrice(toNumber(pagamento.valor))} />
          </Bloco>
        )}

        {envio && (
          <Bloco titulo="Envio">
            <Linha k="Forma" v={envio.forma_envio?.nome} />
            <Linha k="Prazo" v={`${envio.prazo} dia(s)`} />
            {envio.objeto ? (
              <Linha
                k="Rastreio"
                v={
                  <a
                    href={rastreioUrl(envio.objeto)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-gold underline"
                  >
                    {envio.objeto}
                  </a>
                }
              />
            ) : (
              <Linha k="Rastreio" v="Aguardando código" />
            )}
          </Bloco>
        )}

        <Bloco titulo="Resumo">
          <Linha k="Subtotal" v={formatPrice(toNumber(pedido.valor_subtotal))} />
          {toNumber(pedido.valor_desconto) > 0 && (
            <Linha k="Desconto" v={formatPrice(toNumber(pedido.valor_desconto))} />
          )}
          {toNumber(pedido.valor_envio) > 0 && (
            <Linha k="Envio" v={formatPrice(toNumber(pedido.valor_envio))} />
          )}
          <Linha k="Total" v={<span className="text-gold">{formatPrice(total)}</span>} />
        </Bloco>
      </div>
    </div>
  );
}
