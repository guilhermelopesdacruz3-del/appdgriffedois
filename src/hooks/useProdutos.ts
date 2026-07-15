import { useEffect, useState } from "react";
import type { Product } from "../data";
import { listarProdutos, type ListarProdutosOpts } from "../services/lojaIntegrada";

interface UseProdutosResult {
  produtos: Product[];
  total: number;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** Carrega produtos da Loja Integrada. Reexecuta sempre que `opts` mudar de valor (compare por JSON). */
export function useProdutos(opts: ListarProdutosOpts = {}): UseProdutosResult {
  const [produtos, setProdutos] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const optsKey = JSON.stringify(opts);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setError(null);

    listarProdutos(JSON.parse(optsKey))
      .then((resultado) => {
        if (cancelado) return;
        setProdutos(resultado.produtos);
        setTotal(resultado.total);
      })
      .catch((err: Error) => {
        if (cancelado) return;
        setError(err.message);
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });

    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optsKey, reloadKey]);

  return { produtos, total, loading, error, reload: () => setReloadKey((k) => k + 1) };
}
