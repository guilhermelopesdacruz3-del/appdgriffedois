import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cadastrarCliente, loginCliente, setClienteSession } from '../services/cliente';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cpf, setCpf] = useState('');
  const [isCadastro, setIsCadastro] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    try {
      const res = isCadastro
        ? await cadastrarCliente({ email, senha, nome, telefone, cpf })
        : await loginCliente({ email, senha });

      if (res.ok && res.session) {
        setClienteSession(res.session);
        navigate('/checkout');
      } else {
        setErro('E-mail ou senha inválidos.');
      }
    } catch (err: any) {
      setErro(err.message || 'Erro ao fazer login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-ice flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gold/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-gold font-display font-bold text-2xl">D</span>
          </div>
          <h1 className="text-xl font-bold text-luxury-black">
            {isCadastro ? 'Criar Conta' : 'Entrar'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isCadastro ? 'Crie sua conta para comprar' : 'Digite seu e-mail e senha'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-card space-y-4">
          {isCadastro && (
            <>
              <div>
                <label className="text-sm text-gray-600 block mb-1">Nome completo</label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                  className="w-full h-11 px-4 rounded-xl border border-ice-dark text-sm focus:outline-none focus:border-gold"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 block mb-1">Telefone</label>
                <input
                  type="tel"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-ice-dark text-sm focus:outline-none focus:border-gold"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 block mb-1">CPF</label>
                <input
                  type="text"
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  className="w-full h-11 px-4 rounded-xl border border-ice-dark text-sm focus:outline-none focus:border-gold"
                />
              </div>
            </>
          )}

          <div>
            <label className="text-sm text-gray-600 block mb-1">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="seu@email.com"
              className="w-full h-11 px-4 rounded-xl border border-ice-dark text-sm focus:outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 block mb-1">Senha</label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              minLength={6}
              placeholder="Mínimo 6 caracteres"
              className="w-full h-11 px-4 rounded-xl border border-ice-dark text-sm focus:outline-none focus:border-gold"
            />
          </div>

          {erro && <p className="text-xs text-red-500">{erro}</p>}

          <button
            type="submit"
            disabled={loading || !email || !senha || senha.length < 6}
            className="w-full h-11 btn-primary disabled:opacity-50"
          >
            {loading ? 'Entrando...' : isCadastro ? 'Criar Conta' : 'Entrar'}
          </button>

          <p className="text-center text-xs text-gray-500">
            {isCadastro ? 'Já tem conta?' : 'Não tem conta?'}{' '}
            <button
              type="button"
              onClick={() => { setIsCadastro(!isCadastro); setErro(null); }}
              className="text-gold hover:underline font-semibold"
            >
              {isCadastro ? 'Entrar' : 'Criar Conta'}
            </button>
          </p>
        </form>

        <p className="text-center text-xs text-gray-400 mt-4">
          Ao continuar, você concorda com os termos de uso e política de privacidade.
        </p>
      </div>
    </div>
  );
}
