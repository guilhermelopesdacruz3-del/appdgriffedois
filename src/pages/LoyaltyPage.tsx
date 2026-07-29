import { useState, useEffect } from "react";
import { useCliente } from "../hooks/useCliente";
import { NIVEIS, BENEFICIO_BASE, TETO_BENEFICIOS_PERC } from "../data/fidelidade";

function formatarData(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function LoyaltyPage({ fidelidade: info, historicoFidelidade: historico, fidelidadeLoading: loading }: { fidelidade: any; historicoFidelidade?: any[]; fidelidadeLoading?: boolean }) {
  const { cliente } = useCliente();
  const email = cliente?.email || null;

  const pontos = info?.pontos ?? 0;
  const regras = info?.regras ?? { pontosPorReal: 1, pontosPorDesconto: 100 };
  // Nível vem do backend (info.nivel) ou cai no cálculo local para o visual.
  const nivelBackend = info?.nivel;
  const nivelLocal = NIVEIS.find((n) => n.min <= pontos && (n.max === null || pontos <= n.max)) || NIVEIS[0];
  const nivel = nivelBackend ? { ...nivelLocal, nome: nivelBackend.nome, cashbackAdicional: nivelBackend.cashbackAdicional, cupomAniversario: nivelBackend.cupomAniversario } : nivelLocal;
  const niveisLista = info?.niveis || NIVEIS.map((n) => ({ id: n.id, nome: n.nome, min: n.min, max: n.max }));
  const indiceAtual = NIVEIS.findIndex((n) => n.id === nivel.id);
  const prox = info?.proximoNivel || (indiceAtual < NIVEIS.length - 1 ? NIVEIS[indiceAtual + 1] : null);
  const ptsParaProx = info?.pontosParaProximoNivel ?? (prox ? Math.max(0, prox.min - pontos) : 0);
  const progresso = prox && prox.min > nivel.min ? Math.min(100, ((pontos - nivel.min) / (prox.min - nivel.min)) * 100) : 100;

  const cashbackPerc = info?.cashback?.percentual ?? nivel.cashbackAdicional + 2;
  const cashbackDisp = info?.cashback?.disponivel ?? Number(((pontos / regras.pontosPorDesconto) * 10).toFixed(2));
  const descontoMax = info?.desconto_max ?? 0;
  const [missoes, setMissoes] = useState<{id:string; descricao:string; pontos:number; feito:boolean}[]>([]);
  const [missoesLoading, setMissoesLoading] = useState(false);
  const [missoesErro, setMissoesErro] = useState<string | null>(null);
  const [missoesSucesso, setMissoesSucesso] = useState<string | null>(null);

  useEffect(() => {
    if (!email) return;
    let mounted = true;
    setMissoesLoading(true);
    setMissoesErro(null);
    fetch(`/api/fidelidade/missao?email=${encodeURIComponent(email)}`)
      .then((r) => {
        if (!mounted) return;
        if (!r.ok) throw new Error(`Falha ao carregar missões (HTTP ${r.status}).`);
        return r.json();
      })
      .then((j) => {
        if (!mounted) return;
        const lista = Array.isArray(j.missoes) ? j.missoes : [];
        setMissoes(lista);
        setMissoesErro(lista.length ? null : "Nenhuma missão disponível no momento.");
      })
      .catch((e) => {
        if (mounted) setMissoesErro(e.message || "Não foi possível carregar missões.");
      })
      .finally(() => { if (mounted) setMissoesLoading(false); });
    return () => { mounted = false; };
  }, [email]);

  const concluirMissao = async (tipo: string) => {
    if (!email) return;
    setMissoesLoading(true);
    setMissoesErro(null);
    setMissoesSucesso(null);
    try {
      const r = await fetch("/api/fidelidade/missao/concluir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, tipo }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        const mensagem = j.erro || `Falha ao concluir missão (HTTP ${r.status}).`;
        setMissoesErro(mensagem);
        alert(mensagem);
        return;
      }
      setMissoes((prev: {id:string; descricao:string; pontos:number; feito:boolean}[]) => prev.map((m: {id:string; descricao:string; pontos:number; feito:boolean}) => (m.id === tipo ? { ...m, feito: true } : m)));
      if (j.jaConcedida) {
        setMissoesSucesso("Missão já havia sido concluída anteriormente.");
      } else if (j.pontosConcedidos > 0) {
        setMissoesSucesso(`+${j.pontosConcedidos} pontos concedidos!`);
      }
    } catch (e: any) {
      const mensagem = e.message || "Não foi possível concluir a missão.";
      setMissoesErro(mensagem);
      alert(mensagem);
    } finally {
      setMissoesLoading(false);
    }
  };

  return (
    <div className="pb-4">
      {/* VIP Card */}
      <div className="mx-4 mt-2 relative overflow-hidden rounded-[28px] bg-luxury-black p-5 shadow-xl shadow-black/10 ring-1 ring-white/10">
        <div className="absolute inset-0 opacity-60">
          <div className="absolute -top-10 -right-10 w-56 h-56 rounded-full border border-white/10" />
          <div className="absolute -top-20 right-10 w-72 h-72 rounded-full bg-gradient-to-br from-white/10 to-transparent" />
          <div className="absolute -bottom-24 -left-16 w-60 h-60 rounded-full bg-gradient-to-tr from-gold/10 to-transparent" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1 text-gold/90">Clube D'Griffe</p>
              <h2 className="text-white text-[22px] font-bold leading-tight">{nivel.nome}</h2>
            </div>
            <div className="w-14 h-14 bg-gradient-to-br from-gold to-yellow-600 rounded-full flex items-center justify-center shadow-xl shadow-gold/20 border border-white/10">
              <span className="text-2xl">👑</span>
            </div>
          </div>

          <div className="bg-white/5 rounded-2xl p-4 mb-3 border border-white/10 backdrop-blur-sm">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Pontos Acumulados</p>
            <p className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-gold">{pontos.toLocaleString('pt-BR')}</p>
            {prox ? (
              <div className="mt-4">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[10px] text-gray-500">Progresso para {prox.nome}</span>
                  <span className="text-[10px] font-semibold text-gold/90">{prox.min.toLocaleString('pt-BR')} pts</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden border border-white/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-gold to-yellow-400 transition-all duration-1000" style={{ width: `${Math.min(progresso, 100)}%` }} />
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5">Faltam {ptsParaProx.toLocaleString('pt-BR')} pts</p>
              </div>
            ) : (
              <p className="text-[10px] text-gray-400 mt-2">Nível máximo alcançado 🎉</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Cashback Disponível</p>
              <p className="text-lg font-bold text-white">{cashbackDisp.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
            </div>
            <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Desconto Atual</p>
              <p className="text-lg font-bold text-white">{descontoMax}<span className="text-gold text-sm ml-0.5">%</span></p>
            </div>
          </div>
        </div>
      </div>

      {/* Faixas de nível */}
      <div className="px-5 mt-6 mb-2">
        <h3 className="text-[13px] font-bold text-luxury-black">Níveis de Relacionamento</h3>
        <p className="text-[10px] text-gray-500">Acumule pontos e desbloqueie benefícios</p>
      </div>
      <div className="px-4 space-y-2">
        {niveisLista.map((n: any) => {
          const idx = NIVEIS.findIndex((x) => x.id === n.id);
          const ativo = idx === indiceAtual;
          const alcancado = idx <= indiceAtual;
          return (
            <div key={n.id} className={`flex items-center justify-between px-4 py-3 rounded-2xl border transition-all ${ativo ? 'bg-luxury-black shadow-lg shadow-black/10 border-luxury-black' : 'bg-white border-ice-dark/60'}`}>
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full shrink-0 ring-2 ring-white/60" style={{ background: NIVEIS[idx]?.cor || '#ccc' }} />
                <span className={`text-xs font-semibold ${ativo ? 'text-white' : alcancado ? 'text-luxury-black' : 'text-gray-400'}`}>{n.nome}</span>
              </div>
              <div className="text-right">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${ativo ? 'text-gold' : ativo ? 'text-gold' : 'text-gray-400'}`}>
                  {n.min?.toLocaleString('pt-BR')}{n.max ? `–${n.max.toLocaleString('pt-BR')}` : '+'} pts
                </span>
                {ativo && <p className="text-[10px] text-white/70 mt-0.5">Seu nível atual</p>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Benefícios do nível */}
      <div className="px-5 mt-7 mb-2">
        <h3 className="text-[13px] font-bold text-luxury-black">Benefícios {nivel.nome}</h3>
      </div>
      <div className="px-4 space-y-2.5">
        <div className="rounded-2xl bg-white shadow-sm border border-gold/10 p-4 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center text-xl shrink-0">💎</div>
          <div>
            <p className="text-xs font-semibold text-luxury-black">Benefício base</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{BENEFICIO_BASE.parcelado}% parc. / {BENEFICIO_BASE.pix}% Pix</p>
          </div>
        </div>
        <div className="rounded-2xl bg-white shadow-sm border border-gold/10 p-4 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center text-xl shrink-0">🏷️</div>
          <div>
            <p className="text-xs font-semibold text-luxury-black">Cashback Grau / Solar / Joias</p>
            <p className="text-[10px] text-gray-500 mt-0.5">Aplicado automaticamente no carrinho</p>
            <span className="text-[10px] font-bold text-gold">{cashbackPerc}%</span>
          </div>
        </div>
        {nivel.cupomAniversario > 0 && (
          <div className="rounded-2xl bg-white shadow-sm border border-gold/10 p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center text-xl shrink-0">🎂</div>
            <div>
              <p className="text-xs font-semibold text-luxury-black">Cupom de aniversário</p>
              <p className="text-[10px] text-gray-500 mt-0.5">Valor do cupom</p>
              <span className="text-[10px] font-bold text-gold">R$ {nivel.cupomAniversario},00</span>
            </div>
          </div>
        )}
      </div>

      {/* Indicação + Família (atalhos) */}
      <div className="px-4 mt-5 space-y-2.5">
        <div className="bg-gradient-to-r from-gold/10 to-gold/5 rounded-2xl p-4 border border-gold/20 flex items-center gap-3">
          <div className="w-10 h-10 bg-gold/20 rounded-xl flex items-center justify-center"><span className="text-lg">🎁</span></div>
          <div className="flex-1">
            <p className="text-xs font-bold text-luxury-black">Indique e Ganhe</p>
            <p className="text-[10px] text-gray-500">200 pontos por indicação convertida</p>
          </div>
          <button onClick={async () => {
            if (!cliente?.email) return;
            try {
              const r = await fetch(`/api/indicacao/codigo?email=${encodeURIComponent(cliente.email)}`);
              const j = await r.json();
              alert(`Seu código: ${j.codigo}\nIndicações convertidas: ${j.indicacoesConvertidas}/${j.limiteAnual}`);
            } catch { alert("Não foi possível gerar o código."); }
          }} className="px-4 py-2 bg-luxury-black text-white text-[10px] font-bold rounded-xl active:scale-95 transition-all">Indicar</button>
        </div>
        <div className="bg-gradient-to-r from-gold/10 to-gold/5 rounded-2xl p-4 border border-gold/20 flex items-center gap-3">
          <div className="w-10 h-10 bg-gold/20 rounded-xl flex items-center justify-center"><span className="text-lg">👨‍👩‍👧</span></div>
          <div className="flex-1">
            <p className="text-xs font-bold text-luxury-black">Clube Família</p>
            <p className="text-[10px] text-gray-500">Até 5 membros · 20% dos pontos da compra viram pontos do responsável</p>
          </div>
          <button onClick={async () => {
            if (!cliente?.email) return;
            try {
              const r = await fetch(`/api/familia?email=${encodeURIComponent(cliente.email)}`);
              const j = await r.json();
              alert(`Membros: ${j.membros?.length}/${j.limite}\nCréditos Família: R$ ${j.creditos?.creditoRs || 0}`);
            } catch { alert("Não foi possível ler o clube."); }
          }} className="px-4 py-2 bg-luxury-black text-white text-[10px] font-bold rounded-xl active:scale-95 transition-all">Ver</button>
        </div>
        <p className="text-[9px] text-gray-400 text-center px-2">Teto de benefícios por venda: {TETO_BENEFICIOS_PERC}%</p>
      {info && (
        <div className="px-4 mt-5">
          <h3 className="text-sm font-bold text-luxury-black mb-2">Missões</h3>
          {missoesLoading && <p className="text-[11px] text-gray-400 text-center py-2">Carregando missões…</p>}
        {missoesErro && !missoesLoading && <p className="text-[11px] text-red-600 text-center py-2 bg-red-50 border border-red-200 rounded-xl">{missoesErro}</p>}
        {missoesSucesso && !missoesLoading && <p className="text-[11px] text-green-700 text-center py-2 bg-green-50 border border-green-200 rounded-xl">{missoesSucesso}</p>}
          <div className="space-y-2">
            {missoes.map((m) => (
              <div key={m.id} className={`flex items-center gap-3 p-3 rounded-xl ${m.feito ? "bg-green-50 border border-green-200" : "bg-white border border-ice-dark/40"}`}>
                <span className="text-lg">{m.id === "cadastro_completo" ? "✅" : m.id === "primeira_compra" ? "🛒" : m.id === "avaliar_atendimento" ? "⭐" : m.id === "indicacao_convertida" ? "🎁" : m.id === "recompra_12m" ? "🔁" : "🏆"}</span>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-luxury-black">{m.descricao}</p>
                  <p className="text-[10px] text-gold font-bold">+{m.pontos} pts</p>
                </div>
                {m.feito ? (
                  <span className="text-green-600 text-xs font-bold">✓</span>
                ) : m.id === "avaliar_atendimento" ? (
                  <button onClick={async () => { await concluirMissao(m.id); }} className="px-3 py-1.5 bg-gold text-white text-[10px] font-bold rounded-xl active:scale-95 transition-all">Concluir</button>
                ) : (
                  <span className="text-gray-300 text-xs font-bold">○</span>
                )}
              </div>
            ))}
          </div>
          <h3 className="text-sm font-bold text-luxury-black mt-5 mb-2">Validade</h3>
          <div className="bg-white rounded-2xl p-4 border border-ice-dark/40 space-y-2 text-xs text-luxury-black">
            <div className="flex justify-between"><span>Pontos sem movimentação</span><span className="font-bold">24 meses → -50% / 36 meses → expira</span></div>
            <div className="flex justify-between"><span>Cashback sem movimentação</span><span className="font-bold">12 meses → -50% + 180 dias</span></div>
            <p className="text-gray-500 text-[10px]">Qualquer compra ou serviço pago renova o prazo.</p>
          </div>
        </div>
      )}
      </div>

      {/* Histórico */}
      <div className="px-5 mt-6 mb-3">
        <h3 className="text-sm font-bold text-luxury-black">Histórico</h3>
        <p className="text-[10px] text-gray-500">Seus créditos e resgates</p>
      </div>
      <div className="px-4 space-y-2">
        {loading && <p className="text-[11px] text-gray-400 text-center py-4">Carregando…</p>}
        {!loading && (!historico || historico.length === 0) && (
          <p className="text-[11px] text-gray-400 text-center py-4">
            {email ? "Nenhuma movimentação ainda." : "Faça login para ver seu histórico."}
          </p>
        )}
        {(historico || []).map((h: any, i: number) => (
          <div key={h.id ?? i} className="flex items-center gap-3 p-3 rounded-2xl bg-white shadow-sm border border-ice-dark/40">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm flex-shrink-0 ${h.tipo === "credito" ? "bg-green-100" : "bg-red-100"}`}>
              {h.tipo === "credito" ? "⬆️" : "⬇️"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-luxury-black leading-tight">
                {h.tipo === "credito" ? "Crédito" : "Resgate"}
                {h.motivo ? ` · ${h.motivo}` : ""}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">{formatarData(h.created_at)}</p>
            </div>
            <span className={`text-xs font-bold ${h.tipo === "credito" ? "text-green-600" : "text-red-500"}`}>
              {h.tipo === "credito" ? "+" : "−"}{h.pontos}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
