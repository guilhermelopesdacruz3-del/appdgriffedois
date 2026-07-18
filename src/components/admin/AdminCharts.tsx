// Componentes de gráfico em SVG puro (sem dependências externas).
// Mantém o bundle single-file leve e funciona dentro do Capacitor/WebView.

interface BarDatum {
  label: string;
  value: number;
}

export function BarChart({
  data,
  height = 150,
  color = "#D4A853",
}: {
  data: BarDatum[];
  height?: number;
  color?: string;
}) {
  if (data.length === 0) return <p className="text-[11px] text-gray-400">Sem dados.</p>;
  const max = Math.max(...data.map((d) => d.value), 1);
  const width = 100; // viewBox percentual
  const gap = 5;
  const barW = (width - gap * (data.length - 1)) / data.length;
  const fmt = (v: number) =>
    v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : String(v);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
      {/* linha de base */}
      <line x1={0} y1={height - 12} x2={width} y2={height - 12} stroke="#E5E7EB" strokeWidth={0.4} />
      {data.map((d, i) => {
        const h = Math.max((d.value / max) * (height - 26), 2);
        const x = i * (barW + gap);
        const y = height - 12 - h;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={h} rx={1.5} fill={color} opacity={0.92} />
            {/* valor no topo da barra */}
            <text x={x + barW / 2} y={y - 2} fontSize={3.4} textAnchor="middle" fill="#6B7280" fontWeight={600}>
              {fmt(d.value)}
            </text>
            {/* label legível (abrevia só se muito longo) */}
            <text x={x + barW / 2} y={height - 4} fontSize={3.6} textAnchor="middle" fill="#9CA3AF">
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
  if (total === 0) return <p className="text-[11px] text-gray-400">Sem dados.</p>;
  const r = size / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex items-center gap-3">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
        <circle cx={r} cy={r} r={r} fill="#F3F4F6" />
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
              <span className="text-gray-600 flex-1 truncate">{d.label}</span>
              <span className="font-semibold text-luxury-black">{d.value}</span>
              <span className="text-gray-400 w-7 text-right">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function KpiCard({
  label,
  value,
  sub,
  accent,
  trend,
  delta,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  trend?: "up" | "down";
  delta?: string;
}) {
  const trendColor = trend === "up" ? "#16A34A" : trend === "down" ? "#EF4444" : undefined;
  return (
    <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-50">
      <p className="text-[9px] text-gray-400 uppercase tracking-wider">{label}</p>
      <div className="flex items-end gap-1 mt-0.5">
        <p className="text-lg font-bold leading-tight" style={{ color: accent || "#0A0A0A" }}>
          {value}
        </p>
        {trend && (
          <span
            className="text-[10px] font-bold mb-1"
            style={{ color: trendColor }}
          >
            {trend === "up" ? "▲" : "▼"} {delta}
          </span>
        )}
      </div>
      {sub && <p className="text-[9px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}
