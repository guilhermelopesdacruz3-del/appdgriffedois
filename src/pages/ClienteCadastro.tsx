import { useState } from "react";
import { verificarOtp, loginComMagicLink, loginComSenha, registrarComSenha } from "../services/cliente";
import { salvarClienteSessao } from "../utils/cookies";
import { buscarClientePorEmail } from "../services/lojaIntegrada";
import TermosPrivacidade from "./TermosPrivacidade";

type Etapa = "dados" | "codigo" | "login" | "senha";

export default function ClienteCadastro({ onVoltar }: { onVoltar: () => void }) {
  const [etapa, setEtapa] = useState<Etapa>("dados");
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cpf, setCpf] = useState("");
  const [codigo, setCodigo] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [aceite, setAceite] = useState(false);
  const [mostrarTermos, setMostrarTermos] = useState(false);

  if (mostrarTermos) {
    return <TermosPrivacidade onVoltar={() => setMostrarTermos(false)} />;
  }

  const enviarCadastroComSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setMensagem(null);
    if (!aceite) {
      setErro("É necessário aceitar os Termos e a Política de Privacidade para continuar.");
      return;
    }
    if (!senha || senha.length < 6) {
      return setErro("Senha deve ter ao menos 6 caracteres.");
    }
    setLoading(true);
    try {
      const r = await registrarComSenha(email.trim().toLowerCase(), senha, nome);
      if (r.ok) {
        if (r.session) {
          try {
            const sess = r.session as any;
            if (sess?.access_token) {
              salvarClienteSessao({ access_token: sess.access_token, refresh_token: sess.refresh_token });
            }
          } catch { /* ignora */ }
        }
        // Persiste o cliente (para sobreviver ao reload).
        const emailL = email.trim().toLowerCase();
        window.localStorage.setItem("dgriffe:cliente_email", emailL);
        window.localStorage.setItem("dgriffe:cliente", JSON.stringify({ email: emailL, nome: (nome || emailL.split("@")[0] || ""), id: null }));
        window.dispatchEvent(new Event("cliente-atualizado"));
        setMensagem(r.mensagem || "Conta criada! Redirecionando...");
        setTimeout(() => onVoltar(), 1200);
      }
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const enviarMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setMensagem(null);
    if (!email.trim()) return setErro("Digite seu e-mail.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setErro("E-mail inválido.");
    setLoading(true);
    try {
      const r = await loginComMagicLink(email.trim().toLowerCase());
      if (r.ok) {
        setMensagem(r.mensagem || "Link mágico enviado. Clique no e-mail para entrar.");
        setEtapa("login");
      }
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setLoading(false);
    }
   };

  const enviarLoginSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setMensagem(null);
    if (!email.trim()) return setErro("Digite seu e-mail.");
    if (!senha.trim()) return setErro("Digite sua senha.");
    setLoading(true);
    try {
      const r = await loginComSenha(email.trim().toLowerCase(), senha);
      if (r.ok) {
        if (r.session) {
          try {
            const sess = r.session as any;
            if (sess?.access_token) {
              salvarClienteSessao({ access_token: sess.access_token, refresh_token: sess.refresh_token });
            }
          } catch { /* ignora */ }
        }
        // Persiste o cliente (para sobreviver ao reload) — mesmo padrão do confirmação OTP.
        const emailL = email.trim().toLowerCase();
        let cli: any = null;
        try {
          cli = await buscarClientePorEmail(emailL);
        } catch {
          /* ignora falha de busca — prossegue com dados locais */
        }
        if (!cli) {
          cli = { email: emailL, nome: (nome || emailL.split("@")[0] || ""), id: null };
        }
        window.localStorage.setItem("dgriffe:cliente_email", emailL);
        if (cli.id != null) {
          window.localStorage.setItem("dgriffe:cliente_id", String(cli.id));
        }
        window.localStorage.setItem("dgriffe:cliente", JSON.stringify(cli));
        window.dispatchEvent(new Event("cliente-atualizado"));
        setMensagem(r.mensagem || "Login OK!");
        setTimeout(() => onVoltar(), 1200);
      }
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const loginDemo = async () => {
    setErro(null);
    setMensagem(null);
    setLoading(true);
    try {
      const r = await loginComSenha("demo@dgriffe.com", "demo123");
      if (r.ok) {
        if (r.session) {
          try {
            const sess = r.session as any;
            if (sess?.access_token) {
              salvarClienteSessao({ access_token: sess.access_token, refresh_token: sess.refresh_token });
            }
          } catch { /* ignora */ }
        }
        const emailL = "demo@dgriffe.com";
        window.localStorage.setItem("dgriffe:cliente_email", emailL);
        window.localStorage.setItem("dgriffe:cliente", JSON.stringify({ email: emailL, nome: "Cliente Demo", id: null }));
        window.dispatchEvent(new Event("cliente-atualizado"));
        setMensagem("Logado como demo!");
        setTimeout(() => onVoltar(), 1200);
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
      if (r.ok) {
        // Tenta salvar a sessão no cliente do Supabase (persistSession ativo).
        // OPCIONAL: se as vars VITE_SUPABASE_* não estiverem no deploy, o
        // getSupabase() lança — ignoramos, pois o login pela Loja Integrada
        // (busca por e-mail + localStorage) já identifica o cliente na "Minha Conta".
        if (r.session) {
          // Salva o access_token (e refresh_token para renovação) para chamadas
          // autenticadas da API (cupons/meus, perfil, enderecos, etc.) que
          // exigem Authorization. O token vem da resposta do backend.
          try {
            const sess = r.session as any;
            if (sess?.access_token) {
              salvarClienteSessao({ access_token: sess.access_token, refresh_token: sess.refresh_token });
            }
          } catch { /* ignora */ }
        }
        // Salva o cliente para a "Minha Conta" sobreviver ao reload.
        // Mesmo sem a LI configurada (modo demo), persistemos os dados
        // locais (e-mail + nome do cadastro) para o perfil não esvaziar.
        const emailL = email.trim().toLowerCase();
        let cli: any = null;
        try {
          cli = await buscarClientePorEmail(emailL);
        } catch {
          /* ignora falha de busca — prossegue com dados locais */
        }
        if (!cli) {
          // LI não achou (modo demo / loja sem esse cliente): monta objeto mínimo.
          cli = { email: emailL, nome: (nome || emailL.split("@")[0] || ""), id: null };
        }
        window.localStorage.setItem("dgriffe:cliente_email", emailL);
        if (cli.id != null) {
          window.localStorage.setItem("dgriffe:cliente_id", String(cli.id));
        }
        // Objeto completo persistido — sobrevive ao reload mesmo sem LI.
        window.localStorage.setItem("dgriffe:cliente", JSON.stringify(cli));
        // Avisa o ClienteProvider (já montado no App) para sincronizar o estado.
        try { window.dispatchEvent(new Event("cliente-atualizado")); } catch { /* ignora */ }
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
           {etapa === "dados" ? "Criar minha conta" : etapa === "codigo" ? "Confirmar e-mail" : etapa === "senha" ? "Entrar com senha" : "Entrar"}
         </h2>
         <p className="text-xs text-gray-500 mt-1 text-center">
           {etapa === "dados"
             ? "Cadastre-se para acompanhar pedidos e acumular pontos."
             : etapa === "codigo"
             ? `Enviamos um código de 6 dígitos para ${email}.`
             : etapa === "senha"
             ? "Digite seu e-mail e senha para entrar direto."
             : "Digite seu e-mail e receba um link mágico para entrar."}
         </p>

         <div className="flex bg-gray-50 rounded-xl p-1 text-[11px] font-bold mb-4">
           <button
             onClick={() => { setEtapa("dados"); setEmail(""); setNome(""); setTelefone(""); setCpf(""); setErro(null); setMensagem(null); setAceite(false); setSenha(""); }}
             className={`flex-1 py-2 rounded-lg transition-all ${etapa === "dados" ? "bg-luxury-black text-white" : "text-gray-500"}`}
           >
             Cadastrar
           </button>
           <button
             onClick={() => { setEtapa("login"); setEmail(""); setNome(""); setTelefone(""); setCpf(""); setErro(null); setMensagem(null); setSenha(""); }}
             className={`flex-1 py-2 rounded-lg transition-all ${etapa === "login" ? "bg-luxury-black text-white" : "text-gray-500"}`}
           >
             Link mágico
           </button>
           <button
             onClick={() => { setEtapa("senha"); setEmail(""); setNome(""); setTelefone(""); setCpf(""); setErro(null); setMensagem(null); setSenha(""); }}
             className={`flex-1 py-2 rounded-xl transition-all ${etapa === "senha" ? "bg-luxury-black text-white" : "text-gray-500"}`}
           >
             Senha
           </button>
         </div>

         {etapa === "dados" ? (
           <form className="mt-5 space-y-3" onSubmit={enviarCadastroComSenha}>
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
             <input
               type="password"
               required
               minLength={6}
               value={senha}
               onChange={(e) => setSenha(e.target.value)}
               placeholder="Senha (mín. 6 caracteres)"
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
              disabled={loading || senha.length < 6}
              className="w-full h-12 bg-luxury-black text-white text-xs font-bold rounded-2xl disabled:opacity-50 active:scale-[0.98] transition-all"
            >
              {loading ? "Cadastrando..." : "Criar conta"}
            </button>
          </form>
        ) : etapa === "login" ? (
          <form className="mt-5 space-y-3" onSubmit={enviarMagicLink}>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="w-full h-12 px-4 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-gold"
            />
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full h-12 bg-luxury-black text-white text-xs font-bold rounded-2xl disabled:opacity-50 active:scale-[0.98] transition-all"
            >
              {loading ? "Enviando..." : "Enviar link mágico"}
            </button>
            <p className="text-[10px] text-gray-400 text-center">
              Sem código! Clique no link que chega no seu e-mail.
            </p>
           </form>
         ) : etapa === "senha" ? (
           <form className="mt-5 space-y-3" onSubmit={enviarLoginSenha}>
             <input
               type="email"
               required
               value={email}
               onChange={(e) => setEmail(e.target.value)}
               placeholder="seu@email.com"
               className="w-full h-12 px-4 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-gold"
             />
             <input
               type="password"
               required
               minLength={6}
               value={senha}
               onChange={(e) => setSenha(e.target.value)}
               placeholder="Senha (mín. 6 caracteres)"
               className="w-full h-12 px-4 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-gold"
             />
              <button
                type="submit"
                disabled={loading || !email.trim() || senha.length < 6}
                className="w-full h-12 bg-luxury-black text-white text-xs font-bold rounded-2xl disabled:opacity-50 active:scale-[0.98] transition-all"
              >
                {loading ? "Entrando..." : "Entrar"}
              </button>
              <div className="flex items-center gap-2 my-1">
                <div className="flex-1 h-px bg-gray-200"></div>
                <span className="text-[10px] text-gray-400">ou</span>
                <div className="flex-1 h-px bg-gray-200"></div>
              </div>
              <button
                type="button"
                onClick={loginDemo}
                disabled={loading}
                className="w-full h-11 bg-gold text-luxury-black text-xs font-bold rounded-2xl disabled:opacity-50 active:scale-[0.98] transition-all border border-gold"
              >
                {loading ? "Entrando..." : "Entrar como demo"}
              </button>
              <p className="text-[10px] text-gray-400 text-center">
                Conta demo: demo@dgriffe.com / demo123 — ou crie sua conta na aba "Cadastrar" com e-mail + senha.
              </p>
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
        {mensagem && etapa !== "dados" && (
          <p className="text-[11px] text-green-600 mt-3 text-center">{mensagem}</p>
        )}

        <button
          type="button"
          onClick={onVoltar}
          className="w-full text-[10px] text-gray-400 underline mt-4"
        >
          {etapa === "dados" ? "Já tenho conta" : etapa === "codigo" ? "Voltar" : "Voltar"}
        </button>
      </div>
    </div>
  );
}

