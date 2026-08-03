import { useEffect, useState } from "react";
import { listarClientesAdmin, type ClienteRelatorio } from "../../services/admin";
import { notificarClientesAdmin, type FiltrosNotificar } from "../../services/notificacoes";

type Tipo = "cupom" | "promocao" | "produto" | "carrinho" | "geral";

const TIPOS: { value: Tipo; label: string; color: string; icon: string }[] = [
  { value: "cupom", label: "Cupom", color: "bg-amber-400/10 border border-amber-300/25 text-amber-200", icon: "🎟️" },
  { value: "promocao", label: "Promoção", color: "bg-rose-400/10 border border-rose-300/25 text-rose-200", icon: "🔥" },
  { value: "produto", label: "Produto exclusivo", color: "bg-violet-400/10 border border-violet-300/25 text-violet-200", icon: "✨" },
  { value: "carrinho", label: "Aviso de carrinho", color: "bg-sky-400/10 border border-sky-300/25 text-sky-200", icon: "🛒" },
  { value: "geral", label: "Geral", color: "bg-white/5 border border-white/10 text-gray-200", icon: "📣" },
];

const TEMPLATES = [
  { label: "Cupom 10% OFF", titulo: "Cupom de 10% OFF", corpo: "Use o cupom SAUDE10 e ganhe 10% em óculos de grau e solar.", tipo: "cupom" as Tipo },
  { label: "Frete grátis", titulo: "Frete grátis hoje", corpo: "Aproveite: hoje o frete é por nossa conta para todo o Brasil.", tipo: "promocao" as Tipo },
  { label: "Novidade", titulo: "Novidade na D'Griffe", corpo: "Chegou uma coleção nova de armações. Venha conferir.", tipo: "produto" as Tipo },
  { label: "Carrinho abandonado", titulo: "Faltou pouco!", corpo: "Você deixou itens no carrinho. Finalize agora e garanta sua preferência.", tipo: "carrinho" as Tipo },
];

const inputCls =
  "h-10 px-3 rounded-xl border border-white/15 bg-black/40 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-all";
const cardCls =
  "bg-gradient-to-b from-white/[0.07] to-white/[0.02] border border-white/10 rounded-2xl";

