// Detecção central de ambiente.
//
// Regra de ouro: DEMO_MODE só vale fora de produção. Em produção, um
// DEMO_MODE=true acidental NUNCA pode aprovar pedidos sem cobrança nem
// simular a Loja Integrada. Quando não há como confirmar preço/pagamento,
// o servidor falha fechado (recusa) em vez de confiar no cliente.

export function ehProducao(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.RENDER === "true" ||
    process.env.VERCEL_ENV === "production"
  );
}

export function demoPermitido(): boolean {
  const flag = process.env.DEMO_MODE === "true" || process.env.DEMO_MODE === "1";
  return flag && !ehProducao();
}

// Em desenvolvimento local (sem DEMO_MODE) ainda permitimos fallback de preço
// para não travar o trabalho no app. Em qualquer ambiente publicado, o preço
// tem de vir da Loja Integrada. `ehProducao()` vem primeiro para que um
// NODE_ENV=development mal configurado no host não abra o fallback.
export function permiteFallbackPreco(): boolean {
  if (ehProducao()) return false;
  if (demoPermitido()) return true;
  const env = process.env.NODE_ENV;
  return env === "development" || env === "test" || env === undefined;
}
