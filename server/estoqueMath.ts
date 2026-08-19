// Função pura de cálculo de saldo de estoque.
// Extraída de registrarMovimentoEstoque para permitir teste unitário.
// movimento > 0 = entrada; movimento < 0 = saída/venda.
// O saldo nunca fica negativo.

export function calcularNovoSaldo(saldoAtual: number, movimento: number): number {
  return Math.max(0, saldoAtual + movimento);
}
