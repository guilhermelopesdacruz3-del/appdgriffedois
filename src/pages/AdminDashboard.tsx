import { useEffect, useState } from "react";
import { relatorioAdmin, listarPedidosAdmin, listarSituacoes, type SituacaoPedido } from "../services/admin";
import { listarCupons, type Cupom } from "../services/cupomApp";
import { BarChart, KpiCard } from "../components/admin/AdminCharts";
import { StatusBadge, ehHoje } from "../components/admin/statusBadge";
import { formatPrice } from "../utils";

interface Props {
  token: string;
  onAbrirPedido: (id: number | string) => void;
  onIrPedidos: (status?: string) => void;
  onIrCupons: () => void;
  onAbrirApis: () => void;
}

const INTEGRACOES = [
  {
    id: "LOJA_INTEGRADA_APP_KEY",
    nome: "Loja Integrada",
    desc: "Catálogo e pedidos",
    cor: "bg-sky-50 border-sky-200 text-sky-600",
    chip: "bg-sky-50 text-sky-600 border-sky-200",
    icone: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><path d="M9 22V12h6v10" /></svg>
    ),
  },
  {
    id: "MP_ACCESS_TOKEN",
    nome: "Mercado Pago",
    desc: "Pagamentos e checkout",
    cor: "bg-indigo-50 border-indigo-200 text-indigo-600",
    chip: "bg-indigo-50 text-indigo-600 border-indigo-200",
    icone: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
    ),
  },
  {
    id: "SUPABASE_SERVICE_ROLE",
    nome: "Supabase",
    desc: "Banco e autenticação",
    cor: "bg-emerald-50 border-emerald-200 text-emerald-600",
    chip: "bg-emerald-50 text-emerald-600 border-emerald-200",
    icone: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></svg>
    ),
  },
  {
    id: "YT_API_KEY",
    nome: "YouTube",
    desc: "Vídeos e conteúdo",
    cor: "bg-rose-50 border-rose-200 text-rose-600",
    chip: "bg-rose-50 text-rose-600 border-rose-200",
    icone: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22.54 6.42a2.78 2.78 0 00-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 00-1.94 2A29 29 0 001 11.75a29 29 0 00.46 5.33A2.78 2.78 0 003.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 001.94-2 29 29 0 00.46-5.25 29 29 0 00-.46-5.33z" /><path d="M9.75 15.02l5.75-3.27-5.75-3.27v6.54z" /></svg>
    ),
  },
];

