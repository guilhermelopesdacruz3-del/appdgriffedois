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
import { PieChart } from "../components/admin/AdminCharts";
import { StatusBadge, ehHoje } from "../components/admin/statusBadge";
import { ApiConfigPanel } from "../components/admin/ApiConfigPanel";
import CuponsAdmin from "./admin/CuponsAdmin";
import FidelidadeAdmin from "./admin/FidelidadeAdmin";
import NotificacoesAdmin from "./admin/NotificacoesAdmin";
import ReceitasAdmin from "./admin/ReceitasAdmin";
import AdminDashboard from "./AdminDashboard";

type Aba = "pedidos" | "dashboard" | "cupons" | "fidelidade" | "notificacoes" | "relatorios" | "logs" | "receitas" | "configuracoes";

const ICONES: Record<string, React.ReactNode> = {
  dashboard: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  pedidos: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" /><path d="M3.27 6.96L12 12.01l8.73-5.05" /><path d="M12 22.08V12" />
    </svg>
  ),
  cupons: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.83z" /><line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  ),
  fidelidade: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" /><line x1="12" y1="22" x2="12" y2="7" /><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" />
    </svg>
  ),
  notificacoes: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  ),
  relatorios: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  ),
  logs: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" /><path d="M16 13H8" /><path d="M16 17H8" />
    </svg>
  ),
  receitas: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" />
    </svg>
  ),
  configuracoes: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  ),
};

const NAV_ITENS: { id: Aba; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "pedidos", label: "Pedidos" },
  { id: "cupons", label: "Cupons" },
  { id: "fidelidade", label: "Fidelidade" },
  { id: "notificacoes", label: "Notificações" },
  { id: "relatorios", label: "Relatórios" },
  { id: "logs", label: "Logs" },
  { id: "receitas", label: "Receitas" },
  { id: "configuracoes", label: "Configurações" },
];

const GRUPOS_NAV: { titulo: string; itens: { id: Aba; label: string }[] }[] = [
  { titulo: "Visão Geral", itens: [{ id: "dashboard", label: "Dashboard" }] },
  {
    titulo: "Comercial",
    itens: [
      { id: "pedidos", label: "Pedidos" },
      { id: "cupons", label: "Cupons" },
      { id: "relatorios", label: "Relatórios" },
    ],
  },
  {
    titulo: "Relacionamento",
    itens: [
      { id: "fidelidade", label: "Fidelidade" },
      { id: "notificacoes", label: "Notificações" },
    ],
  },
  {
    titulo: "Operacional",
    itens: [
      { id: "receitas", label: "Receitas" },
      { id: "logs", label: "Logs" },
      { id: "configuracoes", label: "Configurações" },
    ],
  },
];