export default function NotificacoesAdmin() {
  const [clientes, setClientes] = useState<ClienteRelatorio[]>([]);
  const [titulo, setTitulo] = useState("");
  const [corpo, setCorpo] = useState("");
  const [tipo, setTipo] = useState<Tipo>("cupom");
  const [fEmail, setFEmail] = useState("");
  const [fNome, setFNome] = useState("");
  const [fPontosMin, setFPontosMin] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [historico, setHistorico] = useState<{ titulo: string; tipo: Tipo; enviadas: number; ts: string }[]>([]);

  useEffect(() => {
    listarClientesAdmin()
      .then((r) => setClientes(r.clientes))
      .catch(() => setClientes([]));
  }, []);

  const previewFiltro = () => {
    return clientes.filter((c) => {
      if (fEmail && !c.email.toLowerCase().includes(fEmail.toLowerCase())) return false;
      if (fNome && !c.nome.toLowerCase().includes(fNome.toLowerCase())) return false;
      if (fPontosMin && Number(fPontosMin) > 0 && ((c as any).pontos ?? 0) < Number(fPontosMin)) return false;
      return true;
    });
  };
  const preview = previewFiltro();

  const enviar = async () => {
    if (!titulo.trim() || !corpo.trim()) {
      setStatus("Preencha título e mensagem.");
      return;
    }
    setEnviando(true);
    setStatus(null);
    const filtros: FiltrosNotificar = {};
    if (fEmail.trim()) filtros.email = fEmail.trim();
    if (fNome.trim()) filtros.nome = fNome.trim();
    if (fPontosMin && Number(fPontosMin) > 0) filtros.pontosMin = Number(fPontosMin);
    try {
      const r = await notificarClientesAdmin({ titulo, corpo, tipo, filtros });
      setStatus(`Enviado para ${r.enviadas} cliente(s).`);
      setTitulo("");
      setCorpo("");
      setHistorico((prev) => [
        ...prev,
        { titulo, tipo, enviadas: r.enviadas, ts: new Date().toLocaleString("pt-BR") },
      ].slice(-40));
      window.dispatchEvent(new Event("notificacoes-atualizadas"));
    } catch (e: any) {
      setStatus(e.message || "Falha ao enviar.");
    } finally {
      setEnviando(false);
    }
  };

  const tipoAtivo = TIPOS.find((t) => t.value === tipo);

  return (
    <div className="px-4 py-4 space-y-4 -mx-4 -mt-4 bg-luxury-black">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-white flex items-center gap-2"><span className="w-1 h-4 rounded-full bg-gold inline-block" />Notificações</h2>
        <span className="text-[10px] text-white/60 bg-white/5 border border-white/10 rounded-full px-2.5 py-1">Envio custa 1 notificação por cliente</span>
      </div>

      <div className={`${cardCls} p-4 space-y-3`}>
        <p className="text-[11px] font-bold text-gold/80 uppercase tracking-wider">Modelos rápidos</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TEMPLATES.map((tpl) => (
            <button
              key={tpl.label}
              onClick={() => { setTitulo(tpl.titulo); setCorpo(tpl.corpo); setTipo(tpl.tipo); }}
              className="shrink-0 px-3 py-2 rounded-xl border border-white/10 bg-white/10 text-[10px] font-semibold text-white hover:border-gold/40 hover:bg-white/15 transition-all"
            >
              {tpl.label}
            </button>
          ))}
        </div>
      </div>

      <div className={`${cardCls} p-4 shadow-sm space-y-3`}>
        <div className="flex gap-2">
          {TIPOS.map((item) => (
            <button
              key={item.value}
              onClick={() => setTipo(item.value)}
              className={`flex-1 py-2 rounded-xl border text-[10px] font-bold transition-all ${tipo === item.value ? `${item.color} border-current shadow-lg` : "border-white/10 text-gray-300 hover:bg-white/5"}`}
            >
              <span className="block text-sm leading-none mb-1">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
        <div>
          <label className="text-[11px] text-gold/70 font-bold mb-1 block">Título</label>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Cupom de 10% OFF" className={`${inputCls} w-full`} />
        </div>
        <div>
          <label className="text-[11px] text-gold/70 font-bold mb-1 block">Mensagem</label>
          <textarea value={corpo} onChange={(e) => setCorpo(e.target.value)} placeholder="Ex: Use o cupom SAUDE10..." rows={3} className="w-full px-3 py-2 rounded-xl border border-white/15 bg-black/40 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-all" />
        </div>

        {/* Pré-visualização mobile */}
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <p className="text-[10px] font-bold text-gold/70 uppercase tracking-wider mb-2">Pré-visualização</p>
          <div className="bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/10 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10">
              <p className="text-[11px] font-bold text-white leading-tight">{titulo || "Título da notificação"}</p>
            </div>
            <div className="px-4 py-3">
              <p className="text-[10px] text-white/70 leading-relaxed">{corpo || "Mensagem aparecerá aqui..."}</p>
            </div>
            <div className="px-4 py-2 border-t border-white/10 flex items-center justify-between">
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-lg border ${tipoAtivo?.color || "bg-white/5 border-white/10 text-gray-200"}`}>{tipoAtivo?.icon} {tipoAtivo?.label ?? tipo}</span>
              <span className="text-[9px] text-white/50">Agora</span>
            </div>
          </div>
        </div>
      </div>

      <div className={`${cardCls} p-4 shadow-sm space-y-3`}>
        <p className="text-[11px] font-bold text-gold/70 uppercase tracking-wider">Destinatários (filtros)</p>
        <input value={fEmail} onChange={(e) => setFEmail(e.target.value)} placeholder="Filtrar por e-mail (parte)" className={`${inputCls} w-full`} />
        <input value={fNome} onChange={(e) => setFNome(e.target.value)} placeholder="Filtrar por nome" className={`${inputCls} w-full`} />
        <input value={fPontosMin} onChange={(e) => setFPontosMin((e.target.value || "").replace(/\D+/g, "").slice(0, 20))} placeholder="Nível mínimo de fidelidade (pontos)" className={`${inputCls} w-full`} />
        <p className="text-[11px] text-white/60 bg-white/5 border border-white/10 rounded-xl px-3 py-2">{preview.length} cliente(s) correspondem aos filtros.</p>
      </div>

      {status && <p className="text-[11px] text-center text-gold">{status}</p>}

      <button onClick={enviar} disabled={enviando} className="w-full h-12 bg-gradient-to-r from-gold to-gold-dark text-black text-xs font-bold rounded-2xl disabled:opacity-60 active:scale-[0.98] transition-all shadow-lg shadow-gold/20 hover:brightness-110">
        {enviando ? "Enviando..." : "Enviar notificação"}
      </button>

      {historico.length > 0 && (
        <div className={`${cardCls} p-4 shadow-sm space-y-2`}>
          <p className="text-[11px] font-bold text-gold/70 uppercase tracking-wider">Histórico recente</p>
          <div className="space-y-2">
            {historico.map((h, idx) => (
              <div key={idx} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 hover:border-gold/20 transition-colors">
                <div>
                  <p className="text-xs font-semibold text-white leading-tight">{h.titulo}</p>
                  <p className="text-[10px] text-white/60">{h.ts} • {h.enviadas} destinatário(s)</p>
                </div>
                <span className={`text-[9px] font-bold px-2 py-1 rounded-lg border ${TIPOS.find((t) => t.value === h.tipo)?.color ?? "bg-white/5 border-white/10 text-gray-200"}`}>
                  {TIPOS.find((t) => t.value === h.tipo)?.label ?? h.tipo}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
