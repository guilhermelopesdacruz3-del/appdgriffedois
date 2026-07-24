import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  buscarClientePorEmail,
  buscarClientePorId,
  type ClienteApp,
} from "../services/lojaIntegrada";

interface UseClienteResult {
  cliente: ClienteApp | null;
  loading: boolean;
  error: string | null;
  entrarComEmail: (email: string) => Promise<void>;
  sair: () => void;
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

const ClienteContext = createContext<UseClienteResult | null>(null);

function salvarLocal(c: ClienteApp | null) {
  try {
    if (c) window.localStorage.setItem(LS_CLIENTE, JSON.stringify(c));
    else window.localStorage.removeItem(LS_CLIENTE);
  } catch { /* ignora */ }
}

export function ClienteProvider({ children }: { children: ReactNode }) {
  const [cliente, setCliente] = useState<ClienteApp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restaura de um reload/login anterior. NUNCA zera o cliente se a LI falhar.
  const restaurar = useCallback(async () => {
    try {
      const raw = window.localStorage.getItem(LS_CLIENTE);
      const cached = raw ? (JSON.parse(raw) as ClienteApp) : null;
      if (cached) setCliente(cached);

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
        /* LI indisponível — mantém o cache local */
      }
    } catch {
      /* JSON inválido */
    }
  }, []);

  useEffect(() => {
    restaurar();
    // Sincroniza quando o cadastro salva o cliente (ClienteCadastro dispara o evento).
    const onUpdate = () => restaurar();
    window.addEventListener("cliente-atualizado", onUpdate);
    return () => window.removeEventListener("cliente-atualizado", onUpdate);
  }, [restaurar]);

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
        if (encontrado.id != null) window.localStorage.setItem(LS_ID, String(encontrado.id));
      } catch { /* ignora */ }
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
    } catch { /* ignora */ }
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
      const atual = cliente; // captura o cliente atual do contexto
      if (!atual?.id) throw new Error("Nenhum cliente carregado.");
      const PROXY =
        (import.meta.env.VITE_LOJA_INTEGRADA_PROXY_URL as string | undefined)?.replace(
          /\/api\/loja-integrada\/?$/,
          ""
        ) || "";
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

      const res = await fetch(`${PROXY}/api/loja-integrada/cliente/${atual.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Falha ao atualizar (${res.status})`);
      const atualizado = await buscarClientePorId(atual.id);
      if (atualizado) {
        setCliente(atualizado);
        salvarLocal(atualizado);
      }
    },
    [cliente]
  );

  return (
    <ClienteContext.Provider value={{ cliente, loading, error, entrarComEmail, sair, atualizarCliente }}>
      {children}
    </ClienteContext.Provider>
  );
}

// Hook consumidor — mantém a mesma API de antes, mas agora é GLOBAL (Provider no App).
export function useCliente(): UseClienteResult {
  const ctx = useContext(ClienteContext);
  if (!ctx) {
    // Fallback (não deve acontecer se o App envolver com ClienteProvider).
    return {
      cliente: null,
      loading: false,
      error: null,
      entrarComEmail: async () => {},
      sair: () => {},
      atualizarCliente: async () => { throw new Error("ClienteProvider ausente"); },
    };
  }
  return ctx;
}
