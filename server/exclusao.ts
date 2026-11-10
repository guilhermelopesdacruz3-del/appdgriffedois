// Exclusão de conta self-service (LGPD / Política de Dados do Google Play) —
// fluxo por SENHA (versão 2026-10 suave): o cliente informa e-mail + senha da
// própria conta, digita a palavra de confirmação no front e os dados são
// apagados em cascata (o critério de identidade é o MESMO do login).
//
// Esta versão NÃO usa e-mail/OTP (a anterior exigia Resend + DNS do domínio):
// a verificação de posse da conta é a própria senha. Quem sabe email+senha é
// o dono — mesma prova exigida para entrar no app.
//
// Anti força bruta (por e-mail, em memória): 5 credenciais erradas dentro de
// 15 min bloqueiam verificações para aquele e-mail por 15 min. Complementa o
// limitador por IP do index.ts (checarBloqueio/registrarTentativaFalha).
// Falhas de infraestrutura NÃO contam como tentativa errada.

import { supabaseClient } from "./db.ts";

export const EXCLUIR_FALHAS_MAX = 5;
export const EXCLUIR_JANELA_MS = 15 * 60 * 1000; // janela de contagem das falhas
export const EXCLUIR_BLOQUEIO_MS = 15 * 60 * 1000; // tempo bloqueado ao estourar

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

type EstadoEmail = { falhas: number[]; bloqueadoAte: number };
const estados = new Map<string, EstadoEmail>();

/** Estado do limitador para o e-mail (tempo injetável → testável). */
export function estadoLimite(
  email: string,
  agora = Date.now()
): { bloqueado: boolean; restaMs: number } {
  const st = estados.get(normalizarEmail(email));
  if (!st) return { bloqueado: false, restaMs: 0 };
  if (Number.isFinite(st.bloqueadoAte) && agora < st.bloqueadoAte) {
    return { bloqueado: true, restaMs: st.bloqueadoAte - agora };
  }
  return { bloqueado: false, restaMs: 0 };
}

/** Contabiliza uma credencial errada. Ao estourar a janela → bloqueio. */
export function registrarFalhaCredencial(email: string, agora = Date.now()): void {
  const e = normalizarEmail(email);
  const st = estados.get(e) ?? { falhas: [], bloqueadoAte: 0 };
  st.falhas = [...st.falhas, agora].filter((t) => agora - t < EXCLUIR_JANELA_MS);
  if (st.falhas.length >= EXCLUIR_FALHAS_MAX) {
    st.bloqueadoAte = agora + EXCLUIR_BLOQUEIO_MS;
    st.falhas = []; // a contagem recomeça depois do bloqueio expirar
  }
  estados.set(e, st);
}

/** Sucesso (ou logout em outra via) zera a contagem. */
export function limparFalhasCredencial(email: string): void {
  estados.delete(normalizarEmail(email));
}

export type VerificacaoCredenciais =
  | { ok: true; userId: string }
  | { ok: false; motivo: "credenciais" | "bloqueado" | "infra"; erro?: string };

/**
 * Valida e-mail+senha na autenticação. Quando ok, devolve userId do Supabase
 * (a cascata usa o id real de Auth — nunca o e-mail vindo do cliente como
 * vontade de verdade para o usuário de Auth).
 */
export async function verificarCredenciaisExclusao(
  email: string,
  senha: string
): Promise<VerificacaoCredenciais> {
  if (estadoLimite(email).bloqueado) return { ok: false, motivo: "bloqueado" };

  const sb = supabaseClient();
  if (!sb) return { ok: false, motivo: "infra", erro: "banco de dados indisponível" };

  const e = normalizarEmail(email);
  try {
    const { data, error } = await sb.auth.signInWithPassword({ email: e, password: senha });
    if (!error && data?.user) {
      limparFalhasCredencial(e);
      return { ok: true, userId: data.user.id };
    }
    if (error && /email not confirmed|not confirmed/i.test(error.message)) {
      return {
        ok: false,
        motivo: "credenciais",
        erro: "Confirme seu e-mail antes de excluir a conta.",
      };
    }
    // Credenciais erradas OU conta inexistente — mensagem única (sem enumeration).
    registrarFalhaCredencial(e);
    return { ok: false, motivo: "credenciais" };
  } catch (errAuth) {
    // Erro de rede/timeout/infra: não conta como tentativa de senha errada.
    return {
      ok: false,
      motivo: "infra",
      erro: (errAuth as Error)?.message || "falha ao verificar credenciais",
    };
  }
}
