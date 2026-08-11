// Badges de status reutilizados na lista de pedidos, detalhe e dashboard do admin.

export function statusClasse(status: string): string {
  const s = (status || "").toLowerCase();
  if (s.includes("entregue")) return "bg-emerald-50 text-emerald-600 border-emerald-200";
  if (s.includes("produc") || s.includes("mont")) return "bg-indigo-50 text-indigo-600 border-indigo-200";
  if (
    s.includes("enviad") ||
    s.includes("despach") ||
    s.includes("transport") ||
    s.includes("aprovad") ||
    s.includes("pago") ||
    s.includes("confirmad")
  )
    return "bg-sky-50 text-sky-600 border-sky-200";
  if (s.includes("cancel") || s.includes("recusad") || s.includes("estorn")) return "bg-red-50 text-red-600 border-red-200";
  if (s.includes("aguard") || s.includes("novo") || s.includes("pendent") || s.includes("recebid"))
    return "bg-amber-50 text-amber-600 border-amber-200";
  return "bg-slate-50 text-slate-500 border-slate-200";
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 text-[9px] font-bold rounded-full border whitespace-nowrap ${statusClasse(status)} ${className || ""}`}
    >
      {status || "—"}
    </span>
  );
}

export function ehHoje(data: string | Date | null): boolean {
  if (!data) return false;
  const d = new Date(data);
  if (isNaN(d.getTime())) return false;
  const agora = new Date();
  return (
    d.getFullYear() === agora.getFullYear() &&
    d.getMonth() === agora.getMonth() &&
    d.getDate() === agora.getDate()
  );
}