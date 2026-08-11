// Componentes de gráfico em SVG puro (sem dependências externas).
// Mantém o bundle single-file leve e funciona dentro do Capacitor/WebView.

interface BarDatum {
  label: string;
  value: number;
}

export function BarChart({
  data,
  height = 150,
  color = "#7C3AED",
}: {
  data: BarDatum[];
  height?: number;
  color?: string;
}) {
  if (data.length === 0) return <p className="text-[11px] text-slate-400">Sem dados.</p>;
  const max = Math.max(...data.map((d) => d.value), 1);
  const width = 100; // viewBox percentual
  const gap = 5;
  const barW = (width - gap * (data.length - 1)) / data.length;
  const fmt = (v: number) =>
    v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : String(v);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
      {/* linha de base */}
      <line x1={0} y1={height - 12} x2={width} y2={height - 12} stroke="#E2E8F0" strokeWidth={0.4} />
      {data.map((d, i) => {
        const h = Math.max((d.value / max) * (height - 26), 2);
        const x = i * (barW + gap);
        const y = height - 12 - h;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={h} rx={1.5} fill={color} opacity={0.9} />
            {/* valor no topo da barra */}
            <text x={x + barW / 2} y={y - 2} fontSize={3.4} textAnchor="middle" fill="#7C3AED" fontWeight={600}>
              {fmt(d.value)}
            </text>
            {/* label legível (abrevia só se muito longo) */}
            <text x={x + barW / 2} y={height - 4} fontSize={3.6} textAnchor="middle" fill="#94A3B8">
              {d.label.length > 7 ? d.label.slice(0, 5) + "…" : d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

interface Slice {
  label: string;
  value: number;
  color: string;
}

export function PieChart({ data, size = 132 }: { data: Slice[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <p className="text-[11px] text-slate-400">Sem dados.</p>;
  const r = size / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex items-center gap-3">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
        <circle cx={r} cy={r} r={r} fill="#F1F5F9" />
        {data.map((d, i) => {
          const frac = d.value / total;
          const dash = frac * c;
          const el = (
            <circle
              key={i}
              cx={r}
              cy={r}
              r={r}
              fill="transparent"
              stroke={d.color}
              strokeWidth={r}
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${r} ${r})`}
            />
          );
          offset += dash;
          return el;
        })}
      </svg>
      <div className="flex-1 space-y-1">
        {data.map((d, i) => {
          const pct = ((d.value / total) * 100).toFixed(d.value / total < 0.1 ? 1 : 0);
          return (
            <div key={i} className="flex items-center gap-2 text-[11px]">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
              <span className="text-slate-600 flex-1 truncate">{d.label}</span>
              <span className="font-semibold text-slate-800">{d.value}</span>
              <span className="text-slate-400 w-7 text-right">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Sparkline({
  pontos,
  width = 120,
  height = 36,
  color = "#7C3AED",
}: {
  pontos: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (pontos.length < 2) return null;
  const max = Math.max(...pontos, 1);
  const min = Math.min(...pontos, 0);
  const range = max - min || 1;
  const step = width / (pontos.length - 1);
  const coords = pontos.map((v, i) => {
    const x = i * step;
    const y = height - 3 - ((v - min) / range) * (height - 8);
    return [x, y] as const;
  });
  const path = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="opacity-25">
      <path d={`${path} L${width},${height} L0,${height} Z`} fill={color} />
      <path d={path} fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
    </svg>
  );
}

export function KpiCard({
  label,
  value,
  sub,
  accent,
  trend,
  delta,
  spark,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  trend?: "up" | "down";
  delta?: string;
  spark?: number[];
}) {
  const trendColor = trend === "up" ? "#059669" : trend === "down" ? "#DC2626" : undefined;
  return (
    <div className="relative bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      {spark && (
        <div className="absolute right-0 bottom-0 pointer-events-none">
          <Sparkline pontos={spark} color={accent || "#7C3AED"} />
        </div>
      )}
      <p className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">{label}</p>
      <div className="flex items-end gap-1.5 mt-1">
        <p className="text-2xl font-bold leading-tight" style={{ color: accent || "#0F172A" }}>
          {value}
        </p>
        {trend && (
          <span
            className="text-[10px] font-bold mb-1 px-1.5 py-0.5 rounded-full"
            style={{ color: trendColor, backgroundColor: `${trendColor}14` }}
          >
            {trend === "up" ? "▲" : "▼"} {delta}
          </span>
        )}
      </div>
      {sub && <p className="text-[9px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}