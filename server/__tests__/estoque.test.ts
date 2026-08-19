import { describe, it, expect } from "vitest";
import { calcularNovoSaldo } from "../estoqueMath";

// Função pura extraída para teste: dado saldo atual e movimento (sinal),
// retorna o novo saldo (mínimo 0). Espelha a lógica de registrarMovimentoEstoque.
describe("controle de estoque - soma/subtrai corretamente", () => {
  it("entrada soma ao saldo atual", () => {
    expect(calcularNovoSaldo(10, +5)).toBe(15);
  });
  it("saída subtrai do saldo atual", () => {
    expect(calcularNovoSaldo(10, -4)).toBe(6);
  });
  it("venda (negativo) subtrai", () => {
    expect(calcularNovoSaldo(20, -1)).toBe(19);
  });
  it("nunca fica negativo", () => {
    expect(calcularNovoSaldo(3, -10)).toBe(0);
  });
  it("partindo de zero, entrada define o saldo", () => {
    expect(calcularNovoSaldo(0, +12)).toBe(12);
  });
});
