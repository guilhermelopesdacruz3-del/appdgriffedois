import { useEffect, useState } from "react";
import { listarClientesAdmin } from "../../services/admin";
import {
  ajustarPontosFidelidade,
  getRegrasFidelidadeAdmin,
  salvarRegrasFidelidadeAdmin,
  type RegrasFidelidade,
} from "../../services/fidelidadeAdmin";

const inputCls =
  "h-10 px-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs placeholder:text-slate-400 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all";
const cardCls =
  "bg-white border border-slate-200 rounded-2xl shadow-sm";
const btnPrimary =
  "bg-gradient-to-r from-violet-600 to-purple-500 text-white font-bold rounded-xl active:scale-[0.98] transition-all hover:brightness-110 disabled:opacity-50";

export default function FidelidadeAdmin() {
  const [clientes, setClientes] = useState<{ email: string; nome: string }[]>([]);
  const [email, setEmail] = useState("");
  const [pontos, setPontos] = useState("");
  const [operacao, setOperacao] = useState<"creditar" | "resgatar" | "definir">("creditar");
  const [motivo, setMotivo] = useState("");
  const [regras, setRegras] = useState<RegrasFidelidade>({ pontosPorReal: 1, pontosPorDesconto: 100 });
  const [erro, setErro] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const carregar = async () => {
    setLoading(true);
    try {
      const [cl, rg] = await Promise.all([
        listarClientesAdmin().catch(() => ({ clientes: [] })),
        getRegrasFidelidadeAdmin().catch(() => ({ pontosPorReal: 1, pontosPorDesconto: 100 })),
      ]);
      setClientes(cl.clientes || []);
      setRegras(rg);
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const ajustar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setMsg(null);
    try {
      const r = await ajustarPontosFidelidade(email.trim().toLowerCase(), Number(pontos), operacao, motivo.trim() || undefined);
      setMsg(`Saldo de ${r.email} agora é ${r.saldo} pts (${r.operacao}).`);
      setPontos("");
      setMotivo("");
      window.dispatchEvent(new Event("fidelidade-atualizada"));
    } catch (e: any) {
      setErro(e.message);
    }
  };

  const salvarRegras = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setMsg(null);
    try {
      await salvarRegrasFidelidadeAdmin(Number(regras.pontosPorReal), Number(regras.pontosPorDesconto));
      setMsg("Regras de fidelidade salvas.");
    } catch (e: any) {
      setErro(e.message);
    }
  };

  return (
    <div className="space-y-4">
      {/* Ajuste de pontos */}
      <form onSubmit={ajustar} className={`${cardCls} p-4 space-y-3`}>
        <p className="text-xs font-bold text-slate-800 flex items-center gap-2"><span className="w-1 h-3.5 rounded-full bg-violet-600 inline-block" />Ajustar pontos de um cliente</p>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-mail do cliente"
          className={`${inputCls} w-full`}
          required
        />
        <div className="flex gap-2">
          <input
            value={pontos}
            onChange={(e) => setPontos(e.target.value)}
            placeholder="Quantidade"
            type="number"
            className={`${inputCls} flex-1`}
            required
          />
          <select
            value={operacao}
            onChange={(e) => setOperacao(e.target.value as any)}
            className={inputCls}
          >
            <option value="creditar">Creditar</option>
            <option value="resgatar">Resgatar</option>
            <option value="definir">Definir saldo</option>
          </select>
        </div>
        <input
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Motivo (opcional)"
          className={`${inputCls} w-full`}
        />
        <button type="submit" className={`${btnPrimary} w-full h-12 text-xs`}>
          Aplicar
        </button>
      </form>

      {erro && <p className="text-[11px] text-red-400 px-1">{erro}</p>}
      {msg && <p className="text-[11px] text-emerald-400 px-1">{msg}</p>}

      {/* Regras */}
      <form onSubmit={salvarRegras} className={`${cardCls} p-4 space-y-3`}>
        <p className="text-xs font-bold text-slate-800 flex items-center gap-2"><span className="w-1 h-3.5 rounded-full bg-violet-600 inline-block" />Regras do programa</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[9px] text-violet-600/60 mb-0.5 px-1 uppercase tracking-wider font-bold">Pontos por R$</label>
            <input
              value={regras.pontosPorReal}
              onChange={(e) => setRegras((r) => ({ ...r, pontosPorReal: Number(e.target.value) }))}
              type="number"
              step="0.1"
              className={`${inputCls} w-full`}
            />
          </div>
          <div>
            <label className="block text-[9px] text-violet-600/60 mb-0.5 px-1 uppercase tracking-wider font-bold">Pontos = R$ (desconto)</label>
            <input
              value={regras.pontosPorDesconto}
              onChange={(e) => setRegras((r) => ({ ...r, pontosPorDesconto: Number(e.target.value) }))}
              type="number"
              className={`${inputCls} w-full`}
            />
          </div>
        </div>
        <p className="text-[10px] text-slate-400">
          Ex.: 1 ponto por R$1 e 100 pontos = R$10 de desconto.
        </p>
        <button type="submit" className={`${btnPrimary} w-full h-10 text-[11px]`}>
          Salvar regras
        </button>
      </form>

      {/* Clientes */}
      <div className={`${cardCls} p-4 space-y-2`}>
        <p className="text-xs font-bold text-slate-800 flex items-center gap-2"><span className="w-1 h-3.5 rounded-full bg-violet-600 inline-block" />Clientes ({clientes.length})</p>
        <p className="text-[10px] text-slate-400">Clique para preencher o e-mail no ajuste acima.</p>
        <div className="max-h-64 overflow-y-auto space-y-1">
          {clientes.map((cl) => (
            <button
              key={cl.email}
              onClick={() => setEmail(cl.email)}
              className="w-full flex items-center gap-2 py-1.5 px-2 rounded-xl hover:bg-violet-50 text-left transition-colors"
            >
              <span className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-600/30 to-violet-600/10 border border-violet-200 flex items-center justify-center text-[10px] font-bold text-violet-600 flex-shrink-0">
                {(cl.nome || "?").charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-slate-800 truncate">{cl.nome}</p>
                <p className="text-[9px] text-slate-400 truncate">{cl.email}</p>
              </div>
            </button>
          ))}
          {clientes.length === 0 && <p className="text-[10px] text-slate-400">Nenhum cliente encontrado.</p>}
        </div>
      </div>

      {loading && <p className="text-xs text-slate-400 text-center">Carregando…</p>}
    </div>
  );
}
