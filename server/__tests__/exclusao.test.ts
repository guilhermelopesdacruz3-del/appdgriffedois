// Testes das primitivas da exclusão POR SENHA (limite de tentativas por e-mail).
// A verificação de credenciais em si depende de Supabase — coberta manualmente
// em produção; aqui testamos o limitador de força bruta (tempo injetável) e a
// normalização de e-mail.

import { describe, expect, it } from "vitest";
import {
  EXCLUIR_BLOQUEIO_MS,
  EXCLUIR_FALHAS_MAX,
  estadoLimite,
  limparFalhasCredencial,
  normalizarEmail,
  registrarFalhaCredencial,
} from "../exclusao.ts";

describe("normalizarEmail", () => {
  it("trim + lowercase", () => {
    expect(normalizarEmail("  Cliente@Exemplo.COM ")).toBe("cliente@exemplo.com");
  });
});

describe("limite de tentativas por e-mail (força bruta)", () => {
  const t0 = 1_000_000;
  const email = "teste-bruteforce@example.com";

  it("começa sem bloqueio", () => {
    expect(estadoLimite(email, t0)).toEqual({ bloqueado: false, restaMs: 0 });
  });

  it("até 4 falhas NÃO bloqueiam", () => {
    for (let i = 0; i < EXCLUIR_FALHAS_MAX - 1; i++) registrarFalhaCredencial(email, t0 + i * 1000);
    expect(estadoLimite(email, t0 + 10_000).bloqueado).toBe(false);
  });

  it("a 5ª falha bloqueia por EXCLUIR_BLOQUEIO_MS", () => {
    registrarFalhaCredencial(email, t0 + 4 * 1000 + 1);
    const st = estadoLimite(email, t0 + 5_000);
    expect(st.bloqueado).toBe(true);
    expect(st.restaMs).toBeGreaterThan(0);
    expect(st.restaMs).toBeLessThanOrEqual(EXCLUIR_BLOQUEIO_MS);
  });

  it("o bloqueio expira sozinho", () => {
    expect(estadoLimite(email, t0 + 5_000 + EXCLUIR_BLOQUEIO_MS).bloqueado).toBe(false);
  });

  it("falhas FORA da janela de 15 min não somam", () => {
    const outro = "janela-afora@example.com";
    // 4 falhas antigas (acima da janela) + falha única agora → não bloqueia.
    for (let i = 0; i < EXCLUIR_FALHAS_MAX - 1; i++) registrarFalhaCredencial(outro, 5_000_000 + i * 1000);
    registrarFalhaCredencial(outro, 5_000_000 + 20 * 60 * 1000); // 20 min depois — janela estourada
    expect(estadoLimite(outro, 5_000_000 + 20 * 60 * 1000).bloqueado).toBe(false);
  });

  it("limparFalhasCredencial desbloqueia na hora (uso no sucesso)", () => {
    const alvo = "sucesso-zera@example.com";
    for (let i = 0; i < EXCLUIR_FALHAS_MAX; i++) registrarFalhaCredencial(alvo, 7_000_000 + i * 1000);
    expect(estadoLimite(alvo, 7_001_000).bloqueado).toBe(true);
    limparFalhasCredencial(alvo);
    expect(estadoLimite(alvo, 7_001_000).bloqueado).toBe(false);
  });
});
