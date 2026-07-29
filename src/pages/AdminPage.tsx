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
  buscarClienteAdmin,
  pedidoParaCSV,
  relatorioAdmin,
  type AdminPedido,
  type ClienteRelatorio,
  type RelatorioAdmin,
  type SituacaoPedido,
} from "../services/admin";
import { saveApiConfig } from "../services/apiConfig";
import { BarChart, PieChart, KpiCard } from "../components/admin/AdminCharts";
import { ApiConfigPanel } from "../components/admin/ApiConfigPanel";
import CuponsAdmin from "./admin/CuponsAdmin";
import FidelidadeAdmin from "./admin/FidelidadeAdmin";
import NotificacoesAdmin from "./admin/NotificacoesAdmin";
import AdminDashboard from "./AdminDashboard";

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type Aba = "pedidos" | "dashboard" | "cupons" | "fidelidade" | "notificacoes" | "relatorios" | "logs";

export default function AdminPage({ onExit }: { onExit: () => void }) {
  const [token, setToken] = useState<string | null>(() => getAdminToken());
  const [senha, setSenha] = useState("");
  const [loginErro, setLoginErro] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  const [aba, setAba] = useState<Aba>("pedidos");
  const [pedidos, setPedidos] = useState<AdminPedido[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
  const [situacoes, setSituacoes] = useState<SituacaoPedido[]>([]);
  const [mostrarConfig, setMostrarConfig] = useState(false);

  const [selecionado, setSelecionado] = useState<number | string | null>(null);
  const [detalhe, setDetalhe] = useState<AdminPedido | null>(null);
  const [detalheLoading, setDetalheLoading] = useState(false);
  const [salvandoStatus, setSalvandoStatus] = useState(false);
  const [statusSelecionado, setStatusSelecionado] = useState<string>("");

  // Relatórios
  const [relatorio, setRelatorio] = useState<RelatorioAdmin | null>(null);
  const [clientes, setClientes] = useState<ClienteRelatorio[]>([]);
  const [relLoading, setRelLoading] = useState(false);

  // Cliente detalhe
  const [clienteDetalhe, setClienteDetalhe] = useState<{
    email: string;
    dados: any | null;
    loading: boolean;
    erro: string | null;
  } | null>(null);

  // Logs (A8)
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsFiltroEmail, setLogsFiltroEmail] = useState("");
  const [logsFiltroAcao, setLogsFiltroAcao] = useState("");
  const [logsDataInicio, setLogsDataInicio] = useState("");
  const [logsDataFim, setLogsDataFim] = useState("");

  const abrirCliente = useCallback(async (email: string) => {
    setClienteDetalhe({ email, dados: null, loading: true, erro: null });
    try {
      const d = await buscarClienteAdmin(email);
      setClienteDetalhe({ email, dados: d, loading: false, erro: null });
    } catch (e: any) {
      setClienteDetalhe({ email, dados: null, loading: false, erro: e?.message || "Erro" });
    }
  }, []);

  const carregar = useCallback(async () => {
    setLoading(true);
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
      setLoading(false);
    }
  }, [busca, filtroStatus, filtroDataInicio, filtroDataFim]);

  const carregarSituacoes = useCallback(async () => {
    try {
      setSituacoes(await listarSituacoes());
    } catch {
      /* ignora */
    }
  }, []);

  const carregarRelatorio = useCallback(async () => {
    setRelLoading(true);
    try {
      const [r, c] = await Promise.all([relatorioAdmin(), listarClientesAdmin()]);
      setRelatorio(r);
      setClientes(c.clientes);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setRelLoading(false);
    }
  }, []);

  const carregarLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const q: Record<string, unknown> = { limit: 50 };
      if (logsFiltroEmail) q.admin_email = logsFiltroEmail;
      if (logsFiltroAcao) q.acao = logsFiltroAcao;
      if (logsDataInicio) q.inicio = logsDataInicio;
      if (logsDataFim) q.fim = logsDataFim;

      const res = await fetch("/api/admin/logs?" + new URLSearchParams(q as any).toString(), {
        headers: { Authorization: `Bearer ${getAdminToken()}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error((json as any)?.erro || "Falha ao carregar logs");
      setLogs((json as any).logs || []);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setLogsLoading(false);
    }
  }, [logsFiltroEmail, logsFiltroAcao, logsDataInicio, logsDataFim]);

  const exportarLogsCSV = () => {
    const linhas = [
      ["id", "admin_email", "acao", "detalhe", "ip", "created_at"].join(";"),
      ...(logs as any[]).map((l) =>
        [l.id, l.admin_email, l.acao, JSON.stringify(l.detalhe || {}), l.ip || "", l.created_at || ""].join(";")
      ),
    ];
    downloadCSV(linhas.join("\n"), "logs-admin.csv");
  };

  useEffect(() => {
    if (token) {
      carregar();
      carregarSituacoes();
      carregarRelatorio();
    }
  }, [token, carregar, carregarSituacoes, carregarRelatorio, aba]);

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
    try {
      await adminLogout();
    } catch {
      /* ignora falha de rede no logout */
    }
    clearAdminToken();
    setToken(null);
    setPedidos([]);
    setSelecionado(null);
    setDetalhe(null);
    setRelatorio(null);
    setClientes([]);
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
        data: new Date(p.data_criacao).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        total: Number(p.valor_total) || 0,
        items: (p.itens || []).reduce((s, i) => s + (i.quantidade || 0), 0),
        verificado: Boolean((p as { verificado?: boolean }).verificado),
        verificado_em: (p as { verificado_em?: string | null }).verificado_em || null,
      };
      setDetalhe(mapeado);
      setStatusSelecionado(String(p.situacao?.id ?? ""));
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
      await carregar();
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

  const exportarCSV = () => downloadCSV(pedidoParaCSV(pedidosFiltrados), "pedidos-dgriffe.csv");

  // -------------------- Tela de login --------------------
    if (!token) {
      return (
        <div className="min-h-screen bg-ice flex items-center justify-center px-6">
          <div className="w-full max-w-sm bg-white/10 border border-white/20 rounded-[2rem] p-6 shadow-[0_0_40px_rgba(212,168,83,0.15)] backdrop-blur">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center shadow-lg shadow-gold/20 mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <h2 className="text-base font-bold text-luxury-black text-center">Painel Admin</h2>
            <p className="text-xs text-luxury-black/60 mt-1 text-center">Acesso restrito — informe a senha</p>

            <form className="mt-5 space-y-3" onSubmit={fazerLogin}>
              <input
                type="password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Senha de administrador"
                className="w-full h-12 px-4 rounded-2xl border border-white/20 bg-white/30 text-luxury-black text-sm placeholder:text-luxury-black/50 focus:outline-none focus:border-gold"
              />
              <button
                type="submit"
                disabled={loginLoading}
                className="w-full h-12 bg-white text-luxury-black text-xs font-bold rounded-2xl disabled:opacity-50 active:scale-[0.98] transition-all"
              >
                {loginLoading ? "Entrando..." : "Entrar"}
              </button>
            </form>

            {loginErro && <p className="text-[11px] text-red-400 mt-3 text-center">{loginErro}</p>}
            <button onClick={onExit} className="w-full text-[10px] font-bold text-luxury-black/60 hover:text-luxury-black mt-4">
              ← Voltar à loja
            </button>
          </div>
        </div>
      );
    }

    // -------------------- Painel --------------------
    const coresStatus = ["#D4A853", "#6366F1", "#10B981", "#F59E0B", "#3B82F6", "#EF4444", "#8B5CF6", "#EC4899"];

    return (
      <div className="min-h-screen bg-ice text-luxury-black">
        <div className="max-w-6xl mx-auto min-h-screen bg-ice relative">
          <div className="sticky top-0 z-20 bg-white/5 border-b border-white/20 px-5 py-3 flex items-center justify-between backdrop-blur">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)]" />
              <div>
                <h1 className="text-sm font-bold leading-tight">Painel Admin</h1>
                <p className="text-[10px] text-gold-dark font-semibold">{total} pedidos no total</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-luxury-black bg-white/10 border border-white/20 rounded-full pl-2 pr-3 py-1">
                <span>👤</span>
                <span>Admin</span>
                <span className="text-[8px] opacity-60">▾</span>
              </div>
              <button onClick={() => setMostrarConfig((v) => !v)} className="text-[11px] font-bold text-gold-dark hover:text-gold flex items-center gap-1 border border-white/20 bg-white/5 rounded-full px-3 py-1" title="APIs">
                <span>⚙️</span><span className="hidden sm:inline">APIs</span>
              </button>
              <button onClick={sair} className="text-[11px] font-bold text-gray-400 hover:text-luxury-black flex items-center gap-1 border border-white/20 bg-white/5 rounded-full px-3 py-1" title="Sair">
                <span>🚪</span><span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          </div>

        <div className="flex gap-1 px-4 pt-3">
          {(["pedidos", "dashboard", "cupons", "fidelidade", "notificacoes", "relatorios", "logs"] as Aba[]).map((a) => (
            <button
              key={a}
              onClick={() => setAba(a)}
              className={`flex-1 h-9 rounded-xl text-[11px] font-bold transition-all border ${
                aba === a ? "bg-white text-black border-white" : "bg-white/5 text-gray-300 border-white/10 hover:border-white/20"
              }`}
            >
              {a === "pedidos" ? "Pedidos" : a === "dashboard" ? "Dashboard" : a === "cupons" ? "Cupons" : a === "fidelidade" ? "Fidelidade" : a === "notificacoes" ? "Notificações" : a === "relatorios" ? "Relatórios" : "Logs"}
            </button>
          ))}
        </div>

        <div className="p-4 space-y-3">
          {mostrarConfig && <ApiConfigPanel onClose={() => setMostrarConfig(false)} />}

          {aba === "dashboard" && <AdminDashboard token={token as string} />}
          {aba === "pedidos" && (
            <>
              {/* Filtros em card */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">🔍</span>
                    <input
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && carregar()}
                      placeholder="Buscar por nº, nome ou e-mail..."
                      className="w-full h-10 pl-9 pr-3 rounded-xl border border-white/10 bg-black/40 text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-gold"
                    />
                  </div>
                  <select
                    value={filtroStatus}
                    onChange={(e) => setFiltroStatus(e.target.value)}
                    className="h-10 px-3 rounded-xl border border-white/10 bg-black/40 text-white text-xs focus:outline-none focus:border-gold"
                  >
                    <option value="todos">Todos os status</option>
                    {situacoes.map((s) => (
                      <option key={s.id} value={s.nome}>{s.nome}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2 items-center flex-wrap">
                  <input
                    type="date"
                    value={filtroDataInicio}
                    onChange={(e) => setFiltroDataInicio(e.target.value)}
                    className="h-10 px-3 rounded-xl border border-white/10 bg-black/40 text-white text-xs"
                  />
                  <span className="text-[10px] text-white/50">até</span>
                  <input
                    type="date"
                    value={filtroDataFim}
                    onChange={(e) => setFiltroDataFim(e.target.value)}
                    className="h-10 px-3 rounded-xl border border-white/10 bg-black/40 text-white text-xs"
                  />
                  <button
                    onClick={exportarCSV}
                    className="ml-auto h-10 px-3 border border-gold/40 text-gold-dark text-[11px] font-bold rounded-xl active:scale-95 whitespace-nowrap bg-white/5"
                  >
                    📥 Exportar CSV
                  </button>
                </div>
              </div>

              {erro && (
                <div className="bg-amber-500/10 border border-amber-400/20 text-amber-200 rounded-2xl p-3 flex items-center justify-between gap-2">
                  <p className="text-[11px] flex-1">{erro}</p>
                  <button onClick={() => { setErro(null); carregar(); }} className="text-[10px] font-bold text-amber-100 border border-amber-300/30 rounded-lg px-2 py-1 active:scale-95 whitespace-nowrap">
                    Tentar de novo
                  </button>
                </div>
              )}

              {loading && (
                <div className="flex justify-center py-10">
                  <div className="w-7 h-7 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {!loading && pedidosFiltrados.length === 0 && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 py-10 text-center text-xs text-white/50">Nenhum pedido encontrado.</div>
              )}

              {!loading && pedidosFiltrados.length > 0 && (
                <div className="bg-white/5 border border-white/10 rounded-2xl shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-[9px] uppercase tracking-wide text-white/40 border-b border-white/10">
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
                          <tr key={p.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors">
                            <td className="p-3">
                              <input type="checkbox" className="accent-white" />
                            </td>
                            <td className="p-3">
                              <span className="text-xs font-bold text-white">#{p.numero}</span>
                              {p.verificado && <span className="ml-1 text-[9px] text-emerald-400 font-bold">• Verificado</span>}
                            </td>
                            <td className="p-3">
                              <p className="text-[11px] font-semibold text-white truncate max-w-[140px]">{p.cliente_nome}</p>
                              <p className="text-[9px] text-white/40 truncate max-w-[140px]">{p.cliente_email}</p>
                            </td>
                            <td className="p-3 text-[11px] text-white/70 whitespace-nowrap">{p.data}</td>
                            <td className="p-3">
                              <span className={`inline-block px-2 py-0.5 text-[9px] font-bold rounded-full border ${
                                p.status === "Entregue" ? "bg-emerald-400/10 text-emerald-300 border-emerald-400/20" :
                                p.status === "Em produção" ? "bg-indigo-400/10 text-indigo-300 border-indigo-400/20" :
                                "bg-white/5 text-gray-300 border-white/10"
                              }`}>{p.status}</span>
                            </td>
                            <td className="p-3 text-right text-xs font-bold text-white whitespace-nowrap">{formatPrice(p.total)}</td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => abrirDetalhe(p.id)}
                                className="w-8 h-8 rounded-xl bg-white/10 text-white text-[10px] font-bold active:scale-95 inline-flex items-center justify-center border border-white/10"
                                title="Ver"
                              >
                                👁️
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
                    <div className="flex items-center gap-2 text-[10px] text-white/40">
                      <button className="w-7 h-7 rounded-lg border border-white/10 flex items-center justify-center disabled:opacity-40" disabled>◀</button>
                      <span>Página 1 de 1</span>
                      <button className="w-7 h-7 rounded-lg border border-white/10 flex items-center justify-center disabled:opacity-40" disabled>▶</button>
                    </div>
                    <span className="text-[10px] text-white/40">Exibindo {pedidosFiltrados.length} de {total} pedidos</span>
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
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <p className="text-xs font-bold text-white mb-2">Faturamento por dia</p>
                <BarChart data={(relatorio?.serieDiaria || []).slice(-10)} color="#D4A853" />
              </div>
            </div>
          )}

          {aba === "cupons" && <CuponsAdmin />}

          {aba === "fidelidade" && <FidelidadeAdmin />}

          {aba === "notificacoes" && <NotificacoesAdmin />}

          {aba === "relatorios" && (
            <div className="space-y-3">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <p className="text-xs font-bold text-white mb-2">Origem (app vs site)</p>
                <div className="h-40">
                  <PieChart data={[
                    { label: "Site", value: relatorio?.porCanal.site || 0, color: "#6366F1" },
                    { label: "App", value: relatorio?.porCanal.app || 0, color: "#D4A853" },
                  ]} size={140} />
                </div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <p className="text-xs font-bold text-white mb-2">Clientes</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[9px] uppercase tracking-wide text-white/40 border-b border-white/10">
                        <th className="p-3 font-semibold">Cliente</th>
                        <th className="p-3 font-semibold text-right">Pedidos</th>
                        <th className="p-3 font-semibold text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientes.map((c) => (
                        <tr key={c.email} className="border-b border-white/5 last:border-0">
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
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3 space-y-2">
                <div className="flex gap-2 items-center flex-wrap">
                  <div className="flex-1 min-w-[180px]">
                    <input
                      value={logsFiltroEmail}
                      onChange={(e) => setLogsFiltroEmail(e.target.value)}
                      placeholder="E-mail do admin"
                      className="w-full h-10 px-3 rounded-xl border border-white/10 bg-black/40 text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-gold"
                    />
                  </div>
                  <div className="flex-1 min-w-[180px]">
                    <input
                      value={logsFiltroAcao}
                      onChange={(e) => setLogsFiltroAcao(e.target.value)}
                      placeholder="Ação"
                      className="w-full h-10 px-3 rounded-xl border border-white/10 bg-black/40 text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-gold"
                    />
                  </div>
                  <div>
                    <input
                      type="date"
                      value={logsDataInicio}
                      onChange={(e) => setLogsDataInicio(e.target.value)}
                      className="h-10 px-3 rounded-xl border border-white/10 bg-black/40 text-white text-xs"
                    />
                  </div>
                  <div>
                    <input
                      type="date"
                      value={logsDataFim}
                      onChange={(e) => setLogsDataFim(e.target.value)}
                      className="h-10 px-3 rounded-xl border border-white/10 bg-black/40 text-white text-xs"
                    />
                  </div>
                  <button onClick={carregarLogs} className="h-10 px-3 bg-white text-black text-[11px] font-bold rounded-xl active:scale-95 whitespace-nowrap">
                    Filtrar
                  </button>
                  <button onClick={exportarLogsCSV} className="h-10 px-3 border border-gold/40 text-gold-dark text-[11px] font-bold rounded-xl active:scale-95 whitespace-nowrap bg-white/5">
                    Exportar CSV
                  </button>
                </div>
              </div>

              {logsLoading && (
                <div className="flex justify-center py-10">
                  <div className="w-7 h-7 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {!logsLoading && logs.length === 0 && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center text-xs text-white/50">Nenhum log encontrado.</div>
              )}

              <div className="space-y-2">
                {logs.map((l) => (
                  <div key={l.id} className="bg-white/5 border border-white/10 rounded-2xl p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-bold text-white">{l.acao}</p>
                      <span className="text-[10px] text-white/40">{new Date(l.created_at).toLocaleString("pt-BR")}</span>
                    </div>
                    <p className="text-[10px] text-white/50 truncate">{l.admin_email} {l.ip ? `· ${l.ip}` : ""}</p>
                    <pre className="text-[10px] text-white/60 whitespace-pre-wrap break-words">{JSON.stringify(l.detalhe || {}, null, 2)}</pre>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {selecionado !== null && (
        <div className="fixed inset-0 z-40 bg-black/60 flex items-end justify-center" onClick={() => setSelecionado(null)}>
          <div
            className="w-full max-w-lg bg-[#0b0b0b] border border-white/10 rounded-t-3xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-[#0b0b0b]/90 px-5 py-3 flex items-center justify-between border-b border-white/10 backdrop-blur">
              <h3 className="text-sm font-bold text-white">Pedido #{detalhe?.numero ?? selecionado}</h3>
              <button onClick={() => setSelecionado(null)} className="text-gray-400 text-xl leading-none">×</button>
            </div>

            {detalheLoading && (
              <div className="flex justify-center py-10">
                <div className="w-7 h-7 border-2 border-gold border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {detalhe && (
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-bold text-white">{formatPrice(detalhe.total)}</p>
                    <p className="text-[10px] text-white/50">{detalhe.data} · {detalhe.items} itens · {detalhe.status}</p>
                  </div>
                  <button
                    onClick={alternarVerificado}
                    className={`px-3 py-2 rounded-xl text-[11px] font-bold active:scale-95 border ${
                      detalhe.verificado ? "bg-emerald-400/10 text-emerald-300 border-emerald-400/20" : "bg-white/5 text-gray-300 border-white/10"
                    }`}
                  >
                    {detalhe.verificado ? "✓ Verificado" : "Marcar verificado"}
                  </button>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <p className="text-xs font-bold text-white mb-2">Mudar status</p>
                  <div className="flex gap-2">
                    <select
                      value={statusSelecionado}
                      onChange={(e) => setStatusSelecionado(e.target.value)}
                      className="flex-1 h-10 px-3 rounded-xl border border-white/10 bg-black/40 text-white text-xs focus:outline-none focus:border-gold"
                    >
                      <option value="">Selecione...</option>
                      {situacoes.map((s) => (
                        <option key={s.id} value={String(s.id)}>{s.nome}</option>
                      ))}
                    </select>
                    <button
                      onClick={salvarStatus}
                      disabled={salvandoStatus || !statusSelecionado}
                      className="h-10 px-4 bg-white text-black text-[11px] font-bold rounded-xl disabled:opacity-50 active:scale-95"
                    >
                      {salvandoStatus ? "Salvando..." : "Salvar"}
                    </button>
                  </div>
                </div>

                <DetalhePedido id={detalhe.id} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal detalhe do cliente (A5) */}
      {clienteDetalhe && (
        <div className="fixed inset-0 z-40 bg-black/60 flex items-end justify-center" onClick={() => setClienteDetalhe(null)}>
          <div className="w-full max-w-lg bg-[#0b0b0b] border border-white/10 rounded-t-3xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-[#0b0b0b]/90 px-5 py-3 flex items-center justify-between border-b border-white/10 backdrop-blur">
              <h3 className="text-sm font-bold text-white">Cliente: {clienteDetalhe.email}</h3>
              <button onClick={() => setClienteDetalhe(null)} className="text-gray-400 text-xl leading-none">×</button>
            </div>

            {clienteDetalhe.loading && (
              <div className="flex justify-center py-10">
                <div className="w-7 h-7 border-2 border-gold border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {!clienteDetalhe.loading && clienteDetalhe.dados && (
              <div className="p-5 space-y-4">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
                  <p className="text-xs font-bold text-white">Satus</p>
                  <p className="text-[11px] text-white/70">{clienteDetalhe.dados.cliente?.status || "—"}</p>
                  <p className="text-xs font-bold text-white">Pedidos</p>
                  <p className="text-[11px] text-white/70">{(clienteDetalhe.dados.pedidos || []).length}</p>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
                  <p className="text-xs font-bold text-white">Fidelidade</p>
                  <p className="text-[11px] text-white/70">Pontos: {clienteDetalhe.dados.fidelidade?.pontos ?? "—"}</p>
                  <pre className="text-[10px] text-white/60 whitespace-pre-wrap break-words">{JSON.stringify(clienteDetalhe.dados.fidelidade?.historico || [], null, 2)}</pre>
                </div>

                <div className="space-y-2">
                  {(clienteDetalhe.dados.pedidos || []).map((p: any) => (
                    <div key={p.id || p.numero} className="bg-white/5 border border-white/10 rounded-2xl p-3 flex items-center justify-between text-[11px]">
                      <div>
                        <p className="font-semibold text-white">#{p.numero}</p>
                        <p className="text-white/50">{p.status}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-white">{formatPrice(Number(p.valor_total || p.total || 0))}</p>
                        <p className="text-white/40">{new Date(p.data_criacao || p.data).toLocaleDateString("pt-BR")}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {clienteDetalhe.erro && (
              <div className="p-5 text-xs text-red-300">{clienteDetalhe.erro}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** @todo mover para componentes/admin quando estabilizar */
function DetalhePedido({ id }: { id: number | string }) {
  const [raw, setRaw] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/admin/pedidos/${encodeURIComponent(String(id))}`);
        const j = await r.json();
        setRaw(j);
      } catch {
        setRaw(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <div className="text-[11px] text-white/50">Carregando detalhe...</div>;
  if (!raw) return <div className="text-[11px] text-red-300">Falha ao carregar detalhe.</div>;

  const itens = raw.itens || raw.items || [];
  const endereco = raw.endereco_entrega || raw.endereco || null;

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
      <div>
        <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Itens</p>
        <div className="space-y-1">
          {itens.map((it: any, i: number) => (
            <div key={i} className="flex items-center justify-between text-[11px]">
              <span className="text-white">{it.nome || it.produto || `Item ${i + 1}`}</span>
              <span className="text-white/60">x{it.quantidade || it.quantity || 1}</span>
            </div>
          ))}
          {itens.length === 0 && <p className="text-[11px] text-white/50">Sem itens.</p>}
        </div>
      </div>

      {endereco && (
        <div>
          <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Endereço</p>
          <p className="text-[11px] text-white/70">
            {endereco.logradouro || endereco.endereco || ""} {endereco.numero || ""} {endereco.complemento || ""}
            <br />
            {endereco.bairro || ""} {endereco.cidade || ""} {endereco.estado || ""} {endereco.cep || ""}
          </p>
        </div>
      )}

      {raw.note && (
        <div>
          <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Nota</p>
          <p className="text-[11px] text-white/70">{raw.note}</p>
        </div>
      )}
    </div>
  );
}