export default function AdminDashboard({ token, onAbrirPedido, onIrPedidos, onIrCupons, onAbrirApis }: Props) {
  const [relatorio, setRelatorio] = useState<any>(null);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [situacoes, setSituacoes] = useState<SituacaoPedido[]>([]);
  const [cupons, setCupons] = useState<Cupom[]>([]);
  const [config, setConfig] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);
  const [heroVisivel, setHeroVisivel] = useState(true);

  useEffect(() => {
    const carregar = async () => {
      setLoading(true);
      try {
        const [rel, ped, sit, cup] = await Promise.all([
          relatorioAdmin(),
          listarPedidosAdmin({ limit: 50 }),
          listarSituacoes(),
          listarCupons(),
        ]);
        setRelatorio(rel);
        setPedidos(ped.pedidos || []);
        setSituacoes(sit || []);
        setCupons(cup || []);
        setUltimaAtualizacao(new Date());
      } catch (e) {
        console.error("dashboard:", e);
      } finally {
        setLoading(false);
      }
    };
    carregar();
  }, []);

  useEffect(() => {
    if (!token) return;
    fetch("/api/config", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json().catch(() => ({})))
      .then((j) => setConfig(j?.configuracoes ?? j ?? {}))
      .catch(() => {});
  }, [token]);

  const inicioHoje = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  })();
  const hoje = pedidos.filter((p) => new Date(p.data) >= inicioHoje);
  const faturamentoHoje = hoje.reduce((s, p) => s + (Number(p.total) || 0), 0);
  const recentes = [...pedidos].sort((a, b) => String(b.data).localeCompare(String(a.data))).slice(0, 8);
  const cuponsAtivos = (cupons || [])
    .filter((c) => !c.data_fim || new Date(c.data_fim) > new Date())
    .sort((a, b) => (b.usos ?? 0) - (a.usos ?? 0));
  const totaisPorStatus: Record<string, number> = relatorio?.porStatus || {};
  const statusComContagem = situacoes.filter((s) => (totaisPorStatus[s.nome] || 0) > 0);
  const serie = (relatorio?.serieDiaria || []).slice(-10);
  const faturamentoTotal = relatorio?.faturamentoAprovado || 0;
  const pedidosTotal = relatorio?.totalPedidos || 0;

  const serieAnterior = serie[serie.length - 2];
  const serieAtual = serie[serie.length - 1];
  const deltaFaturamento =
    serieAnterior && serieAtual && serieAnterior.total > 0
      ? Math.round(((serieAtual.total - serieAnterior.total) / serieAnterior.total) * 100)
      : null;
  const fmtDia = (dia: string) => (dia || "").slice(5).replace("-", "/");

  const metricas = [
    {
      label: "Faturamento hoje",
      value: formatPrice(faturamentoHoje),
      sub: `${hoje.length} pedido(s) hoje`,
      accent: "#7C3AED",
      trend: deltaFaturamento == null ? undefined : (deltaFaturamento >= 0 ? "up" : "down") as "up" | "down",
      delta: deltaFaturamento == null ? undefined : `${deltaFaturamento >= 0 ? "+" : ""}${deltaFaturamento}%`,
      spark: serie.map((d: any) => d.total),
    },
    {
      label: "Pedidos (total)",
      value: String(pedidosTotal),
      sub: "todos os tempos",
      spark: serie.map((d: any) => d.count),
    },
    {
      label: "Ticket médio",
      value: relatorio ? formatPrice(relatorio.ticketMedio) : "—",
      sub: "valor por pedido",
    },
    {
      label: "Aprovado",
      value: formatPrice(faturamentoTotal),
      sub: "valor aprovado",
      accent: "#059669",
    },
  ];

  const planoItens = [
    { nome: "Pedidos processados", usado: pedidosTotal, limite: 1000 },
    { nome: "Cupons ativos", usado: cuponsAtivos.length, limite: 20 },
    { nome: "Faturamento aprovado", usado: faturamentoTotal, limite: 50000 },
  ];

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {heroVisivel && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 to-purple-500 shadow-lg shadow-violet-500/25">
          <div className="absolute right-16 top-1/2 -translate-y-1/2 w-40 h-40 rounded-full bg-white/10 pointer-events-none" />
          <div className="absolute right-40 bottom-[-3rem] w-32 h-32 rounded-full bg-white/10 pointer-events-none" />
          <button
            onClick={() => setHeroVisivel(false)}
            className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors"
            aria-label="Fechar"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
          <div className="relative p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">Bem-vindo de volta</p>
              <h2 className="text-xl md:text-2xl font-bold text-white mt-1">Vamos cuidar da sua loja hoje? 👋</h2>
              <p className="text-xs text-white/80 mt-1 max-w-md">
                Acompanhe pedidos, faturamento e cupons em um só lugar. Tudo sincronizado em tempo real.
              </p>
              <div className="flex gap-2 mt-4">
                <button onClick={() => onIrPedidos()} className="h-9 px-4 rounded-xl bg-white text-violet-700 text-[11px] font-bold hover:bg-violet-50 active:scale-95 transition-all shadow-sm">
                  Ver pedidos
                </button>
                <button onClick={onIrCupons} className="h-9 px-4 rounded-xl bg-white/15 border border-white/30 text-white text-[11px] font-bold hover:bg-white/25 active:scale-95 transition-all">
                  Gerenciar cupons
                </button>
              </div>
            </div>
            <div className="hidden md:flex items-center justify-center w-28 h-28 rounded-full bg-white/10 border border-white/20 flex-shrink-0">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 5-6" />
              </svg>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {metricas.map((m) => (
          <KpiCard key={m.label} label={m.label} value={m.value} sub={m.sub} accent={m.accent} trend={m.trend} delta={m.delta} spark={m.spark} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <p className="text-xs font-bold text-slate-700 mb-2 px-1">Integrações</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {INTEGRACOES.map((intg) => {
              const ok = Boolean(config[intg.id]?.set);
              return (
                <div key={intg.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${intg.cor}`}>{intg.icone}</div>
                    <span className={`text-[9px] font-bold px-2 py-1 rounded-full border ${intg.chip}`}>
                      {ok ? "● Conectado" : "○ Ausente"}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">{intg.nome}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{intg.desc}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={onAbrirApis}
                      className="flex-1 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold active:scale-95 transition-all"
                    >
                      Gerenciar
                    </button>
                    <button
                      onClick={onAbrirApis}
                      className={`flex-1 h-8 rounded-xl text-[10px] font-bold active:scale-95 transition-all ${
                        ok ? "bg-slate-50 border border-slate-200 text-slate-400" : "bg-gradient-to-r from-violet-600 to-purple-500 text-white hover:brightness-110"
                      }`}
                    >
                      {ok ? "Atualizar" : "Conectar"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-xs font-bold text-slate-700 mb-2 px-1">Status do Plano</p>
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-bold text-slate-800">Plano D'Griffe</p>
                <p className="text-[10px] text-slate-400">Recursos do período atual</p>
              </div>
              <span className="text-[9px] font-bold px-2 py-1 rounded-full bg-violet-50 text-violet-600 border border-violet-200">ATIVO</span>
            </div>
            <div className="space-y-4 flex-1">
              {planoItens.map((item) => {
                const pct = Math.min(Math.round((item.usado / item.limite) * 100), 100);
                return (
                  <div key={item.nome}>
                    <div className="flex items-center justify-between text-[10px] mb-1">
                      <span className="font-semibold text-slate-600">{item.nome}</span>
                      <span className="text-slate-400">
                        {item.nome === "Faturamento aprovado" ? formatPrice(item.usado) : item.usado} / {item.nome === "Faturamento aprovado" ? formatPrice(item.limite) : item.limite}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <button
              onClick={onAbrirApis}
              className="mt-4 w-full h-10 rounded-xl bg-gradient-to-r from-violet-600 to-purple-500 text-white text-[11px] font-bold hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-violet-500/20"
            >
              Configurar recursos
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <p className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-2">
          <span className="w-1 h-3.5 rounded-full bg-violet-600 inline-block" />Faturamento por dia
        </p>
        <BarChart data={serie.map((d: any) => ({ label: fmtDia(d.dia), value: d.total }))} />
      </div>

      {statusComContagem.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-800 mb-2.5 flex items-center gap-2">
            <span className="w-1 h-3.5 rounded-full bg-violet-600 inline-block" />Pedidos por status
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => onIrPedidos()}
              className="px-2.5 h-7 rounded-full text-[10px] font-bold border border-violet-300 bg-violet-50 text-violet-600 hover:bg-violet-100 transition-all active:scale-95"
            >
              Todos · {pedidosTotal}
            </button>
            {statusComContagem.map((s) => (
              <button
                key={s.id}
                onClick={() => onIrPedidos(s.nome)}
                className="px-2.5 h-7 rounded-full text-[10px] font-bold border border-slate-200 bg-slate-50 text-slate-600 hover:border-violet-300 hover:text-violet-600 transition-all active:scale-95"
              >
                {s.nome} · {totaisPorStatus[s.nome]}
              </button>
            ))}
          </div>
        </div>
      )}

      {recentes.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-slate-800 flex items-center gap-2">
              <span className="w-1 h-3.5 rounded-full bg-violet-600 inline-block" />Pedidos recentes
            </p>
            <button onClick={() => onIrPedidos()} className="text-[10px] font-bold text-violet-600 hover:text-violet-700 transition-colors">
              Ver todos →
            </button>
          </div>
          <div className="space-y-1">
            {recentes.map((p) => (
              <button
                key={p.id}
                onClick={() => onAbrirPedido(p.id)}
                className="w-full flex items-center justify-between text-[11px] rounded-xl px-2 py-2 hover:bg-slate-50 transition-colors text-left"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                    #{p.numero}
                    {ehHoje(p.data) && <span className="w-1.5 h-1.5 rounded-full bg-violet-600 inline-block" title="Hoje" />}
                  </p>
                  <p className="text-slate-400 truncate">{p.cliente_nome} · {p.cliente_email}</p>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <p className="font-bold text-slate-800">{formatPrice(Number(p.total) || 0)}</p>
                  <StatusBadge status={p.status} />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {cuponsAtivos.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-xs font-bold text-slate-800 flex items-center gap-2">
              <span className="w-1 h-3.5 rounded-full bg-violet-600 inline-block" />Cupons ativos
            </p>
            <button onClick={onIrCupons} className="text-[10px] font-bold text-violet-600 hover:text-violet-700 transition-colors">
              Gerenciar →
            </button>
          </div>
          <div className="space-y-1.5">
            {cuponsAtivos.slice(0, 4).map((c) => (
              <div key={c.id} className="flex items-center justify-between text-[11px] rounded-xl px-2 py-1.5 bg-slate-50 border border-slate-100">
                <span className="font-bold text-violet-600">{c.codigo}</span>
                <span className="text-slate-500">
                  {c.tipo === "percentual" ? `${c.valor}%` : `R$ ${Number(c.valor).toFixed(2)}`} · {c.usos}/{c.max_usos ?? "∞"} usos
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <p className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-2">
          <span className="w-1 h-3.5 rounded-full bg-violet-600 inline-block" />Integrações
        </p>
        <p className="text-[11px] text-slate-500 mb-2">
          Catálogo e checkout dependem das chaves da Loja Integrada e Mercado Pago. Configure na aba "APIs" (canto superior direito).
        </p>
        {ultimaAtualizacao && (
          <p className="text-[9px] text-slate-400">Atualizado {ultimaAtualizacao.toLocaleTimeString("pt-BR")}</p>
        )}
      </div>
    </div>
  );
}