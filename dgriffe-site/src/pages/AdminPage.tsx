import { useState, useEffect } from 'react';
import type { Afiliado, AdminStats } from '../data/types';
import { Users, LogOut, Image, Upload, Trash2, Eye, EyeOff, ExternalLink } from 'lucide-react';
import { listarAfiliados } from '../services/api';

interface SiteImage {
  id: number;
  url: string;
  titulo: string;
  tipo: 'hero' | 'banner' | 'categoria' | 'logo' | 'outro';
  ativo: boolean;
  ordem: number;
  criadoEm: string;
}

export default function AdminPage() {
  const [afiliados, setAfiliados] = useState<Afiliado[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState('admin@app.com');
  const [senha, setSenha] = useState('');
  const [aba, setAba] = useState<'dashboard' | 'imagens'>('dashboard');

  // Imagens
  const [imagens, setImagens] = useState<SiteImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [novaImagem, setNovaImagem] = useState({ url: '', titulo: '', tipo: 'hero' as SiteImage['tipo'] });

  useEffect(() => {
    if (!token) return;
    async function carregar() {
      try {
        setLoading(true);
        const res = await listarAfiliados(token as string);
        setAfiliados(res.afiliados || []);
        setStats(res.stats || null);
      } catch (e: any) {
        setErro(e.message);
      } finally {
        setLoading(false);
      }
    }
    carregar();
  }, [token]);

  useEffect(() => {
    if (!token || aba !== 'imagens') return;
    carregarImagens();
  }, [token, aba]);

  async function carregarImagens() {
    try {
      const res = await fetch('https://appdgriffedois.onrender.com/api/admin/imagens', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setImagens(data.imagens || []);
    } catch (e: any) {
      setErro(e.message);
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!novaImagem.url || !novaImagem.titulo) return;
    setUploading(true);
    try {
      const res = await fetch('https://appdgriffedois.onrender.com/api/admin/imagens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(novaImagem),
      });
      if (res.ok) {
        setNovaImagem({ url: '', titulo: '', tipo: 'hero' });
        carregarImagens();
      }
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setUploading(false);
    }
  }

  async function toggleAtivo(img: SiteImage) {
    try {
      await fetch(`https://appdgriffedois.onrender.com/api/admin/imagens/${img.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ativo: !img.ativo }),
      });
      carregarImagens();
    } catch (e: any) {
      setErro(e.message);
    }
  }

  async function excluirImagem(id: number) {
    if (!confirm('Excluir esta imagem?')) return;
    try {
      await fetch(`https://appdgriffedois.onrender.com/api/admin/imagens/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      carregarImagens();
    } catch (e: any) {
      setErro(e.message);
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'https://appdgriffedois.onrender.com'}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senha }),
      });
      const data = await res.json();
      if (data.token) {
        setToken(data.token);
        setErro(null);
      } else {
        setErro(data.erro || 'Senha inválida');
      }
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-[#F7F8FC] flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-[#7C3AED] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-white font-display font-bold text-2xl">D</span>
            </div>
            <h1 className="text-xl font-bold text-[#111827]">Painel Admin</h1>
            <p className="text-sm text-gray-500">Ótica D'Griffe</p>
          </div>
          <form onSubmit={handleLogin} className="bg-white rounded-2xl p-6 shadow-card space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">E-mail</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#7C3AED]" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Senha</label>
              <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#7C3AED]" />
            </div>
            {erro && <p className="text-xs text-red-500">{erro}</p>}
            <button type="submit" disabled={loading} className="w-full h-10 bg-[#7C3AED] text-white font-semibold rounded-xl hover:bg-[#6D28D9] transition-colors disabled:opacity-50">
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F8FC] flex">
      {/* Sidebar */}
      <aside className="w-[285px] bg-[#0F172A] text-white flex flex-col fixed h-full">
        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#7C3AED] flex items-center justify-center">
              <span className="font-display font-bold text-sm">D</span>
            </div>
            <div>
              <p className="text-sm font-bold">Painel Admin</p>
              <p className="text-[10px] text-violet-400 uppercase tracking-wider">D'Griffe Ótica</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Visão Geral</div>
          <button onClick={() => setAba('dashboard')} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors w-full text-left ${aba === 'dashboard' ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5'}`}>
            <Users size={16} /> Dashboard
          </button>
          <button onClick={() => setAba('imagens')} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors w-full text-left ${aba === 'imagens' ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5'}`}>
            <Image size={16} /> Imagens do Site
          </button>
        </nav>
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-2 text-[10px] text-green-400 mb-3">
            <div className="w-2 h-2 rounded-full bg-green-400" /> Sistema conectado
          </div>
          <button onClick={() => setToken(null)} className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors">
            <LogOut size={14} /> Sair
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 ml-[285px]">
        <header className="bg-white border-b border-gray-100 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-[#111827]">{aba === 'dashboard' ? 'Dashboard' : 'Imagens do Site'}</h1>
              <p className="text-xs text-gray-500">{aba === 'dashboard' ? 'Visão geral dos afiliados' : 'Gerencie banners, hero e imagens do site'}</p>
            </div>
          </div>
        </header>

        <div className="p-6">
          {aba === 'dashboard' && (
            <>
              {/* Banner */}
              <div className="bg-gradient-to-r from-[#7C3AED] to-[#A855F7] rounded-3xl p-8 mb-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
                <div className="relative">
                  <p className="text-violet-200 text-xs font-semibold uppercase tracking-wider mb-1">Bem-vindo de volta</p>
                  <h2 className="text-2xl font-bold text-white mb-2">Vamos cuidar da sua loja hoje? 👋</h2>
                  <p className="text-violet-200 text-sm max-w-md">Acompanhe afiliados, vendas e comissões em um só lugar.</p>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-2xl p-4 border border-gray-100">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Afiliados</p>
                  <p className="text-2xl font-bold text-[#111827]">{stats?.totalAfiliados || afiliados.length}</p>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-gray-100">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Ativos</p>
                  <p className="text-2xl font-bold text-[#111827]">{stats?.afiliadosAtivos || 0}</p>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-gray-100">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Vendas</p>
                  <p className="text-2xl font-bold text-[#111827]">{stats?.totalVendas || 0}</p>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-gray-100">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Comissão</p>
                  <p className="text-2xl font-bold text-[#059669]">R$ {(stats?.totalComissao || 0).toFixed(2)}</p>
                </div>
              </div>

              {/* Afiliados Table */}
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100"><h3 className="text-sm font-bold text-[#111827]">Afiliados</h3></div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead><tr className="bg-gray-50">
                      <th className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Nome</th>
                      <th className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">E-mail</th>
                      <th className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Telefone</th>
                      <th className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Vendas</th>
                      <th className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Comissão</th>
                      <th className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Status</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-50">
                      {afiliados.length > 0 ? afiliados.map((a) => (
                        <tr key={a.id} className="hover:bg-gray-50/50">
                          <td className="px-6 py-3 text-sm text-[#111827]">{a.nome}</td>
                          <td className="px-6 py-3 text-sm text-gray-500">{a.email}</td>
                          <td className="px-6 py-3 text-sm text-gray-500">{a.telefone}</td>
                          <td className="px-6 py-3 text-sm font-semibold text-[#111827]">{a.totalVendas || 0}</td>
                          <td className="px-6 py-3 text-sm font-semibold text-[#059669]">R$ {(a.totalComissao || 0).toFixed(2)}</td>
                          <td className="px-6 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${a.ativo ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${a.ativo ? 'bg-green-500' : 'bg-gray-400'}`} />
                              {a.ativo ? 'Ativo' : 'Inativo'}
                            </span>
                          </td>
                        </tr>
                      )) : <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">Nenhum afiliado cadastrado ainda.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {aba === 'imagens' && (
            <>
              {/* Upload Form */}
              <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
                <h3 className="text-sm font-bold text-[#111827] mb-4 flex items-center gap-2">
                  <Upload size={16} /> Publicar Nova Imagem
                </h3>
                <form onSubmit={handleUpload} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">URL da Imagem</label>
                      <input type="url" value={novaImagem.url} onChange={(e) => setNovaImagem(p => ({ ...p, url: e.target.value }))} placeholder="https://..." className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#7C3AED]" required />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Título</label>
                      <input type="text" value={novaImagem.titulo} onChange={(e) => setNovaImagem(p => ({ ...p, titulo: e.target.value }))} placeholder="Ex: Banner Hero" className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#7C3AED]" required />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Tipo</label>
                    <select value={novaImagem.tipo} onChange={(e) => setNovaImagem(p => ({ ...p, tipo: e.target.value as SiteImage['tipo'] }))} className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#7C3AED]">
                      <option value="hero">Hero Banner (Página Inicial)</option>
                      <option value="banner">Banner Promocional</option>
                      <option value="categoria">Imagem de Categoria</option>
                      <option value="logo">Logo</option>
                      <option value="outro">Outro</option>
                    </select>
                  </div>
                  <button type="submit" disabled={uploading} className="h-10 px-6 bg-[#7C3AED] text-white font-semibold rounded-xl hover:bg-[#6D28D9] transition-colors disabled:opacity-50">
                    {uploading ? 'Publicando...' : 'Publicar Imagem'}
                  </button>
                </form>
              </div>

              {/* Galeria */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {imagens.length > 0 ? imagens.map((img) => (
                  <div key={img.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    <div className="aspect-video bg-gray-100 relative overflow-hidden">
                      <img src={img.url} alt={img.titulo} className="w-full h-full object-cover" />
                      {!img.ativo && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <span className="text-white text-xs font-semibold bg-black/60 px-2 py-1 rounded-full">Inativa</span>
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-sm font-semibold text-[#111827]">{img.titulo}</p>
                          <p className="text-[10px] text-gray-500 uppercase tracking-wider">{img.tipo}</p>
                        </div>
                        <span className={`w-2 h-2 rounded-full ${img.ativo ? 'bg-green-500' : 'bg-gray-300'}`} />
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <a href={img.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#7C3AED] transition-colors">
                          <ExternalLink size={12} /> Ver
                        </a>
                        <button onClick={() => toggleAtivo(img)} className={`flex items-center gap-1 text-xs font-medium transition-colors ${img.ativo ? 'text-green-600 hover:text-green-700' : 'text-gray-400 hover:text-gray-600'}`}>
                          {img.ativo ? <><EyeOff size={12} /> Desativar</> : <><Eye size={12} /> Ativar</>}
                        </button>
                        <button onClick={() => excluirImagem(img.id)} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 transition-colors ml-auto">
                          <Trash2 size={12} /> Excluir
                        </button>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="col-span-full text-center py-16 bg-white rounded-2xl border border-gray-100">
                    <Image size={48} className="mx-auto mb-3 text-gray-300" />
                    <p className="text-gray-500">Nenhuma imagem publicada ainda.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
