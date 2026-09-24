import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { listarProdutos, listarCategorias, listarMarcas } from '../services/api';
import type { Product } from '../data/types';
import ProductCard from '../components/features/ProductCard';
import { getCategoriaNome } from '../data/categoriasMap';

/**
 * Catálogo com filtros — Filtragem no Backend (Server-side)
 * 
 * Conforme modelo de referência:
 * 1. Frontend captura filtros (categoria, marca, preço, busca)
 * 2. Monta query params e envia ao backend via GET
 * 3. Backend filtra no banco (listarProdutosLocal)
 * 4. Retorna JSON com produtos filtrados
 * 5. Frontend renderiza
 */

export default function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Dados
  const [items, setItems] = useState<Product[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [marcas, setMarcas] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros — estado controlado pelo frontend
  const [filtroCategoria, setFiltroCategoria] = useState<number | null>(null);
  const [filtroMarca, setFiltroMarca] = useState<number | null>(null);
  const [filtroPrecoMin, setFiltroPrecoMin] = useState('');
  const [filtroPrecoMax, setFiltroPrecoMax] = useState('');
  const [buscaInput, setBuscaInput] = useState('');
  const [busca, setBusca] = useState('');
  const [ordenacao, setOrdenacao] = useState('relevancia');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Debounce da busca (500ms)
  useEffect(() => {
    const t = setTimeout(() => setBusca(buscaInput.trim()), 500);
    return () => clearTimeout(t);
  }, [buscaInput]);

  // Carregar categorias e marcas (uma vez)
  useEffect(() => {
    listarCategorias().then(setCategorias).catch(() => {});
    listarMarcas().then(setMarcas).catch(() => {});
  }, []);

  // Ler URL params -> estado inicial
  useEffect(() => {
    const cat = searchParams.get('categoria');
    const mar = searchParams.get('marca');
    const precoMin = searchParams.get('preco_min');
    const precoMax = searchParams.get('preco_max');
    const buscaParam = searchParams.get('busca');
    const ordenacaoParam = searchParams.get('ordenacao');

    setFiltroCategoria(cat ? Number(cat) : null);
    setFiltroMarca(mar ? Number(mar) : null);
    setFiltroPrecoMin(precoMin || '');
    setFiltroPrecoMax(precoMax || '');
    setBuscaInput(buscaParam || '');
    setBusca(buscaParam || '');
    setOrdenacao(ordenacaoParam || 'relevancia');
  }, [searchParams]);

  // Carregar produtos SEMPRE que filtros mudam (conforme modelo useEffect + fetch)
  useEffect(() => {
    let cancelled = false;

    async function carregar() {
      setLoading(true);
      setError(null);

      try {
        // Montar query params (conforme modelo: URLSearchParams)
        const params: Record<string, string> = { limit: '100' };
        
        if (filtroCategoria) params.categorias = String(filtroCategoria);
        if (filtroMarca) params.marca = String(filtroMarca);
        if (busca) params.nome__icontains = busca;
        if (filtroPrecoMin) params.preco_min = filtroPrecoMin;
        if (filtroPrecoMax) params.preco_max = filtroPrecoMax;
        if (ordenacao && ordenacao !== 'relevancia') params.ordenacao = ordenacao;

        const res = await listarProdutos(params);
        const produtos = res.produtos || [];

        if (!cancelled) {
          setItems(produtos);
          setTotal(res.total || produtos.length);
        }
      } catch (err) {
        if (!cancelled) {
          setError('Erro ao carregar produtos. Tente novamente.');
          setItems([]);
          setTotal(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    carregar();
    return () => { cancelled = true; };
  }, [filtroCategoria, filtroMarca, filtroPrecoMin, filtroPrecoMax, busca, ordenacao]);

  // Atualizar URL quando filtros mudam (mantém estado compartilhável)
  useEffect(() => {
    const params: Record<string, string> = {};
    if (filtroCategoria) params.categoria = String(filtroCategoria);
    if (filtroMarca) params.marca = String(filtroMarca);
    if (busca) params.busca = busca;
    if (filtroPrecoMin) params.preco_min = filtroPrecoMin;
    if (filtroPrecoMax) params.preco_max = filtroPrecoMax;
    if (ordenacao && ordenacao !== 'relevancia') params.ordenacao = ordenacao;
    setSearchParams(params, { replace: true });
  }, [filtroCategoria, filtroMarca, busca, filtroPrecoMin, filtroPrecoMax, ordenacao]);

  const limparFiltros = () => {
    setFiltroCategoria(null);
    setFiltroMarca(null);
    setFiltroPrecoMin('');
    setFiltroPrecoMax('');
    setBuscaInput('');
    setBusca('');
    setOrdenacao('relevancia');
    setSearchParams({});
  };

  const hasFiltros = filtroCategoria || filtroMarca || filtroPrecoMin || filtroPrecoMax || busca;

  const FiltrosBody = (
    <>
      {/* Categorias */}
      <div>
        <h3 className="text-[11px] font-bold text-luxury-black uppercase tracking-wider mb-2">Categorias</h3>
        <div className="space-y-0.5 max-h-56 overflow-y-auto no-scrollbar">
          {categorias.length === 0 && <p className="text-xs text-gray-400 px-1">Sem categorias.</p>}
          {categorias.map((c) => {
            const id = c.id;
            const checked = filtroCategoria === id;
            const nome = getCategoriaNome(id);
            return (
              <button
                key={id}
                onClick={() => setFiltroCategoria(checked ? null : id)}
                className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer transition-colors text-left ${
                  checked ? 'bg-gold/10' : 'hover:bg-ice'
                }`}
              >
                <input type="radio" name="categoria" checked={checked} onChange={() => {}} className="w-4 h-4 accent-gold" />
                <span className={`text-xs truncate ${checked ? 'font-semibold text-luxury-black' : 'text-gray-600'}`}>{nome}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Marcas */}
      <div>
        <h3 className="text-[11px] font-bold text-luxury-black uppercase tracking-wider mb-2">Marcas</h3>
        <div className="space-y-0.5 max-h-56 overflow-y-auto no-scrollbar">
          {marcas.length === 0 && <p className="text-xs text-gray-400 px-1">Sem marcas.</p>}
          {marcas.map((m) => {
            const id = m.id;
            const checked = filtroMarca === id;
            const nome = m.nome || `Marca ${id}`;
            return (
              <button
                key={id}
                onClick={() => setFiltroMarca(checked ? null : id)}
                className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer transition-colors text-left ${
                  checked ? 'bg-gold/10' : 'hover:bg-ice'
                }`}
              >
                <input type="radio" name="marca" checked={checked} onChange={() => {}} className="w-4 h-4 accent-gold" />
                <span className={`text-xs truncate ${checked ? 'font-semibold text-luxury-black' : 'text-gray-600'}`}>{nome}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Preço */}
      <div>
        <h3 className="text-[11px] font-bold text-luxury-black uppercase tracking-wider mb-2">Preço</h3>
        <div className="flex gap-2 items-center">
          <input type="number" value={filtroPrecoMin} onChange={(e) => setFiltroPrecoMin(e.target.value)} placeholder="Min" min="0" className="w-full h-9 px-2 rounded-lg border border-ice-dark text-xs focus:outline-none focus:border-gold" />
          <span className="text-gray-400 text-xs">–</span>
          <input type="number" value={filtroPrecoMax} onChange={(e) => setFiltroPrecoMax(e.target.value)} placeholder="Max" min="0" className="w-full h-9 px-2 rounded-lg border border-ice-dark text-xs focus:outline-none focus:border-gold" />
        </div>
      </div>

      {/* Ordenação */}
      <div>
        <h3 className="text-[11px] font-bold text-luxury-black uppercase tracking-wider mb-2">Ordenação</h3>
        <select
          value={ordenacao}
          onChange={(e) => setOrdenacao(e.target.value)}
          className="w-full h-9 px-2 rounded-lg border border-ice-dark text-xs focus:outline-none focus:border-gold bg-white"
        >
          <option value="relevancia">Relevância</option>
          <option value="menor-preco">Menor preço</option>
          <option value="maior-preco">Maior preço</option>
          <option value="nome">Nome (A-Z)</option>
        </select>
      </div>

      {hasFiltros && (
        <button onClick={limparFiltros} className="w-full h-9 rounded-lg border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 transition-colors">
          Limpar filtros
        </button>
      )}
    </>
  );

  return (
    <div className="container-site py-6">
      {/* Header */}
      <div className="mb-5">
        <h1 className="font-display text-2xl md:text-3xl font-bold text-luxury-black">Coleção</h1>
        <p className="text-sm text-gray-500 mt-1">
          {loading ? 'Carregando...' : `${total.toLocaleString('pt-BR')} produto${total !== 1 ? 's' : ''}`}
          {hasFiltros && items.length > 0 && ` • ${items.length} visível${items.length !== 1 ? 'is' : ''}`}
        </p>
        {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
      </div>

      {/* Barra superior: busca + botão filtros (mobile) */}
      <div className="flex gap-2 mb-5">
        <div className="relative flex-1">
          <input
            type="text"
            value={buscaInput}
            onChange={(e) => setBuscaInput(e.target.value)}
            placeholder="Buscar produtos..."
            className="w-full h-11 pl-10 pr-3 rounded-xl border border-ice-dark text-sm focus:outline-none focus:border-gold"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
        </div>
        <button
          onClick={() => setSidebarOpen(true)}
          className="md:hidden flex items-center justify-center gap-1.5 px-4 h-11 rounded-xl border border-ice-dark text-sm font-medium text-gray-600 hover:bg-ice transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg>
          Filtros
        </button>
      </div>

      <div className="flex gap-6 items-start">
        {/* Sidebar desktop */}
        <aside className="hidden md:block w-60 flex-shrink-0">
          <div className="sticky top-20 space-y-5">{FiltrosBody}</div>
        </aside>

        {/* Grid de produtos */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="card overflow-hidden animate-pulse">
                  <div className="aspect-[4/3] bg-ice-dark" />
                  <div className="p-3 space-y-2">
                    <div className="h-2.5 bg-ice-dark rounded" />
                    <div className="h-2.5 bg-ice-dark rounded w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length > 0 ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <svg className="w-14 h-14 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/></svg>
              <p className="text-gray-500 mb-2">Nenhum produto encontrado.</p>
              {hasFiltros && (
                <button onClick={limparFiltros} className="text-gold text-sm font-semibold hover:underline">
                  Limpar filtros
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Drawer mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-white shadow-xl overflow-y-auto animate-slide-in-left">
            <div className="sticky top-0 bg-white border-b border-ice-dark px-4 py-3 flex items-center justify-between z-10">
              <h2 className="font-display font-bold text-base text-luxury-black">Filtros</h2>
              <button onClick={() => setSidebarOpen(false)} className="w-8 h-8 rounded-full bg-ice flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-4 space-y-5">{FiltrosBody}</div>
            <div className="sticky bottom-0 bg-white border-t border-ice-dark px-4 py-3">
              <button onClick={() => setSidebarOpen(false)} className="w-full h-11 btn-gold text-sm font-semibold">
                Ver {total.toLocaleString('pt-BR')} produtos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