const LOJAS = ["D'Griffe Ótica", "Loja em desenvolvimento"];

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
  const [lojaAtiva, setLojaAtiva] = useState(LOJAS[0]);
  const [gruposAbertos, setGruposAbertos] = useState<Record<string, boolean>>({});

  const [selecionado, setSelecionado] = useState<number | string | null>(null);
  const [detalhe, setDetalhe] = useState<AdminPedido | null>(null);
  const [detalheLoading, setDetalheLoading] = useState(false);
  const [salvandoStatus, setSalvandoStatus] = useState(false);
  const [statusSelecionado, setStatusSelecionado] = useState("");
  const [statusSalvo, setStatusSalvo] = useState(false);
  const [historialCliente, setHistorialCliente] = useState<AdminPedido[]>([]);
  const [carregandoHistorial, setCarregandoHistorial] = useState(false);

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
    // Atualização em tempo real: recarrega a lista de pedidos a cada 15s
    // enquanto a tela estiver aberta (sem interferir em filtros/edição).
    const timer = setInterval(() => {
      carregarPedidos();
    }, 15000);
    return () => clearInterval(timer);
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
    setCarregandoHistorial(true);
    try {
      const p = await buscarPedidoAdmin(id);
      const mapeado: AdminPedido = {
        id: (p as any).id_api ?? p.id,
        numero: p.numero,
        cliente_nome: p.cliente_nome,
        cliente_email: p.cliente_email,
        cliente_cpf: p.cliente_cpf ?? null,
        cliente_telefone: p.cliente_telefone ?? null,
        cliente_endereco: p.cliente_endereco ?? null,
        status: p.situacao?.nome || "—",
        status_id: p.situacao?.id,
        status_uri: p.situacao?.resource_uri,
        data: new Date(p.data_criacao).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }),
        total: Number(p.valor_total) || 0,
        items: (p.itens || []).reduce((s, i) => s + (i.quantidade || 0), 0),
        itens: (p.itens || []).map((it: any) => ({
          nome: it.nome || "",
          quantidade: Number(it.quantidade) || 0,
          preco_venda: Number(it.preco_venda) || 0,
          sku: it.sku || "",
          variacao: it.variacao || null,
        })),
        pagamento: p.pagamentos?.[0]?.forma_pagamento?.nome ?? null,
        pagamento_status: p.pagamentos?.[0]?.status ?? null,
        pagamento_detalhes: p.pagamentos?.[0]
          ? [
              p.pagamentos[0].valor ? `R$ ${Number(p.pagamentos[0].valor).toFixed(2)}` : null,
              p.pagamentos[0].parcelamento_numero_parcelas ? `${p.pagamentos[0].parcelamento_numero_parcelas}x` : null,
              p.pagamentos[0].bandeira ?? null,
            ].filter(Boolean).join(" · ")
          : null,
        envio: p.envios?.[0]?.forma_envio?.nome ?? null,
        envio_status: p.envios?.[0]?.status ?? null,
        envio_rastreio: p.envios?.[0]?.objeto ?? null,
        endereco_entrega: p.endereco_entrega
          ? `${p.endereco_entrega.endereco}, ${p.endereco_entrega.numero} — ${p.endereco_entrega.bairro}, ${p.endereco_entrega.cidade}/${p.endereco_entrega.estado} ${p.endereco_entrega.cep}`
          : null,
        observacoes: (p as any).cliente_obs || null,
        forma_entrega:
          p.endereco_entrega && !/d'griffe/i.test(String(p.endereco_entrega.nome || ""))
            ? "entrega"
            : "retirada",
        verificado: Boolean((p as any).verificado),
        verificado_em: (p as any).verificado_em || null,
      };
      setDetalhe(mapeado);
      setStatusSelecionado(String((p.situacao?.id ?? "") as any));
      // Fetch customer order history
      if (p.cliente_email) {
        const hist = await listarPedidosAdmin({ cliente_email: p.cliente_email, limit: 10 });
        setHistorialCliente(hist.pedidos);
      } else {
        setHistorialCliente([]);
      }
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setDetalheLoading(false);
      setCarregandoHistorial(false);
    }
  };

  const salvarStatus = async () => {
    if (!detalhe || !statusSelecionado) return;
    setSalvandoStatus(true);
    setStatusSalvo(false);
    try {
      const sit = situacoes.find((s) => String(s.id) === statusSelecionado);
      await atualizarStatusPedido(detalhe.id, sit?.resource_uri || sit?.id || statusSelecionado);
      await carregarPedidos();
      setDetalhe({ ...detalhe, status: sit?.nome || detalhe.status, status_id: sit?.id, status_uri: sit?.resource_uri });
      setStatusSalvo(true);
      setTimeout(() => setStatusSalvo(false), 1800);
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-violet-50 flex items-center justify-center px-6 relative overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-violet-200/40 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-purple-200/40 blur-3xl pointer-events-none" />
        <div className="w-full max-w-sm bg-white border border-slate-200 rounded-[2rem] p-7 shadow-xl shadow-slate-900/5 relative">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-violet-600 to-purple-500 flex items-center justify-center shadow-lg shadow-violet-500/30 mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <h2 className="text-base font-bold text-slate-800 text-center">Painel Admin</h2>
          <p className="text-xs text-slate-500 mt-1 text-center">Acesso restrito — informe a senha</p>
          <form className="mt-5 space-y-3" onSubmit={fazerLogin}>
            <div className="relative">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-violet-500" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
              <input
                type="password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Senha de administrador"
                className="w-full h-12 pl-10 pr-4 rounded-2xl border border-slate-300 bg-white text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
              />
            </div>
            <button type="submit" disabled={loginLoading} className="w-full h-12 bg-gradient-to-r from-violet-600 to-purple-500 text-white text-xs font-bold rounded-2xl disabled:opacity-50 active:scale-[0.98] transition-all shadow-lg shadow-violet-500/20 hover:brightness-110">
              {loginLoading ? "Entrando..." : "Entrar"}
            </button>
          </form>
          {loginErro && <p className="text-[11px] text-red-600 mt-3 text-center">{loginErro}</p>}
          <button onClick={onExit} className="w-full text-[10px] font-bold text-slate-400 hover:text-slate-600 mt-4 transition-colors">← Voltar à loja</button>
        </div>
      </div>
    );
  }

