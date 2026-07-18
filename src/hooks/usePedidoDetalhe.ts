import { useEffect, useState } from "react";
import { buscarPedido, type LIPedido } from "../services/lojaIntegrada";

/** Busca o pedido completo (itens, pagamento, envio) pela LI. */
export function usePedidoDetalhe(pedidoId: string | number | null) {
  const [pedido, setPedido] = useState<LIPedido | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (pedidoId === null || pedidoId === undefined) return;
    let cancelado = false;
    setLoading(true);
    setError(null);
    buscarPedido(pedidoId)
      .then((p) => !cancelado && setPedido(p))
      .catch((e: Error) => !cancelado && setError(e.message))
      .finally(() => !cancelado && setLoading(false));
    return () => {
      cancelado = true;
    };
  }, [pedidoId]);

  return { pedido, loading, error };
}
