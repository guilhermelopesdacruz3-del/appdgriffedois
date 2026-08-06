import { useEffect, useRef, useState, useCallback } from "react";
import { obterTokenValido } from "../services/cliente";

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

export function useFidelidade(email: string | null | undefined) {
  const [info, setInfo] = useState<FidelidadeInfo | null>(null);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const reqId = useRef(0);

  const reload = useCallback(() => {
    const e = (email || "").trim().toLowerCase();
    if (!e) {
      setInfo(null);
      setHistorico([]);
      return;
    }
    const id = ++reqId.current;
    setLoading(true);
    setErro(null);
    obterTokenValido()
      .then((token) => {
        const headers: Record<string, string> = { Accept: "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        return Promise.all([
          fetch(`${PROXY}/api/fidelidade?email=${encodeURIComponent(e)}`, { headers }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))),
          fetch(`${PROXY}/api/fidelidade/historico?email=${encodeURIComponent(e)}`, { headers }).then((r) => (r.ok ? r.json() : { historico: [] })),
        ]);
      })
      .then(([d, h]) => {
        if (id !== reqId.current) return;
        setInfo(d);
        setHistorico(Array.isArray(h.historico) ? h.historico : []);
      })
      .catch((err) => {
        if (id !== reqId.current) return;
        setErro(err.message);
      })
      .finally(() => {
        if (id === reqId.current) setLoading(false);
      });
  }, [email]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    const handler = () => reload();
    window.addEventListener("fidelidade-atualizada", handler);
    return () => window.removeEventListener("fidelidade-atualizada", handler);
  }, [reload]);

  return { info, historico, loading, erro, reload };
}
