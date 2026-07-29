import { useEffect, useState } from "react";
import { listarClientesAdmin } from "../../services/admin";
import {
  ajustarPontosFidelidade,
  getRegrasFidelidadeAdmin,
  salvarRegrasFidelidadeAdmin,
  type RegrasFidelidade,
} from "../../services/fidelidadeAdmin";

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
      <form onSubmit={ajustar} className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3 backdrop-blur">
        <p className="text-xs font-bold text-white">Ajustar pontos de um cliente</p>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-mail do cliente"
          className="w-full h-10 px-3 rounded-xl border border-white/10 bg-black/40 text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-gold"
          required
        />
        <div className="flex gap-2">
          <input
            value={pontos}
            onChange={(e) => setPontos(e.target.value)}
            placeholder="Quantidade"
            type="number"
            className="flex-1 h-10 px-3 rounded-xl border border-white/10 bg-black/40 text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-gold"
            required
          />
          <select
            value={operacao}
            onChange={(e) => setOperacao(e.target.value as any)}
            className="h-10 px-3 rounded-xl border border-white/10 bg-black/40 text-white text-xs focus:outline-none focus:border-gold"
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
          className="w-full h-10 px-3 rounded-xl border border-white/10 bg-black/40 text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-gold"
        />
        <button type="submit" className="w-full h-12 bg-white text-black text-xs font-bold rounded-2xl active:scale-[0.98] transition-all disabled:opacity-50">
          Aplicar
        </button>
      </form>

      {erro && <p className="text-[11px] text-red-400">{erro}</p>}
      {msg && <p className="text-[11px] text-emerald-400">{msg}</p>}

      {/* Regras */}
      <form onSubmit={salvarRegras} className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3 backdrop-blur">
        <p className="text-xs font-bold text-white">Regras do programa</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[9px] text-white/50 mb-0.5 px-1">Pontos por R$</label>
            <input
              value={regras.pontosPorReal}
              onChange={(e) => setRegras((r) => ({ ...r, pontosPorReal: Number(e.target.value) }))}
              type="number"
              step="0.1"
              className="w-full h-10 px-3 rounded-xl border border-white/10 bg-black/40 text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="block text-[9px] text-white/50 mb-0.5 px-1">Pontos = R$ (desconto)</label>
            <input
              value={regras.pontosPorDesconto}
              onChange={(e) => setRegras((r) => ({ ...r, pontosPorDesconto: Number(e.target.value) }))}
              type="number"
              className="w-full h-10 px-3 rounded-xl border border-white/10 bg-black/40 text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-gold"
            />
          </div>
        </div>
        <p className="text-[10px] text-white/50">
          Ex.: 1 ponto por R$1 e 100 pontos = R$10 de desconto.
        </p>
        <button type="submit" className="w-full h-10 bg-white text-black text-[11px] font-bold rounded-xl active:scale-[0.98] transition-all disabled:opacity-50">
          Salvar regras
        </button>
      </form>

      {/* Clientes */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2 backdrop-blur">
        <p className="text-xs font-bold text-white">Clientes ({clientes.length})</p>
        <p className="text-[10px] text-white/50">Clique para preencher o e-mail no ajuste acima.</p>
        <div className="max-h-64 overflow-y-auto space-y-1">
          {clientes.map((cl) => (
            <button
              key={cl.email}
              onClick={() => setEmail(cl.email)}
              className="w-full flex items-center gap-2 py-1.5 px-2 rounded-xl hover:bg-white/10 text-left"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-white truncate">{cl.nome}</p>
                <p className="text-[9px] text-white/40 truncate">{cl.email}</p>
              </div>
            </button>
          ))}
          {clientes.length === 0 && <p className="text-[10px] text-white/50">Nenhum cliente encontrado.</p>}
        </div>
      </div>

      {loading && <p className="text-xs text-white/50 text-center">Carregando…</p>}
    </div>
  );
}
