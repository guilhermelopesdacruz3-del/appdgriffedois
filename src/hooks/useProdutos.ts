import { useEffect, useState } from "react";
import type { Product } from "../data";
import { listarProdutos, type ListarProdutosOpts } from "../services/lojaIntegrada";
import { demoProducts } from "../demoProducts";

interface UseProdutosResult {
  produtos: Product[];
  total: number;
  loading: boolean;
  error: string | null;
  reload: () => void;
  demo: boolean;
}

/** Carrega produtos da Loja Integrada. Reexecuta sempre que `opts` mudar de valor (compare por JSON).
 *  Se a LI não devolver nada (ex.: chaves ausentes), usa catálogo de demonstração temporário. */
export function useProdutos(opts: ListarProdutosOpts = {}): UseProdutosResult {
  const [produtos, setProdutos] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const optsKey = JSON.stringify(opts);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setError(null);

    listarProdutos(JSON.parse(optsKey))
      .then((resultado) => {
        if (cancelado) return;
        if (resultado.produtos.length > 0) {
          setProdutos(resultado.produtos);
          setTotal(resultado.total);
          setDemo(false);
        } else {
          // Sem produtos da LI (provável: chaves ausentes) -> catálogo demo temporário.
          setProdutos(demoProducts);
          setTotal(demoProducts.length);
          setDemo(true);
        }
      })
      .catch(() => {
        if (cancelado) return;
        // Falha ao contatar a LI -> demo, sem quebrar a tela.
        setProdutos(demoProducts);
        setTotal(demoProducts.length);
        setDemo(true);
        setError(null);
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });

    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optsKey, reloadKey]);

  return { produtos, total, loading, error, reload: () => setReloadKey((k) => k + 1), demo };
}
