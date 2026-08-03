import { useEffect, useState } from "react";
import { relatorioAdmin, listarPedidosAdmin, listarSituacoes, listarLogsAdmin } from "../services/admin";
import { listarCupons, enviarCupom, criarCupom, type Cupom } from "../services/cupomApp";
import { formatPrice } from "../utils";

export default function AdminDashboard(_props: { token: string }) {
  const [relatorio, setRelatorio] = useState<any>(null);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [_situacoes, setSituacoes] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [cupons, setCupons] = useState<Cupom[]>([]);
  const [loading, setLoading] = useState(true);
  const [aba] = useState<"visao" | "cupons" | "logs">("visao");

  useEffect(() => {
    const carregar = async () => {
      setLoading(true);
      try {
        const [rel, ped, sit, log, cup] = await Promise.all([
          relatorioAdmin(),
          listarPedidosAdmin({ limit: 50 }),
          listarSituacoes(),
          listarLogsAdmin({ limit: 50 }),
          listarCupons(),
        ]);
        setRelatorio(rel);
        setPedidos(ped.pedidos || []);
        setSituacoes(sit || []);
        setLogs(log.logs || []);
        setCupons(cup || []);
      } catch (e) {
        console.error("dashboard:", e);
      } finally {
        setLoading(false);
      }
    };
    carregar();
  }, []);

  const enviarCupomSelecionado = async (id: string, user_id?: string) => {
    try {
      const user_ids = user_id ? [user_id] : undefined;
      await enviarCupom(id, user_ids ? { user_ids } : { grupo: "todos" });
      alert("Cupom enviado!");
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs font-bold text-gold mb-1 px-1 flex items-center gap-2"><span className="w-1 h-3.5 rounded-full bg-gold inline-block" />Visão Geral</p>

      {loading && (
        <div className="flex justify-center py-10">
          <div className="w-7 h-7 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && aba === "visao" && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gradient-to-b from-white/[0.09] to-white/[0.03] border border-white/10 rounded-2xl p-3.5 hover:border-gold/30 transition-colors">
              <p className="text-[10px] text-white/60">Pedidos</p>
              <p className="text-lg font-bold text-white mt-0.5">{relatorio ? relatorio.totalPedidos : "—"}</p>
            </div>
            <div className="bg-gradient-to-b from-white/[0.09] to-white/[0.03] border border-white/10 rounded-2xl p-3.5 hover:border-gold/30 transition-colors">
              <p className="text-[10px] text-white/60">Faturamento</p>
              <p className="text-lg font-bold text-white mt-0.5">{relatorio ? formatPrice(relatorio.faturamentoTotal) : "—"}</p>
            </div>
            <div className="bg-gradient-to-b from-white/[0.09] to-white/[0.03] border border-white/10 rounded-2xl p-3.5 hover:border-gold/30 transition-colors">
              <p className="text-[10px] text-white/60">Ticket Médio</p>
              <p className="text-lg font-bold text-gold mt-0.5">{relatorio ? formatPrice(relatorio.ticketMedio) : "—"}</p>
            </div>
            <div className="bg-gradient-to-b from-white/[0.09] to-white/[0.03] border border-white/10 rounded-2xl p-3.5 hover:border-gold/30 transition-colors">
              <p className="text-[10px] text-white/60">Aprovado</p>
              <p className="text-lg font-bold text-emerald-400 mt-0.5">{relatorio ? formatPrice(relatorio.faturamentoAprovado) : "—"}</p>
            </div>
          </div>

          <div className="bg-gradient-to-b from-white/[0.07] to-white/[0.02] border border-white/10 rounded-2xl p-4">
            <p className="text-xs font-bold text-white mb-2 flex items-center gap-2"><span className="w-1 h-3.5 rounded-full bg-gold inline-block" />Integrações</p>
            <p className="text-[11px] text-white/60 mb-2">Catálogo e checkout dependem das chaves da Loja Integrada e Mercado Pago. Configure na aba "APIs" (canto superior direito).</p>
          </div>

          {pedidos.length > 0 && (
            <div className="bg-gradient-to-b from-white/[0.07] to-white/[0.02] border border-white/10 rounded-2xl p-4">
              <p className="text-xs font-bold text-white mb-3 flex items-center gap-2"><span className="w-1 h-3.5 rounded-full bg-gold inline-block" />Pedidos Recentes ({pedidos.length})</p>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {pedidos.slice(0, 20).map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-[11px] rounded-xl px-2 py-2 hover:bg-white/[0.04] transition-colors">
                    <div className="min-w-0">
                      <p className="font-semibold text-white">#{p.numero}</p>
                      <p className="text-white/60 truncate">{p.cliente_nome} · {p.cliente_email}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-white">{formatPrice(Number(p.valor_total) || 0)}</p>
                      <p className="text-white/50">{new Date(p.data_criacao).toLocaleDateString("pt-BR")}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {!loading && aba === "cupons" && (
        <div className="space-y-3">
          <div className="bg-gradient-to-b from-white/[0.07] to-white/[0.02] border border-white/10 rounded-2xl p-4 shadow-sm space-y-3">
            <p className="text-xs font-bold text-white flex items-center gap-2"><span className="w-1 h-3.5 rounded-full bg-gold inline-block" />Criar cupom</p>
            <div className="grid grid-cols-2 gap-2">
              <input
                id="cupom-codigo"
                placeholder="Código"
                className="h-10 px-3 rounded-xl border border-white/15 bg-black/40 text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-all"
              />
              <select
                id="cupom-tipo"
                className="h-10 px-3 rounded-xl border border-white/15 bg-black/40 text-white text-xs focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-all"
                defaultValue="percentual"
              >
                <option value="percentual">%</option>
                <option value="fixo">R$ fixo</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                id="cupom-valor"
                type="number"
                placeholder="Valor"
                className="h-10 px-3 rounded-xl border border-white/15 bg-black/40 text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-all"
              />
              <input
                id="cupom-minimo"
                type="number"
                placeholder="Mínimo (R$)"
                className="h-10 px-3 rounded-xl border border-white/15 bg-black/40 text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-all"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                id="cupom-inicio"
                type="datetime-local"
                className="h-10 px-3 rounded-xl border border-white/15 bg-black/40 text-white text-xs focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-all"
              />
              <input
                id="cupom-fim"
                type="datetime-local"
                className="h-10 px-3 rounded-xl border border-white/15 bg-black/40 text-white text-xs focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-all"
              />
            </div>
            <button
              onClick={async () => {
                try {
                  await criarCupom({
                    codigo: (document.getElementById("cupom-codigo") as HTMLInputElement).value.trim().toUpperCase(),
                    tipo: (document.getElementById("cupom-tipo") as HTMLSelectElement).value as any,
                    valor: Number((document.getElementById("cupom-valor") as HTMLInputElement).value),
                    valor_minimo: (document.getElementById("cupom-minimo") as HTMLInputElement).value
                      ? Number((document.getElementById("cupom-minimo") as HTMLInputElement).value)
                      : undefined,
                    data_inicio: (document.getElementById("cupom-inicio") as HTMLInputElement).value,
                    data_fim: (document.getElementById("cupom-fim") as HTMLInputElement).value,
                  });
                  alert("Cupom criado!");
                  setCupons(await listarCupons());
                } catch (e: any) {
                  alert(e.message);
                }
              }}
              className="w-full h-12 bg-gradient-to-r from-gold to-gold-dark text-black text-xs font-bold rounded-2xl disabled:opacity-50 active:scale-[0.98] transition-all shadow-lg shadow-gold/20 hover:brightness-110"
            >
              Criar cupom
            </button>
          </div>

          <div className="space-y-2">
            {cupons.map((c) => (
              <div key={c.id} className="bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/10 rounded-2xl p-3 shadow-sm flex items-center justify-between gap-2 hover:border-gold/20 transition-colors">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white">{c.codigo}</p>
                  <p className="text-[10px] text-white/60">
                    {c.tipo === "percentual" ? `${c.valor}%` : `R$ ${Number(c.valor).toFixed(2)}`} · {c.usos}/{c.max_usos ?? "∞"} usos
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => enviarCupomSelecionado(c.id)} className="px-3 py-2 bg-gold/15 text-gold text-[10px] font-bold rounded-xl border border-gold/30 hover:bg-gold/25 transition-all">Todos</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && aba === "logs" && (
        <div className="space-y-2">
          {logs.slice(0, 50).map((l) => (
            <div key={l.id} className="bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/10 rounded-2xl p-3 shadow-sm flex items-center justify-between text-[11px] hover:border-gold/20 transition-colors">
              <div>
                <p className="font-semibold text-white flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-gold inline-block" />{l.acao}</p>
                <p className="text-white/60">{l.admin_email} · {new Date(l.created_at).toLocaleString("pt-BR")}</p>
              </div>
              <span className="text-[10px] text-white/50 bg-white/5 border border-white/10 rounded-lg px-2 py-1">{l.ip}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Aba de Configurações removida: o AdminPage já possui o ApiConfigPanel nativo
// (botão "APIs" no topo). Manter este componente apenas como Visão Geral.
