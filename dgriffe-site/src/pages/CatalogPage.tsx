import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { listarProdutos, listarCategorias, listarMarcas } from '../services/api';
import type { Product } from '../data/types';
import ProductCard from '../components/features/ProductCard';
import CategoryIcon from '../components/features/CategoryIcon';

type SortOption = 'relevancia' | 'menor-preco' | 'maior-preco' | 'nome';
const PAGE_SIZE = 30;

export default function CatalogPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [allProdutos, setAllProdutos] = useState<Product[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [marcas, setMarcas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // Filtros
  const [buscaInput, setBuscaInput] = useState('');
  const [busca, setBusca] = useState('');
  const [filtroCategorias, setFiltroCategorias] = useState<number[]>([]);
  const [filtroMarcas, setFiltroMarcas] = useState<number[]>([]);
  const [precoMin, setPrecoMin] = useState('');
  const [precoMax, setPrecoMax] = useState('');
  const [ordenacao, setOrdenacao] = useState<SortOption>('relevancia');

  // UI
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Debounce da busca
  useEffect(() => {
    const timer = setTimeout(() => setBusca(buscaInput.trim()), 400);
    return () => clearTimeout(timer);
  }, [buscaInput]);

  // Carregar categorias e marcas
  useEffect(() => {
    listarCategorias().then(setCategorias).catch(() => {});
    listarMarcas().then(setMarcas).catch(() => {});
  }, []);

  // Carregar produtos com paginação
  const carregarProdutos = useCallback(async (offset: number, append: boolean = false) => {
    if (offset === 0) setLoading(true);
    else setLoadingMore(true);

    try {
      const res = await listarProdutos({
        limit: PAGE_SIZE,
        offset,
        busca: busca || undefined,
      });
      const novos = res.produtos || [];
      setTotalCount(res.total || 0);

      if (append) {
        setAllProdutos((prev) => [...prev, ...novos]);
      } else {
        setAllProdutos(novos);
      }

      const totalCarregados = append ? allProdutos.length + novos.length : novos.length;
      setHasMore(totalCarregados < (res.total || 0));
    } catch {
      if (!append) setAllProdutos([]);
      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [busca]);

  // Recarregar quando busca muda
  useEffect(() => {
    carregarProdutos(0, false);
  }, [busca]);

  // Sincronizar com URL params
  useEffect(() => {
    const catId = searchParams.get('categoria');
    if (catId) setFiltroCategorias([Number(catId)]);
    const marcaId = searchParams.get('marca');
    if (marcaId) setFiltroMarcas([Number(marcaId)]);
  }, [searchParams]);

  // IntersectionObserver para infinite scroll
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          carregarProdutos(allProdutos.length, true);
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [hasMore, loading, loadingMore, allProdutos.length, carregarProdutos]);

  // Filtrar localmente
  const produtosFiltrados = (() => {
    let filtrados = [...allProdutos];

    if (filtroCategorias.length > 0) {
      filtrados = filtrados.filter((p) => {
        const cat = (p.category || '').toLowerCase();
        return filtroCategorias.some((id) => {
          const catEncontrada = categorias.find((c) => c.id === id);
          return catEncontrada && cat.includes(catEncontrada.nome.toLowerCase());
        });
      });
    }

    if (filtroMarcas.length > 0) {
      filtrados = filtrados.filter((p) => {
        const marca = (p.brand || '').toLowerCase();
        return filtroMarcas.some((id) => {
          const marcaEncontrada = marcas.find((m) => m.id === id);
          return marcaEncontrada && marca.includes(marcaEncontrada.nome.toLowerCase());
        });
      });
    }

    const min = parseFloat(precoMin);
    const max = parseFloat(precoMax);
    if (!isNaN(min)) filtrados = filtrados.filter((p) => p.price >= min);
    if (!isNaN(max)) filtrados = filtrados.filter((p) => p.price <= max);

    switch (ordenacao) {
      case 'menor-preco': filtrados.sort((a, b) => a.price - b.price); break;
      case 'maior-preco': filtrados.sort((a, b) => b.price - a.price); break;
      case 'nome': filtrados.sort((a, b) => a.name.localeCompare(b.name)); break;
      default: break;
    }

    return filtrados;
  })();

  const toggleCategoria = (id: number) => {
    setFiltroCategorias((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]);
  };

  const toggleMarca = (id: number) => {
    setFiltroMarcas((prev) => prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]);
  };

  const limparFiltros = () => {
    setFiltroCategorias([]);
    setFiltroMarcas([]);
    setPrecoMin('');
    setPrecoMax('');
    setBuscaInput('');
    setOrdenacao('relevancia');
    navigate('/catalogo');
  };

  const hasFiltros = filtroCategorias.length > 0 || filtroMarcas.length > 0 || precoMin || precoMax;

  return (
    <div className="container-site py-6">
      {/* Header */}
      <div className="mb-5">
        <h1 className="font-display text-2xl md:text-3xl font-bold text-luxury-black">Coleção</h1>
        <p className="text-sm text-gray-500 mt-1">
          {loading ? 'Carregando...' : `${totalCount.toLocaleString('pt-BR')} produtos`}
          {hasFiltros && ` • ${produtosFiltrados.length} filtrados`}
        </p>
      </div>

      {/* Barra superior: busca + botão filtros (mobile) + ordenação */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <input
            type="text"
            value={buscaInput}
            onChange={(e) => setBuscaInput(e.target.value)}
            placeholder="Buscar produtos..."
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-ice-dark text-sm focus:outline-none focus:border-gold"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 h-11 rounded-xl border border-ice-dark text-sm font-medium text-gray-600 hover:bg-ice transition-colors md:hidden"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg>
            Filtros
          </button>
          <select
            value={ordenacao}
            onChange={(e) => setOrdenacao(e.target.value as SortOption)}
            className="h-11 px-3 rounded-xl border border-ice-dark text-sm focus:outline-none focus:border-gold bg-white"
          >
            <option value="relevancia">Relevância</option>
            <option value="menor-preco">Menor preço</option>
            <option value="maior-preco">Maior preço</option>
            <option value="nome">Nome (A-Z)</option>
          </select>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar Desktop */}
        <aside className="hidden md:block w-60 flex-shrink-0">
          <div className="sticky top-20 space-y-5 max-h-[calc(100vh-6rem)] overflow-y-auto no-scrollbar pr-2">
            {/* Categorias */}
            <div>
              <h3 className="text-[11px] font-bold text-luxury-black uppercase tracking-wider mb-2">Categorias</h3>
              <div className="space-y-0.5">
                {categorias.map((cat) => (
                  <label key={cat.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-ice transition-colors">
                    <input type="checkbox" checked={filtroCategorias.includes(cat.id)} onChange={() => toggleCategoria(cat.id)} className="w-3.5 h-3.5 rounded border-ice-dark text-gold focus:ring-gold/20" />
                    <CategoryIcon categoryName={cat.nome} />
                    <span className="text-xs text-gray-600 truncate">{cat.nome}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Marcas */}
            <div>
              <h3 className="text-[11px] font-bold text-luxury-black uppercase tracking-wider mb-2">Marcas</h3>
              <div className="space-y-0.5">
                {marcas.map((marca) => (
                  <label key={marca.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-ice transition-colors">
                    <input type="checkbox" checked={filtroMarcas.includes(marca.id)} onChange={() => toggleMarca(marca.id)} className="w-3.5 h-3.5 rounded border-ice-dark text-gold focus:ring-gold/20" />
                    <span className="text-xs text-gray-600 truncate">{marca.nome}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Preço */}
            <div>
              <h3 className="text-[11px] font-bold text-luxury-black uppercase tracking-wider mb-2">Preço</h3>
              <div className="flex gap-2 items-center">
                <input type="number" value={precoMin} onChange={(e) => setPrecoMin(e.target.value)} placeholder="Min" min="0" className="w-full h-9 px-2 rounded-lg border border-ice-dark text-xs focus:outline-none focus:border-gold" />
                <span className="text-gray-400 text-xs">—</span>
                <input type="number" value={precoMax} onChange={(e) => setPrecoMax(e.target.value)} placeholder="Max" min="0" className="w-full h-9 px-2 rounded-lg border border-ice-dark text-xs focus:outline-none focus:border-gold" />
              </div>
            </div>

            {hasFiltros && (
              <button onClick={limparFiltros} className="w-full h-9 rounded-lg border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 transition-colors">
                Limpar filtros
              </button>
            )}
          </div>
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
          ) : produtosFiltrados.length > 0 ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {produtosFiltrados.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>

              {/* Infinite scroll sentinel */}
              <div ref={loadMoreRef} className="h-20 flex items-center justify-center">
                {loadingMore && (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <span className="w-4 h-4 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
                    Carregando mais...
                  </div>
                )}
                {!hasMore && allProdutos.length > 0 && (
                  <p className="text-xs text-gray-400">Você viu todos os produtos</p>
                )}
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

      {/* Drawer Mobile */}
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
            <div className="p-4 space-y-5">
              <div>
                <h3 className="text-[11px] font-bold text-luxury-black uppercase tracking-wider mb-2">Categorias</h3>
                <div className="space-y-0.5 max-h-40 overflow-y-auto no-scrollbar">
                  {categorias.map((cat) => (
                    <label key={cat.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-ice">
                      <input type="checkbox" checked={filtroCategorias.includes(cat.id)} onChange={() => toggleCategoria(cat.id)} className="w-3.5 h-3.5 rounded border-ice-dark" />
                      <CategoryIcon categoryName={cat.nome} />
                      <span className="text-xs text-gray-600 truncate">{cat.nome}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-[11px] font-bold text-luxury-black uppercase tracking-wider mb-2">Marcas</h3>
                <div className="space-y-0.5 max-h-40 overflow-y-auto no-scrollbar">
                  {marcas.map((marca) => (
                    <label key={marca.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-ice">
                      <input type="checkbox" checked={filtroMarcas.includes(marca.id)} onChange={() => toggleMarca(marca.id)} className="w-3.5 h-3.5 rounded border-ice-dark" />
                      <span className="text-xs text-gray-600 truncate">{marca.nome}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-[11px] font-bold text-luxury-black uppercase tracking-wider mb-2">Preço</h3>
                <div className="flex gap-2 items-center">
                  <input type="number" value={precoMin} onChange={(e) => setPrecoMin(e.target.value)} placeholder="Min" min="0" className="w-full h-9 px-2 rounded-lg border border-ice-dark text-xs focus:outline-none focus:border-gold" />
                  <span className="text-gray-400 text-xs">—</span>
                  <input type="number" value={precoMax} onChange={(e) => setPrecoMax(e.target.value)} placeholder="Max" min="0" className="w-full h-9 px-2 rounded-lg border border-ice-dark text-xs focus:outline-none focus:border-gold" />
                </div>
              </div>
              {hasFiltros && (
                <button onClick={limparFiltros} className="w-full h-9 rounded-lg border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 transition-colors">
                  Limpar filtros
                </button>
              )}
              <button onClick={() => setSidebarOpen(false)} className="w-full h-11 btn-gold text-sm font-semibold">
                Ver {produtosFiltrados.length} produtos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
