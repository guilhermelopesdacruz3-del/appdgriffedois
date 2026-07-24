import { useCallback, useEffect, useState } from "react";
import {
  buscarClientePorEmail,
  buscarClientePorId,
  type ClienteApp,
} from "../services/lojaIntegrada";

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

const LS_EMAIL = "dgriffe:cliente_email";
const LS_ID = "dgriffe:cliente_id";
const LS_CLIENTE = "dgriffe:cliente"; // objeto completo persistido (sobrevive ao reload)

export function useCliente(): UseClienteResult {
  const [cliente, setCliente] = useState<ClienteApp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recupera o cliente logado de um reload anterior (persistência leve).
  useEffect(() => {
    const restaurar = async () => {
      try {
        // 1) Objeto completo persistido — mantém o usuário logado mesmo
        //    sem a Loja Integrada configurada (modo demo).
        const raw = window.localStorage.getItem(LS_CLIENTE);
        const cached = raw ? (JSON.parse(raw) as ClienteApp) : null;
        if (cached) setCliente(cached);

        // 2) Tenta dados frescos da LI (se houver chaves reais). Se a LI
        //    falhar/não achar, MANTÉM o cliente do cache (não zera).
        const id = window.localStorage.getItem(LS_ID);
        const email = window.localStorage.getItem(LS_EMAIL);
        if (!id && !email) return;
        try {
          const atual = id
            ? await buscarClientePorId(id)
            : await buscarClientePorEmail(email!.trim());
          if (atual) {
            setCliente(atual);
            salvarLocal(atual);
          }
        } catch {
          /* LI indisponível ou sem cliente — mantém o cache local */
        }
      } catch {
        /* ignora JSON inválido */
      }
    };
    restaurar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persiste o objeto completo do cliente no localStorage.
  function salvarLocal(c: ClienteApp | null) {
    try {
      if (c) window.localStorage.setItem(LS_CLIENTE, JSON.stringify(c));
      else window.localStorage.removeItem(LS_CLIENTE);
    } catch { /* ignora */ }
  }

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
      salvarLocal(encontrado);
      try {
        window.localStorage.setItem(LS_EMAIL, email.trim().toLowerCase());
        if (encontrado.id != null) {
          window.localStorage.setItem(LS_ID, String(encontrado.id));
        }
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
    salvarLocal(null);
    try {
      window.localStorage.removeItem(LS_EMAIL);
      window.localStorage.removeItem(LS_ID);
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
      // Monta o corpo no formato da Loja Integrada (enderecos é array, com "logradouro").
      const enderecos: any[] = [];
      if (dados.rua || dados.cidade || dados.cep) {
        enderecos.push({
          principal: true,
          logradouro: dados.rua || "",
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
      const atualizado = await buscarClientePorId(cliente.id);
      if (atualizado) {
        setCliente(atualizado);
        salvarLocal(atualizado);
      }
    },
    [cliente]
  );

  return { cliente, loading, error, entrarComEmail, sair, atualizarCliente };
}
