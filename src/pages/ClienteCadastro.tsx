import { useState } from "react";
import { registrarComSenha, loginComSenha } from "../services/cliente";
import { salvarClienteSessao } from "../utils/cookies";
import { buscarClientePorEmail } from "../services/lojaIntegrada";

export default function ClienteCadastro({ onVoltar }: { onVoltar: () => void }) {
  const [etapa, setEtapa] = useState<"cadastro" | "login">("cadastro");
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);

  const limpar = () => {
    setEmail(""); setNome(""); setSenha(""); setErro(null); setMensagem(null);
  };

  const enviarCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null); setMensagem(null);
    if (!email.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      return setErro("E-mail inválido.");
    }
    if (!nome.trim()) {
      return setErro("Nome é obrigatório.");
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
        const emailL = email.trim().toLowerCase();
        let cli: any = null;
        try { cli = await buscarClientePorEmail(emailL); } catch { /* ignora */ }
        if (!cli) cli = { email: emailL, nome, id: null };
        window.localStorage.setItem("dgriffe:cliente_email", emailL);
        if (cli.id != null) window.localStorage.setItem("dgriffe:cliente_id", String(cli.id));
        window.localStorage.setItem("dgriffe:cliente", JSON.stringify(cli));
        window.dispatchEvent(new Event("cliente-atualizado"));
        setMensagem(r.mensagem || "Conta criada! Redirecionando...");
        setTimeout(() => onVoltar(), 1200);
      } else {
        setErro((r as any).erro || "Falha ao criar conta.");
      }
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const enviarLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null); setMensagem(null);
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
        const emailL = email.trim().toLowerCase();
        let cli: any = null;
        try { cli = await buscarClientePorEmail(emailL); } catch { /* ignora */ }
        if (!cli) cli = { email: emailL, nome, id: null };
        window.localStorage.setItem("dgriffe:cliente_email", emailL);
        if (cli.id != null) window.localStorage.setItem("dgriffe:cliente_id", String(cli.id));
        window.localStorage.setItem("dgriffe:cliente", JSON.stringify(cli));
        window.dispatchEvent(new Event("cliente-atualizado"));
        setMensagem(r.mensagem || "Login OK!");
        setTimeout(() => onVoltar(), 1200);
      } else {
        setErro((r as any).erro || "Falha no login.");
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
          {etapa === "cadastro" ? "Criar minha conta" : "Entrar"}
        </h2>
        <p className="text-xs text-gray-500 mt-1 text-center">
          {etapa === "cadastro"
            ? "Cadastre-se com nome, e-mail e senha."
            : "Digite seu e-mail e senha para entrar."}
        </p>

        <div className="flex bg-gray-50 rounded-xl p-1 text-[11px] font-bold mb-4">
          <button
            onClick={() => { setEtapa("cadastro"); limpar(); }}
            className={`flex-1 py-2 rounded-lg transition-all ${etapa === "cadastro" ? "bg-luxury-black text-white" : "text-gray-500"}`}
          >
            Cadastrar
          </button>
          <button
            onClick={() => { setEtapa("login"); limpar(); }}
            className={`flex-1 py-2 rounded-lg transition-all ${etapa === "login" ? "bg-luxury-black text-white" : "text-gray-500"}`}
          >
            Entrar
          </button>
        </div>

        {etapa === "cadastro" ? (
          <form className="mt-5 space-y-3" onSubmit={enviarCadastro}>
            <input
              type="text"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome completo"
              className="w-full h-12 px-4 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-gold"
            />
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
              disabled={loading || senha.length < 6 || !nome.trim() || !email.trim()}
              className="w-full h-12 bg-luxury-black text-white text-xs font-bold rounded-2xl disabled:opacity-50 active:scale-[0.98] transition-all"
            >
              {loading ? "Cadastrando..." : "Criar conta"}
            </button>
          </form>
        ) : (
          <form className="mt-5 space-y-3" onSubmit={enviarLogin}>
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
          </form>
        )}

        {erro && <p className="text-[11px] text-red-500 mt-3 text-center">{erro}</p>}
        {mensagem && etapa !== "cadastro" && (
          <p className="text-[11px] text-green-600 mt-3 text-center">{mensagem}</p>
        )}

        <button
          type="button"
          onClick={onVoltar}
          className="w-full text-[10px] text-gray-400 underline mt-4"
        >
          Voltar
        </button>
      </div>
    </div>
  );
}
