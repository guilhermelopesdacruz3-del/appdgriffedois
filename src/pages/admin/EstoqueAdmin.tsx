import { useCallback, useEffect, useState } from "react";
import { getAdminToken } from "../../services/admin";

type ItemEstoque = {
  produto_id: number;
  nome: string;
  quantidade: number;
  limite_baixo: number;
  sku?: string | null;
  updated_at?: string;
};

type Movimento = {
  id: number;
  produto_id: number;
  nome: string;
  quantidade: number;
  motivo: string;
  observacao?: string | null;
  created_at: string;
  admin_id?: string | null;
};

const MOTIVO_LABEL: Record<string, string> = {
  entrada_manual: "Entrada manual",
  saida_manual: "Saída manual",
  venda: "Venda (automática)",
  ajuste: "Ajuste",
  inicial: "Estoque inicial",
};

export default function EstoqueAdmin() {
  const [itens, setItens] = useState<ItemEstoque[]>([]);
  const [baixo, setBaixo] = useState<ItemEstoque[]>([]);
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState<number | null>(null);
  const [confirmarExclusao, setConfirmarExclusao] = useState<number | null>(null);

  const [produtoId, setProdutoId] = useState("");
  const [nome, setNome] = useState("");
  const [sku, setSku] = useState("");
  const [qtd, setQtd] = useState("");
  const [limiteBaixo, setLimiteBaixo] = useState("");
  const [obs, setObs] = useState("");
  const [acao, setAcao] = useState<"entrada" | "saida">("entrada");
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const token = getAdminToken();
      const headers = { Authorization: `Bearer ${token}` };
      const [rEstoque, rBaixo, rMov] = await Promise.all([
        fetch("/api/admin/estoque", { headers }),
        fetch("/api/admin/estoque/baixo", { headers }),
        fetch("/api/admin/estoque/movimentos?limit=100", { headers }),
      ]);
      if (!rEstoque.ok) throw new Error("Falha ao carregar estoque");
      const d1 = await rEstoque.json();
      const d2 = rBaixo.ok ? await rBaixo.json() : { baixo: [] };
      const d3 = rMov.ok ? await rMov.json() : { movimentos: [] };
      setItens(d1.estoque || []);
      setBaixo(d2.baixo || []);
      setMovimentos(d3.movimentos || []);
    } catch (e: any) {
      setErro(e?.message || "Erro ao carregar");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const salvar = async () => {
    setMsg(null);
    const pid = Number(produtoId);
    const quantidade = Math.round(Number(qtd));
    if (!pid || !quantidade || quantidade <= 0) {
      setMsg("Informe o ID do produto e uma quantidade maior que zero.");
      return;
    }
    setSalvando(true);
    try {
      const token = getAdminToken();
      const body: any = {
        produto_id: pid,
        quantidade,
        nome: nome || `Produto ${pid}`,
        sku: sku || null,
        observacao: obs || null,
      };
      if (limiteBaixo && Number(limiteBaixo) >= 0) {
        body.limite_baixo = Number(limiteBaixo);
      }
      const resp = await fetch(`/api/admin/estoque/${acao}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.erro || "Falha ao salvar");
      setMsg(`${acao === "entrada" ? "Entrada" : "Saída"} registrada: ${quantidade} un. (produto ${pid})`);
      setProdutoId("");
      setNome("");
      setSku("");
      setQtd("");
      setLimiteBaixo("");
      setObs("");
      await carregar();
    } catch (e: any) {
      setMsg(e?.message || "Erro ao salvar");
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (pid: number) => {
    setExcluindo(pid);
    try {
      const token = getAdminToken();
      const resp = await fetch(`/api/admin/estoque/${pid}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.erro || "Falha ao excluir");
      setConfirmarExclusao(null);
      await carregar();
    } catch (e: any) {
      setMsg(e?.message || "Erro ao excluir");
    } finally {
      setExcluindo(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Alerta de peças baixas */}
      {baixo.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4">
          <p className="text-sm font-bold text-amber-800 flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            {baixo.length} produto(s) com estoque baixo
          </p>
          <ul className="mt-2 space-y-1 text-xs text-amber-700">
            {baixo.map((b) => (
              <li key={b.produto_id}>
                #{b.produto_id} — {b.nome}: <strong>{b.quantidade}</strong> un. (limite {b.limite_baixo})
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Formulário de entrada/saída manual */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
        <p className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-2">
          <span className="w-1 h-3.5 rounded-full bg-violet-600 inline-block" />
          Movimentação Manual
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] font-semibold text-slate-500">ID do Produto *</label>
            <input
              type="number"
              value={produtoId}
              onChange={(e) => setProdutoId(e.target.value)}
              className="w-full mt-1 px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-400 outline-none"
              placeholder="ex: 123"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-500">Nome</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full mt-1 px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-400 outline-none"
              placeholder="ex: Óculos Ray-Ban"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-500">SKU</label>
            <input
              type="text"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              className="w-full mt-1 px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-400 outline-none"
              placeholder="opcional"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-500">Quantidade *</label>
            <input
              type="number"
              value={qtd}
              onChange={(e) => setQtd(e.target.value)}
              className="w-full mt-1 px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-400 outline-none"
              placeholder="ex: 10"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-500">Limite p/ alerta</label>
            <input
              type="number"
              value={limiteBaixo}
              onChange={(e) => setLimiteBaixo(e.target.value)}
              className="w-full mt-1 px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-400 outline-none"
              placeholder="ex: 5"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-500">Observação</label>
            <input
              type="text"
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              className="w-full mt-1 px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-400 outline-none"
              placeholder="opcional"
            />
          </div>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <div className="flex rounded-lg overflow-hidden border border-slate-300">
            <button
              onClick={() => setAcao("entrada")}
              className={`px-3 py-1.5 text-xs font-bold ${acao === "entrada" ? "bg-green-600 text-white" : "bg-slate-100 text-slate-600"}`}
            >
              + Entrada
            </button>
            <button
              onClick={() => setAcao("saida")}
              className={`px-3 py-1.5 text-xs font-bold ${acao === "saida" ? "bg-red-600 text-white" : "bg-slate-100 text-slate-600"}`}
            >
              − Saída
            </button>
          </div>
          <button
            onClick={salvar}
            disabled={salvando}
            className="px-4 py-1.5 text-xs font-bold rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Registrar"}
          </button>
          {msg && <span className="text-xs text-slate-600">{msg}</span>}
        </div>
      </div>

      {/* Tabela de estoque */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-slate-800 flex items-center gap-2">
            <span className="w-1 h-3.5 rounded-full bg-violet-600 inline-block" />
            Estoque Atual ({itens.length})
          </p>
          <button
            onClick={carregar}
            className="text-[10px] font-semibold text-violet-600 hover:text-violet-800"
          >
            Atualizar
          </button>
        </div>
        {carregando ? (
          <p className="text-xs text-slate-400">Carregando...</p>
        ) : erro ? (
          <p className="text-xs text-red-500">{erro}</p>
        ) : itens.length === 0 ? (
          <p className="text-xs text-slate-400">Nenhum produto com estoque registrado ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 border-b border-slate-200">
                  <th className="text-left py-2 px-2">ID</th>
                  <th className="text-left py-2 px-2">Nome</th>
                  <th className="text-right py-2 px-2">Qtd</th>
                  <th className="text-right py-2 px-2">Limite</th>
                  <th className="text-left py-2 px-2">Status</th>
                  <th className="text-right py-2 px-2">Ação</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((i) => (
                  <tr key={i.produto_id} className="border-b border-slate-100">
                    <td className="py-2 px-2 text-slate-400">#{i.produto_id}</td>
                    <td className="py-2 px-2 font-medium text-slate-800">{i.nome}</td>
                    <td className="py-2 px-2 text-right font-bold">{i.quantidade}</td>
                    <td className="py-2 px-2 text-right text-slate-400">{i.limite_baixo}</td>
                    <td className="py-2 px-2">
                      {i.quantidade <= i.limite_baixo ? (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">Baixo</span>
                      ) : (
                        <span className="text-[10px] font-bold text-green-700 bg-green-100 rounded-full px-2 py-0.5">OK</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-right">
                      {confirmarExclusao === i.produto_id ? (
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => excluir(i.produto_id)} disabled={excluindo === i.produto_id} className="text-[10px] font-bold text-white bg-red-600 rounded px-2 py-1 disabled:opacity-50">
                            {excluindo === i.produto_id ? "..." : "Confirmar"}
                          </button>
                          <button onClick={() => setConfirmarExclusao(null)} className="text-[10px] font-bold text-slate-500 bg-slate-100 rounded px-2 py-1">
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmarExclusao(i.produto_id)} className="text-slate-400 hover:text-red-600" title="Excluir item">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
                          </svg>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Histórico de movimentos */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
        <p className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-2">
          <span className="w-1 h-3.5 rounded-full bg-violet-600 inline-block" />
          Histórico de Movimentos
        </p>
        {movimentos.length === 0 ? (
          <p className="text-xs text-slate-400">Nenhuma movimentação registrada.</p>
        ) : (
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {movimentos.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-50">
                <div className="flex-1">
                  <span className="font-medium text-slate-700">#{m.produto_id} {m.nome}</span>
                  <span className="text-slate-400 ml-2">{MOTIVO_LABEL[m.motivo] || m.motivo}</span>
                  {m.observacao && <span className="text-slate-400 ml-2">— {m.observacao}</span>}
                </div>
                <div className={`font-bold ${m.quantidade >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {m.quantidade >= 0 ? "+" : ""}{m.quantidade}
                </div>
                <div className="text-slate-400 ml-3 w-24 text-right">
                  {new Date(m.created_at).toLocaleString("pt-BR")}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
