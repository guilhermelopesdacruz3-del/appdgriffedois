import { getResource, listResource } from "./client";
import { mapPedidoParaApp, type PedidoApp } from "./mappers";
import type { LIPedido } from "./types";

/** Lista os pedidos de um cliente específico (para a tela "Meus Pedidos"). */
export async function listarPedidosDoCliente(
  clienteId: number | string,
  opts: { limit?: number; offset?: number } = {}
): Promise<{ pedidos: PedidoApp[]; total: number }> {
  const { limit = 10, offset = 0 } = opts;
  const resposta = await listResource<LIPedido>("pedido", {
    cliente: clienteId,
    limit,
    offset,
    order_by: "-data_criacao",
  });
  return {
    pedidos: resposta.objects.map(mapPedidoParaApp),
    total: resposta.meta.total_count,
  };
}

/** Busca um pedido específico com todos os detalhes (itens, pagamento, envio). */
export async function buscarPedido(id: number | string): Promise<LIPedido> {
  return getResource<LIPedido>("pedido", id);
}

/** Busca um pedido pelo número exibido ao cliente (ex.: "DG-2024001"). */
export async function buscarPedidoPorNumero(numero: string): Promise<LIPedido | null> {
  const resposta = await listResource<LIPedido>("pedido", { numero, limit: 1 });
  return resposta.objects[0] || null;
}
