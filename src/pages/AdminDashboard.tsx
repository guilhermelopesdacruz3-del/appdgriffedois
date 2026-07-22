import { useEffect, useState } from "react";
import { relatorioAdmin, listarPedidosAdmin, listarSituacoes, listarLogsAdmin } from "../services/admin";
import { listarCupons, enviarCupom, criarCupom, type Cupom } from "../services/cupomApp";
import { getApiConfigStatus, saveApiConfig } from "../services/apiConfig";
import { formatPrice } from "../utils";

export default function AdminDashboard(_props: { token: string }) {
  const [relatorio, setRelatorio] = useState<any>(null);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [_situacoes, setSituacoes] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [cupons, setCupons] = useState<Cupom[]>([]);
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState<"visao" | "cupons" | "logs" | "config">("visao");
  const [configStatus, setConfigStatus] = useState<any[]>([]);
  const [salvandoConfig, setSalvandoConfig] = useState(false);
  const [msgConfig, setMsgConfig] = useState<string | null>(null);

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
      <div className="flex gap-1 px-4 pt-3">
        {(["visao", "cupons", "logs", "config"] as const).map((a) => (
          <button
            key={a}
            onClick={() => setAba(a)}
            className={`flex-1 h-9 rounded-xl text-[11px] font-bold transition-all ${
              aba === a ? "bg-luxury-black text-white" : "bg-white text-gray-500"
            }`}
          >
            {a === "visao" ? "Visão Geral" : a === "cupons" ? "Cupons" : a === "logs" ? "Logs" : "Config"}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-10">
          <div className="w-7 h-7 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && aba === "visao" && relatorio && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white rounded-2xl p-3 shadow-sm">
              <p className="text-[10px] text-gray-400">Pedidos</p>
              <p className="text-lg font-bold text-luxury-black">{relatorio.totalPedidos}</p>
            </div>
            <div className="bg-white rounded-2xl p-3 shadow-sm">
              <p className="text-[10px] text-gray-400">Faturamento</p>
              <p className="text-lg font-bold text-luxury-black">{formatPrice(relatorio.faturamentoTotal)}</p>
            </div>
            <div className="bg-white rounded-2xl p-3 shadow-sm">
              <p className="text-[10px] text-gray-400">Ticket Médio</p>
              <p className="text-lg font-bold text-gold">{formatPrice(relatorio.ticketMedio)}</p>
            </div>
            <div className="bg-white rounded-2xl p-3 shadow-sm">
              <p className="text-[10px] text-gray-400">Aprovado</p>
              <p className="text-lg font-bold text-green-600">{formatPrice(relatorio.faturamentoAprovado)}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-bold text-luxury-black mb-2">Integrações</p>
            <p className="text-[11px] text-gray-500 mb-2">Catálogo e checkout dependem das chaves da Loja Integrada e Mercado Pago.</p>
            <button onClick={() => setAba("config")} className="w-full h-9 rounded-xl bg-ice text-luxury-black text-[11px] font-bold">Abrir Configurações</button>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-bold text-luxury-black mb-2">Pedidos Recentes ({pedidos.length})</p>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {pedidos.slice(0, 20).map((p) => (
                <div key={p.id} className="flex items-center justify-between text-[11px]">
                  <div className="min-w-0">
                    <p className="font-semibold text-luxury-black">#{p.numero}</p>
                    <p className="text-gray-400 truncate">{p.cliente_nome} · {p.cliente_email}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-luxury-black">{formatPrice(Number(p.valor_total) || 0)}</p>
                    <p className="text-gray-400">{new Date(p.data_criacao).toLocaleDateString("pt-BR")}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {!loading && aba === "cupons" && (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
            <p className="text-xs font-bold text-luxury-black">Criar cupom</p>
            <div className="grid grid-cols-2 gap-2">
              <input
                id="cupom-codigo"
                placeholder="Código"
                className="h-10 px-3 rounded-xl border border-gray-200 text-xs uppercase"
              />
              <select
                id="cupom-tipo"
                className="h-10 px-3 rounded-xl border border-gray-200 text-xs bg-white"
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
                className="h-10 px-3 rounded-xl border border-gray-200 text-xs"
              />
              <input
                id="cupom-minimo"
                type="number"
                placeholder="Mínimo (R$)"
                className="h-10 px-3 rounded-xl border border-gray-200 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                id="cupom-inicio"
                type="datetime-local"
                className="h-10 px-3 rounded-xl border border-gray-200 text-xs"
              />
              <input
                id="cupom-fim"
                type="datetime-local"
                className="h-10 px-3 rounded-xl border border-gray-200 text-xs"
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
                  // recarregar cupons
                  setCupons(await listarCupons());
                } catch (e: any) {
                  alert(e.message);
                }
              }}
              className="w-full h-12 bg-luxury-black text-white text-xs font-bold rounded-2xl"
            >
              Criar cupom
            </button>
          </div>

          <div className="space-y-2">
            {cupons.map((c) => (
              <div key={c.id} className="bg-white rounded-2xl p-3 shadow-sm flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-luxury-black">{c.codigo}</p>
                  <p className="text-[10px] text-gray-500">
                    {c.tipo === "percentual" ? `${c.valor}%` : `R$ ${Number(c.valor).toFixed(2)}`} · {c.usos}/{c.max_usos ?? "∞"} usos
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => enviarCupomSelecionado(c.id)} className="px-3 py-2 bg-ice text-luxury-black text-[10px] font-bold rounded-xl">
                    Todos
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && aba === "logs" && (
        <div className="space-y-2">
          {logs.slice(0, 50).map((l) => (
            <div key={l.id} className="bg-white rounded-2xl p-3 shadow-sm flex items-center justify-between text-[11px]">
              <div>
                <p className="font-semibold text-luxury-black">{l.acao}</p>
                <p className="text-gray-500">{l.admin_email} · {new Date(l.created_at).toLocaleString("pt-BR")}</p>
              </div>
              <span className="text-[10px] text-gray-400">{l.ip}</span>
            </div>
          ))}
        </div>
      )}

      {!loading && aba === "config" && <AdminConfigTab status={configStatus} onStatus={setConfigStatus} salvando={salvandoConfig} setSalvando={setSalvandoConfig} msg={msgConfig} setMsg={setMsgConfig} />}
    </div>
  );
}

// Aba de Configurações: colar as chaves das APIs (Loja Integrada + Mercado Pago)
// direto pela UI do admin, sem mexer no Render. Salva no store_config do servidor.
function AdminConfigTab({ status, onStatus, salvando, setSalvando, msg, setMsg }: {
  status: any[];
  onStatus: (s: any[]) => void;
  salvando: boolean;
  setSalvando: (v: boolean) => void;
  msg: string | null;
  setMsg: (m: string | null) => void;
}) {
  const [liApp, setLiApp] = useState("");
  const [liApi, setLiApi] = useState("");
  const [mpToken, setMpToken] = useState("");

  useEffect(() => {
    getApiConfigStatus().then(onStatus).catch(() => onStatus([]));
  }, []);

  const salvar = async () => {
    setSalvando(true);
    setMsg(null);
    try {
      await saveApiConfig({
        ...(liApp.trim() ? { LI_APP_KEY: liApp.trim() } : {}),
        ...(liApi.trim() ? { LI_API_KEY: liApi.trim() } : {}),
        ...(mpToken.trim() ? { MP_ACCESS_TOKEN: mpToken.trim() } : {}),
      });
      setMsg("Chaves salvas com sucesso! O catálogo e o checkout voltam a funcionar em instantes.");
      onStatus(await getApiConfigStatus());
      setLiApp(""); setLiApi(""); setMpToken("");
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setSalvando(false);
    }
  };

  const setOf = (k: string) => status.find((s) => s.key === k)?.set;

  return (
    <div className="space-y-3 px-4 pb-4">
      <p className="text-xs font-bold text-luxury-black">Chaves de API</p>
      <p className="text-[10px] text-gray-500">Cole as chaves da Loja Integrada e do Mercado Pago. Elas ficam salvas com segurança no servidor (nunca no app).</p>

      <div className="bg-white rounded-2xl p-3 space-y-2">
        <label className="text-[10px] font-semibold text-luxury-black">Loja Integrada — Chave da Aplicação {setOf("LI_APP_KEY") ? "✅" : "⚠️"}
          <input value={liApp} onChange={(e) => setLiApp(e.target.value)} placeholder={setOf("LI_APP_KEY") ? "já configurada (deixe vazio p/ manter)" : "cole aqui"} className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs mt-1" />
        </label>
        <label className="text-[10px] font-semibold text-luxury-black">Loja Integrada — Chave de API {setOf("LI_API_KEY") ? "✅" : "⚠️"}
          <input value={liApi} onChange={(e) => setLiApi(e.target.value)} placeholder={setOf("LI_API_KEY") ? "já configurada (deixe vazio p/ manter)" : "cole aqui"} className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs mt-1" />
        </label>
        <label className="text-[10px] font-semibold text-luxury-black">Mercado Pago — Access Token {setOf("MP_ACCESS_TOKEN") ? "✅" : "⚠️"}
          <input value={mpToken} onChange={(e) => setMpToken(e.target.value)} placeholder={setOf("MP_ACCESS_TOKEN") ? "já configurada (deixe vazio p/ manter)" : "cole aqui"} className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs mt-1" />
        </label>
      </div>

      {msg && <p className={`text-[11px] ${msg.includes("sucesso") ? "text-green-600" : "text-red-500"}`}>{msg}</p>}
      <button onClick={salvar} disabled={salvando} className="w-full h-12 bg-luxury-black text-white text-xs font-bold rounded-2xl disabled:opacity-60">
        {salvando ? "Salvando..." : "Salvar chaves"}
      </button>
      <p className="text-[10px] text-gray-400">Após salvar, o catálogo de produtos e o checkout com Mercado Pago passam a funcionar automaticamente.</p>
    </div>
  );
}
