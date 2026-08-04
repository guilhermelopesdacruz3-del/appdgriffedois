import { useCallback, useEffect, useState } from "react";
import { formatPrice } from "../utils";
import {
  adminLogin,
  adminLogout,
  atualizarStatusPedido,
  buscarPedidoAdmin,
  clearAdminToken,
  definirVerificadoPedido,
  getAdminToken,
  listarClientesAdmin,
  listarPedidosAdmin,
  listarSituacoes,
  pedidoParaCSV,
  relatorioAdmin,
  type AdminPedido,
  type ClienteRelatorio,
  type RelatorioAdmin,
  type SituacaoPedido,
} from "../services/admin";
import { BarChart, PieChart, KpiCard } from "../components/admin/AdminCharts";
import { ApiConfigPanel } from "../components/admin/ApiConfigPanel";
import CuponsAdmin from "./admin/CuponsAdmin";
import FidelidadeAdmin from "./admin/FidelidadeAdmin";
import NotificacoesAdmin from "./admin/NotificacoesAdmin";
import ReceitasAdmin from "./admin/ReceitasAdmin";
import AdminDashboard from "./AdminDashboard";

type Aba = "pedidos" | "dashboard" | "cupons" | "fidelidade" | "notificacoes" | "relatorios" | "logs" | "receitas";

