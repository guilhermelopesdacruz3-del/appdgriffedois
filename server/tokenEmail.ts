// Extrai o email do dono a partir de um JWT (access_token do Supabase).
// Usado para isolamento de dados: o email vem do payload assinado pelo
// Supabase, não de parâmetro controlável pelo cliente.

export function extrairEmailDoToken(token: string): string | null {
  if (!token) return null;
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const payload = JSON.parse(Buffer.from(part, "base64").toString("utf8"));
    const email = (payload.email || "").toString().trim().toLowerCase();
    return /@/.test(email) ? email : null;
  } catch {
    return null;
  }
}
