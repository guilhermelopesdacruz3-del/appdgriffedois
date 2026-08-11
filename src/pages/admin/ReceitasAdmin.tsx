import { useState, useEffect } from "react";
import { listarReceitasAdmin, type ReceitaAdmin } from "../../services/admin";

export default function ReceitasAdmin() {
  const [receitas, setReceitas] = useState<ReceitaAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtroEmail, setFiltroEmail] = useState("");
  const [filtroNome, setFiltroNome] = useState("");

  const carregar = async () => {
    setLoading(true); setErro(null);
    try {
      const r = await listarReceitasAdmin();
      setReceitas(r.receitas || []);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const filtradas = receitas.filter((r) => {
    const email = (r.email || "").toLowerCase();
    const nome = (r.nome || "").toLowerCase();
    return (!filtroEmail || email.includes(filtroEmail.toLowerCase())) && (!filtroNome || nome.includes(filtroNome.toLowerCase()));
  });

  const n = (v: number | null | undefined) => (v != null ? v.toFixed(2) : "—");

  const TabelaReceita = (r: ReceitaAdmin) => {
    const hasLonge = r.esf_od_longe != null || r.esf_oe_longe != null || r.cil_od_longe != null || r.cil_oe_longe != null;
    const hasPerto = r.esf_od_perto != null || r.esf_oe_perto != null || r.cil_od_perto != null || r.cil_oe_perto != null;
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-[10px] border-collapse">
          <thead>
            <tr className="bg-ice text-gray-500">
              <th className="p-1 border border-ice-dark" colSpan={4}>OD (Direito)</th>
              <th className="p-1 border border-ice-dark" colSpan={4}>OE (Esquerdo)</th>
            </tr>
            <tr className="bg-ice text-slate-500">
              <th className="p-1 border border-ice-dark">Esf.</th>
              <th className="p-1 border border-ice-dark">Cil.</th>
              <th className="p-1 border border-ice-dark">Eixo</th>
              <th className="p-1 border border-ice-dark">DIP</th>
              <th className="p-1 border border-ice-dark">Esf.</th>
              <th className="p-1 border border-ice-dark">Cil.</th>
              <th className="p-1 border border-ice-dark">Eixo</th>
              <th className="p-1 border border-ice-dark">DIP</th>
            </tr>
          </thead>
          <tbody>
            {hasLonge && (
              <tr>
                <td className="p-1 border border-ice-dark text-center">{n(r.esf_od_longe)}</td>
                <td className="p-1 border border-ice-dark text-center">{n(r.cil_od_longe)}</td>
                <td className="p-1 border border-ice-dark text-center">{n(r.eixo_od_longe)}</td>
                <td className="p-1 border border-ice-dark text-center" rowSpan={hasLonge && hasPerto ? 2 : 1}>{n(r.dip)} mm</td>
                <td className="p-1 border border-ice-dark text-center">{n(r.esf_oe_longe)}</td>
                <td className="p-1 border border-ice-dark text-center">{n(r.cil_oe_longe)}</td>
                <td className="p-1 border border-ice-dark text-center">{n(r.eixo_oe_longe)}</td>
                <td className="p-1 border border-ice-dark" />
              </tr>
            )}
            {hasPerto && (
              <tr>
                <td className="p-1 border border-ice-dark text-center">{n(r.esf_od_perto)}</td>
                <td className="p-1 border border-ice-dark text-center">{n(r.cil_od_perto)}</td>
                <td className="p-1 border border-ice-dark text-center">{n(r.eixo_od_perto)}</td>
                <td className="p-1 border border-ice-dark text-center">{n(r.esf_oe_perto)}</td>
                <td className="p-1 border border-ice-dark text-center">{n(r.cil_oe_perto)}</td>
                <td className="p-1 border border-ice-dark text-center">{n(r.eixo_oe_perto)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {erro && <p className="text-[11px] text-red-500">{erro}</p>}

      <div className="flex gap-2 flex-wrap">
        <input value={filtroEmail} onChange={(e) => setFiltroEmail(e.target.value)} placeholder="Filtrar por e-mail" className="h-10 px-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs placeholder:text-slate-400 focus:outline-none focus:border-violet-500" />
        <input value={filtroNome} onChange={(e) => setFiltroNome(e.target.value)} placeholder="Filtrar por nome" className="h-10 px-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs placeholder:text-slate-400 focus:outline-none focus:border-violet-500" />
        <button onClick={carregar} className="h-10 px-4 bg-gradient-to-r from-violet-600 to-purple-500 text-white text-[11px] font-bold rounded-xl active:scale-95 transition-all">Atualizar</button>
        <span className="h-10 px-3 flex items-center text-[11px] text-slate-400">{filtradas.length} receita(s)</span>
      </div>

      {loading && (<div className="flex justify-center py-10"><div className="w-7 h-7 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>)}

      {!loading && filtradas.length === 0 && (
        <div className="bg-white/60 border border-dashed border-slate-300 rounded-2xl p-10 text-center">
          <p className="text-xs text-slate-400">Nenhuma receita encontrada.</p>
        </div>
      )}

      <div className="space-y-2">
        {filtradas.map((r) => (
          <div key={r.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 space-y-2 hover:border-violet-200 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider text-violet-600">{r.tipo}</span>
                {r.nome && <span className="text-[11px] font-semibold text-slate-800">{r.nome}</span>}
                {r.medico && <span className="text-[10px] text-slate-400">— {r.medico}</span>}
              </div>
              <span className="text-[10px] text-slate-300">{r.data_receita ? new Date(r.data_receita).toLocaleDateString("pt-BR") : ""}</span>
            </div>
            <p className="text-[10px] text-slate-400">{r.email}</p>
            {TabelaReceita(r)}
            {r.descricao && <p className="text-[10px] text-slate-400 whitespace-pre-wrap">{r.descricao}</p>}
            <p className="text-[10px] text-slate-800/20">{new Date(r.created_at).toLocaleString("pt-BR")}</p>
          </div>
        ))}
      </div>
    </div>
  );
}