import { benefits } from "../data";
import { useCliente } from "../hooks/useCliente";
import { useFidelidade } from "../hooks/useFidelidade";

function formatarData(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function LoyaltyPage() {
  const { cliente } = useCliente();
  const email = cliente?.email || null;
  const { info, historico, loading } = useFidelidade(email);

  const pontos = info?.pontos ?? 0;
  const regras = info?.regras ?? { pontosPorReal: 1, pontosPorDesconto: 100 };
  const descontoMax = info?.desconto_max ?? 0;

  const nextTier = 2000;
  const progress = Math.min(100, (pontos / nextTier) * 100);
  const cashback = ((pontos / regras.pontosPorDesconto) * 10).toFixed(2);

  return (
    <div className="pb-4">
      {/* VIP Card */}
      <div className="mx-4 mt-2 relative overflow-hidden rounded-3xl bg-luxury-black p-5">
        {/* Gold accent decorations */}
        <div className="absolute top-0 right-0 w-40 h-40">
          <div className="absolute -top-10 -right-10 w-40 h-40 border border-gold/15 rounded-full" />
          <div className="absolute -top-4 -right-4 w-28 h-28 border border-gold/10 rounded-full" />
          <div className="absolute top-2 right-2 w-16 h-16 border border-gold/5 rounded-full" />
        </div>
        <div className="absolute bottom-0 left-0 w-32 h-32">
          <div className="absolute -bottom-8 -left-8 w-32 h-32 border border-gold/10 rounded-full" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] text-gold font-bold uppercase tracking-widest mb-0.5">
                Clube D'Griffe
              </p>
              <h2 className="text-white text-xl font-bold">Membro Gold</h2>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-gold to-gold-dark rounded-full flex items-center justify-center shadow-lg shadow-gold/20">
              <span className="text-xl">👑</span>
            </div>
          </div>

          {/* Points */}
          <div className="bg-luxury-gray/50 rounded-2xl p-4 mb-3 border border-gold/10">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Pontos Acumulados</p>
            <p className="text-3xl font-bold text-gold-gradient">{pontos.toLocaleString('pt-BR')}</p>
            <div className="mt-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[9px] text-gray-500">Progresso para Platinum</span>
                <span className="text-[9px] text-gold font-semibold">{nextTier.toLocaleString('pt-BR')} pts</span>
              </div>
              <div className="h-1.5 bg-luxury-gray rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-gold-dark via-gold to-gold-light rounded-full transition-all duration-1000"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Cashback */}
          <div className="flex gap-3">
            <div className="flex-1 bg-luxury-gray/50 rounded-xl p-3 border border-gold/10">
              <p className="text-[9px] text-gray-400 uppercase tracking-wider">Cashback</p>
              <p className="text-lg font-bold text-white">R$ {cashback}<span className="text-gold text-sm">,00</span></p>
            </div>
            <div className="flex-1 bg-luxury-gray/50 rounded-xl p-3 border border-gold/10">
              <p className="text-[9px] text-gray-400 uppercase tracking-wider">Desconto Atual</p>
              <p className="text-lg font-bold text-white">{descontoMax}<span className="text-gold text-sm">%</span></p>
            </div>
          </div>
        </div>
      </div>

      {/* Benefits */}
      <div className="px-5 mt-6 mb-3">
        <h3 className="text-sm font-bold text-luxury-black">Benefícios</h3>
        <p className="text-[10px] text-gray-500">Desbloqueie vantagens exclusivas</p>
      </div>

      <div className="px-4 space-y-2.5">
        {benefits.map((benefit) => (
          <div
            key={benefit.id}
            className={`flex items-center gap-3 p-4 rounded-2xl transition-all ${
              benefit.unlocked
                ? "bg-white shadow-sm border border-gold/10"
                : "bg-ice/60 border border-ice-dark/50"
            }`}
          >
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${
                benefit.unlocked
                  ? "bg-gold/10"
                  : "bg-gray-100"
              }`}
            >
              {benefit.unlocked ? benefit.icon : "🔒"}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className={`text-xs font-semibold leading-tight ${
                  benefit.unlocked ? "text-luxury-black" : "text-gray-400"
                }`}
              >
                {benefit.name}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {benefit.points.toLocaleString('pt-BR')} pontos
              </p>
            </div>
            {benefit.unlocked ? (
              <div className="w-7 h-7 bg-gold/10 rounded-full flex items-center justify-center flex-shrink-0">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#D4A853" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            ) : (
              <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] font-bold text-gray-400">
                  {Math.round((pontos / benefit.points) * 100)}%
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="px-4 mt-6">
        <div className="bg-gradient-to-r from-gold/10 to-gold/5 rounded-2xl p-4 border border-gold/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gold/20 rounded-xl flex items-center justify-center">
              <span className="text-lg">🎁</span>
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-luxury-black">Indique e Ganhe</p>
              <p className="text-[10px] text-gray-500">Ganhe 200 pontos por indicação</p>
            </div>
            <button className="px-4 py-2 bg-luxury-black text-white text-[10px] font-bold rounded-xl hover:bg-luxury-dark active:scale-95 transition-all">
              Indicar
            </button>
          </div>
        </div>
      </div>

      {/* Histórico de fidelidade */}
      <div className="px-5 mt-6 mb-3">
        <h3 className="text-sm font-bold text-luxury-black">Histórico</h3>
        <p className="text-[10px] text-gray-500">Seus créditos e resgates</p>
      </div>

      <div className="px-4 space-y-2">
        {loading && <p className="text-[11px] text-gray-400 text-center py-4">Carregando…</p>}
        {!loading && historico.length === 0 && (
          <p className="text-[11px] text-gray-400 text-center py-4">
            {email ? "Nenhuma movimentação ainda." : "Faça login para ver seu histórico."}
          </p>
        )}
        {historico.map((h, i) => (
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
