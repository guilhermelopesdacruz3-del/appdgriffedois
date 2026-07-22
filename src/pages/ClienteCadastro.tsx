import { useState } from "react";
import { cadastrarCliente, verificarOtp } from "../services/cliente";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import TermosPrivacidade from "./TermosPrivacidade";

// Lazy + defensivo: o app NÃO pode quebrar no bootstrap só porque falta a
// env var da Supabase. Criamos o client só na hora de usar (no fluxo OTP),
// e se a URL estiver ausente lançamos um erro tratável em vez de explodir
// o módulo inteiro (que deixava a tela em branco silenciosa).
let _sb: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (_sb) return _sb;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anon = import.meta.env.VITE_SUPABASE_ANON as string | undefined;
  if (!url || !anon) {
    throw new Error("Configuração do app incompleta (Supabase). Verifique as variáveis de ambiente do deploy.");
  }
  _sb = createClient(url, anon, { auth: { persistSession: true, autoRefreshToken: true } });
  return _sb;
}

type Etapa = "dados" | "codigo";

export default function ClienteCadastro({ onVoltar }: { onVoltar: () => void }) {
  const [etapa, setEtapa] = useState<Etapa>("dados");
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cpf, setCpf] = useState("");
  const [codigo, setCodigo] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [aceite, setAceite] = useState(false);
  const [mostrarTermos, setMostrarTermos] = useState(false);

  if (mostrarTermos) {
    return <TermosPrivacidade onVoltar={() => setMostrarTermos(false)} />;
  }

  const enviarCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (!aceite) {
      setErro("É necessário aceitar os Termos e a Política de Privacidade para continuar.");
      return;
    }
    setLoading(true);
    try {
      const r = await cadastrarCliente({ email, nome, telefone, cpf, aceiteLgpd: true });
      if (r.ok) {
        setMensagem(r.mensagem || "Código enviado para seu e-mail.");
        setEtapa("codigo");
      }
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const confirmarCodigo = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setLoading(true);
    try {
      const r = await verificarOtp(email, codigo);
      if (r.ok && r.session) {
        // Salva a sessão no cliente do Supabase (persistSession já está ativo).
        const sess = r.session as any;
        await getSupabase().auth.setSession({
          access_token: sess.access_token,
          refresh_token: sess.refresh_token,
        });
        setMensagem("Conta confirmada! Redirecionando...");
        setTimeout(() => onVoltar(), 1200);
      } else {
        setErro("Não foi possível confirmar o código.");
      }
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-5 pt-10 pb-4">
      <div className="bg-white rounded-3xl p-6 shadow-sm">
        <div className="w-14 h-14 mx-auto rounded-full bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center shadow-lg shadow-gold/20 mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <h2 className="text-base font-bold text-luxury-black text-center">
          {etapa === "dados" ? "Criar minha conta" : "Confirmar e-mail"}
        </h2>
        <p className="text-xs text-gray-500 mt-1 text-center">
          {etapa === "dados"
            ? "Cadastre-se para acompanhar pedidos e acumular pontos."
            : `Enviamos um código de 6 dígitos para ${email}.`}
        </p>

        {etapa === "dados" ? (
          <form className="mt-5 space-y-3" onSubmit={enviarCadastro}>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="w-full h-12 px-4 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-gold"
            />
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome completo"
              className="w-full h-12 px-4 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-gold"
            />
            <input
              type="tel"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="Telefone (opcional)"
              className="w-full h-12 px-4 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-gold"
            />
            <input
              type="text"
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
              placeholder="CPF (opcional)"
              className="w-full h-12 px-4 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-gold"
            />
            <label className="flex items-start gap-2 mt-1 text-[10px] text-gray-500 leading-tight">
              <input
                type="checkbox"
                checked={aceite}
                onChange={(e) => setAceite(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-gold flex-shrink-0"
              />
              <span>
                Li e aceito a{" "}
                <button
                  type="button"
                  onClick={() => setMostrarTermos(true)}
                  className="underline text-luxury-black font-semibold"
                >
                  Política de Privacidade e os Termos de Uso
                </button>
                . Confirmo que meus dados serão tratados conforme a LGPD.
              </span>
            </label>
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-luxury-black text-white text-xs font-bold rounded-2xl disabled:opacity-50 active:scale-[0.98] transition-all"
            >
              {loading ? "Enviando..." : "Enviar código"}
            </button>
          </form>
        ) : (
          <form className="mt-5 space-y-3" onSubmit={confirmarCodigo}>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              required
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
              placeholder="Código de 6 dígitos"
              className="w-full h-12 px-4 rounded-2xl border border-gray-200 text-sm text-center tracking-[0.5em] focus:outline-none focus:border-gold"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-luxury-black text-white text-xs font-bold rounded-2xl disabled:opacity-50 active:scale-[0.98] transition-all"
            >
              {loading ? "Confirmando..." : "Confirmar"}
            </button>
            <button
              type="button"
              onClick={() => setEtapa("dados")}
              className="w-full text-[10px] text-gray-400 underline mt-1"
            >
              Usar outro e-mail
            </button>
          </form>
        )}

        {erro && <p className="text-[11px] text-red-500 mt-3 text-center">{erro}</p>}
        {mensagem && etapa === "dados" && (
          <p className="text-[11px] text-green-600 mt-3 text-center">{mensagem}</p>
        )}

        <button
          type="button"
          onClick={onVoltar}
          className="w-full text-[10px] text-gray-400 underline mt-4"
        >
          Já tenho conta
        </button>
      </div>
    </div>
  );
}
