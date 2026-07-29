import { useEffect, useState } from "react";
import {
  criarCupom,
  enviarCupom,
  listarCupons,
  type Cupom,
} from "../../services/cupomApp";
import { listarClientesAdmin, type ClienteRelatorio } from "../../services/admin";

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
      await criarCupom({
        codigo: codigo.trim().toUpperCase(),
        tipo,
        valor: Number(valor),
        valor_minimo: minimo ? Number(minimo) : undefined,
        max_usos: maxUsos ? Number(maxUsos) : undefined,
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
      <form onSubmit={criar} className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3 backdrop-blur">
        <p className="text-xs font-bold text-white">Criar cupom</p>
        <div className="flex gap-2">
          <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Código (ex: VERAO20)" className="flex-1 h-10 px-3 rounded-xl border border-white/10 bg-black/40 text-white text-xs uppercase placeholder:text-white/30 focus:outline-none focus:border-gold" required />
          <select value={tipo} onChange={(e) => setTipo(e.target.value as any)} className="h-10 px-3 rounded-xl border border-white/10 bg-black/40 text-white text-xs focus:outline-none focus:border-gold">
            <option value="percentual">% Percentual</option>
            <option value="fixo">R$ Fixo</option>
          </select>
        </div>
        <div className="flex gap-2">
          <input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Valor (ex: 10 ou 15)" type="number" className="flex-1 h-10 px-3 rounded-xl border border-white/10 bg-black/40 text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-gold" required />
          <input value={minimo} onChange={(e) => setMinimo(e.target.value)} placeholder="Mínimo (R$)" type="number" className="flex-1 h-10 px-3 rounded-xl border border-white/10 bg-black/40 text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-gold" />
        </div>
        <div className="flex gap-2">
          <input value={maxUsos} onChange={(e) => setMaxUsos(e.target.value)} placeholder="Máx. usos" type="number" className="flex-1 h-10 px-3 rounded-xl border border-white/10 bg-black/40 text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-gold" />
          <div className="flex-1">
            <label className="block text-[9px] text-white/50 mb-0.5 px-1">Início</label>
            <input type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-white/10 bg-black/40 text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-gold" />
          </div>
        </div>
        <div>
          <label className="block text-[9px] text-white/50 mb-0.5 px-1">Término</label>
          <input type="datetime-local" value={fim} onChange={(e) => setFim(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-white/10 bg-black/40 text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-gold" required />
        </div>
        <input value={destinatarios} onChange={(e) => setDestinatarios(e.target.value)} placeholder="IDs de usuários (separados por vírgula) — opcional" className="w-full h-10 px-3 rounded-xl border border-white/10 bg-black/40 text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-gold" />
        <button type="submit" className="w-full h-10 bg-white text-black text-[11px] font-bold rounded-xl active:scale-[0.98] transition-all disabled:opacity-50">Criar cupom</button>
      </form>

      {erro && <p className="text-[11px] text-red-400">{erro}</p>}

      <div className="space-y-2">
        {loading && <p className="text-xs text-white/50">Carregando...</p>}
        {cupons.map((c) => (
          <div key={c.id} className="bg-white/5 border border-white/10 rounded-2xl p-3 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-bold text-white">{c.codigo}</p>
                <p className="text-[10px] text-white/60">
                  {c.tipo === "percentual" ? `${c.valor}%` : `R$ ${Number(c.valor).toFixed(2)}`} · {c.usos}/{c.max_usos ?? "∞"} usos · {new Date(c.data_fim).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => enviar(c.id, "todos")} className="px-3 py-2 bg-white/10 text-white text-[10px] font-bold rounded-xl border border-white/10">Todos</button>
                <button onClick={() => enviar(c.id, "vip")} className="px-3 py-2 bg-white text-black text-[10px] font-bold rounded-xl">VIP</button>
              </div>
            </div>
            {selecionados.size > 0 && (
              <button
                onClick={() => enviar(c.id, undefined, Array.from(selecionados))}
                className="mt-2 w-full h-9 bg-white text-black text-[10px] font-bold rounded-xl active:scale-95"
              >
                Enviar para {selecionados.size} selecionado{selecionados.size > 1 ? "s" : ""}
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2 backdrop-blur">
        <p className="text-xs font-bold text-white">Clientes ({clientes.length})</p>
        <p className="text-[10px] text-white/50">Marque os clientes e use "Enviar para selecionados" acima.</p>
        <div className="max-h-64 overflow-y-auto space-y-1">
          {clientes.map((cl) => (
            <label key={cl.email} className="flex items-center gap-2 py-1.5 px-2 rounded-xl hover:bg-white/10 cursor-pointer">
              <input type="checkbox" checked={selecionados.has(cl.email)} onChange={() => toggle(cl.email)} className="accent-white" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-white truncate">{cl.nome}</p>
                <p className="text-[9px] text-white/40 truncate">{cl.email}</p>
              </div>
            </label>
          ))}
          {clientes.length === 0 && <p className="text-[10px] text-white/50">Nenhum cliente encontrado.</p>}
        </div>
      </div>
    </div>
  );
}
