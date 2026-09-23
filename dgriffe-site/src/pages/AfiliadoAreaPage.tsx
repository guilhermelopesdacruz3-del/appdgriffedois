import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Afiliado } from '../data/types';

const API_BASE = import.meta.env.VITE_API_URL || 'https://appdgriffedois.onrender.com';

async function api<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

export default function AfiliadoAreaPage() {
  const [searchParams] = useSearchParams();
  const cupomFromUrl = searchParams.get('cupom') || '';

  const [email, setEmail] = useState('');
  const [nome, setNome] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [afiliado, setAfiliado] = useState<Afiliado | null>(null);
  const [vendas, setVendas] = useState<any[]>([]);
  const [indicacoes, setIndicacoes] = useState<any[]>([]);
  const [link, setLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Se veio com cupom na URL, preenche o nome
  useEffect(() => {
    if (cupomFromUrl) {
      setEmail('');
      setNome('');
    }
  }, [cupomFromUrl]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    try {
      const res = await api<{ token: string; afiliado: any }>('/api/afiliado/login', {
        method: 'POST',
        body: JSON.stringify({ email, nome }),
      });
      setToken(res.token);
      setAfiliado(res.afiliado);
      // Carrega dados
      const [vendasRes, indicacoesRes, linkRes] = await Promise.all([
        api<{ vendas: any[] }>(`/api/afiliado/me/vendas?token=${res.token}`),
        api<{ indicacoes: any[] }>(`/api/afiliado/me/indicacoes?token=${res.token}`),
        api<{ link: string }>(`/api/afiliado/me/link?token=${res.token}`),
      ]);
      setVendas(vendasRes.vendas || []);
      setIndicacoes(indicacoesRes.indicacoes || []);
      setLink(linkRes.link || '');
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!token || !afiliado) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-luxury-black via-luxury-dark to-luxury-black flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gold/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-gold font-display font-bold text-2xl">D</span>
            </div>
            <h1 className="text-xl font-bold text-white">Área do Afiliado</h1>
            <p className="text-sm text-gray-400">Acesse com seus dados</p>
          </div>
          <form onSubmit={handleLogin} className="bg-white rounded-2xl p-6 shadow-card space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Nome completo</label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome"
                required
                className="w-full h-11 px-4 rounded-xl border border-ice-dark text-sm focus:outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="w-full h-11 px-4 rounded-xl border border-ice-dark text-sm focus:outline-none focus:border-violet-500"
              />
            </div>
            {erro && <p className="text-xs text-red-500">{erro}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 btn-primary disabled:opacity-50"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ice">
      <div className="container-site py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-luxury-black">Olá, {afiliado.nome}!</h1>
            <p className="text-xs text-gray-500">Seu cupom: <span className="font-bold text-violet-600">{(afiliado as any).cupom || ''}</span></p>
          </div>
          <button onClick={() => setToken(null)} className="text-xs text-gray-500 hover:text-red-500">Sair</button>
        </div>

        {/* Link */}
        {link && (
          <div className="card p-4 mb-6">
            <p className="text-xs font-bold text-luxury-black mb-2">Seu link de afiliado:</p>
            <div className="flex gap-2">
              <input
                readOnly
                value={link}
                className="flex-1 h-9 px-3 rounded-lg border border-ice-dark text-xs bg-white"
              />
              <button
                onClick={() => navigator.clipboard.writeText(link)}
                className="h-9 px-4 rounded-lg bg-violet-600 text-white text-xs font-bold active:scale-95"
              >
                Copiar
              </button>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="card p-4 text-center">
            <p className="text-[9px] text-gray-400 uppercase tracking-wider">Vendas</p>
            <p className="text-2xl font-bold text-luxury-black">{(afiliado as any).totalVendas || 0}</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-[9px] text-gray-400 uppercase tracking-wider">Comissão</p>
            <p className="text-2xl font-bold text-violet-600">R$ {Number((afiliado as any).totalComissao || 0).toFixed(2)}</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-[9px] text-gray-400 uppercase tracking-wider">Indicações</p>
            <p className="text-2xl font-bold text-luxury-black">{indicacoes.length}</p>
          </div>
        </div>

        {/* Vendas */}
        <div className="card p-4 mb-6">
          <h2 className="text-sm font-bold text-luxury-black mb-3">Suas vendas</h2>
          {vendas.length === 0 ? (
            <p className="text-xs text-gray-400">Nenhuma venda registrada ainda.</p>
          ) : (
            <div className="space-y-2">
              {vendas.map((v) => (
                <div key={v.id} className="flex items-center justify-between py-2 border-b border-ice last:border-0">
                  <div>
                    <p className="text-xs font-semibold text-luxury-black">{v.produto_nome}</p>
                    <p className="text-[9px] text-gray-400">{new Date(v.created_at).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-emerald-600">+R$ {Number(v.ganho_afiliado).toFixed(2)}</p>
                    <p className="text-[9px] text-gray-400">total R$ {Number(v.valor_total).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Indicações */}
        <div className="card p-4">
          <h2 className="text-sm font-bold text-luxury-black mb-3">Indicações</h2>
          {indicacoes.length === 0 ? (
            <p className="text-xs text-gray-400">Nenhuma indicação ainda.</p>
          ) : (
            <div className="space-y-2">
              {indicacoes.map((i) => (
                <div key={i.id} className="flex items-center justify-between py-2 border-b border-ice last:border-0">
                  <div>
                    <p className="text-xs font-semibold text-luxury-black">{i.indicado_email}</p>
                    <p className="text-[9px] text-gray-400">{i.status}</p>
                  </div>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${i.status === 'convertida' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
                    {i.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
