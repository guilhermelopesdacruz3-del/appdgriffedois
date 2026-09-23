import { useEffect, useState } from "react";
import { getAdminToken } from "../../services/admin";

const inputCls =
  "h-10 px-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs placeholder:text-slate-400 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all";
const cardCls = "bg-white border border-slate-200 rounded-2xl shadow-sm";
const btnPrimary =
  "bg-gradient-to-r from-violet-600 to-purple-500 text-white font-bold rounded-xl active:scale-[0.98] transition-all hover:brightness-110 disabled:opacity-50";

interface EstoqueItem {
  produto_id: number;
  nome: string;
  sku: string;
  quantidade: number;
  limite_baixo: number;
}

interface Movimento {
  id: number;
  produto_id: number;
  nome: string;
  sku: string;
  quantidade: number;
  motivo: string;
  admin_id: string;
  observacao: string | null;
  created_at: string;
}

export default function EstoqueAdmin() {
  const [estoque, setEstoque] = useState<EstoqueItem[]>([]);
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<"lista" | "movimentos">("lista");

  // Formulário de entrada
  const [entradaProduto, setEntradaProduto] = useState("");
  const [entradaQtd, setEntradaQtd] = useState("");
  const [entradaNome, setEntradaNome] = useState("");
  const [entradaSku, setEntradaSku] = useState("");

  // Formulário de saída
  const [saidaProduto, setSaidaProduto] = useState("");
  const [saidaQtd, setSaidaQtd] = useState("");

  const token = getAdminToken();

  const carregar = async () => {
    setLoading(true);
    setErro(null);
    try {
      const [est, mov] = await Promise.all([
        fetch("/api/admin/estoque", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/admin/estoque/movimentos", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const estJson = await est.json().catch(() => ({}));
      const movJson = await mov.json().catch(() => ({}));
      setEstoque(estJson.estoque || []);
      setMovimentos(movJson.movimentos || []);
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const darEntrada = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    try {
      await fetch("/api/admin/estoque/entrada", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          produto_id: Number(entradaProduto),
          quantidade: Number(entradaQtd),
          nome: entradaNome || undefined,
          sku: entradaSku || undefined,
        }),
      });
      setEntradaProduto("");
      setEntradaQtd("");
      setEntradaNome("");
      setEntradaSku("");
      await carregar();
    } catch (e: any) {
      setErro(e.message);
    }
  };

  const darSaida = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    try {
      await fetch("/api/admin/estoque/saida", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          produto_id: Number(saidaProduto),
          quantidade: Number(saidaQtd),
        }),
      });
      setSaidaProduto("");
      setSaidaQtd("");
      await carregar();
    } catch (e: any) {
      setErro(e.message);
    }
  };

  const deletar = async (produtoId: number) => {
    if (!confirm("Remover este produto do estoque?")) return;
    setErro(null);
    try {
      await fetch(`/api/admin/estoque/${produtoId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      await carregar();
    } catch (e: any) {
      setErro(e.message);
    }
  };

  const baixos = estoque.filter((e) => e.quantidade <= e.limite_baixo);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
          <span className="w-1 h-4 rounded-full bg-violet-600 inline-block" />
          Estoque
        </h2>
        <div className="flex gap-2">
          <button onClick={() => setAba("lista")} className={`h-9 px-4 rounded-xl border text-[11px] font-bold active:scale-95 transition-all ${aba === "lista" ? "border-violet-300 bg-violet-50 text-violet-600" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
            Lista
          </button>
          <button onClick={() => setAba("movimentos")} className={`h-9 px-4 rounded-xl border text-[11px] font-bold active:scale-95 transition-all ${aba === "movimentos" ? "border-violet-300 bg-violet-50 text-violet-600" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
            Movimentos
          </button>
          <button onClick={carregar} disabled={loading} className={`h-9 px-4 rounded-xl border border-slate-200 text-slate-600 text-[11px] font-bold hover:bg-slate-50 active:scale-95 transition-all disabled:opacity-50`}>
            Atualizar
          </button>
        </div>
      </div>

      {erro && <p className="text-[11px] text-red-500">{erro}</p>}

      {aba === "lista" && (
        <>
          {/* Alerta de estoque baixo */}
          {baixos.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
              <p className="text-xs font-bold text-amber-700 flex items-center gap-2">
                <span className="w-1 h-3.5 rounded-full bg-amber-500 inline-block" />
                Estoque baixo ({baixos.length} produto(s))
              </p>
              {baixos.map((b) => (
                <div key={b.produto_id} className="flex items-center justify-between text-[11px]">
                  <span className="text-amber-800 font-semibold">{b.nome}</span>
                  <span className="text-amber-600">{b.quantidade} / {b.limite_baixo}</span>
                </div>
              ))}
            </div>
          )}

          {/* Formulário de entrada */}
          <form onSubmit={darEntrada} className={`${cardCls} p-4 space-y-3`}>
            <p className="text-xs font-bold text-slate-800 flex items-center gap-2">
              <span className="w-1 h-3.5 rounded-full bg-violet-600 inline-block" />
              Entrada manual
            </p>
            <div className="flex gap-2">
              <input value={entradaProduto} onChange={(e) => setEntradaProduto(e.target.value)} placeholder="ID do produto" type="number" className={`${inputCls} flex-1`} required />
              <input value={entradaQtd} onChange={(e) => setEntradaQtd(e.target.value)} placeholder="Quantidade" type="number" className={`${inputCls} flex-1`} required />
            </div>
            <div className="flex gap-2">
              <input value={entradaNome} onChange={(e) => setEntradaNome(e.target.value)} placeholder="Nome (opcional)" className={`${inputCls} flex-1`} />
              <input value={entradaSku} onChange={(e) => setEntradaSku(e.target.value)} placeholder="SKU (opcional)" className={`${inputCls} flex-1`} />
            </div>
            <button type="submit" className={`${btnPrimary} w-full h-10 text-[11px]`}>Registrar entrada</button>
          </form>

          {/* Formulário de saída */}
          <form onSubmit={darSaida} className={`${cardCls} p-4 space-y-3`}>
            <p className="text-xs font-bold text-slate-800 flex items-center gap-2">
              <span className="w-1 h-3.5 rounded-full bg-violet-600 inline-block" />
              Saída manual
            </p>
            <div className="flex gap-2">
              <input value={saidaProduto} onChange={(e) => setSaidaProduto(e.target.value)} placeholder="ID do produto" type="number" className={`${inputCls} flex-1`} required />
              <input value={saidaQtd} onChange={(e) => setSaidaQtd(e.target.value)} placeholder="Quantidade" type="number" className={`${inputCls} flex-1`} required />
            </div>
            <button type="submit" className={`${btnPrimary} w-full h-10 text-[11px]`}>Registrar saída</button>
          </form>

          {/* Lista de estoque */}
          {loading && (
            <div className="flex justify-center py-10">
              <div className="w-7 h-7 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading && estoque.length === 0 && (
            <div className={`${cardCls} p-10 text-center`}>
              <svg className="mx-auto mb-3 text-slate-300" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
                <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" />
              </svg>
              <p className="text-xs text-slate-400">Nenhum item no estoque.</p>
            </div>
          )}

          {!loading && estoque.length > 0 && (
            <div className="space-y-2">
              {estoque.map((item) => (
                <div key={item.produto_id} className={`${cardCls} p-3 flex items-center justify-between gap-2`}>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{item.nome}</p>
                    <p className="text-[10px] text-slate-500">ID: {item.produto_id} · SKU: {item.sku || "—"}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${item.quantidade <= item.limite_baixo ? "bg-amber-50 text-amber-600 border border-amber-200" : "bg-emerald-50 text-emerald-600 border border-emerald-200"}`}>
                      {item.quantidade} / {item.limite_baixo}
                    </span>
                    <button onClick={() => deletar(item.produto_id)} className="w-8 h-8 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 text-[10px] font-bold active:scale-95 transition-all border border-red-200" title="Remover">
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {aba === "movimentos" && (
        <>
          {loading && (
            <div className="flex justify-center py-10">
              <div className="w-7 h-7 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading && movimentos.length === 0 && (
            <div className={`${cardCls} p-10 text-center`}>
              <p className="text-xs text-slate-400">Nenhum movimento registrado.</p>
            </div>
          )}

          {!loading && movimentos.length > 0 && (
            <div className="space-y-2">
              {movimentos.map((m) => (
                <div key={m.id} className={`${cardCls} p-3 space-y-1`}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-800">{m.nome}</p>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${m.quantidade > 0 ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
                      {m.quantidade > 0 ? "+" : ""}{m.quantidade}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    {m.motivo} · {m.admin_id} · {new Date(m.created_at).toLocaleString("pt-BR")}
                  </p>
                  {m.observacao && <p className="text-[10px] text-slate-400">{m.observacao}</p>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
