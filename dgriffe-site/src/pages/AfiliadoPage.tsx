import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { registrarAfiliado } from '../services/api';
import { Users, DollarSign, TrendingUp, CheckCircle } from 'lucide-react';

export default function AfiliadoPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [loading, setLoading] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    try {
      const res = await registrarAfiliado({ email, nome, telefone });
      if (res.ok) {
        setSucesso(true);
        // Redireciona para a área do afiliado após 2s
        setTimeout(() => navigate('/afiliado-area'), 2000);
      } else {
        setErro('Erro ao cadastrar. Tente novamente.');
      }
    } catch (e: any) {
      setErro(e.message || 'Erro ao cadastrar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-violet-900 via-purple-900 to-violet-800 overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-10 left-10 w-64 h-64 bg-violet-400 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-purple-400 rounded-full blur-3xl" />
        </div>
        <div className="container-site relative py-20 md:py-28">
          <div className="max-w-2xl">
            <p className="text-violet-300 font-semibold uppercase tracking-widest text-sm mb-4">Programa Afiliado</p>
            <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-6">
              Ganhe comissão vendendo
              <span className="text-violet-300"> óculos D'Griffe</span>
            </h1>
            <p className="text-lg text-violet-200 mb-8">
              Cadastre-se como afiliado e ganhe comissão por cada venda realizada através do seu link.
              Use o GoMarketme para rastrear suas vendas e receber seus ganhos.
            </p>
            <div className="flex flex-wrap gap-4">
              <a
                href="#cadastro"
                className="bg-white text-violet-700 font-semibold px-6 py-3 rounded-xl hover:bg-violet-50 transition-all"
              >
                Cadastre-se Agora
              </a>
              <a
                href="https://gomarketme.com.br"
                target="_blank"
                rel="noopener noreferrer"
                className="border border-white/30 text-white font-semibold px-6 py-3 rounded-xl hover:bg-white/10 transition-all"
              >
                Conheça o GoMarketme
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Benefícios */}
      <section className="py-16 bg-white">
        <div className="container-site">
          <h2 className="section-title text-center mb-10">Como Funciona</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center mx-auto mb-4">
                <Users size={24} className="text-violet-600" />
              </div>
              <h3 className="text-lg font-bold text-luxury-black mb-2">1. Cadastre-se</h3>
              <p className="text-sm text-gray-600">
                Crie sua conta de afiliado gratuitamente e receba seu link exclusivo.
              </p>
            </div>
            <div className="card p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center mx-auto mb-4">
                <TrendingUp size={24} className="text-violet-600" />
              </div>
              <h3 className="text-lg font-bold text-luxury-black mb-2">2. Indique</h3>
              <p className="text-sm text-gray-600">
                Compartilhe seu link nas redes sociais, grupos e com amigos.
              </p>
            </div>
            <div className="card p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center mx-auto mb-4">
                <DollarSign size={24} className="text-violet-600" />
              </div>
              <h3 className="text-lg font-bold text-luxury-black mb-2">3. Ganhe</h3>
              <p className="text-sm text-gray-600">
                Receba comissão por cada venda realizada através do seu link.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Cadastro */}
      <section id="cadastro" className="py-16 bg-ice">
        <div className="container-site max-w-xl">
          <div className="card p-6 md:p-8">
            <h2 className="text-2xl font-bold text-luxury-black mb-6 text-center">Cadastro de Afiliado</h2>

            {sucesso ? (
              <div className="text-center py-8">
                <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-luxury-black mb-2">Cadastro Realizado!</h3>
                <p className="text-sm text-gray-600 mb-6">
                  Você será redirecionado para sua área de afiliado...
                </p>
                <a
                  href="https://gomarketme.com.br"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-afiliado inline-flex items-center gap-2"
                >
                  Ativar no GoMarketme
                </a>
                <p className="text-[10px] text-gray-400 mt-4">
                  Ou acesse sua área: <a href="/afiliado-area" className="text-violet-600 font-bold">Clique aqui</a>
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Nome completo *</label>
                  <input
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required
                    className="w-full h-11 px-4 rounded-xl border border-ice-dark text-sm focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">E-mail *</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full h-11 px-4 rounded-xl border border-ice-dark text-sm focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Telefone *</label>
                  <input
                    type="tel"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    required
                    placeholder="(51) 99999-9999"
                    className="w-full h-11 px-4 rounded-xl border border-ice-dark text-sm focus:outline-none focus:border-violet-500"
                  />
                </div>

                {erro && (
                  <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-600">
                    {erro}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 btn-afiliado disabled:opacity-50"
                >
                  {loading ? 'Cadastrando...' : 'Cadastrar como Afiliado'}
                </button>

                <p className="text-[10px] text-gray-400 text-center">
                  Ao cadastrar, você concorda com os termos do programa de afiliados.
                  Seus dados serão usados apenas para fins de rastreamento de vendas e pagamento de comissões.
                </p>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
