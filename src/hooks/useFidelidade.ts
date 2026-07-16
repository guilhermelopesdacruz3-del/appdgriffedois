import { useEffect, useState } from "react";

const PROXY = (import.meta.env.VITE_LOJA_INTEGRADA_PROXY_URL as string | undefined)?.replace(/\/api\/loja-integrada\/?$/, "") || "";

export interface FidelidadeInfo {
  email: string;
  pontos: number;
  regras: { pontosPorReal: number; pontosPorDesconto: number };
  desconto_max: number;
}

// Busca o saldo de fidelidade de um e-mail na API do proxy.
export function useFidelidade(email: string | null | undefined) {
  const [info, setInfo] = useState<FidelidadeInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const e = (email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      setInfo(null);
      return;
    }
    let cancelado = false;
    setLoading(true);
    setErro(null);
    fetch(`${PROXY}/api/fidelidade?email=${encodeURIComponent(e)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => !cancelado && setInfo(d))
      .catch((err) => !cancelado && setErro(err.message))
      .finally(() => !cancelado && setLoading(false));
    return () => {
      cancelado = true;
    };
  }, [email]);

  return { info, loading, erro };
}
