import { benefits } from "../data";
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

  return (
    <div className="pb-4">
      {/* VIP Card */}
      <div className="mx-4 mt-2 relative overflow-hidden rounded-3xl bg-luxury-black p-5">
        <div className="absolute top-0 right-0 w-40 h-40">
          <div className="absolute -top-10 -right-10 w-40 h-40 border rounded-full" style={{ borderColor: `${nivel.cor}22` }} />
          <div className="absolute -top-4 -right-4 w-28 h-28 border rounded-full" style={{ borderColor: `${nivel.cor}18` }} />
        </div>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: nivel.cor }}>Clube D'Griffe</p>
              <h2 className="text-white text-xl font-bold">{nivel.nome}</h2>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-gold to-gold-dark rounded-full flex items-center justify-center shadow-lg shadow-gold/20">
              <span className="text-xl">👑</span>
            </div>
          </div>

          <div className="bg-luxury-gray/50 rounded-2xl p-4 mb-3 border" style={{ borderColor: `${nivel.cor}22` }}>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Pontos Acumulados</p>
            <p className="text-3xl font-bold text-gold-gradient">{pontos.toLocaleString('pt-BR')}</p>
            {prox ? (
              <div className="mt-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[9px] text-gray-500">Progresso para {prox.nome}</span>
                  <span className="text-[9px] font-semibold" style={{ color: nivel.cor }}>{prox.min.toLocaleString('pt-BR')} pts</span>
                </div>
                <div className="h-1.5 bg-luxury-gray rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${progresso}%`, background: nivel.cor }} />
                </div>
                <p className="text-[9px] text-gray-500 mt-1">Faltam {ptsParaProx.toLocaleString('pt-BR')} pts</p>
              </div>
            ) : (
              <p className="text-[9px] text-gray-500 mt-2">Nível máximo alcançado 🎉</p>
            )}
          </div>

          <div className="flex gap-3">
            <div className="flex-1 bg-luxury-gray/50 rounded-xl p-3 border border-gold/10">
              <p className="text-[9px] text-gray-400 uppercase tracking-wider">Cashback</p>
              <p className="text-lg font-bold text-white">{cashbackDisp.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
            </div>
            <div className="flex-1 bg-luxury-gray/50 rounded-xl p-3 border border-gold/10">
              <p className="text-[9px] text-gray-400 uppercase tracking-wider">Desconto Atual</p>
              <p className="text-lg font-bold text-white">{descontoMax}<span className="text-gold text-sm">%</span></p>
            </div>
          </div>
        </div>
      </div>

      {/* Faixas de nível */}
      <div className="px-5 mt-5 mb-2">
        <h3 className="text-sm font-bold text-luxury-black">Níveis de Relacionamento</h3>
        <p className="text-[10px] text-gray-500">Acumule pontos e desbloqueie benefícios</p>
      </div>
      <div className="px-4 space-y-1.5">
        {niveisLista.map((n: any) => {
          const idx = NIVEIS.findIndex((x) => x.id === n.id);
          const ativo = idx === indiceAtual;
          const alcancado = idx <= indiceAtual;
          return (
            <div key={n.id} className={`flex items-center justify-between px-4 py-2.5 rounded-xl border ${ativo ? 'bg-luxury-black' : 'bg-white border-ice-dark/50'}`}>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: NIVEIS[idx]?.cor || '#ccc' }} />
                <span className={`text-xs font-semibold ${ativo ? 'text-white' : alcancado ? 'text-luxury-black' : 'text-gray-400'}`}>{n.nome}</span>
              </span>
              <span className={`text-[9px] ${ativo ? 'text-gold' : 'text-gray-400'}`}>
                {n.min?.toLocaleString('pt-BR')}{n.max ? `–${n.max.toLocaleString('pt-BR')}` : '+'} pts
              </span>
            </div>
          );
        })}
      </div>

      {/* Benefícios do nível */}
      <div className="px-5 mt-5 mb-2">
        <h3 className="text-sm font-bold text-luxury-black">Benefícios {nivel.nome}</h3>
      </div>
      <div className="px-4 space-y-2">
        <div className="rounded-2xl bg-white shadow-sm border border-gold/10 p-3 flex items-center justify-between">
          <span className="text-xs text-luxury-black">Benefício base</span>
          <span className="text-xs font-bold text-gold">{BENEFICIO_BASE.parcelado}% parc. / {BENEFICIO_BASE.pix}% Pix</span>
        </div>
        <div className="rounded-2xl bg-white shadow-sm border border-gold/10 p-3 flex items-center justify-between">
          <span className="text-xs text-luxury-black">Cashback Grau / Solar / Joias</span>
          <span className="text-xs font-bold text-gold">{cashbackPerc}%</span>
        </div>
        {nivel.cupomAniversario > 0 && (
          <div className="rounded-2xl bg-white shadow-sm border border-gold/10 p-3 flex items-center justify-between">
            <span className="text-xs text-luxury-black">Cupom de aniversário</span>
            <span className="text-xs font-bold text-gold">R$ {nivel.cupomAniversario},00</span>
          </div>
        )}
      </div>

      {/* Indicação + Família (atalhos) */}
      <div className="px-4 mt-5 space-y-2.5">
        <div className="bg-gradient-to-r from-gold/10 to-gold/5 rounded-2xl p-4 border border-gold/20 flex items-center gap-3">
          <div className="w-10 h-10 bg-gold/20 rounded-xl flex items-center justify-center"><span className="text-lg">🎁</span></div>
          <div className="flex-1">
            <p className="text-xs font-bold text-luxury-black">Indique e Ganhe</p>
            <p className="text-[10px] text-gray-500">R$ 50 + 200 pontos por indicação</p>
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
            <p className="text-[10px] text-gray-500">Até 5 membros · 20% dos pontos viram crédito</p>
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
          <div className="space-y-2">
            {[
              { id: "cadastro_completo", label: "Completar cadastro", pontos: 100, icon: "✅", feito: true },
              { id: "primeira_compra", label: "Primeira compra", pontos: 500, icon: "🛒", feito: false },
              { id: "avaliar_atendimento", label: "Avaliar atendimento", pontos: 100, icon: "⭐", feito: false },
              { id: "indicacao_convertida", label: "Indicação convertida", pontos: 200, icon: "🎁", feito: false },
              { id: "recompra_12m", label: "Recompra em 12 meses", pontos: 400, icon: "🔁", feito: false },
            ].map((m) => (
              <div key={m.id} className={`flex items-center gap-3 p-3 rounded-xl ${m.feito ? "bg-green-50 border border-green-200" : "bg-white border border-ice-dark/40"}`}>
                <span className="text-lg">{m.icon}</span>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-luxury-black">{m.label}</p>
                  <p className="text-[10px] text-gold font-bold">+{m.pontos} pts</p>
                </div>
                {m.feito ? <span className="text-green-600 text-xs font-bold">✓</span> : <span className="text-gray-300 text-xs font-bold">○</span>}
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
