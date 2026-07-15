import { useEffect, useState } from "react";
import { listarPedidosDoCliente, type PedidoApp } from "../services/lojaIntegrada";

interface UsePedidosResult {
  pedidos: PedidoApp[];
  total: number;
  loading: boolean;
  error: string | null;
}

/** Carrega os pedidos de um cliente. Passe `clienteId: null` enquanto ninguém estiver logado. */
export function usePedidos(clienteId: number | string | null): UsePedidosResult {
  const [pedidos, setPedidos] = useState<PedidoApp[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (clienteId === null) {
      setPedidos([]);
      setTotal(0);
      return;
    }

    let cancelado = false;
    setLoading(true);
    setError(null);

    listarPedidosDoCliente(clienteId)
      .then((resultado) => {
        if (cancelado) return;
        setPedidos(resultado.pedidos);
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
  }, [clienteId]);

  return { pedidos, total, loading, error };
}
