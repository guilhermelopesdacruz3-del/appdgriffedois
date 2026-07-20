// Serviço de cadastro de cliente (OTP por e-mail, sem senha).
const PROXY = (import.meta.env.VITE_LOJA_INTEGRADA_PROXY_URL as string | undefined)?.replace(
  /\/api\/loja-integrada\/?$/,
  ""
) || "";

async function post(path: string, body: unknown) {
  const res = await fetch(`${PROXY}/api/cliente${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(json?.erro || json?.message || `Erro ${res.status}`);
  return json;
}

export async function cadastrarCliente(dados: {
  email: string;
  nome?: string;
  telefone?: string;
  cpf?: string;
}): Promise<{ ok: boolean; mensagem?: string }> {
  return post("/cadastro", dados);
}

export async function verificarOtp(email: string, token: string): Promise<{
  ok: boolean;
  session?: unknown;
  user?: unknown;
}> {
  return post("/verificar", { email, token });
}