export default function AdminPage({ onExit }: { onExit: () => void }) {
  const [token, setToken] = useState<string | null>(() => getAdminToken());
  const [senha, setSenha] = useState("");
  const [loginErro, setLoginErro] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  const [aba, setAba] = useState<Aba>("pedidos");
  const [pedidos, setPedidos] = useState<AdminPedido[]>([]);
  const [total, setTotal] = useState(0);
  const [carregandoPedidos, setCarregandoPedidos] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
  const [situacoes, setSituacoes] = useState<SituacaoPedido[]>([]);
  const [mostrarApi, setMostrarApi] = useState(false);

  const [selecionado, setSelecionado] = useState<number | string | null>(null);
  const [detalhe, setDetalhe] = useState<AdminPedido | null>(null);
  const [detalheLoading, setDetalheLoading] = useState(false);
  const [salvandoStatus, setSalvandoStatus] = useState(false);
  const [statusSelecionado, setStatusSelecionado] = useState("");

  const [relatorio, setRelatorio] = useState<RelatorioAdmin | null>(null);
  const [clientes, setClientes] = useState<ClienteRelatorio[]>([]);

  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsFiltroEmail, setLogsFiltroEmail] = useState("");
  const [logsFiltroAcao, setLogsFiltroAcao] = useState("");
  const [logsDataInicio, setLogsDataInicio] = useState("");
  const [logsDataFim, setLogsDataFim] = useState("");

  const carregarPedidos = useCallback(async () => {
    setCarregandoPedidos(true);
    setErro(null);
    try {
      const termo = busca.trim();
      const filtro: Record<string, unknown> = { limit: 100, offset: 0 };
      if (termo.includes("@")) filtro.cliente_email = termo;
      else if (termo) filtro.numero = termo;
      if (filtroStatus && filtroStatus !== "todos") filtro.status = filtroStatus;
      if (filtroDataInicio) filtro.data_inicio = filtroDataInicio;
      if (filtroDataFim) filtro.data_fim = filtroDataFim;

      const resultado = await listarPedidosAdmin(filtro as any);
      setPedidos(resultado.pedidos);
      setTotal(resultado.total);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregandoPedidos(false);
    }
  }, [busca, filtroStatus, filtroDataInicio, filtroDataFim]);

  const carregarRelatorio = useCallback(async () => {
    try {
      const [r, c] = await Promise.all([relatorioAdmin(), listarClientesAdmin()]);
      setRelatorio(r);
      setClientes(c.clientes);
    } catch (e) {
      setErro((e as Error).message);
    }
  }, []);

  const carregarSituacoes = useCallback(async () => {
    try {
      setSituacoes(await listarSituacoes());
    } catch {
      // silencioso
    }
  }, []);

  const carregarLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const q: Record<string, string> = { limit: "50" };
      if (logsFiltroEmail) q.admin_email = logsFiltroEmail;
      if (logsFiltroAcao) q.acao = logsFiltroAcao;
      if (logsDataInicio) q.inicio = logsDataInicio;
      if (logsDataFim) q.fim = logsDataFim;

      const autorizacao = `Bearer ${getAdminToken()}`;
      const res = await fetch("/api/admin/logs?" + new URLSearchParams(q).toString(), {
        headers: { Authorization: autorizacao }
      });
      const json = (await res.json().catch(() => ({}))) as any;
      if (!res.ok) throw new Error(json?.erro || `Falha ao carregar logs (${res.status})`);
      setLogs(json.logs || []);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setLogsLoading(false);
    }
  }, [logsFiltroEmail, logsFiltroAcao, logsDataInicio, logsDataFim]);

  const exportarLogsCSV = () => {
    const linhas = [
      ["id", "admin_email", "acao", "detalhe", "ip", "created_at"].join(";"),
      ...logs.map((l: any) =>
        [l.id, l.admin_email, l.acao, JSON.stringify(l.detalhe || {}), l.ip || "", l.created_at || ""].join(";")
      ),
    ];
    const blob = new Blob(["\uFEFF" + linhas.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "logs-admin.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (!token) return;
    carregarPedidos();
    carregarSituacoes();
    carregarRelatorio();
  }, [token, carregarPedidos, carregarSituacoes, carregarRelatorio]);

  const fazerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginErro(null);
    try {
      await adminLogin(senha);
      setToken(getAdminToken());
    } catch (e) {
      setLoginErro((e as Error).message);
    } finally {
      setLoginLoading(false);
    }
  };

  const sair = async () => {
    try { await adminLogout(); } catch { /* ignorar */ }
    clearAdminToken();
    setToken(null);
    setPedidos([]);
    setSelecionado(null);
    setDetalhe(null);
    setRelatorio(null);
    setClientes([]);
    setLogs([]);
  };

  const abrirDetalhe = async (id: number | string) => {
    setSelecionado(id);
    setDetalheLoading(true);
    try {
      const p = await buscarPedidoAdmin(id);
      const mapeado: AdminPedido = {
        id: p.id,
        numero: p.numero,
        cliente_nome: p.cliente_nome,
        cliente_email: p.cliente_email,
        status: p.situacao?.nome || "—",
        status_id: p.situacao?.id,
        status_uri: p.situacao?.resource_uri,
        data: new Date(p.data_criacao).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }),
        total: Number(p.valor_total) || 0,
        items: (p.itens || []).reduce((s, i) => s + (i.quantidade || 0), 0),
        verificado: Boolean((p as any).verificado),
        verificado_em: (p as any).verificado_em || null,
      };
      setDetalhe(mapeado);
      setStatusSelecionado(String((p.situacao?.id ?? "") as any));
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setDetalheLoading(false);
    }
  };

  const salvarStatus = async () => {
    if (!detalhe || !statusSelecionado) return;
    setSalvandoStatus(true);
    try {
      const sit = situacoes.find((s) => String(s.id) === statusSelecionado);
      await atualizarStatusPedido(detalhe.id, sit?.resource_uri || sit?.id || statusSelecionado);
      await carregarPedidos();
      setDetalhe({ ...detalhe, status: sit?.nome || detalhe.status, status_id: sit?.id, status_uri: sit?.resource_uri });
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvandoStatus(false);
    }
  };

  const alternarVerificado = async () => {
    if (!detalhe) return;
    const novo = !detalhe.verificado;
    try {
      await definirVerificadoPedido(detalhe.id, novo);
      setDetalhe({ ...detalhe, verificado: novo, verificado_em: novo ? new Date().toISOString() : null });
      setPedidos((prev) => prev.map((p) => (p.id === detalhe.id ? { ...p, verificado: novo } : p)));
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  const pedidosFiltrados = pedidos.filter((p) => {
    if (filtroStatus !== "todos" && p.status !== filtroStatus) return false;
    if (filtroDataInicio) {
      const d = new Date(p.data || "0");
      if (d < new Date(filtroDataInicio)) return false;
    }
    if (filtroDataFim) {
      const d = new Date(p.data || "0");
      const fim = new Date(filtroDataFim);
      fim.setHours(23, 59, 59, 999);
      if (d > fim) return false;
    }
    return true;
  });

  if (!token) {
    return (
      <div className="min-h-screen bg-luxury-black flex items-center justify-center px-6 relative overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-gold/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-gold/5 blur-3xl pointer-events-none" />
        <div className="w-full max-w-sm bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-gold/20 rounded-[2rem] p-7 shadow-[0_0_60px_rgba(212,168,83,0.12)] backdrop-blur relative">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center shadow-lg shadow-gold/30 mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <h2 className="text-base font-bold text-white text-center">Painel Admin</h2>
          <p className="text-xs text-white/60 mt-1 text-center">Acesso restrito — informe a senha</p>
          <form className="mt-5 space-y-3" onSubmit={fazerLogin}>
            <div className="relative">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gold/60" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
              <input
                type="password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Senha de administrador"
                className="w-full h-12 pl-10 pr-4 rounded-2xl border border-white/15 bg-black/40 text-white text-sm placeholder:text-white/40 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-all"
              />
            </div>
            <button type="submit" disabled={loginLoading} className="w-full h-12 bg-gradient-to-r from-gold to-gold-dark text-black text-xs font-bold rounded-2xl disabled:opacity-50 active:scale-[0.98] transition-all shadow-lg shadow-gold/20 hover:brightness-110">
              {loginLoading ? "Entrando..." : "Entrar"}
            </button>
          </form>
          {loginErro && <p className="text-[11px] text-amber-300 mt-3 text-center">{loginErro}</p>}
          <button onClick={onExit} className="w-full text-[10px] font-bold text-white/60 hover:text-white mt-4 transition-colors">← Voltar à loja</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-luxury-black text-white">
      <div className="max-w-6xl mx-auto min-h-screen bg-luxury-black relative pb-16">
        <div className="sticky top-0 z-20 bg-luxury-black/90 border-b border-white/10 px-5 py-3 flex items-center justify-between backdrop-blur-lg">
          <div className="flex items-center gap-3">
            <span className="relative flex w-2.5 h-2.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
              <span className="relative inline-flex rounded-full w-2.5 h-2.5 bg-emerald-400" />
            </span>
            <div>
              <h1 className="text-sm font-bold leading-tight flex items-center gap-2">
                Painel Admin
                <span className="hidden sm:inline text-[9px] font-bold px-2 py-0.5 rounded-full bg-gold/15 text-gold border border-gold/25 uppercase tracking-wider">D'Griffe</span>
              </h1>
              <p className="text-[10px] text-amber-300 font-semibold">{total} pedidos no total</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setMostrarApi((v) => !v)} className={`text-[11px] font-bold flex items-center gap-1.5 rounded-full px-3 py-1.5 border transition-all ${mostrarApi ? "bg-gold text-black border-gold" : "text-amber-200 border-gold/25 bg-white/5 hover:bg-white/10"}`} title="APIs">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 6V4m0 16v-2m6-6h2M4 12h2m10.5-4.5l1.5-1.5M6 18l1.5-1.5M16.5 16.5L18 18M6 6l1.5 1.5" /><circle cx="12" cy="12" r="3" /></svg>
              <span className="hidden sm:inline">APIs</span>
            </button>
            <button onClick={sair} className="text-[11px] font-bold text-gray-300 hover:text-white flex items-center gap-1.5 border border-white/15 bg-white/5 hover:bg-white/10 rounded-full px-3 py-1.5 transition-all" title="Sair">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>

        <div className="sticky top-[61px] z-10 bg-luxury-black/80 backdrop-blur-lg px-4 pt-3 pb-2">
          <div className="flex gap-1 p-1 rounded-2xl bg-white/[0.04] border border-white/10 overflow-x-auto">
{([
  "pedidos", "dashboard", "cupons", "fidelidade", "notificacoes", "relatorios", "logs", "receitas"
] as Aba[]).map((a) => (
  <button key={a} onClick={() => setAba(a)} className={`flex-1 min-w-[80px] h-9 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap ${aba === a ? "bg-gradient-to-r from-gold to-gold-dark text-black shadow-lg shadow-gold/20" : "text-gray-300 hover:text-white hover:bg-white/5"}`}>
    {a === "pedidos" ? "Pedidos" : a === "dashboard" ? "Dashboard" : a === "cupons" ? "Cupons" : a === "fidelidade" ? "Fidelidade" : a === "notificacoes" ? "Notificações" : a === "relatorios" ? "Relatórios" : a === "logs" ? "Logs" : "Receitas"}
  </button>
))}
          </div>
        </div>

        <div className="p-4 space-y-3">
          {mostrarApi && <ApiConfigPanel onClose={() => setMostrarApi(false)} />}

          {aba === "dashboard" && <AdminDashboard token={token as string} />}

          {aba === "pedidos" && (
            <>
              <div className="bg-gradient-to-b from-white/[0.07] to-white/[0.02] border border-white/10 rounded-2xl p-4 space-y-3">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gold/60" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                    <input value={busca} onChange={(e) => setBusca(e.target.value)} onKeyDown={(e) => e.key === "Enter" && carregarPedidos()} placeholder="Buscar por nº, nome ou e-mail..." className="w-full h-10 pl-9 pr-3 rounded-xl border border-white/15 bg-black/40 text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-all" />
                  </div>
                  <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="h-10 px-3 rounded-xl border border-white/15 bg-black/40 text-white text-xs focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-all">
                    <option value="todos">Todos os status</option>
                    {situacoes.map((s) => (<option key={s.id} value={s.nome}>{s.nome}</option>))}
                  </select>
                </div>
                <div className="flex gap-2 items-center flex-wrap">
                  <input type="date" value={filtroDataInicio} onChange={(e) => setFiltroDataInicio(e.target.value)} className="h-10 px-3 rounded-xl border border-white/15 bg-black/40 text-white text-xs focus:outline-none focus:border-gold" />
                  <span className="text-[10px] text-white/50">até</span>
                  <input type="date" value={filtroDataFim} onChange={(e) => setFiltroDataFim(e.target.value)} className="h-10 px-3 rounded-xl border border-white/15 bg-black/40 text-white text-xs focus:outline-none focus:border-gold" />
                  <button onClick={() => { const blob = new Blob([pedidoParaCSV(pedidosFiltrados)], { type: "text/csv;charset=utf-8;" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "pedidos-dgriffe.csv"; a.click(); URL.revokeObjectURL(url); }} className="ml-auto h-10 px-3 border border-gold/40 text-gold text-[11px] font-bold rounded-xl active:scale-95 whitespace-nowrap bg-gold/10 hover:bg-gold/20 transition-all">📥 Exportar CSV</button>
                </div>
              </div>

              {erro && (
                <div className="bg-amber-500/10 border border-amber-400/25 text-amber-200 rounded-2xl p-3 flex items-center justify-between gap-2">
                  <p className="text-[11px] flex-1">{erro}</p>
                  <button onClick={() => { setErro(null); void carregarPedidos(); }} className="text-[10px] font-bold text-amber-100 border border-amber-300/30 rounded-lg px-2 py-1 active:scale-95 whitespace-nowrap">Tentar de novo</button>
                </div>
              )}

              {carregandoPedidos && (<div className="flex justify-center py-10"><div className="w-7 h-7 border-2 border-gold border-t-transparent rounded-full animate-spin" /></div>)}

              {!carregandoPedidos && pedidosFiltrados.length === 0 && (
                <div className="bg-gradient-to-b from-white/[0.04] to-transparent border border-white/10 rounded-2xl p-10 text-center">
                  <svg className="mx-auto mb-3 text-white/20" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 01-8 0" /></svg>
                  <p className="text-xs text-white/50">Nenhum pedido encontrado.</p>
                </div>
              )}

              {!carregandoPedidos && pedidosFiltrados.length > 0 && (
                <div className="bg-gradient-to-b from-white/[0.07] to-white/[0.02] border border-white/10 rounded-2xl shadow-lg shadow-black/20 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-[9px] uppercase tracking-wide text-gold/70 border-b border-white/10 bg-white/[0.03]">
                          <th className="p-3 w-8"></th>
                          <th className="p-3 font-semibold">Pedido Nº</th>
                          <th className="p-3 font-semibold">Cliente</th>
                          <th className="p-3 font-semibold">Data</th>
                          <th className="p-3 font-semibold">Status</th>
                          <th className="p-3 font-semibold text-right">Total</th>
                          <th className="p-3 font-semibold text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pedidosFiltrados.map((p) => (
                          <tr key={p.id} className="border-b border-white/5 last:border-0 hover:bg-gold/[0.04] transition-colors">
                            <td className="p-3"><input type="checkbox" className="accent-gold" /></td>
                            <td className="p-3">
                              <span className="text-xs font-bold text-white">#{p.numero}</span>
                              {p.verificado && <span className="ml-1.5 text-[9px] text-emerald-300 font-bold bg-emerald-400/10 border border-emerald-400/20 rounded-full px-1.5 py-0.5">✓ Verificado</span>}
                            </td>
                            <td className="p-3">
                              <p className="text-[11px] font-semibold text-white truncate max-w-[140px]">{p.cliente_nome}</p>
                              <p className="text-[9px] text-white/40 truncate max-w-[140px]">{p.cliente_email}</p>
                            </td>
                            <td className="p-3 text-[11px] text-white/70 whitespace-nowrap">{p.data}</td>
                            <td className="p-3">
                              <span className={`inline-block px-2 py-0.5 text-[9px] font-bold rounded-full border ${p.status === "Entregue" ? "bg-emerald-400/10 text-emerald-300 border-emerald-400/25" : p.status === "Em produção" ? "bg-indigo-400/10 text-indigo-300 border-indigo-400/25" : "bg-white/5 text-gray-300 border-white/10"}`}>{p.status}</span>
                            </td>
                            <td className="p-3 text-right text-xs font-bold text-white whitespace-nowrap">{formatPrice(p.total)}</td>
                            <td className="p-3 text-right">
                              <button onClick={() => abrirDetalhe(p.id)} className="w-8 h-8 rounded-xl bg-gold/15 text-gold hover:bg-gold/25 text-[10px] font-bold active:scale-95 inline-flex items-center justify-center border border-gold/25 transition-all" title="Ver">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {aba === "dashboard" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <KpiCard label="Pedidos" value={relatorio ? String(relatorio.totalPedidos) : "—"} />
                <KpiCard label="Faturamento" value={relatorio ? formatPrice(relatorio.faturamentoTotal) : "—"} />
                <KpiCard label="Ticket Médio" value={relatorio ? formatPrice(relatorio.ticketMedio) : "—"} accent="#D4A853" />
                <KpiCard label="Aprovado" value={relatorio ? formatPrice(relatorio.faturamentoAprovado) : "—"} accent="#10B981" />
              </div>
              <div className="bg-gradient-to-b from-white/[0.07] to-white/[0.02] border border-white/10 rounded-2xl p-4">
                <p className="text-xs font-bold text-white mb-3 flex items-center gap-2"><span className="w-1 h-3.5 rounded-full bg-gold inline-block" />Faturamento por dia</p>
                <BarChart data={(relatorio?.serieDiaria || []).slice(-10).map((d) => ({ label: d.dia, value: d.total }))} color="#D4A853" />
              </div>
            </div>
          )}

          {aba === "cupons" && <CuponsAdmin />}
          {aba === "fidelidade" && <FidelidadeAdmin />}
          {aba === "notificacoes" && <NotificacoesAdmin />}

          {aba === "relatorios" && (
            <div className="space-y-3">
              <div className="bg-gradient-to-b from-white/[0.07] to-white/[0.02] border border-white/10 rounded-2xl p-4">
                <p className="text-xs font-bold text-white mb-3 flex items-center gap-2"><span className="w-1 h-3.5 rounded-full bg-gold inline-block" />Origem (app vs site)</p>
                <div className="h-40">
                  <PieChart data={[{ label: "Site", value: relatorio?.porCanal.site || 0, color: "#6366F1" }, { label: "App", value: relatorio?.porCanal.app || 0, color: "#D4A853" }]} size={140} />
                </div>
              </div>
              <div className="bg-gradient-to-b from-white/[0.07] to-white/[0.02] border border-white/10 rounded-2xl p-4">
                <p className="text-xs font-bold text-white mb-3 flex items-center gap-2"><span className="w-1 h-3.5 rounded-full bg-gold inline-block" />Clientes</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[9px] uppercase tracking-wide text-gold/70 border-b border-white/10 bg-white/[0.03]">
                        <th className="p-3 font-semibold">Cliente</th>
                        <th className="p-3 font-semibold text-right">Pedidos</th>
                        <th className="p-3 font-semibold text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientes.map((c) => (
                        <tr key={c.email} className="border-b border-white/5 last:border-0 hover:bg-gold/[0.04] transition-colors">
                          <td className="p-3">
                            <p className="text-xs font-semibold text-white">{c.nome}</p>
                            <p className="text-[9px] text-white/40">{c.email}</p>
                          </td>
                          <td className="p-3 text-right text-[11px] text-white/70">{c.pedidos ?? 0}</td>
                          <td className="p-3 text-right text-xs font-bold text-white whitespace-nowrap">{formatPrice(Number(c.total || 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {aba === "logs" && (
            <div className="space-y-3">
              <div className="bg-gradient-to-b from-white/[0.07] to-white/[0.02] border border-white/10 rounded-2xl p-3 space-y-2">
                <div className="flex gap-2 items-center flex-wrap">
                  <div className="flex-1 min-w-[180px]">
                    <input value={logsFiltroEmail} onChange={(e) => setLogsFiltroEmail(e.target.value)} placeholder="E-mail do admin" className="w-full h-10 px-3 rounded-xl border border-white/15 bg-black/40 text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-all" />
                  </div>
                  <div className="flex-1 min-w-[180px]">
                    <input value={logsFiltroAcao} onChange={(e) => setLogsFiltroAcao(e.target.value)} placeholder="Ação" className="w-full h-10 px-3 rounded-xl border border-white/15 bg-black/40 text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-all" />
                  </div>
                  <div>
                    <input type="date" value={logsDataInicio} onChange={(e) => setLogsDataInicio(e.target.value)} className="h-10 px-3 rounded-xl border border-white/15 bg-black/40 text-white text-xs focus:outline-none focus:border-gold" />
                  </div>
                  <div>
                    <input type="date" value={logsDataFim} onChange={(e) => setLogsDataFim(e.target.value)} className="h-10 px-3 rounded-xl border border-white/15 bg-black/40 text-white text-xs focus:outline-none focus:border-gold" />
                  </div>
                  <button onClick={carregarLogs} className="h-10 px-4 bg-gradient-to-r from-gold to-gold-dark text-black text-[11px] font-bold rounded-xl active:scale-95 whitespace-nowrap transition-all hover:brightness-110">Filtrar</button>
                  <button onClick={exportarLogsCSV} className="h-10 px-3 border border-gold/40 text-gold text-[11px] font-bold rounded-xl active:scale-95 whitespace-nowrap bg-gold/10 hover:bg-gold/20 transition-all">Exportar CSV</button>
                </div>
              </div>

              {logsLoading && (<div className="flex justify-center py-10"><div className="w-7 h-7 border-2 border-gold border-t-transparent rounded-full animate-spin" /></div>)}

              {!logsLoading && logs.length === 0 && (
                <div className="bg-gradient-to-b from-white/[0.04] to-transparent border border-white/10 rounded-2xl p-10 text-center">
                  <svg className="mx-auto mb-3 text-white/20" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4h16v16H4z" /><path d="M8 9h8M8 13h8M8 17h5" /></svg>
                  <p className="text-xs text-white/50">Nenhum log encontrado.</p>
                </div>
              )}

              <div className="space-y-2">
                {logs.map((l: any) => (
                  <div key={l.id} className="bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/10 rounded-2xl p-3.5 space-y-1.5 hover:border-gold/20 transition-colors">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-bold text-white flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-gold inline-block" />{l.acao}</p>
                      <span className="text-[10px] text-white/40">{new Date(l.created_at).toLocaleString("pt-BR")}</span>
                    </div>
                    <p className="text-[10px] text-white/50 truncate">{l.admin_email} {l.ip ? `· ${l.ip}` : ""}</p>
                    <pre className="text-[10px] text-white/60 whitespace-pre-wrap break-words bg-black/30 rounded-xl p-2.5">{JSON.stringify(l.detalhe || {}, null, 2)}</pre>
                  </div>
                ))}
              </div>
             </div>
           )}

           {aba === "receitas" && <ReceitasAdmin />}
         </div>
       </div>

      {selecionado !== null && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-end justify-center" onClick={() => setSelecionado(null)}>
          <div className="w-full max-w-lg bg-[#0d0d0d] border border-white/10 rounded-t-3xl max-h-[90vh] overflow-y-auto shadow-2xl shadow-black/60" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-[#0d0d0d]/90 px-5 py-3.5 flex items-center justify-between border-b border-white/10 backdrop-blur">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Pedido #{detalhe?.numero ?? selecionado}
                {detalhe?.verificado && <span className="text-[9px] font-bold text-emerald-300 bg-emerald-400/10 border border-emerald-400/20 rounded-full px-2 py-0.5">✓ Verificado</span>}
              </h3>
              <button onClick={() => setSelecionado(null)} className="text-gray-400 hover:text-white text-xl leading-none w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 transition-colors">×</button>
            </div>

            {detalheLoading && (<div className="flex justify-center py-10"><div className="w-7 h-7 border-2 border-gold border-t-transparent rounded-full animate-spin" /></div>)}

            {detalhe && (
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-gold">{formatPrice(detalhe.total)}</p>
                    <p className="text-[10px] text-white/50 mt-0.5">{detalhe.data} · {detalhe.items} itens · {detalhe.status}</p>
                  </div>
                  <button onClick={alternarVerificado} className={`px-3 py-2 rounded-xl text-[11px] font-bold active:scale-95 border transition-all ${detalhe.verificado ? "bg-emerald-400/10 text-emerald-300 border-emerald-400/25" : "bg-white/5 text-gray-300 border-white/15 hover:bg-white/10"}`}>
                    {detalhe.verificado ? "✓ Verificado" : "Marcar verificado"}
                  </button>
                </div>

                <div className="bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/10 rounded-2xl p-4 space-y-1">
                  <p className="text-[10px] text-gold/70 uppercase tracking-wider font-bold">Cliente</p>
                  <p className="text-sm font-semibold text-white">{detalhe.cliente_nome}</p>
                  <p className="text-xs text-white/60">{detalhe.cliente_email}</p>
                </div>

                <div className="bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/10 rounded-2xl p-4 space-y-2.5">
                  <p className="text-[10px] text-gold/70 uppercase tracking-wider font-bold">Atualizar status</p>
                  <select value={statusSelecionado} onChange={(e) => setStatusSelecionado(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-white/15 bg-black/40 text-white text-xs focus:outline-none focus:border-gold">
                    {situacoes.map((s) => <option key={s.id} value={String(s.id)}>{s.nome}</option>)}
                  </select>
                  <button onClick={salvarStatus} disabled={salvandoStatus} className="w-full h-12 bg-gradient-to-r from-gold to-gold-dark text-black text-xs font-bold rounded-2xl disabled:opacity-50 active:scale-[0.98] transition-all shadow-lg shadow-gold/20 hover:brightness-110">
                    {salvandoStatus ? "Salvando..." : "Salvar status"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
