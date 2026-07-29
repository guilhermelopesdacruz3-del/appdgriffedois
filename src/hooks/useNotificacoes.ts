import { useEffect, useState, useCallback } from "react";
import { listarNotificacoes, marcarNotificacaoLida, type Notificacao } from "../services/notificacoes";

export function useNotificacoes(email: string | null | undefined) {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [aberto, setAberto] = useState(false);

  const recarregar = useCallback(async () => {
    if (!email) {
      setNotificacoes([]);
      setNaoLidas(0);
      return;
    }
    try {
      const r = await listarNotificacoes(email);
      setNotificacoes(r.notificacoes);
      setNaoLidas(r.naoLidas);
    } catch {
      /* ignora falha de rede */
    }
  }, [email]);

  useEffect(() => {
    recarregar();
    const t = setInterval(recarregar, 30000);
    return () => clearInterval(t);
  }, [recarregar]);

  useEffect(() => {
    const handler = () => recarregar();
    window.addEventListener("notificacoes-atualizadas", handler);
    return () => window.removeEventListener("notificacoes-atualizadas", handler);
  }, [recarregar]);

  const marcarLida = useCallback(
    async (id: string) => {
      if (!email) return;
      try {
        await marcarNotificacaoLida(email, id);
        setNotificacoes((prev) => prev.map((n) => (n.id === id ? { ...n, lida: true } : n)));
        setNaoLidas((prev) => Math.max(0, prev - 1));
      } catch {
        /* ignora */
      }
    },
    [email]
  );

  return { notificacoes, naoLidas, aberto, setAberto, recarregar, marcarLida };
}
