import { useEffect, useState } from "react";

const PROXY = (import.meta.env.VITE_LOJA_INTEGRADA_PROXY_URL as string | undefined)?.replace(/\/api\/loja-integrada\/?$/, "") || "";

export interface FidelidadeInfo {
  email: string;
  pontos: number;
  regras: { pontosPorReal: number; pontosPorDesconto: number };
  desconto_max: number;
}

export interface HistoricoItem {
  id?: number;
  email: string;
  tipo: "credito" | "resgate";
  pontos: number;
  motivo?: string | null;
  ref?: string | null;
  created_at?: string;
}

// Busca o saldo de fidelidade de um e-mail na API do proxy.
export function useFidelidade(email: string | null | undefined) {
  const [info, setInfo] = useState<FidelidadeInfo | null>(null);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const e = (email || "").trim().toLowerCase();
    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(e)) {
      setInfo(null);
      setHistorico([]);
      return;
    }
    let cancelado = false;
    setLoading(true);
    setErro(null);
    Promise.all([
      fetch(`${PROXY}/api/fidelidade?email=${encodeURIComponent(e)}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))),
      fetch(`${PROXY}/api/fidelidade/historico?email=${encodeURIComponent(e)}`).then((r) => (r.ok ? r.json() : { historico: [] })),
    ])
      .then(([d, h]) => {
        if (cancelado) return;
        setInfo(d);
        setHistorico(Array.isArray(h.historico) ? h.historico : []);
      })
      .catch((err) => !cancelado && setErro(err.message))
      .finally(() => !cancelado && setLoading(false));
    return () => {
      cancelado = true;
    };
  }, [email]);

  return { info, historico, loading, erro };
}
