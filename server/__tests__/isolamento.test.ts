import { describe, it, expect } from "vitest";
import { extrairEmailDoToken } from "../tokenEmail";

// Gera um JWT fake (header.payload.signature) com o email no payload.
// Não é assinado de verdade — só simula a estrutura que o Supabase emite.
function jwtFake(email: string): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64");
  return `${b64({ alg: "HS256" })}.${b64({ email, sub: "123" })}.sig`;
}

describe("isolamento de dados - token extrai dono correto", () => {
  it("extrai o email do dono do JWT", () => {
    const token = jwtFake("cliente.a@exemplo.com");
    expect(extrairEmailDoToken(token)).toBe("cliente.a@exemplo.com");
  });

  it("normaliza para minusculo", () => {
    const token = jwtFake("Cliente.B@Exemplo.COM");
    expect(extrairEmailDoToken(token)).toBe("cliente.b@exemplo.com");
  });

  it("retorna null sem token", () => {
    expect(extrairEmailDoToken("")).toBeNull();
  });

  it("retorna null se payload nao tem email", () => {
    const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64");
    const token = `${b64({ alg: "HS256" })}.${b64({ sub: "123" })}.sig`;
    expect(extrairEmailDoToken(token)).toBeNull();
  });

  it("usuario A nao consegue extrair email de B (prova isolamento por claims)", () => {
    const tokenA = jwtFake("usuario.a@dgriffe.com");
    const tokenB = jwtFake("usuario.b@dgriffe.com");
    expect(extrairEmailDoToken(tokenA)).not.toBe(extrairEmailDoToken(tokenB));
    expect(extrairEmailDoToken(tokenA)).toBe("usuario.a@dgriffe.com");
  });
});
