import { useCallback, useEffect, useRef, useState } from "react";
import type { Product } from "../data";
import { listarProdutos, type ListarProdutosOpts } from "../services/lojaIntegrada";
import { demoProducts } from "../demoProducts";

export const PAGE_SIZE = 100;

interface UseProdutosResult {
  produtos: Product[];
  total: number;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  demo: boolean;
  hasMore: boolean;
  reload: () => void;
  loadMore: () => void;
}

/** Carrega produtos da Loja Integrada com paginação incremental (PAGE_SIZE por página).
 *  Se a LI não devolver nada (ex.: chaves ausentes), usa catálogo de demonstração temporário. */
export function useProdutos(opts: ListarProdutosOpts = {}): UseProdutosResult {
  const [produtos, setProdutos] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const optsKey = JSON.stringify(opts);
  const offsetRef = useRef(0);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setError(null);
    offsetRef.current = 0;

    listarProdutos({ ...JSON.parse(optsKey), limit: PAGE_SIZE, offset: 0 })
      .then((resultado) => {
        if (cancelado) return;
        if (resultado.produtos.length > 0) {
          setProdutos(resultado.produtos);
          setTotal(resultado.total);
          setDemo(false);
          offsetRef.current = PAGE_SIZE;
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

  const loadMore = useCallback(() => {
    if (loadingMore) return;
    const offset = offsetRef.current;
    if (produtos.length >= total) return;
    setLoadingMore(true);
    listarProdutos({ ...JSON.parse(optsKey), limit: PAGE_SIZE, offset })
      .then((resultado) => {
        if (resultado.produtos.length === 0) return;
        setProdutos((prev) => {
          const vistos = new Set(prev.map((p) => p.id));
          const novos = resultado.produtos.filter((p) => !vistos.has(p.id));
          return [...prev, ...novos];
        });
        offsetRef.current = offset + resultado.produtos.length;
      })
      .catch(() => { /* mantém o que já carregou */ })
      .finally(() => setLoadingMore(false));
  }, [loadingMore, produtos.length, total, optsKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  return { produtos, total, loading, loadingMore, error, reload, loadMore, demo, hasMore: produtos.length < total };
}
