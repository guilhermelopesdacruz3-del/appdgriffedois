import { useCallback, useEffect, useState } from "react";
import { formatPrice } from "../utils";
import {
  adminLogin,
  adminLogout,
  buscarPedidoAdmin,
  clearAdminToken,
  getAdminToken,
  listarClientesAdmin,
  listarPedidosAdmin,
  listarSituacoes,
  pedidoParaCSV,
  relatorioAdmin,
  atualizarStatusPedido,
  type AdminPedido,
  type ClienteRelatorio,
  type RelatorioAdmin,
  type SituacaoPedido,
} from "../services/admin";
import { BarChart, PieChart } from "../components/admin/AdminCharts";
import { ApiConfigPanel } from "../components/admin/ApiConfigPanel";
import CuponsAdmin from "./admin/CuponsAdmin";
import FidelidadeAdmin from "./admin/FidelidadeAdmin";
import NotificacoesAdmin from "./admin/NotificacoesAdmin";
import AdminDashboard from "./AdminDashboard";
import PedidoDetalhe from "./admin/PedidoDetalhe";

type Aba = "pedidos" | "dashboard" | "cupons" | "fidelidade" | "notificacoes" | "relatorios" | "logs";

const ABAS: { id: Aba; label: string; grupo: string }[] = [
  { id: "dashboard", label: "Dashboard", grupo: "VISÃO GERAL" },
  { id: "pedidos", label: "Pedidos", grupo: "COMERCIAL" },
  { id: "cupons", label: "Cupons", grupo: "COMERCIAL" },
  { id: "fidelidade", label: "Fidelidade", grupo: "RELACIONAMENTO" },
  { id: "notificacoes", label: "Notificações", grupo: "RELACIONAMENTO" },
  { id: "relatorios", label: "Relatórios", grupo: "OPERACIONAL" },
  { id: "logs", label: "Logs", grupo: "OPERACIONAL" },
];

const GRUPOS = ["VISÃO GERAL", "COMERCIAL", "RELACIONAMENTO", "OPERACIONAL"];

