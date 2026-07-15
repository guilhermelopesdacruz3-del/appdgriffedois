import { useCallback, useState } from "react";
import { buscarClientePorEmail, type ClienteApp } from "../services/lojaIntegrada";

interface UseClienteResult {
  cliente: ClienteApp | null;
  loading: boolean;
  error: string | null;
  /** Busca o cliente pelo e-mail cadastrado na loja e guarda o resultado. */
  entrarComEmail: (email: string) => Promise<void>;
  sair: () => void;
}

/**
 * Este hook resolve o cliente pelo e-mail cadastrado na Loja Integrada.
 * A API da Loja Integrada não expõe login/senha do cliente final, então isso
 * NÃO é autenticação forte — combine com um passo de verificação (ex.: envio
 * de código por e-mail) antes de usar em produção.
 */
export function useCliente(): UseClienteResult {
  const [cliente, setCliente] = useState<ClienteApp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const entrarComEmail = useCallback(async (email: string) => {
    setLoading(true);
    setError(null);
    try {
      const encontrado = await buscarClientePorEmail(email.trim());
      if (!encontrado) {
        setError("Não encontramos nenhum cliente com esse e-mail na loja.");
        setCliente(null);
        return;
      }
      setCliente(encontrado);
    } catch (err) {
      setError((err as Error).message);
      setCliente(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const sair = useCallback(() => setCliente(null), []);

  return { cliente, loading, error, entrarComEmail, sair };
}
