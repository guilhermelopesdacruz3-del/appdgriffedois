import { useEffect, useState } from "react";
import { listarReceitasAdmin, type ReceitaAdmin } from "../../services/admin";

const inputCls =
  "h-10 px-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs placeholder:text-slate-400 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all";
const cardCls = "bg-white border border-slate-200 rounded-2xl shadow-sm";
const btnPrimary =
  "bg-gradient-to-r from-violet-600 to-purple-500 text-white font-bold rounded-xl active:scale-[0.98] transition-all hover:brightness-110 disabled:opacity-50";

export default function ReceitasAdmin() {
  const [receitas, setReceitas] = useState<ReceitaAdmin[]>([]);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = async () => {
    setLoading(true);
    setErro(null);
    try {
      const r = await listarReceitasAdmin();
      setReceitas(r.receitas || []);
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const filtradas = receitas.filter((r) => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return true;
    return (
      (r.nome || "").toLowerCase().includes(termo) ||
      (r.email || "").toLowerCase().includes(termo) ||
      (r.medico || "").toLowerCase().includes(termo)
    );
  });

  const exportarCSV = () => {
    const header = ["nome", "email", "medico", "data", "tipo", "descricao", "OD Longe (ESF/CIL/EIXO)", "OE Longe (ESF/CIL/EIXO)", "OD Perto (ESF/CIL/EIXO)", "OE Perto (ESF/CIL/EIXO)", "DIP"];
    const linhas = filtradas.map((r) =>
      [
        r.nome,
        r.email,
        r.medico,
        r.data_receita,
        r.tipo,
        r.descricao,
        r.esf_od_longe !== null ? `${r.esf_od_longe}/${r.cil_od_longe}/${r.eixo_od_longe}` : "—",
        r.esf_oe_longe !== null ? `${r.esf_oe_longe}/${r.cil_oe_longe}/${r.eixo_oe_longe}` : "—",
        r.esf_od_perto !== null ? `${r.esf_od_perto}/${r.cil_od_perto}/${r.eixo_od_perto}` : "—",
        r.esf_oe_perto !== null ? `${r.esf_oe_perto}/${r.cil_oe_perto}/${r.eixo_oe_perto}` : "—",
        r.dip !== null ? String(r.dip) : "—",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [header.join(","), ...linhas].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "receitas-dgriffe.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
          <span className="w-1 h-4 rounded-full bg-violet-600 inline-block" />
          Receitas Ópticas
        </h2>
        <div className="flex gap-2">
          <button onClick={exportarCSV} disabled={filtradas.length === 0} className={`h-9 px-4 rounded-xl border border-violet-200 text-violet-600 text-[11px] font-bold hover:bg-violet-50 active:scale-95 transition-all disabled:opacity-50`}>
            Exportar CSV
          </button>
          <button onClick={carregar} disabled={loading} className={`h-9 px-4 rounded-xl border border-slate-200 text-slate-600 text-[11px] font-bold hover:bg-slate-50 active:scale-95 transition-all disabled:opacity-50`}>
            Atualizar
          </button>
        </div>
      </div>

      <div className={`${cardCls} p-4 space-y-3`}>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, e-mail ou médico..."
          className={`${inputCls} w-full`}
        />
        <p className="text-[11px] text-slate-500">
          {filtradas.length} receita(s) encontrada(s)
        </p>
      </div>

      {erro && <p className="text-[11px] text-red-500">{erro}</p>}
      {loading && (
        <div className="flex justify-center py-10">
          <div className="w-7 h-7 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && filtradas.length === 0 && (
        <div className={`${cardCls} p-10 text-center`}>
          <svg className="mx-auto mb-3 text-slate-300" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
          </svg>
          <p className="text-xs text-slate-400">Nenhuma receita encontrada.</p>
        </div>
      )}

      <div className="space-y-2">
        {filtradas.map((r) => (
          <div key={r.id} className={`${cardCls} p-4 space-y-2`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800">{r.nome || "Sem nome"}</p>
                <p className="text-[10px] text-slate-500">{r.email}</p>
              </div>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 border border-violet-200 flex-shrink-0">
                {r.tipo}
              </span>
            </div>

            {r.medico && (
              <p className="text-[11px] text-slate-600">
                <span className="font-semibold">Médico:</span> {r.medico}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-2">
                <p className="font-bold text-slate-600 mb-0.5">Longe</p>
                <p className="text-slate-500">
                  OD: {r.esf_od_longe !== null ? `${r.esf_od_longe} / ${r.cil_od_longe} / ${r.eixo_od_longe}` : "—"}
                </p>
                <p className="text-slate-500">
                  OE: {r.esf_oe_longe !== null ? `${r.esf_oe_longe} / ${r.cil_oe_longe} / ${r.eixo_oe_longe}` : "—"}
                </p>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-2">
                <p className="font-bold text-slate-600 mb-0.5">Perto</p>
                <p className="text-slate-500">
                  OD: {r.esf_od_perto !== null ? `${r.esf_od_perto} / ${r.cil_od_perto} / ${r.eixo_od_perto}` : "—"}
                </p>
                <p className="text-slate-500">
                  OE: {r.esf_oe_perto !== null ? `${r.esf_oe_perto} / ${r.cil_oe_perto} / ${r.eixo_oe_perto}` : "—"}
                </p>
              </div>
            </div>

            {r.dip !== null && (
              <p className="text-[10px] text-slate-500">
                <span className="font-semibold">DIP:</span> {r.dip}mm
              </p>
            )}

            <p className="text-[10px] text-slate-400">
              {r.data_receita ? new Date(r.data_receita).toLocaleDateString("pt-BR") : "Sem data"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
