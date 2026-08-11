import { useEffect, useState } from "react";
import {
  criarCupom,
  enviarCupom,
  listarCupons,
  type Cupom,
} from "../../services/cupomApp";
import { listarClientesAdmin, type ClienteRelatorio } from "../../services/admin";

const inputCls =
  "h-10 px-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs placeholder:text-slate-400 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all";
const cardCls =
  "bg-white border border-slate-200 rounded-2xl shadow-sm";
const btnPrimary =
  "bg-gradient-to-r from-violet-600 to-purple-500 text-white font-bold rounded-xl active:scale-[0.98] transition-all hover:brightness-110 disabled:opacity-50";

export default function CuponsAdmin() {
  const [cupons, setCupons] = useState<Cupom[]>([]);
  const [clientes, setClientes] = useState<ClienteRelatorio[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [codigo, setCodigo] = useState("");
  const [tipo, setTipo] = useState<"percentual" | "fixo">("percentual");
  const [valor, setValor] = useState("");
  const [minimo, setMinimo] = useState("");
  const [maxUsos, setMaxUsos] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [destinatarios, setDestinatarios] = useState("");

  const carregar = async () => {
    setLoading(true);
    try {
      const [c, cl] = await Promise.all([listarCupons(), listarClientesAdmin()]);
      setCupons(c);
      setClientes(cl.clientes || []);
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    try {
      const num = (v: string) => Number(String(v).trim().replace(",", "."));
      const valorNum = num(valor);
      const minimoNum = minimo ? num(minimo) : undefined;
      const maxUsosNum = maxUsos ? num(maxUsos) : undefined;
      if (!Number.isFinite(valorNum)) {
        setErro("Valor inválido — use ponto ou vírgula (ex: 10,50).");
        return;
      }
      await criarCupom({
        codigo: codigo.trim().toUpperCase(),
        tipo,
        valor: valorNum,
        valor_minimo: minimoNum,
        max_usos: maxUsosNum,
        data_inicio: inicio || new Date().toISOString(),
        data_fim: fim,
        destinatarios: destinatarios ? destinatarios.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
      });
      setCodigo("");
      setValor("");
      setMinimo("");
      setMaxUsos("");
      setInicio("");
      setFim("");
      setDestinatarios("");
      await carregar();
      window.dispatchEvent(new Event("cupons-atualizados"));
    } catch (e: any) {
      setErro(e.message);
    }
  };

  const enviar = async (id: string, grupo?: string, emails?: string[]) => {
    setErro(null);
    try {
      await enviarCupom(id, { grupo: grupo as any, emails });
      await carregar();
      window.dispatchEvent(new Event("cupons-atualizados"));
    } catch (e: any) {
      setErro(e.message);
    }
  };

  const toggle = (email: string) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <form onSubmit={criar} className={`${cardCls} p-4 space-y-3`}>
        <p className="text-xs font-bold text-slate-800 flex items-center gap-2"><span className="w-1 h-3.5 rounded-full bg-violet-600 inline-block" />Criar cupom</p>
        <div className="flex gap-2">
          <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Código (ex: VERAO20)" className={`${inputCls} flex-1 uppercase`} required />
          <select value={tipo} onChange={(e) => setTipo(e.target.value as any)} className={inputCls}>
            <option value="percentual">% Percentual</option>
            <option value="fixo">R$ Fixo</option>
          </select>
        </div>
        <div className="flex gap-2">
          <input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Valor (ex: 10 ou 15)" type="number" className={`${inputCls} flex-1`} required />
          <input value={minimo} onChange={(e) => setMinimo(e.target.value)} placeholder="Mínimo (R$)" type="number" className={`${inputCls} flex-1`} />
        </div>
        <div className="flex gap-2">
          <input value={maxUsos} onChange={(e) => setMaxUsos(e.target.value)} placeholder="Máx. usos" type="number" className={`${inputCls} flex-1`} />
          <div className="flex-1">
            <label className="block text-[9px] text-violet-600/60 mb-0.5 px-1 uppercase tracking-wider font-bold">Início</label>
            <input type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} className={`${inputCls} w-full`} />
          </div>
        </div>
        <div>
          <label className="block text-[9px] text-violet-600/60 mb-0.5 px-1 uppercase tracking-wider font-bold">Término</label>
          <input type="datetime-local" value={fim} onChange={(e) => setFim(e.target.value)} className={`${inputCls} w-full`} required />
        </div>
        <input value={destinatarios} onChange={(e) => setDestinatarios(e.target.value)} placeholder="IDs de usuários (separados por vírgula) — opcional" className={`${inputCls} w-full`} />
        <button type="submit" className={`${btnPrimary} w-full h-10 text-[11px]`}>Criar cupom</button>
      </form>

      {erro && <p className="text-[11px] text-red-600 px-1">{erro}</p>}

      <div className="space-y-2">
        <p className="text-xs font-bold text-slate-800 px-1 flex items-center gap-2"><span className="w-1 h-3.5 rounded-full bg-violet-600 inline-block" />Cupons ({cupons.length})</p>
        {loading && <p className="text-xs text-slate-400 px-1">Carregando...</p>}
        {cupons.map((c) => (
          <div key={c.id} className={`${cardCls} p-3 shadow-sm hover:border-violet-200 transition-colors`}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800">{c.codigo}</p>
                <p className="text-[10px] text-slate-500">
                  {c.tipo === "percentual" ? `${c.valor}%` : `R$ ${Number(c.valor).toFixed(2)}`} · {c.usos}/{c.max_usos ?? "∞"} usos · {new Date(c.data_fim).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => enviar(c.id, "todos")} className="px-3 py-2 text-[10px] bg-slate-100 text-slate-800 border border-slate-300 rounded-xl hover:bg-slate-200 transition-all">Todos</button>
                <button onClick={() => enviar(c.id, "vip")} className={`px-3 py-2 text-[10px] ${btnPrimary}`}>VIP</button>
              </div>
            </div>
            {selecionados.size > 0 && (
              <button
                onClick={() => enviar(c.id, undefined, Array.from(selecionados))}
                className={`mt-2 w-full h-9 text-[10px] ${btnPrimary}`}
              >
                Enviar para {selecionados.size} selecionado{selecionados.size > 1 ? "s" : ""}
              </button>
            )}
          </div>
        ))}
        {!loading && cupons.length === 0 && (
          <div className={`${cardCls} p-8 text-center`}>
            <svg className="mx-auto mb-3 text-slate-800/20" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>
            <p className="text-xs text-slate-400">Nenhum cupom criado ainda.</p>
          </div>
        )}
      </div>

      <div className={`${cardCls} p-4 space-y-2`}>
        <p className="text-xs font-bold text-slate-800 flex items-center gap-2"><span className="w-1 h-3.5 rounded-full bg-violet-600 inline-block" />Clientes ({clientes.length})</p>
        <p className="text-[10px] text-slate-400">Marque os clientes e use "Enviar para selecionados" acima.</p>
        <div className="max-h-64 overflow-y-auto space-y-1">
          {clientes.map((cl) => (
            <label key={cl.email} className="flex items-center gap-2 py-1.5 px-2 rounded-xl hover:bg-violet-50 cursor-pointer transition-colors">
              <input type="checkbox" checked={selecionados.has(cl.email)} onChange={() => toggle(cl.email)} className="accent-violet-600" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-slate-800 truncate">{cl.nome}</p>
                <p className="text-[9px] text-slate-400 truncate">{cl.email}</p>
              </div>
            </label>
          ))}
          {clientes.length === 0 && <p className="text-[10px] text-slate-400">Nenhum cliente encontrado.</p>}
        </div>
      </div>
    </div>
  );
}
