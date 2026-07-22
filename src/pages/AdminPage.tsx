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
import CuponsAdmin from "./admin/CuponsAdmin";
import AdminDashboard from "./AdminDashboard";

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type Aba = "pedidos" | "dashboard" | "cupons" | "relatorios" | "logs";

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
      setPedidos((prev) =>
        prev.map((p) => (p.id === detalhe.id ? { ...p, verificado: novo } : p))
      );
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
        <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-sm">
          <div className="w-14 h-14 mx-auto rounded-full bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center shadow-lg shadow-gold/20 mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <h2 className="text-base font-bold text-luxury-black text-center">Painel do Administrador</h2>
          <p className="text-xs text-gray-500 mt-1 text-center">Acesso restrito — informe a senha de admin</p>

          <form className="mt-5 space-y-3" onSubmit={fazerLogin}>
            <input
              type="password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Senha de administrador"
              className="w-full h-12 px-4 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-gold"
            />
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full h-12 bg-luxury-black text-white text-xs font-bold rounded-2xl disabled:opacity-50 active:scale-[0.98] transition-all"
            >
              {loginLoading ? "Entrando..." : "Entrar"}
            </button>
          </form>

          {loginErro && <p className="text-[11px] text-red-500 mt-3 text-center">{loginErro}</p>}
          <button onClick={onExit} className="w-full text-[10px] font-bold text-gray-400 hover:text-luxury-black mt-4">
            ← Voltar à loja
          </button>
        </div>
      </div>
    );
  }

  // -------------------- Painel --------------------
  const coresStatus = ["#D4A853", "#6366F1", "#10B981", "#F59E0B", "#3B82F6", "#EF4444", "#8B5CF6", "#EC4899"];

  return (
    <div className="min-h-screen bg-ice">
      <div className="max-w-5xl mx-auto min-h-screen bg-ice relative">
        <div className="sticky top-0 z-20 bg-luxury-black text-white px-5 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-sm font-bold">Painel Admin</h1>
            <p className="text-[10px] text-gold-dark font-semibold">{total} pedidos no total</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setMostrarConfig((v) => !v)} className="text-[10px] font-bold text-gold-dark hover:text-gold">APIs</button>
            <button onClick={sair} className="text-[10px] font-bold text-gray-300 hover:text-white">Sair</button>
          </div>
        </div>

        <div className="flex gap-1 px-4 pt-3">
          {(["pedidos", "dashboard", "cupons", "relatorios", "logs"] as Aba[]).map((a) => (
            <button
              key={a}
              onClick={() => setAba(a)}
              className={`flex-1 h-9 rounded-xl text-[11px] font-bold transition-all ${
                aba === a ? "bg-luxury-black text-white" : "bg-white text-gray-500"
              }`}
            >
              {a === "pedidos" ? "Pedidos" : a === "dashboard" ? "Dashboard" : a === "cupons" ? "Cupons" : a === "relatorios" ? "Relatórios" : "Logs"}
            </button>
          ))}
        </div>

        <div className="p-4 space-y-3">
          {mostrarConfig && <ApiConfigPanel onClose={() => setMostrarConfig(false)} />}

          {aba === "dashboard" && <AdminDashboard token={token as string} />}
          {aba === "pedidos" && (
            <>
              <div className="flex gap-2">
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && carregar()}
                  placeholder="Buscar por nº ou e-mail"
                  className="flex-1 h-10 px-3 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-gold"
                />
                <button
                  onClick={carregar}
                  className="h-10 px-3 bg-luxury-black text-white text-[11px] font-bold rounded-xl active:scale-95"
                >
                  Buscar
                </button>
              </div>

              <div className="flex gap-2 items-center">
                <select
                  value={filtroStatus}
                  onChange={(e) => setFiltroStatus(e.target.value)}
                  className="flex-1 h-10 px-3 rounded-xl border border-gray-200 text-xs bg-white focus:outline-none focus:border-gold"
                >
                  <option value="todos">Todos os status</option>
                  {situacoes.map((s) => (
                    <option key={s.id} value={s.nome}>{s.nome}</option>
                  ))}
                </select>
                <input
                  type="date"
                  value={filtroDataInicio}
                  onChange={(e) => setFiltroDataInicio(e.target.value)}
                  className="h-10 px-3 rounded-xl border border-gray-200 text-xs bg-white"
                />
                <input
                  type="date"
                  value={filtroDataFim}
                  onChange={(e) => setFiltroDataFim(e.target.value)}
                  className="h-10 px-3 rounded-xl border border-gray-200 text-xs bg-white"
                />
                <button
                  onClick={exportarCSV}
                  className="h-10 px-3 border border-gold/40 text-gold-dark text-[11px] font-bold rounded-xl active:scale-95 whitespace-nowrap"
                >
                  Exportar CSV
                </button>
              </div>

              {erro && (
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3 flex items-center justify-between gap-2">
                  <p className="text-[11px] text-amber-700 flex-1">{erro}</p>
                  <button
                    onClick={() => { setErro(null); carregar(); }}
                    className="text-[10px] font-bold text-amber-800 border border-amber-200 rounded-lg px-2 py-1 active:scale-95 whitespace-nowrap"
                  >
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
                <div className="bg-white rounded-2xl p-6 py-10 shadow-sm text-center text-xs text-gray-400">Nenhum pedido encontrado.</div>
              )}

              <div className="space-y-2">
                {pedidosFiltrados.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => abrirDetalhe(p.id)}
                    className="w-full bg-white rounded-2xl p-3 shadow-sm hover:shadow-md transition-all text-left flex items-center gap-3"
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${p.verificado ? "bg-green-100" : "bg-gray-100"}`}>
                      {p.verificado ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /></svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-luxury-black">
                        #{p.numero} {p.verificado && <span className="text-[9px] text-green-600 font-bold">• Verificado</span>}
                      </p>
                      <p className="text-[10px] text-gray-500 truncate">{p.cliente_nome} · {p.cliente_email}</p>
                      <p className="text-[10px] text-gray-400">{p.data} · {p.items} {p.items === 1 ? "item" : "itens"}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-bold text-luxury-black">{formatPrice(p.total)}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 bg-ice text-gray-600 text-[9px] font-bold rounded-full">{p.status}</span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {aba === "cupons" && <CuponsAdmin />}
          {aba === "relatorios" && (
            <>
              {relLoading && (
                <div className="flex justify-center py-10">
                  <div className="w-7 h-7 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {relatorio && (
                <>
                  <p className="text-[11px] font-semibold text-luxury-black mb-2">Visão Geral</p>
                  <div className="grid grid-cols-2 gap-2">
                    <KpiCard label="Pedidos" value={String(relatorio.totalPedidos)} trend="up" delta="total" />
                    <KpiCard label="Ticket Médio" value={formatPrice(relatorio.ticketMedio)} accent="#D4A853" sub="por pedido" />
                    <KpiCard label="Faturamento" value={formatPrice(relatorio.faturamentoTotal)} accent="#10B981" trend="up" delta="bruto" />
                    <KpiCard label="Aprovado" value={formatPrice(relatorio.faturamentoAprovado)} accent="#6366F1" sub="confirmado" />
                  </div>

                  <div className="bg-white rounded-2xl p-4 shadow-sm">
                    <p className="text-[11px] font-semibold text-luxury-black mb-2">Faturamento por dia</p>
                    <BarChart
                      data={relatorio.serieDiaria.map((s) => ({ label: s.dia.slice(5), value: s.total }))}
                    />
                  </div>

                  <div className="bg-white rounded-2xl p-4 shadow-sm">
                    <p className="text-[11px] font-semibold text-luxury-black mb-2">Pedidos por status</p>
                    <PieChart
                      data={Object.entries(relatorio.porStatus).map(([k, v], i) => ({
                        label: k,
                        value: v,
                        color: coresStatus[i % coresStatus.length],
                      }))}
                    />
                  </div>

                  <div className="bg-white rounded-2xl p-4 shadow-sm">
                    <p className="text-[11px] font-semibold text-luxury-black mb-2">Origem (app vs site)</p>
                    <PieChart
                      data={[
                        { label: "Site", value: relatorio.porCanal.site, color: "#D4A853" },
                        { label: "App", value: relatorio.porCanal.app, color: "#3B82F6" },
                      ]}
                    />
                  </div>

                  <div className="bg-white rounded-2xl p-4 shadow-sm">
                    <p className="text-[11px] font-semibold text-luxury-black mb-2">
                      Clientes ({clientes.length}) — top gastadores
                    </p>
                    <div className="space-y-2">
                      {clientes.slice(0, 10).map((c, i) => (
                        <button
                          key={c.email}
                          onClick={() => abrirCliente(c.email)}
                          className="w-full flex items-center gap-2 text-[11px] text-left hover:bg-ice/60 rounded-xl p-1.5 transition-colors"
                        >
                          <span className="w-5 h-5 rounded-full bg-ice flex items-center justify-center text-[9px] font-bold text-gray-500 flex-shrink-0">
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-luxury-black truncate">{c.nome}</p>
                            <p className="text-[9px] text-gray-400 truncate">{c.email}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-bold text-luxury-black">{formatPrice(c.total)}</p>
                            <p className="text-[9px] text-gray-400">{c.pedidos} pedidos</p>
                          </div>
                        </button>
                      ))}
                      {clientes.length === 0 && <p className="text-[11px] text-gray-400">Sem clientes.</p>}
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {aba === "logs" && (
            <div className="space-y-3">
              <div className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
                <p className="text-[11px] font-semibold text-luxury-black">Logs de auditoria</p>
                <div className="flex gap-2">
                  <input
                    value={logsFiltroEmail}
                    onChange={(e) => setLogsFiltroEmail(e.target.value)}
                    placeholder="admin_email"
                    className="flex-1 h-10 px-3 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-gold"
                  />
                  <input
                    value={logsFiltroAcao}
                    onChange={(e) => setLogsFiltroAcao(e.target.value)}
                    placeholder="acao"
                    className="flex-1 h-10 px-3 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-gold"
                  />
                </div>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={logsDataInicio}
                    onChange={(e) => setLogsDataInicio(e.target.value)}
                    className="flex-1 h-10 px-3 rounded-xl border border-gray-200 text-xs bg-white"
                  />
                  <input
                    type="date"
                    value={logsDataFim}
                    onChange={(e) => setLogsDataFim(e.target.value)}
                    className="flex-1 h-10 px-3 rounded-xl border border-gray-200 text-xs bg-white"
                  />
                  <button
                    onClick={carregarLogs}
                    className="h-10 px-3 bg-luxury-black text-white text-[11px] font-bold rounded-xl active:scale-95 whitespace-nowrap"
                  >
                    Filtrar
                  </button>
                  <button
                    onClick={exportarLogsCSV}
                    className="h-10 px-3 border border-gold/40 text-gold-dark text-[11px] font-bold rounded-xl active:scale-95 whitespace-nowrap"
                  >
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
                <div className="bg-white rounded-2xl p-6 shadow-sm text-center text-xs text-gray-400">Nenhum log encontrado.</div>
              )}

              <div className="space-y-2">
                {logs.map((l) => (
                  <div key={l.id} className="bg-white rounded-2xl p-3 shadow-sm space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-bold text-luxury-black">{l.acao}</p>
                      <span className="text-[10px] text-gray-400">{new Date(l.created_at).toLocaleString("pt-BR")}</span>
                    </div>
                    <p className="text-[10px] text-gray-500 truncate">{l.admin_email} {l.ip ? `· ${l.ip}` : ""}</p>
                    <pre className="text-[10px] text-gray-600 whitespace-pre-wrap break-words">{JSON.stringify(l.detalhe || {}, null, 2)}</pre>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {selecionado !== null && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-end justify-center" onClick={() => setSelecionado(null)}>
          <div
            className="w-full max-w-lg bg-white rounded-t-3xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white px-5 py-3 flex items-center justify-between border-b border-gray-100">
              <h3 className="text-sm font-bold text-luxury-black">Pedido #{detalhe?.numero ?? selecionado}</h3>
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
                    <p className="text-lg font-bold text-luxury-black">{formatPrice(detalhe.total)}</p>
                    <p className="text-[10px] text-gray-400">{detalhe.data} · {detalhe.items} itens · {detalhe.status}</p>
                  </div>
                  <button
                    onClick={alternarVerificado}
                    className={`px-3 py-2 rounded-xl text-[11px] font-bold active:scale-95 ${detalhe.verificado ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}
                  >
                    {detalhe.verificado ? "✓ Verificado" : "Marcar verificado"}
                  </button>
                </div>

                <div className="bg-ice rounded-2xl p-3">
                  <p className="text-[11px] font-semibold text-luxury-black mb-2">Mudar status</p>
                  <div className="flex gap-2">
                    <select
                      value={statusSelecionado}
                      onChange={(e) => setStatusSelecionado(e.target.value)}
                      className="flex-1 h-10 px-3 rounded-xl border border-gray-200 text-xs bg-white focus:outline-none focus:border-gold"
                    >
                      <option value="">Selecione...</option>
                      {situacoes.map((s) => (
                        <option key={s.id} value={String(s.id)}>{s.nome}</option>
                      ))}
                    </select>
                    <button
                      onClick={salvarStatus}
                      disabled={salvandoStatus || !statusSelecionado}
                      className="h-10 px-4 bg-luxury-black text-white text-[11px] font-bold rounded-xl disabled:opacity-50 active:scale-95"
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
        <div className="fixed inset-0 z-40 bg-black/40 flex items-end justify-center" onClick={() => setClienteDetalhe(null)}>
          <div className="w-full max-w-lg bg-white rounded-t-3xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white px-5 py-3 flex items-center justify-between border-b border-gray-100">
              <h3 className="text-sm font-bold text-luxury-black">Detalhe do Cliente</h3>
              <button onClick={() => setClienteDetalhe(null)} className="text-gray-400 text-xl leading-none">×</button>
            </div>
            <div className="p-5 space-y-4">
              {clienteDetalhe.loading && (
                <div className="flex justify-center py-10">
                  <div className="w-7 h-7 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {clienteDetalhe.erro && <p className="text-[11px] text-red-500">{clienteDetalhe.erro}</p>}
              {clienteDetalhe.dados && (
                <>
                  <div className="bg-white border border-gray-100 rounded-2xl p-3">
                    <p className="text-[11px] font-semibold text-luxury-black mb-1">Dados</p>
                    <p className="text-[11px] text-gray-600">{clienteDetalhe.dados.cliente?.nome || "—"}</p>
                    <p className="text-[11px] text-gray-400">{clienteDetalhe.email}</p>
                    {clienteDetalhe.dados.cliente?.telefone && (
                      <p className="text-[11px] text-gray-400">{clienteDetalhe.dados.cliente.telefone}</p>
                    )}
                  </div>
                  <div className="bg-white border border-gray-100 rounded-2xl p-3">
                    <p className="text-[11px] font-semibold text-luxury-black mb-1">Fidelidade</p>
                    <p className="text-[11px] text-gray-600 font-bold text-gold">{clienteDetalhe.dados.fidelidade?.pontos ?? 0} pontos</p>
                  </div>
                  <div className="bg-white border border-gray-100 rounded-2xl p-3">
                    <p className="text-[11px] font-semibold text-luxury-black mb-2">Pedidos ({clienteDetalhe.dados.pedidos?.length ?? 0})</p>
                    <div className="space-y-2">
                      {(clienteDetalhe.dados.pedidos || []).slice(0, 10).map((p: any) => (
                        <div key={p.id} className="flex items-center justify-between gap-2 pb-2 border-b border-gray-50 last:border-0 last:pb-0">
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-medium text-luxury-black truncate">#{p.numero}</p>
                            <p className="text-[10px] text-gray-400">{p.situacao?.nome || p.status}</p>
                          </div>
                          <span className="text-[11px] font-bold text-luxury-black flex-shrink-0">
                            {formatPrice(Number(p.valor_total) || 0)}
                          </span>
                        </div>
                      ))}
                      {(clienteDetalhe.dados.pedidos || []).length === 0 && (
                        <p className="text-[11px] text-gray-400">Nenhum pedido.</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
function DetalhePedido({ id }: { id: number | string }) {
  const [pedido, setPedido] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    buscarPedidoAdmin(id)
      .then((p) => {
        if (!cancelado) setPedido(p);
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, [id]);

  if (loading) return <div className="text-center text-xs text-gray-400 py-4">Carregando detalhes...</div>;
  if (!pedido) return null;

  return (
    <div className="space-y-3">
      <div className="bg-white border border-gray-100 rounded-2xl p-3">
        <p className="text-[11px] font-semibold text-luxury-black mb-2">Itens do pedido</p>
        <div className="space-y-2">
          {(pedido.itens || []).map((i: any) => (
            <div key={i.id} className="flex items-center justify-between gap-2 pb-2 border-b border-gray-50 last:border-0 last:pb-0">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-luxury-black truncate">{i.nome}</p>
                <p className="text-[10px] text-gray-400">{i.quantidade}x · {formatPrice(Number(i.preco_venda) || 0)}</p>
              </div>
              <span className="text-[11px] font-bold text-luxury-black flex-shrink-0">
                {formatPrice((Number(i.quantidade) || 0) * (Number(i.preco_venda) || 0))}
              </span>
            </div>
          ))}
        </div>
      </div>

      {pedido.cliente_nome && (
        <div className="bg-white border border-gray-100 rounded-2xl p-3">
          <p className="text-[11px] font-semibold text-luxury-black mb-1">Cliente</p>
          <p className="text-[11px] text-gray-600">{pedido.cliente_nome}</p>
          <p className="text-[11px] text-gray-400">{pedido.cliente_email}</p>
        </div>
      )}

      {(pedido.pagamentos || []).length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-3">
          <p className="text-[11px] font-semibold text-luxury-black mb-1">Pagamento</p>
          {(pedido.pagamentos || []).map((pg: any, idx: number) => (
            <p key={idx} className="text-[11px] text-gray-600">
              {pg.forma_pagamento?.nome} · {formatPrice(Number(pg.valor) || 0)}
            </p>
          ))}
        </div>
      )}

      {(pedido.envios || []).length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-3">
          <p className="text-[11px] font-semibold text-luxury-black mb-1">Envio</p>
          {(pedido.envios || []).map((ev: any, idx: number) => (
            <p key={idx} className="text-[11px] text-gray-600">
              {ev.forma_envio?.nome} · prazo {ev.prazo}d{ev.objeto ? ` · rastreio ${ev.objeto}` : ""}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Painel de configuração das APIs (Loja Integrada + Mercado Pago).
// ---------------------------------------------------------------------------
function ApiConfigPanel({ onClose }: { onClose: () => void }) {
  const [liApp, setLiApp] = useState("");
  const [liApi, setLiApi] = useState("");
  const [mpToken, setMpToken] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const salvar = async () => {
    setSalvando(true);
    setErro(null);
    setMsg(null);
    try {
      await saveApiConfig({
        ...(liApp ? { LI_APP_KEY: liApp } : {}),
        ...(liApi ? { LI_API_KEY: liApi } : {}),
        ...(mpToken ? { MP_ACCESS_TOKEN: mpToken } : {}),
      });
      setMsg("Chaves salvas com sucesso.");
      setLiApp(""); setLiApi(""); setMpToken("");
    } catch (e: any) {
      setErro(e.message || "Falha ao salvar.");
    } finally {
      setSalvando(false);
    }
  };

  const field = (label: string, value: string, set: (v: string) => void, ph: string) => (
    <div>
      <p className="text-[11px] font-semibold text-luxury-black mb-1">{label}</p>
      <input
        type="password"
        value={value}
        onChange={(e) => set(e.target.value)}
        placeholder={ph}
        className="w-full h-11 px-3 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-gold"
      />
    </div>
  );

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-luxury-black">Configurar APIs</h3>
        <button onClick={onClose} className="text-gray-400 text-lg leading-none">×</button>
      </div>
      <p className="text-[10px] text-gray-400">Cole as chaves das integrações. Elas ficam guardadas com segurança e nunca expostas no app.</p>

      {field("Loja Integrada — Chave de Aplicação", liApp, setLiApp, "APP_KEY da Loja Integrada")}
      {field("Loja Integrada — Chave de API", liApi, setLiApi, "API_KEY da Loja Integrada")}
      {field("Mercado Pago — Access Token", mpToken, setMpToken, "Access Token do Mercado Pago")}

      <button
        onClick={salvar}
        disabled={salvando}
        className="w-full h-11 bg-luxury-black text-white text-xs font-bold rounded-xl disabled:opacity-50 active:scale-95"
      >
        {salvando ? "Salvando..." : "Salvar chaves"}
      </button>

      {msg && <p className="text-[11px] text-green-600">{msg}</p>}
      {erro && <p className="text-[11px] text-red-500">{erro}</p>}
    </div>
  );
}
