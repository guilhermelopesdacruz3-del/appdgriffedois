import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cadastrarCliente, verificarOtp, loginCliente, setClienteSession } from '../services/cliente';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cpf, setCpf] = useState('');
  const [codigo, setCodigo] = useState('');
  const [etapa, setEtapa] = useState<'email' | 'codigo'>('email');
  const [isCadastro, setIsCadastro] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  const handleEnviarOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    try {
      if (isCadastro) {
        await cadastrarCliente({ email, nome, telefone, cpf });
      } else {
        await loginCliente(email);
      }
      setSucesso(true);
      setTimeout(() => setEtapa('codigo'), 1500);
    } catch (err: any) {
      setErro(err.message || 'Erro ao enviar código.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerificarCodigo = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    try {
      const res = await verificarOtp({ email, token: codigo });
      if (res.ok && res.session) {
        setClienteSession(res.session);
        navigate('/checkout');
      } else {
        setErro('Código inválido.');
      }
    } catch (err: any) {
      setErro(err.message || 'Erro ao verificar código.');
    } finally {
      setLoading(false);
    }
  };

  if (etapa === 'codigo') {
    return (
      <div className="min-h-screen bg-ice flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gold/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-gold font-display font-bold text-2xl">D</span>
            </div>
            <h1 className="text-xl font-bold text-luxury-black">Verificar Código</h1>
            <p className="text-sm text-gray-500 mt-1">
              Enviamos um código de 6 dígitos para <span className="font-semibold">{email}</span>
            </p>
          </div>
          <form onSubmit={handleVerificarCodigo} className="bg-white rounded-2xl p-6 shadow-card space-y-4">
            <div>
              <label className="text-sm text-gray-600 block mb-1">Código de 6 dígitos</label>
              <input
                type="text"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                required
                maxLength={6}
                className="w-full h-11 px-4 rounded-xl border border-ice-dark text-sm text-center text-lg tracking-widest focus:outline-none focus:border-gold"
              />
            </div>
            {erro && <p className="text-xs text-red-500">{erro}</p>}
            <button
              type="submit"
              disabled={loading || codigo.length !== 6}
              className="w-full h-11 btn-primary disabled:opacity-50"
            >
              {loading ? 'Verificando...' : 'Verificar e Entrar'}
            </button>
            <button
              type="button"
              onClick={() => { setEtapa('email'); setCodigo(''); setErro(null); }}
              className="w-full text-xs text-gray-500 hover:text-gray-700"
            >
              ← Voltar e trocar e-mail
            </button>
          </form>
        </div>
      </div>
    );
  }

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
            {isCadastro ? 'Preencha seus dados para criar uma conta' : 'Digite seu e-mail para receber um código de acesso'}
          </p>
        </div>

        {sucesso && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4">
            <p className="text-xs text-green-700">
              ✅ Código enviado! Verifique seu e-mail (pode estar na caixa de spam).
            </p>
          </div>
        )}

        <form onSubmit={handleEnviarOtp} className="bg-white rounded-2xl p-6 shadow-card space-y-4">
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
              disabled={isCadastro && !nome}
              placeholder="seu@email.com"
              className="w-full h-11 px-4 rounded-xl border border-ice-dark text-sm focus:outline-none focus:border-gold disabled:bg-ice"
            />
          </div>

          {erro && <p className="text-xs text-red-500">{erro}</p>}

          <button
            type="submit"
            disabled={loading || !email}
            className="w-full h-11 btn-primary disabled:opacity-50"
          >
            {loading ? 'Enviando...' : isCadastro ? 'Criar Conta' : 'Enviar Código'}
          </button>

          <p className="text-center text-xs text-gray-500">
            {isCadastro ? 'Já tem conta?' : 'Não tem conta?'}{' '}
            <button
              type="button"
              onClick={() => { setIsCadastro(!isCadastro); setErro(null); setSucesso(false); }}
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
