import { useCallback, useEffect, useState } from "react";
import { formatPrice } from "../utils";
import {
  adminLogin,
  atualizarStatusPedido,
  buscarPedidoAdmin,
  clearAdminToken,
  definirVerificadoPedido,
  getAdminToken,
  listarPedidosAdmin,
  listarSituacoes,
  pedidoParaCSV,
  type AdminPedido,
  type SituacaoPedido,
} from "../services/admin";
import { saveApiConfig } from "../services/apiConfig";

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminPage({ onExit }: { onExit: () => void }) {
  const [token, setToken] = useState<string | null>(() => getAdminToken());
  const [senha, setSenha] = useState("");
  const [loginErro, setLoginErro] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  const [pedidos, setPedidos] = useState<AdminPedido[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [situacoes, setSituacoes] = useState<SituacaoPedido[]>([]);
  const [mostrarConfig, setMostrarConfig] = useState(false);

  const [selecionado, setSelecionado] = useState<number | string | null>(null);
  const [detalhe, setDetalhe] = useState<AdminPedido | null>(null);
  const [detalheLoading, setDetalheLoading] = useState(false);
  const [salvandoStatus, setSalvandoStatus] = useState(false);
  const [statusSelecionado, setStatusSelecionado] = useState<string>("");

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const termo = busca.trim();
      const resultado = await listarPedidosAdmin({
        limit: 100,
        offset: 0,
        ...(termo.includes("@")
          ? { cliente_email: termo }
          : termo
          ? { numero: termo }
          : {}),
      });
      setPedidos(resultado.pedidos);
      setTotal(resultado.total);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [busca]);

  const carregarSituacoes = useCallback(async () => {
    try {
      setSituacoes(await listarSituacoes());
    } catch {
      /* ignora */
    }
  }, []);

  useEffect(() => {
    if (token) {
      carregar();
      carregarSituacoes();
    }
  }, [token, carregar, carregarSituacoes]);

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

  const sair = () => {
    clearAdminToken();
    setToken(null);
    setPedidos([]);
    setSelecionado(null);
    setDetalhe(null);
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

  const pedidosFiltrados = pedidos.filter((p) =>
    filtroStatus === "todos" ? true : p.status === filtroStatus
  );

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
  return (
    <div className="min-h-screen bg-ice">
      <div className="max-w-lg mx-auto min-h-screen bg-ice relative">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-luxury-black text-white px-5 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-sm font-bold">Painel Admin</h1>
            <p className="text-[10px] text-gray-400">{total} pedidos no total</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setMostrarConfig((v) => !v)} className="text-[10px] font-bold text-gold-dark hover:text-gold">APIs</button>
            <button onClick={sair} className="text-[10px] font-bold text-gray-300 hover:text-white">
              Sair
            </button>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {mostrarConfig && <ApiConfigPanel onClose={() => setMostrarConfig(false)} />}

          {/* Toolbar */}
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
                <option key={s.id} value={s.nome}>
                  {s.nome}
                </option>
              ))}
            </select>
            <button
              onClick={exportarCSV}
              className="h-10 px-3 border border-gold/40 text-gold-dark text-[11px] font-bold rounded-xl active:scale-95 whitespace-nowrap"
            >
              Exportar CSV
            </button>
          </div>

          {erro && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-3 text-center text-[11px] text-red-500">
              {erro}
            </div>
          )}

          {loading && (
            <div className="flex justify-center py-10">
              <div className="w-7 h-7 border-2 border-gold border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading && pedidosFiltrados.length === 0 && (
            <div className="bg-white rounded-2xl p-6 shadow-sm text-center text-xs text-gray-400">
              Nenhum pedido encontrado.
            </div>
          )}

          {/* Lista */}
          <div className="space-y-2">
            {pedidosFiltrados.map((p) => (
              <button
                key={p.id}
                onClick={() => abrirDetalhe(p.id)}
                className="w-full bg-white rounded-2xl p-3 shadow-sm hover:shadow-md transition-all text-left flex items-center gap-3"
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                    p.verificado ? "bg-green-100" : "bg-gray-100"
                  }`}
                >
                  {p.verificado ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="9" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-luxury-black">
                    #{p.numero} {p.verificado && <span className="text-[9px] text-green-600 font-bold">• Verificado</span>}
                  </p>
                  <p className="text-[10px] text-gray-500 truncate">
                    {p.cliente_nome} · {p.cliente_email}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {p.data} · {p.items} {p.items === 1 ? "item" : "itens"}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-bold text-luxury-black">
                    {formatPrice(p.total)}
                  </p>
                  <span className="inline-block mt-1 px-2 py-0.5 bg-ice text-gray-600 text-[9px] font-bold rounded-full">
                    {p.status}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Detalhe (bottom sheet) */}
      {selecionado !== null && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-end justify-center" onClick={() => setSelecionado(null)}>
          <div
            className="w-full max-w-lg bg-white rounded-t-3xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white px-5 py-3 flex items-center justify-between border-b border-gray-100">
              <h3 className="text-sm font-bold text-luxury-black">
                Pedido #{detalhe?.numero ?? selecionado}
              </h3>
              <button onClick={() => setSelecionado(null)} className="text-gray-400 text-xl leading-none">
                ×
              </button>
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
                    <p className="text-[10px] text-gray-400">
                      {detalhe.data} · {detalhe.items} itens · {detalhe.status}
                    </p>
                  </div>
                  <button
                    onClick={alternarVerificado}
                    className={`px-3 py-2 rounded-xl text-[11px] font-bold active:scale-95 ${
                      detalhe.verificado
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {detalhe.verificado ? "✓ Verificado" : "Marcar verificado"}
                  </button>
                </div>

                {/* Trocar status */}
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
                        <option key={s.id} value={String(s.id)}>
                          {s.nome}
                        </option>
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
    </div>
  );
}

/** Busca e exibe os itens/pagamentos/envio do pedido selecionado. */
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
        <p className="text-[11px] font-semibold text-luxury-black mb-2">Itens</p>
        <div className="space-y-1.5">
          {(pedido.itens || []).map((i: any) => (
            <div key={i.id} className="flex items-center justify-between text-[11px]">
              <span className="text-gray-600 truncate">
                {i.quantidade}x {i.nome}
              </span>
              <span className="text-luxury-black font-medium">
                {formatPrice(Number(i.preco_venda) || 0)}
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
              {ev.forma_envio?.nome} · prazo {ev.prazo}d
              {ev.objeto ? ` · rastreio ${ev.objeto}` : ""}
            </p>
          ))}
        </div>
      )}

      {erro && <p className="text-[11px] text-red-500 mt-2">{erro}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Painel de configuração das APIs (Loja Integrada + Mercado Pago).
// O admin cola as chaves aqui; a Edge `config` salva em store_config (RLS).
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
      <p className="text-[10px] text-gray-400">
        Cole as chaves das integrações. Elas ficam guardadas com segurança e nunca expostas no app.
      </p>

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
