// Testes das primitivas de OTP de exclusão (hash/expiração/geração).
// As funções de banco (solicitar/confirmar) dependem de Supabase — cobertas
// manualmente em staging; aqui testamos o que é puro (fail-closed garantido).

import { beforeAll, describe, expect, it } from "vitest";
import { hashCodigo, expirou, gerarCodigo } from "../exclusao.ts";
import crypto from "node:crypto";

beforeAll(() => {
  // segredo de teste server-only (só para o HMAC dos testes)
  process.env.OTP_SALT = process.env.OTP_SALT || "test-salt-opcional-apenas-em-testes";
});

describe("gerarCodigo", () => {
  it("sempre gera 6 dígitos entre 100000 e 999999", () => {
    for (let i = 0; i < 200; i++) {
      const c = gerarCodigo();
      expect(/^\d{6}$/.test(c)).toBe(true);
      expect(Number(c)).toBeGreaterThanOrEqual(100000);
      expect(Number(c)).toBeLessThanOrEqual(999999);
    }
  });
});

describe("hashCodigo", () => {
  it("é determinístico para o mesmo par (código, e-mail)", () => {
    expect(hashCodigo("123456", "a@b.com")).toBe(hashCodigo("123456", "a@b.com"));
  });

  it("liga o hash ao e-mail (mesmo código, outro e-mail = outro hash)", () => {
    expect(hashCodigo("123456", "a@b.com")).not.toBe(hashCodigo("123456", "c@d.com"));
  });

  it("é um HMAC-SHA256 hex de 64 caracteres", () => {
    expect(hashCodigo("123456", "a@b.com")).toHaveLength(64);
    const esperado = crypto
      .createHmac("sha256", "test-salt-opcional-apenas-em-testes")
      .update("a@b.com:123456")
      .digest("hex");
    expect(hashCodigo("123456", "A@B.COM")).toBe(esperado); // e-mail normalizado
  });

  it("sempre lança sem segredo server-only", () => {
    const antiga = process.env.OTP_SALT;
    const antigoAdm = process.env.ADMIN_SECRET;
    delete process.env.OTP_SALT;
    delete process.env.ADMIN_SECRET;
    try {
      expect(() => hashCodigo("123456", "a@b.com")).toThrow();
    } finally {
      if (antiga) process.env.OTP_SALT = antiga;
      if (antigoAdm) process.env.ADMIN_SECRET = antigoAdm;
    }
  });
});

describe("expirou", () => {
  it("data no futuro = válido", () => {
    expect(expirou(new Date(Date.now() + 60_000).toISOString())).toBe(false);
  });
  it("data no passado = expirado", () => {
    expect(expirou(new Date(Date.now() - 60_000).toISOString())).toBe(true);
  });
  it("fail-closed: valor ausente/inválido = expirado", () => {
    expect(expirou(undefined)).toBe(true);
    expect(expirou("")).toBe(true);
    expect(expirou("não-é-uma-data")).toBe(true);
  });
});