export default function AdminPage({ onExit }: { onExit: () => void }) {
  const [token, setToken] = useState<string | null>(() => getAdminToken());
  const [senha, setSenha] = useState("");
  const [loginErro, setLoginErro] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  const [aba, setAba] = useState<Aba>("dashboard");
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
        headers: { Authorization: autorizacao },
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
    setPedidoSelecionado(null);
    setRelatorio(null);
    setClientes([]);
    setLogs([]);
  };

  const [pedidoSelecionado, setPedidoSelecionado] = useState<AdminPedido | null>(null);

  const abrirDetalhePedido = async (p: AdminPedido) => {
    // Busca o detalhe completo (com itens, endereço, rastreio) antes de abrir o modal
    try {
      const detalheCompleto = await buscarPedidoAdmin(p.id);
      setPedidoSelecionado({
        ...p,
        itens: (detalheCompleto.itens || []).map((it: any) => ({
          nome: it.nome || "",
          quantidade: Number(it.quantidade) || 0,
          preco_venda: Number(it.preco_venda) || 0,
          sku: it.sku || "",
          variacao: it.variacao || null,
        })),
        pagamento: detalheCompleto.pagamentos?.[0]?.forma_pagamento?.nome || null,
        pagamento_status: detalheCompleto.pagamentos?.[0]?.status || null,
        envio: detalheCompleto.envios?.[0]?.forma_envio?.nome || null,
        envio_status: detalheCompleto.envios?.[0]?.status || null,
        envio_rastreio: detalheCompleto.envios?.[0]?.objeto || null,
        endereco_entrega: detalheCompleto.endereco_entrega
          ? `${detalheCompleto.endereco_entrega.endereco || ""}, ${detalheCompleto.endereco_entrega.numero || ""} — ${detalheCompleto.endereco_entrega.bairro || ""}, ${detalheCompleto.endereco_entrega.cidade || ""}/${detalheCompleto.endereco_entrega.estado || ""} ${detalheCompleto.endereco_entrega.cep || ""}`.trim()
          : null,
        observacoes: (detalheCompleto as any).cliente_obs || null,
        forma_entrega: detalheCompleto.endereco_entrega && !/d'griffe/i.test(detalheCompleto.endereco_entrega.nome || "") ? "entrega" : "retirada",
      });
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  const handleStatusChange = async (novoStatus: string) => {
    if (!pedidoSelecionado) return;
    const atualizado = (await atualizarStatusPedido(pedidoSelecionado.id, novoStatus)) as any;
    // Atualiza a lista com o novo status
    setPedidos((prev) =>
      prev.map((ped) =>
        ped.id === pedidoSelecionado.id
          ? { ...ped, status: atualizado?.situacao?.nome || ped.status, status_id: atualizado?.situacao?.id || ped.status_id }
          : ped
      )
    );
    return atualizado;
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

  // Tela de login
  if (!token) {
    return (
      <div className="min-h-screen bg-[#F7F8FC] flex items-center justify-center px-6">
        <div className="w-full max-w-sm bg-white border border-slate-200 rounded-3xl p-8 shadow-lg shadow-slate-200/50">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-violet-600 to-purple-500 flex items-center justify-center shadow-lg shadow-violet-500/30 mb-5">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-800 text-center">Painel Admin</h2>
          <p className="text-xs text-slate-400 mt-1 text-center">Acesso restrito — informe a senha</p>
          <form className="mt-6 space-y-3" onSubmit={fazerLogin}>
            <div className="relative">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
              <input
                type="password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Senha de administrador"
                className="w-full h-12 pl-10 pr-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm placeholder:text-slate-400 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
              />
            </div>
            <button type="submit" disabled={loginLoading} className="w-full h-12 bg-gradient-to-r from-violet-600 to-purple-500 text-white text-sm font-bold rounded-xl disabled:opacity-50 active:scale-[0.98] transition-all shadow-lg shadow-violet-500/20 hover:brightness-110">
              {loginLoading ? "Entrando..." : "Entrar"}
            </button>
          </form>
          {loginErro && <p className="text-[11px] text-red-500 mt-3 text-center">{loginErro}</p>}
          <button onClick={onExit} className="w-full text-[10px] font-bold text-slate-400 hover:text-slate-600 mt-4 transition-colors">← Voltar à loja</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F8FC] flex">
      {/* SIDEBAR */}
      <aside className="w-[285px] bg-[#0F172A] text-white flex flex-col fixed inset-y-0 left-0 z-30">
        {/* Logo */}
        <div className="p-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-purple-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-tight">Painel Admin</p>
              <p className="text-[10px] text-violet-400 font-semibold">D'GRIFFE ÓTICA</p>
            </div>
          </div>
        </div>

        {/* Navegação */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-4">
          {GRUPOS.map((grupo) => (
            <div key={grupo}>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1.5 px-2">{grupo}</p>
              <div className="space-y-0.5">
                {ABAS.filter((a) => a.grupo === grupo).map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setAba(a.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[11px] font-semibold transition-all ${
                      aba === a.id
                        ? "bg-violet-600/20 text-violet-300 border border-violet-500/30"
                        : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer sidebar */}
        <div className="p-4 border-t border-white/5 space-y-2">
          <div className="flex items-center gap-2 text-[10px] text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Sistema conectado
          </div>
          <button onClick={onExit} className="text-[10px] font-bold text-slate-500 hover:text-white transition-colors">
            ← Voltar à loja
          </button>
        </div>
      </aside>

      {/* ÁREA PRINCIPAL */}
      <div className="flex-1 ml-[285px] flex flex-col min-h-screen">
        {/* HEADER */}
        <header className="sticky top-0 z-20 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-800 leading-tight">Dashboard</h1>
            <p className="text-[11px] text-slate-400">{total} pedidos no total</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setMostrarApi((v) => !v)} className={`h-9 px-4 rounded-xl border text-[11px] font-bold active:scale-95 transition-all flex items-center gap-1.5 ${mostrarApi ? "bg-violet-600 text-white border-violet-600" : "border-violet-200 bg-violet-50 text-violet-600 hover:bg-violet-100"}`}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 6V4m0 16v-2m6-6h2M4 12h2m10.5-4.5l1.5-1.5M6 18l1.5-1.5M16.5 16.5L18 18M6 6l1.5 1.5" /><circle cx="12" cy="12" r="3" /></svg>
              APIs
            </button>
            <button onClick={sair} className="h-9 px-4 rounded-xl border border-slate-200 text-slate-600 text-[11px] font-bold hover:bg-slate-50 active:scale-95 transition-all flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>
              Sair
            </button>
          </div>
        </header>

        {/* CONTEÚDO */}
        <main className="flex-1 p-6 space-y-4">
          {mostrarApi && <ApiConfigPanel onClose={() => setMostrarApi(false)} />}

          {aba === "dashboard" && (
            <AdminDashboard
              token={token as string}
              onAbrirPedido={(id) => {
                const p = pedidos.find((ped) => ped.id === id);
                if (p) abrirDetalhePedido(p);
              }}
              onIrPedidos={() => setAba("pedidos")}
              onIrCupons={() => setAba("cupons")}
              onAbrirApis={() => setMostrarApi(true)}
            />
          )}

          {aba === "pedidos" && (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                    <input value={busca} onChange={(e) => setBusca(e.target.value)} onKeyDown={(e) => e.key === "Enter" && carregarPedidos()} placeholder="Buscar por nº, nome ou e-mail..." className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-xs placeholder:text-slate-400 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all" />
                  </div>
                  <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-xs focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all">
                    <option value="todos">Todos os status</option>
                    {situacoes.map((s) => (<option key={s.id} value={s.nome}>{s.nome}</option>))}
                  </select>
                </div>
                <div className="flex gap-2 items-center flex-wrap">
                  <input type="date" value={filtroDataInicio} onChange={(e) => setFiltroDataInicio(e.target.value)} className="h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-xs focus:outline-none focus:border-violet-500" />
                  <span className="text-[10px] text-slate-400">até</span>
                  <input type="date" value={filtroDataFim} onChange={(e) => setFiltroDataFim(e.target.value)} className="h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-xs focus:outline-none focus:border-violet-500" />
                  <button onClick={() => { const blob = new Blob([pedidoParaCSV(pedidosFiltrados)], { type: "text/csv;charset=utf-8;" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "pedidos-dgriffe.csv"; a.click(); URL.revokeObjectURL(url); }} className="ml-auto h-10 px-3 border border-violet-200 text-violet-600 text-[11px] font-bold rounded-xl active:scale-95 whitespace-nowrap bg-violet-50 hover:bg-violet-100 transition-all">📥 Exportar CSV</button>
                </div>
              </div>

              {erro && (
                <div className="bg-red-50 border border-red-200 text-red-600 rounded-2xl p-3 flex items-center justify-between gap-2">
                  <p className="text-[11px] flex-1">{erro}</p>
                  <button onClick={() => { setErro(null); void carregarPedidos(); }} className="text-[10px] font-bold text-red-600 border border-red-300 rounded-lg px-2 py-1 active:scale-95 whitespace-nowrap">Tentar de novo</button>
                </div>
              )}

              {carregandoPedidos && (<div className="flex justify-center py-10"><div className="w-7 h-7 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>)}

              {!carregandoPedidos && pedidosFiltrados.length === 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-sm">
                  <svg className="mx-auto mb-3 text-slate-300" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 01-8 0" /></svg>
                  <p className="text-xs text-slate-400">Nenhum pedido encontrado.</p>
                </div>
              )}

              {!carregandoPedidos && pedidosFiltrados.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-[9px] uppercase tracking-wide text-slate-400 border-b border-slate-100 bg-slate-50">
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
                          <tr key={p.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                            <td className="p-3"><input type="checkbox" className="accent-violet-500" /></td>
                            <td className="p-3">
                              <span className="text-xs font-bold text-slate-800">#{p.numero}</span>
                              {p.verificado && <span className="ml-1.5 text-[9px] text-emerald-600 font-bold bg-emerald-50 border border-emerald-200 rounded-full px-1.5 py-0.5">✓ Verificado</span>}
                            </td>
                            <td className="p-3">
                              <p className="text-[11px] font-semibold text-slate-800 truncate max-w-[140px]">{p.cliente_nome}</p>
                              <p className="text-[9px] text-slate-400 truncate max-w-[140px]">{p.cliente_email}</p>
                            </td>
                            <td className="p-3 text-[11px] text-slate-600 whitespace-nowrap">{p.data}</td>
                            <td className="p-3">
                              <span className={`inline-block px-2 py-0.5 text-[9px] font-bold rounded-full border ${p.status === "Entregue" ? "bg-emerald-50 text-emerald-600 border-emerald-200" : p.status === "Em produção" ? "bg-violet-50 text-violet-600 border-violet-200" : "bg-slate-50 text-slate-500 border-slate-200"}`}>{p.status}</span>
                            </td>
                            <td className="p-3 text-right text-xs font-bold text-slate-800 whitespace-nowrap">{formatPrice(p.total)}</td>
                            <td className="p-3 text-right">
                              <button onClick={() => abrirDetalhePedido(p)} className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 hover:bg-violet-100 text-[10px] font-bold active:scale-95 inline-flex items-center justify-center border border-violet-200 transition-all" title="Ver detalhes">
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
            </div>
          )}

          {/* Modal de detalhes do pedido */}
          {pedidoSelecionado && (
            <PedidoDetalhe
              pedido={pedidoSelecionado}
              onClose={() => setPedidoSelecionado(null)}
              onStatusChange={handleStatusChange}
            />
          )}

          {aba === "cupons" && <CuponsAdmin />}
          {aba === "fidelidade" && <FidelidadeAdmin />}
          {aba === "notificacoes" && <NotificacoesAdmin />}

          {aba === "relatorios" && (
            <div className="space-y-4">
              {/* KPIs */}
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                  <p className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">Faturamento Total</p>
                  <p className="text-2xl font-bold text-slate-800 mt-1">{relatorio ? formatPrice(relatorio.faturamentoTotal) : "—"}</p>
                  <p className="text-[9px] text-slate-400 mt-0.5">{relatorio?.totalPedidos ?? 0} pedidos</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                  <p className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">Faturamento Aprovado</p>
                  <p className="text-2xl font-bold text-emerald-600 mt-1">{relatorio ? formatPrice(relatorio.faturamentoAprovado) : "—"}</p>
                  <p className="text-[9px] text-slate-400 mt-0.5">aprovados</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                  <p className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">Ticket Médio</p>
                  <p className="text-2xl font-bold text-violet-600 mt-1">{relatorio ? formatPrice(relatorio.ticketMedio) : "—"}</p>
                  <p className="text-[9px] text-slate-400 mt-0.5">por pedido</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                  <p className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">Clientes</p>
                  <p className="text-2xl font-bold text-slate-800 mt-1">{clientes.length}</p>
                  <p className="text-[9px] text-slate-400 mt-0.5">cadastrados</p>
                </div>
              </div>

              {/* Gráfico de faturamento por dia */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <p className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-2"><span className="w-1 h-3.5 rounded-full bg-violet-600 inline-block" />Faturamento por dia</p>
                <div className="h-48">
                  <BarChart data={(relatorio?.serieDiaria || []).slice(-14).map((d: any) => ({ label: d.dia, value: d.total }))} />
                </div>
              </div>

              {/* Pedidos por status */}
              {relatorio?.porStatus && Object.keys(relatorio.porStatus).length > 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                  <p className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-2"><span className="w-1 h-3.5 rounded-full bg-violet-600 inline-block" />Pedidos por status</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.entries(relatorio.porStatus).map(([status, count]) => (
                      <div key={status} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                        <span className="text-[11px] font-semibold text-slate-600">{status}</span>
                        <span className="text-xs font-bold text-violet-600">{count as number}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Origem (app vs site) */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <p className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-2"><span className="w-1 h-3.5 rounded-full bg-violet-600 inline-block" />Origem (app vs site)</p>
                <div className="h-40">
                  <PieChart data={[{ label: "Site", value: relatorio?.porCanal.site || 0, color: "#6366F1" }, { label: "App", value: relatorio?.porCanal.app || 0, color: "#7C3AED" }]} size={140} />
                </div>
              </div>

              {/* Clientes */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <p className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-2"><span className="w-1 h-3.5 rounded-full bg-violet-600 inline-block" />Clientes</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[9px] uppercase tracking-wide text-slate-400 border-b border-slate-100 bg-slate-50">
                        <th className="p-3 font-semibold">Cliente</th>
                        <th className="p-3 font-semibold text-right">Pedidos</th>
                        <th className="p-3 font-semibold text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientes.map((c) => (
                        <tr key={c.email} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                          <td className="p-3">
                            <p className="text-xs font-semibold text-slate-800">{c.nome}</p>
                            <p className="text-[9px] text-slate-400">{c.email}</p>
                          </td>
                          <td className="p-3 text-right text-[11px] text-slate-600">{c.pedidos ?? 0}</td>
                          <td className="p-3 text-right text-xs font-bold text-slate-800 whitespace-nowrap">{formatPrice(Number(c.total || 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {aba === "logs" && (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex gap-2 items-center flex-wrap">
                  <div className="flex-1 min-w-[180px]">
                    <input value={logsFiltroEmail} onChange={(e) => setLogsFiltroEmail(e.target.value)} placeholder="E-mail do admin" className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-xs placeholder:text-slate-400 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all" />
                  </div>
                  <div className="flex-1 min-w-[180px]">
                    <input value={logsFiltroAcao} onChange={(e) => setLogsFiltroAcao(e.target.value)} placeholder="Ação" className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-xs placeholder:text-slate-400 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all" />
                  </div>
                  <div>
                    <input type="date" value={logsDataInicio} onChange={(e) => setLogsDataInicio(e.target.value)} className="h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-xs focus:outline-none focus:border-violet-500" />
                  </div>
                  <div>
                    <input type="date" value={logsDataFim} onChange={(e) => setLogsDataFim(e.target.value)} className="h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-xs focus:outline-none focus:border-violet-500" />
                  </div>
                  <button onClick={carregarLogs} className="h-10 px-4 bg-gradient-to-r from-violet-600 to-purple-500 text-white text-[11px] font-bold rounded-xl active:scale-95 whitespace-nowrap transition-all hover:brightness-110">Filtrar</button>
                  <button onClick={exportarLogsCSV} className="h-10 px-3 border border-violet-200 text-violet-600 text-[11px] font-bold rounded-xl active:scale-95 whitespace-nowrap bg-violet-50 hover:bg-violet-100 transition-all">Exportar CSV</button>
                </div>
              </div>

              {logsLoading && (<div className="flex justify-center py-10"><div className="w-7 h-7 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>)}

              {!logsLoading && logs.length === 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-sm">
                  <svg className="mx-auto mb-3 text-slate-300" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4h16v16H4z" /><path d="M8 9h8M8 13h8M8 17h5" /></svg>
                  <p className="text-xs text-slate-400">Nenhum log encontrado.</p>
                </div>
              )}

              <div className="space-y-2">
                {logs.map((l: any) => (
                  <div key={l.id} className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-1.5 hover:border-violet-200 transition-colors shadow-sm">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-bold text-slate-800">{l.acao}</p>
                      <span className="text-[9px] text-slate-400">{l.created_at}</span>
                    </div>
                    <p className="text-[10px] text-slate-500">{l.admin_email} — {l.detalhe}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
