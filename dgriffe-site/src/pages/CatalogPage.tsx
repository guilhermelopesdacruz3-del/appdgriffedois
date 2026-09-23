import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { listarProdutos, listarCategorias, listarMarcas } from '../services/api';
import type { Product } from '../data/types';
import ProductCard from '../components/features/ProductCard';

const PAGE_SIZE = 24;

export default function CatalogPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [items, setItems] = useState<Product[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [marcas, setMarcas] = useState<any[]>([]);
  const [total, setTotal] = useState(0);

  const [loadingFirst, setLoadingFirst] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Filtros
  const [buscaInput, setBuscaInput] = useState('');
  const [busca, setBusca] = useState('');
  const [selCategorias, setSelCategorias] = useState<number[]>([]);
  const [selMarcas, setSelMarcas] = useState<number[]>([]);
  const [precoMin, setPrecoMin] = useState('');
  const [precoMax, setPrecoMax] = useState('');
  const [ordenacao, setOrdenacao] = useState<'relevancia' | 'menor-preco' | 'maior-preco' | 'nome'>('relevancia');

  const [drawerOpen, setDrawerOpen] = useState(false);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(false);

  // Debounce da busca (500ms)
  useEffect(() => {
    const t = setTimeout(() => setBusca(buscaInput.trim()), 500);
    return () => clearTimeout(t);
  }, [buscaInput]);

  // Categorias / marcas (uma vez)
  useEffect(() => {
    listarCategorias().then(setCategorias).catch(() => {});
    listarMarcas().then(setMarcas).catch(() => {});
  }, []);

  // URL params -> estado inicial
  useEffect(() => {
    const cat = searchParams.get('categoria');
    if (cat) setSelCategorias([Number(cat)]);
    const mar = searchParams.get('marca');
    if (mar) setSelMarcas([Number(mar)]);
  }, [searchParams]);

  const buildQuery = useCallback((off: number) => {
    const q: Record<string, string> = { limit: String(PAGE_SIZE), offset: String(off) };
    if (selCategorias.length === 1) q.categorias = String(selCategorias[0]);
    else if (selCategorias.length > 1) q.categorias = selCategorias.join(',');
    if (selMarcas.length === 1) q.marca = String(selMarcas[0]);
    else if (selMarcas.length > 1) q.marca = selMarcas.join(',');
    if (busca) q.nome__icontains = busca;
    return q;
  }, [selCategorias, selMarcas, busca]);

  const fetchPage = useCallback(async (off: number) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (off === 0) setLoadingFirst(true); else setLoadingMore(true);

    try {
      const q = buildQuery(off);
      const res = await listarProdutos(q);
      const novos: Product[] = (res as any).produtos || [];

      if (off === 0) setItems(novos);
      else setItems((prev) => [...prev, ...novos]);

      const newOffset = off + novos.length;
      setOffset(newOffset);
      const tot = (res as any).total ?? novos.length;
      setTotal(tot);
      setHasMore(newOffset < tot);
    } catch {
      if (off === 0) { setItems([]); setTotal(0); }
      setHasMore(false);
    } finally {
      loadingRef.current = false;
      setLoadingFirst(false);
      setLoadingMore(false);
    }
  }, [buildQuery]);

  // Recarregar sempre que filtros mudam (do zero)
  useEffect(() => {
    fetchPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selCategorias, selMarcas, busca, ordenacao]);

  // Infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingRef.current) {
          fetchPage(offset);
        }
      },
      { rootMargin: '300px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, offset, fetchPage]);

  const toggleArr = (arr: number[], id: number, set: (v: number[]) => void) =>
    set(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

  const limparFiltros = () => {
    setSelCategorias([]);
    setSelMarcas([]);
    setPrecoMin('');
    setPrecoMax('');
    setBuscaInput('');
    setOrdenacao('relevancia');
    navigate('/catalogo');
  };

  const hasFiltros = selCategorias.length > 0 || selMarcas.length > 0 || precoMin || precoMax || busca;

  const FiltrosBody = (
    <>
      {/* Categorias */}
      <div>
        <h3 className="text-[11px] font-bold text-luxury-black uppercase tracking-wider mb-2">Categorias</h3>
        <div className="space-y-0.5 max-h-56 overflow-y-auto no-scrollbar">
          {categorias.length === 0 && <p className="text-xs text-gray-400 px-1">Sem categorias.</p>}
          {categorias.map((c) => {
            const id = c.id;
            const checked = selCategorias.includes(id);
            const nome = c.nome || (c.descricao || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
            return (
              <label key={id} className={`flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer transition-colors ${checked ? 'bg-gold/10' : 'hover:bg-ice'}`}>
                <input type="checkbox" checked={checked} onChange={() => toggleArr(selCategorias, id, setSelCategorias)} className="w-4 h-4 accent-gold" />
                <span className={`text-xs truncate ${checked ? 'font-semibold text-luxury-black' : 'text-gray-600'}`}>{nome || `Categoria ${id}`}</span>
              </label>
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
            const checked = selMarcas.includes(id);
            const nome = m.nome || `Marca ${id}`;
            return (
              <label key={id} className={`flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer transition-colors ${checked ? 'bg-gold/10' : 'hover:bg-ice'}`}>
                <input type="checkbox" checked={checked} onChange={() => toggleArr(selMarcas, id, setSelMarcas)} className="w-4 h-4 accent-gold" />
                <span className={`text-xs truncate ${checked ? 'font-semibold text-luxury-black' : 'text-gray-600'}`}>{nome}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Preço */}
      <div>
        <h3 className="text-[11px] font-bold text-luxury-black uppercase tracking-wider mb-2">Preço</h3>
        <div className="flex gap-2 items-center">
          <input type="number" value={precoMin} onChange={(e) => setPrecoMin(e.target.value)} placeholder="Min" min="0" className="w-full h-9 px-2 rounded-lg border border-ice-dark text-xs focus:outline-none focus:border-gold" />
          <span className="text-gray-400 text-xs">–</span>
          <input type="number" value={precoMax} onChange={(e) => setPrecoMax(e.target.value)} placeholder="Max" min="0" className="w-full h-9 px-2 rounded-lg border border-ice-dark text-xs focus:outline-none focus:border-gold" />
        </div>
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
          {loadingFirst ? 'Carregando...' : `${total.toLocaleString('pt-BR')} produtos`}
          {hasFiltros && items.length > 0 && ` • ${items.length} nesta página`}
        </p>
      </div>

      {/* Barra: busca + ordenação + (mobile) botão filtros */}
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
        <select
          value={ordenacao}
          onChange={(e) => setOrdenacao(e.target.value as any)}
          className="h-11 px-3 rounded-xl border border-ice-dark text-sm focus:outline-none focus:border-gold bg-white"
        >
          <option value="relevancia">Relevância</option>
          <option value="menor-preco">Menor preço</option>
          <option value="maior-preco">Maior preço</option>
          <option value="nome">Nome (A-Z)</option>
        </select>
        <button
          onClick={() => setDrawerOpen(true)}
          className="md:hidden flex items-center justify-center gap-1.5 px-4 h-11 rounded-xl border border-ice-dark text-sm font-medium text-gray-600 hover:bg-ice transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg>
          Filtros
          {hasFiltros && <span className="w-2 h-2 rounded-full bg-gold" />}
        </button>
      </div>

      <div className="flex gap-6 items-start">
        {/* Sidebar desktop */}
        <aside className="hidden md:block w-60 flex-shrink-0">
          <div className="sticky top-20 space-y-5">{FiltrosBody}</div>
        </aside>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0">
          {loadingFirst ? (
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
            <>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>

              {/* Sentinela do infinite scroll */}
              <div ref={sentinelRef} className="h-24 flex items-center justify-center">
                {loadingMore && (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <span className="w-4 h-4 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
                    Carregando mais...
                  </div>
                )}
                {!hasMore && <p className="text-xs text-gray-400">Fim dos produtos</p>}
              </div>
            </>
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
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-white shadow-xl overflow-y-auto animate-slide-in-left">
            <div className="sticky top-0 bg-white border-b border-ice-dark px-4 py-3 flex items-center justify-between z-10">
              <h2 className="font-display font-bold text-base text-luxury-black">Filtros</h2>
              <button onClick={() => setDrawerOpen(false)} className="w-8 h-8 rounded-full bg-ice flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-4 space-y-5">{FiltrosBody}</div>
            <div className="sticky bottom-0 bg-white border-t border-ice-dark px-4 py-3">
              <button onClick={() => setDrawerOpen(false)} className="w-full h-11 btn-gold text-sm font-semibold">
                Ver {total.toLocaleString('pt-BR')} produtos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
