import { useState, useEffect, useCallback } from 'react';
import { Image, Upload, Trash2, Eye, EyeOff, ExternalLink } from 'lucide-react';

interface ImagemSite {
  id: string;
  tipo: string;
  titulo: string;
  url: string;
  ativa: boolean;
  created_at: string;
}

const TIPOS = [
  { id: 'hero', label: 'Hero Banner (página inicial)' },
  { id: 'banner', label: 'Banner (seções)' },
  { id: 'categoria', label: 'Imagem de Categoria' },
  { id: 'marca', label: 'Logo de Marca' },
  { id: 'outro', label: 'Outro' },
];

export default function ImagensAdmin({ token }: { token: string }) {
  const [imagens, setImagens] = useState<ImagemSite[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [tipo, setTipo] = useState('hero');
  const [titulo, setTitulo] = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/site/imagens');
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const data = await res.json();
      setImagens(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const res = await fetch('/api/admin/imagens', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ tipo, titulo, dados: base64, nome_arquivo: file.name }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.erro || `Erro ${res.status}`);
        }
        await carregar();
        setTitulo('');
      };
      reader.readAsDataURL(file);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const toggleAtiva = async (id: string, ativa: boolean) => {
    try {
      const res = await fetch(`/api/admin/imagens/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ativa: !ativa }),
      });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      await carregar();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const excluir = async (id: string) => {
    if (!confirm('Excluir esta imagem?')) return;
    try {
      const res = await fetch(`/api/admin/imagens/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      await carregar();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Imagens do Site</h3>
            <p className="text-[11px] text-slate-400">Publique banners, imagens de categorias e conteúdo visual</p>
          </div>
          <button onClick={carregar} disabled={loading} className="h-9 px-4 rounded-xl border border-violet-200 text-violet-600 text-[11px] font-bold hover:bg-violet-50 active:scale-95 transition-all">
            {loading ? 'Carregando...' : 'Atualizar'}
          </button>
        </div>

        {/* Upload */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <select value={tipo} onChange={e => setTipo(e.target.value)} className="h-10 px-3 rounded-lg border border-slate-200 text-sm">
              {TIPOS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <input type="text" placeholder="Título (ex: Hero Banner Verão 2026)" value={titulo} onChange={e => setTitulo(e.target.value)} className="flex-1 h-10 px-3 rounded-lg border border-slate-200 text-sm" />
            <label className="h-10 px-4 rounded-xl bg-violet-600 text-white text-sm font-bold flex items-center gap-2 cursor-pointer hover:bg-violet-700 transition-all">
              <Upload size={16} />
              {uploading ? 'Enviando...' : 'Upload'}
              <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
            </label>
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-red-600 text-xs">{error}</div>}

        {/* Lista */}
        {loading && (
          <div className="flex justify-center py-10">
            <div className="w-7 h-7 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && imagens.length === 0 && (
          <div className="text-center py-10">
            <Image className="mx-auto mb-3 text-slate-300" width={32} height={32} />
            <p className="text-xs text-slate-400">Nenhuma imagem publicada ainda.</p>
          </div>
        )}

        {!loading && imagens.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {imagens.map(img => (
              <div key={img.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="aspect-video bg-slate-100 relative">
                  <img src={img.url} alt={img.titulo} className="w-full h-full object-cover" />
                  {!img.ativa && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="text-white text-xs font-bold">INATIVA</span>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-xs font-bold text-slate-800 truncate">{img.titulo}</p>
                  <p className="text-[10px] text-slate-400 mb-2">{TIPOS.find(t => t.id === img.tipo)?.label}</p>
                  <div className="flex gap-1">
                    <button onClick={() => toggleAtiva(img.id, img.ativa)} className={`flex-1 h-7 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-all ${img.ativa ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                      {img.ativa ? <Eye size={12} /> : <EyeOff size={12} />}
                      {img.ativa ? 'Ativa' : 'Inativa'}
                    </button>
                    <a href={img.url} target="_blank" className="h-7 w-7 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200">
                      <ExternalLink size={12} />
                    </a>
                    <button onClick={() => excluir(img.id)} className="h-7 w-7 rounded-lg bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