return (
    <div className="min-h-screen bg-slate-50 text-slate-800 md:flex">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 w-64 bg-slate-900 border-r border-slate-800 z-30">
        <div className="px-5 pt-6 pb-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-bold leading-tight text-white">Painel Admin</h1>
              <p className="text-[9px] font-bold text-violet-400 uppercase tracking-widest">D'Griffe Ótica</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
          {GRUPOS_NAV.map((g) => {
            const aberto = gruposAbertos[g.titulo] ?? g.itens.some((i) => i.id === aba);
            return (
              <div key={g.titulo}>
                <button
                  onClick={() => setGruposAbertos((prev) => ({ ...prev, [g.titulo]: !aberto }))}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <span>{g.titulo}</span>
                  <svg
                    width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    className={`transition-transform duration-200 ${aberto ? "rotate-180" : ""}`}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {aberto && (
                  <div className="mt-1 space-y-0.5">
                    {g.itens.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => setAba(n.id)}
                        className={`w-full flex items-center gap-3 pl-3 pr-2 h-10 rounded-lg text-[11px] font-semibold transition-all border-l-2 ${
                          aba === n.id
                            ? "bg-violet-500/15 text-white border-l-violet-400"
                            : "text-slate-400 hover:text-white hover:bg-white/5 border-l-transparent"
                        }`}
                      >
                        <span className="flex-shrink-0">{ICONES[n.id]}</span>
                        <span className="flex-1 text-left">{n.label}</span>
                        {n.id === "pedidos" && total > 0 && (
                          <span className={`text-[9px] font-bold rounded-full px-1.5 py-0.5 ${aba === n.id ? "bg-violet-500/25 text-violet-200" : "bg-white/10 text-slate-400"}`}>
                            {total}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <div className="px-5 py-4 border-t border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-[10px] text-slate-400">
            <span className="relative flex w-2 h-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
              <span className="relative inline-flex rounded-full w-2 h-2 bg-emerald-400" />
            </span>
            Sistema conectado
          </div>
          <button onClick={onExit} className="w-full text-[10px] font-bold text-violet-400 hover:text-violet-300 transition-colors text-left">
            ← Voltar à loja
          </button>
        </div>
      </aside>

      <div className="flex-1 md:ml-60 min-h-screen relative">
        <div className="absolute -top-28 -right-28 w-96 h-96 rounded-full bg-violet-600/[0.07] blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 -left-24 w-72 h-72 rounded-full bg-violet-50 blur-3xl pointer-events-none" />

        <div className="relative">
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-lg border-b border-slate-200 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="md:hidden w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-purple-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold leading-tight text-slate-800 flex items-center gap-2">
                {NAV_ITENS.find((n) => n.id === aba)?.label}
                <span className="md:hidden text-[9px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 border border-violet-300 uppercase tracking-wider">D'Griffe</span>
              </h2>
              <p className="text-[10px] text-slate-500 font-semibold">{total} pedidos no total</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative hidden sm:block">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-violet-500" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><path d="M9 22V12h6v10" /></svg>
              <select value={lojaAtiva} onChange={(e) => setLojaAtiva(e.target.value)} className="h-9 pl-8 pr-8 rounded-full border border-slate-200 bg-white text-[11px] font-bold text-slate-600 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20 transition-all appearance-none cursor-pointer">
                {LOJAS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
              <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
            </div>
            <button onClick={() => setMostrarApi((v) => !v)} className={`text-[11px] font-bold flex items-center gap-1.5 rounded-full px-3 py-1.5 border transition-all ${mostrarApi ? "bg-violet-600 text-white border-violet-500" : "text-amber-600 border-violet-300 bg-slate-50 hover:bg-slate-200"}`} title="APIs">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 6V4m0 16v-2m6-6h2M4 12h2m10.5-4.5l1.5-1.5M6 18l1.5-1.5M16.5 16.5L18 18M6 6l1.5 1.5" /><circle cx="12" cy="12" r="3" /></svg>
              <span className="hidden sm:inline">APIs</span>
            </button>
            <button onClick={sair} className="text-[11px] font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1.5 border border-slate-300 bg-slate-50 hover:bg-slate-200 rounded-full px-3 py-1.5 transition-all" title="Sair">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </header>

        <div className="md:hidden sticky top-[57px] z-10 bg-white/95 backdrop-blur-lg px-4 pt-2 pb-2">
          <div className="flex gap-1 p-1 rounded-2xl bg-slate-100 border border-slate-200 overflow-x-auto no-scrollbar">
            {NAV_ITENS.map((a) => (
              <button key={a.id} onClick={() => setAba(a.id)} className={`flex-1 min-w-[72px] h-9 rounded-xl text-[10px] font-bold transition-all whitespace-nowrap items-center gap-1.5 inline-flex justify-center ${aba === a.id ? "bg-gradient-to-r from-violet-600 to-purple-500 text-white shadow-lg shadow-violet-500/20" : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"}`}>
                <span className="flex-shrink-0">{ICONES[a.id]}</span>
                {a.label}
              </button>
            ))}
          </div>
        </div>

        <main className="p-4 md:p-6 space-y-3 max-w-6xl mx-auto">
          {mostrarApi && <ApiConfigPanel onClose={() => setMostrarApi(false)} />}

          {aba === "dashboard" && (
            <AdminDashboard
              token={token as string}
              onAbrirPedido={abrirDetalhe}
              onAbrirApis={() => setMostrarApi(true)}
              onIrPedidos={(status) => {
                setFiltroStatus(status ?? "todos");
                setAba("pedidos");
              }}
              onIrCupons={() => setAba("cupons")}
            />
          )}

          {aba === "pedidos" && (
            <>
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 space-y-3">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-violet-600/60" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                    <input value={busca} onChange={(e) => setBusca(e.target.value)} onKeyDown={(e) => e.key === "Enter" && carregarPedidos()} placeholder="Buscar por nº, nome ou e-mail..." className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs placeholder:text-slate-400 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all" />
                  </div>
                  <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="h-10 px-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all">
                    <option value="todos">Todos os status</option>
                    {situacoes.map((s) => (<option key={s.id} value={s.nome}>{s.nome}</option>))}
                  </select>
                </div>
                <div className="flex gap-2 items-center flex-wrap">
                  <input type="date" value={filtroDataInicio} onChange={(e) => setFiltroDataInicio(e.target.value)} className="h-10 px-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs focus:outline-none focus:border-violet-500" />
                  <span className="text-[10px] text-slate-400">até</span>
                  <input type="date" value={filtroDataFim} onChange={(e) => setFiltroDataFim(e.target.value)} className="h-10 px-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs focus:outline-none focus:border-violet-500" />
                  <button onClick={() => void carregarPedidos()} title="Recarregar" className="ml-auto h-10 w-10 border border-violet-300 text-violet-600 rounded-xl active:scale-95 bg-violet-50 hover:bg-violet-100 transition-all flex items-center justify-center">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 11-2.64-6.36" /><path d="M21 3v6h-6" /></svg>
                  </button>
                  <button onClick={() => { const blob = new Blob([pedidoParaCSV(pedidosFiltrados)], { type: "text/csv;charset=utf-8;" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "pedidos-dgriffe.csv"; a.click(); URL.revokeObjectURL(url); }} className="h-10 px-3 border border-violet-300 text-violet-600 text-[11px] font-bold rounded-xl active:scale-95 whitespace-nowrap bg-violet-50 hover:bg-violet-100 transition-all">📥 Exportar CSV</button>
                </div>

                <div className="flex gap-1.5 overflow-x-auto pb-0.5 pt-1">
                  <button onClick={() => setFiltroStatus("todos")} className={`px-2.5 h-7 rounded-full text-[10px] font-bold border whitespace-nowrap transition-all active:scale-95 ${filtroStatus === "todos" ? "bg-gradient-to-r from-violet-600 to-purple-500 text-white border-violet-500 shadow shadow-violet-500/20" : "border-slate-300 bg-slate-50 text-slate-800/70 hover:border-violet-300 hover:text-slate-800"}`}>
                    Todos · {total}
                  </button>
                  {situacoes.map((s) => {
                    const n = relatorio?.porStatus?.[s.nome] ?? 0;
                    if (!n) return null;
                    return (
                      <button key={s.id} onClick={() => setFiltroStatus(s.nome)} className={`px-2.5 h-7 rounded-full text-[10px] font-bold border whitespace-nowrap transition-all active:scale-95 ${filtroStatus === s.nome ? "bg-gradient-to-r from-violet-600 to-purple-500 text-white border-violet-500 shadow shadow-violet-500/20" : "border-slate-300 bg-slate-50 text-slate-800/70 hover:border-violet-300 hover:text-slate-800"}`}>
                        {s.nome} · {n}
                      </button>
                    );
                  })}
                </div>
              </div>

              {erro && (
                <div className="bg-amber-500/10 border border-amber-400/25 text-amber-600 rounded-2xl p-3 flex items-center justify-between gap-2">
                  <p className="text-[11px] flex-1">{erro}</p>
                  <button onClick={() => { setErro(null); void carregarPedidos(); }} className="text-[10px] font-bold text-amber-100 border border-amber-300/30 rounded-lg px-2 py-1 active:scale-95 whitespace-nowrap">Tentar de novo</button>
                </div>
              )}

              {carregandoPedidos && (<div className="flex justify-center py-10"><div className="w-7 h-7 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>)}

              {!carregandoPedidos && pedidosFiltrados.length === 0 && (
                <div className="bg-white/60 border border-dashed border-slate-300 rounded-2xl p-10 text-center">
                  <svg className="mx-auto mb-3 text-slate-800/20" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 01-8 0" /></svg>
                  <p className="text-xs text-slate-400">Nenhum pedido encontrado.</p>
                </div>
              )}

              {!carregandoPedidos && pedidosFiltrados.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm shadow-lg shadow-black/20 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-[9px] uppercase tracking-wide text-violet-600/70 border-b border-slate-200 bg-slate-50">
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
                          <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-violet-50 transition-colors">
                            <td className="p-3 w-8">{ehHoje(p.data) && <span className="inline-block w-2 h-2 rounded-full bg-violet-600" title="Pedido de hoje" />}</td>
                            <td className="p-3">
                              <span className="text-xs font-bold text-slate-800">#{p.numero}</span>
                              {ehHoje(p.data) && <span className="ml-1.5 text-[9px] text-violet-600 font-bold bg-violet-50 border border-violet-300 rounded-full px-1.5 py-0.5">Hoje</span>}
                              {p.verificado && <span className="ml-1.5 text-[9px] text-emerald-600 font-bold bg-emerald-50 border border-emerald-200 rounded-full px-1.5 py-0.5">✓ Verificado</span>}
                            </td>
                            <td className="p-3">
                              <p className="text-[11px] font-semibold text-slate-800 truncate max-w-[140px]">{p.cliente_nome}</p>
                              <p className="text-[9px] text-slate-400 truncate max-w-[140px]">{p.cliente_email}</p>
                            </td>
                            <td className="p-3 text-[11px] text-slate-800/70 whitespace-nowrap">{p.data}</td>
                            <td className="p-3">
                              <StatusBadge status={p.status} />
                            </td>
                            <td className="p-3 text-right text-xs font-bold text-slate-800 whitespace-nowrap">{formatPrice(p.total)}</td>
                            <td className="p-3 text-right">
                              <button onClick={() => abrirDetalhe(p.id)} className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 hover:bg-violet-100 text-[10px] font-bold active:scale-95 inline-flex items-center justify-center border border-violet-300 transition-all" title="Ver">
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

          {aba === "cupons" && <CuponsAdmin />}
          {aba === "fidelidade" && <FidelidadeAdmin />}
          {aba === "notificacoes" && <NotificacoesAdmin />}

          {aba === "relatorios" && (
            <div className="space-y-3">
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
                <p className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-2"><span className="w-1 h-3.5 rounded-full bg-violet-600 inline-block" />Origem (app vs site)</p>
                <div className="h-40">
                  <PieChart data={[{ label: "Site", value: relatorio?.porCanal.site || 0, color: "#6366F1" }, { label: "App", value: relatorio?.porCanal.app || 0, color: "#D4A853" }]} size={140} />
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
                <p className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-2"><span className="w-1 h-3.5 rounded-full bg-violet-600 inline-block" />Clientes</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[9px] uppercase tracking-wide text-violet-600/70 border-b border-slate-200 bg-slate-50">
                        <th className="p-3 font-semibold">Cliente</th>
                        <th className="p-3 font-semibold text-right">Pedidos</th>
                        <th className="p-3 font-semibold text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientes.map((c) => (
                        <tr key={c.email} className="border-b border-slate-100 last:border-0 hover:bg-violet-50 transition-colors">
                          <td className="p-3">
                            <p className="text-xs font-semibold text-slate-800">{c.nome}</p>
                            <p className="text-[9px] text-slate-400">{c.email}</p>
                          </td>
                          <td className="p-3 text-right text-[11px] text-slate-800/70">{c.pedidos ?? 0}</td>
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
            <div className="space-y-3">
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-3 space-y-2">
                <div className="flex gap-2 items-center flex-wrap">
                  <div className="flex-1 min-w-[180px]">
                    <input value={logsFiltroEmail} onChange={(e) => setLogsFiltroEmail(e.target.value)} placeholder="E-mail do admin" className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs placeholder:text-slate-400 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all" />
                  </div>
                  <div className="flex-1 min-w-[180px]">
                    <input value={logsFiltroAcao} onChange={(e) => setLogsFiltroAcao(e.target.value)} placeholder="Ação" className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs placeholder:text-slate-400 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all" />
                  </div>
                  <div>
                    <input type="date" value={logsDataInicio} onChange={(e) => setLogsDataInicio(e.target.value)} className="h-10 px-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs focus:outline-none focus:border-violet-500" />
                  </div>
                  <div>
                    <input type="date" value={logsDataFim} onChange={(e) => setLogsDataFim(e.target.value)} className="h-10 px-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs focus:outline-none focus:border-violet-500" />
                  </div>
                  <button onClick={carregarLogs} className="h-10 px-4 bg-gradient-to-r from-violet-600 to-purple-500 text-white text-[11px] font-bold rounded-xl active:scale-95 whitespace-nowrap transition-all hover:brightness-110">Filtrar</button>
                  <button onClick={exportarLogsCSV} className="h-10 px-3 border border-violet-300 text-violet-600 text-[11px] font-bold rounded-xl active:scale-95 whitespace-nowrap bg-violet-50 hover:bg-violet-100 transition-all">Exportar CSV</button>
                </div>
              </div>

              {logsLoading && (<div className="flex justify-center py-10"><div className="w-7 h-7 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>)}

              {!logsLoading && logs.length === 0 && (
                <div className="bg-white/60 border border-dashed border-slate-300 rounded-2xl p-10 text-center">
                  <svg className="mx-auto mb-3 text-slate-800/20" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4h16v16H4z" /><path d="M8 9h8M8 13h8M8 17h5" /></svg>
                  <p className="text-xs text-slate-400">Nenhum log encontrado.</p>
                </div>
              )}

              <div className="space-y-2">
                {logs.map((l: any) => (
                  <div key={l.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-3.5 space-y-1.5 hover:border-violet-200 transition-colors">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-bold text-slate-800 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-violet-600 inline-block" />{l.acao}</p>
                      <span className="text-[10px] text-slate-400">{new Date(l.created_at).toLocaleString("pt-BR")}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 truncate">{l.admin_email} {l.ip ? `· ${l.ip}` : ""}</p>
                    <pre className="text-[10px] text-slate-500 whitespace-pre-wrap break-words bg-slate-100 rounded-xl p-2.5">{JSON.stringify(l.detalhe || {}, null, 2)}</pre>
                  </div>
                ))}
              </div>
             </div>
           )}

           {aba === "configuracoes" && (
  <div className="space-y-3">
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
      <p className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-2"><span className="w-1 h-3.5 rounded-full bg-violet-600 inline-block" />Status das Integrações</p>
      <div className="space-y-2">
        {[
          { label: "Loja Integrada", ok: !!process.env.LOJA_INTEGRADA_API_KEY, desc: "API key configurada" },
          { label: "Mercado Pago", ok: !!process.env.MP_ACCESS_TOKEN, desc: "Access token configurado" },
          { label: "Supabase", ok: !!process.env.SUPABASE_SERVICE_ROLE, desc: "Service role configurada" },
        ].map((s) => (
          <div key={s.label} className="flex items-center justify-between text-xs">
            <span className="text-slate-800/70">{s.label}</span>
            <span className={`font-bold ${s.ok ? "text-emerald-600" : "text-red-600"}`}>{s.ok ? "✓ OK" : "✗ Ausente"}</span>
          </div>
        ))}
      </div>
    </div>
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
      <p className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-2"><span className="w-1 h-3.5 rounded-full bg-violet-600 inline-block" />Configurações da Loja</p>
      <div className="space-y-2 text-xs text-slate-500">
        <p>Frontend: {process.env.FRONTEND_ORIGIN || "—"}</p>
        <p>Modo: {process.env.DEMO_MODE === "true" ? "Demo" : "Produção"}</p>
        <p>Porta: {process.env.PORT || "8787"}</p>
      </div>
    </div>
  </div>
)}

{aba === "receitas" && <ReceitasAdmin />}
          </main>
        </div>
      </div>

      {selecionado !== null && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-end justify-center" onClick={() => setSelecionado(null)}>
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-t-3xl max-h-[90vh] overflow-y-auto shadow-2xl shadow-black/60" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white/95 px-5 py-3.5 flex items-center justify-between border-b border-slate-200 backdrop-blur">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                Pedido #{detalhe?.numero ?? selecionado}
                {detalhe && <StatusBadge status={detalhe.status} />}
                {detalhe?.verificado && <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">✓ Verificado</span>}
              </h3>
              <button onClick={() => setSelecionado(null)} className="text-slate-500 hover:text-slate-800 text-xl leading-none w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-200 transition-colors">×</button>
            </div>

            {detalheLoading && (<div className="flex justify-center py-10"><div className="w-7 h-7 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>)}

            {detalhe && (
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-violet-600">{formatPrice(detalhe.total)}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{detalhe.data} · {detalhe.items} itens · {detalhe.status}</p>
                  </div>
                  <button onClick={alternarVerificado} className={`px-3 py-2 rounded-xl text-[11px] font-bold active:scale-95 border transition-all ${detalhe.verificado ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-slate-50 text-slate-500 border-slate-300 hover:bg-slate-200"}`}>
                    {detalhe.verificado ? "✓ Verificado" : "Marcar verificado"}
                  </button>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 space-y-1">
                  <p className="text-[10px] text-violet-600/70 uppercase tracking-wider font-bold">Cliente</p>
                  <p className="text-sm font-semibold text-slate-800">{detalhe.cliente_nome}</p>
                  <p className="text-xs text-slate-500">{detalhe.cliente_email}</p>
                  {detalhe.cliente_cpf && <p className="text-[11px] text-slate-400">CPF: {detalhe.cliente_cpf}</p>}
                  {detalhe.cliente_telefone && <p className="text-[11px] text-slate-400">Tel: {detalhe.cliente_telefone}</p>}
                  {detalhe.cliente_endereco && <p className="text-[11px] text-slate-400">{detalhe.cliente_endereco}</p>}
                  <div className="flex gap-1.5 pt-1.5">
                    {(() => {
                      const tel = (detalhe.cliente_telefone || "").replace(/\D/g, "");
                      const msg = encodeURIComponent(
                        `Olá ${detalhe.cliente_nome || ""}! Sobre o seu pedido #${detalhe.numero} (${formatPrice(detalhe.total)}) — D'Griffe.`
                      );
                      return (
                        <>
                          {tel.length >= 10 && (
                            <a href={`https://wa.me/55${tel}?text=${msg}`} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-xl text-[10px] font-bold border border-emerald-400/30 bg-emerald-50 text-emerald-600 hover:bg-emerald-400/20 active:scale-95 transition-all flex items-center gap-1.5">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm5.4 14.1c-.2.7-1.3 1.3-1.9 1.4-.5.1-1.1.2-3.4-.7-2.9-1.2-4.7-4.1-4.9-4.3-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5s.8 1.9.8 2c.1.1.1.3 0 .5-.1.2-.2.3-.3.5l-.5.5c-.1.1-.2.3-.1.5.1.2.6 1 1.3 1.6.9.8 1.7 1.1 2 1.2.2.1.4.1.5-.1l.8-.9c.2-.2.3-.2.6-.1l1.9.9c.2.1.4.2.4.3.1.1.1.6-.1 1.2z" /></svg>
                              WhatsApp
                            </a>
                          )}
                          {tel.length >= 10 && (
                            <a href={`tel:+55${tel}`} className="px-3 py-1.5 rounded-xl text-[10px] font-bold border border-sky-200 bg-sky-50 text-sky-600 hover:bg-sky-400/20 active:scale-95 transition-all flex items-center gap-1.5">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0122 16.92z" /></svg>
                              Ligar
                            </a>
                          )}
                          <button
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(detalhe.cliente_email || "");
                                setErro(null);
                              } catch { /* clipboard indisponível */ }
                            }}
                            className="px-3 py-1.5 rounded-xl text-[10px] font-bold border border-slate-300 bg-slate-50 text-slate-800/70 hover:bg-slate-200 active:scale-95 transition-all flex items-center gap-1.5"
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
                            Copiar e-mail
                          </button>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {detalhe.itens && detalhe.itens.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 space-y-2">
                    <p className="text-[10px] text-violet-600/70 uppercase tracking-wider font-bold">Especificações do Pedido</p>
                    <div className="space-y-1.5">
                      {detalhe.itens.map((it, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs">
                          <div className="flex-1 min-w-0">
                            <p className="text-slate-800/90 font-medium truncate">{it.nome}</p>
                            <p className="text-[10px] text-slate-400">SKU: {it.sku}{it.variacao ? ` · ${it.variacao}` : ""}</p>
                          </div>
                          <div className="flex items-center gap-3 text-right">
                            <span className="text-[10px] text-slate-400">x{it.quantidade}</span>
                            <span className="text-slate-800 font-semibold text-xs">{formatPrice(Number(it.preco_venda))}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between text-xs">
                      <span className="text-slate-400">Subtotal</span>
                      <span className="text-slate-800 font-bold">{formatPrice(detalhe.total)}</span>
                    </div>
                  </div>
                )}

                {(detalhe.pagamento || detalhe.envio || detalhe.endereco_entrega || detalhe.observacoes) && (
                  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 space-y-1.5">
                    <p className="text-[10px] text-violet-600/70 uppercase tracking-wider font-bold">Entrega & Pagamento</p>
                    {detalhe.forma_entrega && <p className="text-xs text-slate-800/70">📦 {detalhe.forma_entrega === "entrega" ? "Entrega no endereço" : "Retirada na loja"}</p>}
                    {detalhe.endereco_entrega && <p className="text-[10px] text-slate-400">📍 {detalhe.endereco_entrega}</p>}
                    {detalhe.pagamento && <p className="text-xs text-slate-800/70">💳 {detalhe.pagamento}</p>}
                    {detalhe.pagamento_status && <p className="text-[10px] text-slate-400">Status: {detalhe.pagamento_status}</p>}
                    {detalhe.pagamento_detalhes && <p className="text-[10px] text-slate-400">{detalhe.pagamento_detalhes}</p>}
                    {detalhe.envio && <p className="text-xs text-slate-800/70">🚚 {detalhe.envio}</p>}
                    {detalhe.envio_status && <p className="text-[10px] text-slate-400">Status: {detalhe.envio_status}</p>}
                    {detalhe.envio_rastreio && <p className="text-[10px] text-violet-600/60">Rastreio: {detalhe.envio_rastreio}</p>}
                    {detalhe.observacoes && (
                      <div className="bg-violet-50 border border-violet-200 rounded-xl p-2.5 mt-1">
                        <p className="text-[9px] text-violet-600/70 uppercase tracking-wider font-bold mb-0.5">Observações do cliente</p>
                        <p className="text-[11px] text-amber-700 whitespace-pre-wrap break-words">{detalhe.observacoes}</p>
                      </div>
                    )}
                  </div>
                )}

                {detalhe.itens && detalhe.itens.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 space-y-2">
                    <p className="text-[10px] text-violet-600/70 uppercase tracking-wider font-bold">Estoque dos Produtos</p>
                    <div className="space-y-1.5">
                      {detalhe.itens.map((it, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs">
                          <div className="flex-1 min-w-0">
                            <p className="text-slate-800/90 font-medium truncate">{it.nome}</p>
                            <p className="text-[10px] text-slate-400">SKU: {it.sku}</p>
                          </div>
                          <span className="text-[10px] text-slate-400">x{it.quantidade}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {detalhe.cliente_email && (
                  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 space-y-2">
                    <p className="text-[10px] text-violet-600/70 uppercase tracking-wider font-bold">Histórico do Cliente</p>
                    {carregandoHistorial ? (
                      <div className="flex justify-center py-4"><div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>
                    ) : historialCliente.length === 0 ? (
                      <p className="text-[10px] text-slate-400">Nenhum pedido encontrado.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {historialCliente.map((hp) => (
                          <div key={hp.id} className="flex items-center justify-between text-xs border-b border-slate-100 pb-1.5">
                            <div>
                              <p className="text-slate-800/90 font-medium">#{hp.numero}</p>
                              <p className="text-[10px] text-slate-400">{hp.data}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-slate-800 font-semibold">{formatPrice(hp.total)}</p>
                              <p className="text-[10px] text-slate-400">{hp.status}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 space-y-2.5">
                  <p className="text-[10px] text-violet-600/70 uppercase tracking-wider font-bold">Atualizar status</p>
                  <select value={statusSelecionado} onChange={(e) => setStatusSelecionado(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs focus:outline-none focus:border-violet-500">
                    {situacoes.map((s) => <option key={s.id} value={String(s.id)}>{s.nome}</option>)}
                  </select>
                  <button onClick={salvarStatus} disabled={salvandoStatus} className={`w-full h-12 text-white text-xs font-bold rounded-2xl disabled:opacity-50 active:scale-[0.98] transition-all shadow-lg hover:brightness-110 ${statusSalvo ? "bg-emerald-400 shadow-emerald-400/20" : "bg-gradient-to-r from-violet-600 to-purple-500 shadow-violet-500/20"}`}>
                    {salvandoStatus ? "Salvando..." : statusSalvo ? "✓ Status salvo" : "Salvar status"}
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
