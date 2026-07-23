import { useCallback, useEffect, useState } from "react";
import { buscarClientePorEmail, type ClienteApp } from "../services/lojaIntegrada";

interface UseClienteResult {
  cliente: ClienteApp | null;
  loading: boolean;
  error: string | null;
  /** Busca o cliente pelo e-mail cadastrado na loja e guarda o resultado. */
  entrarComEmail: (email: string) => Promise<void>;
  sair: () => void;
  /** Atualiza nome/telefone/endereço do cliente na Loja Integrada. */
  atualizarCliente: (dados: {
    email?: string;
    nome?: string;
    telefone?: string;
    cidade?: string;
    estado?: string;
    cep?: string;
    rua?: string;
    numero?: string;
    bairro?: string;
  }) => Promise<void>;
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

  // Recupera o cliente logado de um reload anterior (persistência leve).
  useEffect(() => {
    try {
      const email = window.localStorage.getItem("dgriffe:cliente_email");
      if (email) entrarComEmail(email);
    } catch {
      /* ignora */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      try {
        window.localStorage.setItem("dgriffe:cliente_email", email.trim().toLowerCase());
      } catch {
        /* ignora */
      }
    } catch (err) {
      setError((err as Error).message);
      setCliente(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const sair = useCallback(() => {
    setCliente(null);
    try {
      window.localStorage.removeItem("dgriffe:cliente_email");
    } catch {
      /* ignora */
    }
  }, []);

  const atualizarCliente = useCallback(
    async (dados: {
      email?: string;
      nome?: string;
      telefone?: string;
      cidade?: string;
      estado?: string;
      cep?: string;
      rua?: string;
      numero?: string;
      bairro?: string;
    }) => {
      if (!cliente?.id) throw new Error("Nenhum cliente carregado.");
      const PROXY =
        (import.meta.env.VITE_LOJA_INTEGRADA_PROXY_URL as string | undefined)?.replace(
          /\/api\/loja-integrada\/?$/,
          ""
        ) || "";
      // Monta o corpo no formato da Loja Integrada (endereco é array).
      const enderecos: any[] = [];
      if (dados.rua || dados.cidade || dados.cep) {
        enderecos.push({
          principal: true,
          endereco: dados.rua || "",
          numero: dados.numero || "",
          bairro: dados.bairro || "",
          cidade: dados.cidade || "",
          estado: dados.estado || "",
          cep: dados.cep || "",
        });
      }
      const body: any = {};
      if (dados.email) body.email = dados.email;
      if (dados.nome) body.nome = dados.nome;
      if (dados.telefone) body.telefone_celular = dados.telefone;
      if (enderecos.length) body.enderecos = enderecos;

      const res = await fetch(`${PROXY}/api/loja-integrada/cliente/${cliente.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Falha ao atualizar (${res.status})`);
      // Atualiza o estado local para refletir imediatamente.
      const atualizado = await buscarClientePorEmail(cliente.email);
      if (atualizado) setCliente(atualizado);
    },
    [cliente]
  );

  return { cliente, loading, error, entrarComEmail, sair, atualizarCliente };
}
