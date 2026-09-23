import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { listarProdutos, listarCategorias, listarMarcas } from '../services/api';
import type { Product } from '../data/types';
import ProductCard from '../components/features/ProductCard';
import CategoryIcon from '../components/features/CategoryIcon';

type SortOption = 'relevancia' | 'menor-preco' | 'maior-preco' | 'nome';

export default function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [produtos, setProdutos] = useState<Product[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [marcas, setMarcas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [buscaInput, setBuscaInput] = useState('');
  const [busca, setBusca] = useState('');
  const [filtroCategorias, setFiltroCategorias] = useState<number[]>([]);
  const [filtroMarcas, setFiltroMarcas] = useState<number[]>([]);
  const [precoMin, setPrecoMin] = useState('');
  const [precoMax, setPrecoMax] = useState('');
  const [ordenacao, setOrdenacao] = useState<SortOption>('relevancia');

  // Sidebar mobile
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  // Carregar produtos
  useEffect(() => {
    async function carregar() {
      setLoading(true);
      try {
        const res = await listarProdutos({
          limit: 200,
          busca: busca || undefined,
        });
        setProdutos(res.produtos || []);
      } catch {
        setProdutos([]);
      } finally {
        setLoading(false);
      }
    }
    carregar();
  }, [busca]);

  // Sincronizar com URL params
  useEffect(() => {
    const catId = searchParams.get('categoria');
    if (catId) setFiltroCategorias([Number(catId)]);
    const marcaId = searchParams.get('marca');
    if (marcaId) setFiltroMarcas([Number(marcaId)]);
  }, [searchParams]);

  // Filtrar produtos localmente
  const produtosFiltrados = useMemo(() => {
    let filtrados = [...produtos];

    // Categoria
    if (filtroCategorias.length > 0) {
      filtrados = filtrados.filter((p) => {
        const cat = (p.category || '').toLowerCase();
        return filtroCategorias.some((id) => {
          const catEncontrada = categorias.find((c) => c.id === id);
          if (!catEncontrada) return false;
          return cat.includes(catEncontrada.nome.toLowerCase());
        });
      });
    }

    // Marca
    if (filtroMarcas.length > 0) {
      filtrados = filtrados.filter((p) => {
        const marca = (p.brand || '').toLowerCase();
        return filtroMarcas.some((id) => {
          const marcaEncontrada = marcas.find((m) => m.id === id);
          if (!marcaEncontrada) return false;
          return marca.includes(marcaEncontrada.nome.toLowerCase());
        });
      });
    }

    // Preço
    const min = parseFloat(precoMin);
    const max = parseFloat(precoMax);
    if (!isNaN(min)) filtrados = filtrados.filter((p) => p.price >= min);
    if (!isNaN(max)) filtrados = filtrados.filter((p) => p.price <= max);

    // Ordenação
    switch (ordenacao) {
      case 'menor-preco':
        filtrados.sort((a, b) => a.price - b.price);
        break;
      case 'maior-preco':
        filtrados.sort((a, b) => b.price - a.price);
        break;
      case 'nome':
        filtrados.sort((a, b) => a.name.localeCompare(b.name));
        break;
      default:
        break;
    }

    return filtrados;
  }, [produtos, filtroCategorias, filtroMarcas, precoMin, precoMax, ordenacao, categorias, marcas]);

  const toggleCategoria = (id: number) => {
    setFiltroCategorias((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const toggleMarca = (id: number) => {
    setFiltroMarcas((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const limparFiltros = () => {
    setFiltroCategorias([]);
    setFiltroMarcas([]);
    setPrecoMin('');
    setPrecoMax('');
    setBuscaInput('');
    setOrdenacao('relevancia');
    setSearchParams({});
  };

  const hasFiltros = filtroCategorias.length > 0 || filtroMarcas.length > 0 || precoMin || precoMax;

  return (
    <div className="container-site py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="section-title">Coleção</h1>
          <p className="text-sm text-gray-500 mt-1">
            {loading ? 'Carregando...' : `${produtosFiltrados.length} produto${produtosFiltrados.length !== 1 ? 's' : ''} encontrado${produtosFiltrados.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={() => setSidebarOpen(true)}
          className="md:hidden flex items-center gap-2 px-4 py-2 rounded-xl border border-ice-dark text-sm font-medium text-gray-600 hover:bg-ice transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg>
          Filtros
        </button>
      </div>

      <div className="flex gap-8">
        {/* Sidebar Desktop */}
        <aside className="hidden md:block w-64 flex-shrink-0">
          <div className="sticky top-24 space-y-6">
            {/* Busca */}
            <div>
              <h3 className="text-xs font-bold text-luxury-black uppercase tracking-wider mb-3">Buscar</h3>
              <div className="relative">
                <input
                  type="text"
                  value={buscaInput}
                  onChange={(e) => setBuscaInput(e.target.value)}
                  placeholder="Buscar produtos..."
                  className="w-full h-10 pl-9 pr-3 rounded-xl border border-ice-dark text-sm focus:outline-none focus:border-gold"
                />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              </div>
            </div>

            {/* Categorias */}
            <div>
              <h3 className="text-xs font-bold text-luxury-black uppercase tracking-wider mb-3">Categorias</h3>
              <div className="space-y-1 max-h-48 overflow-y-auto no-scrollbar">
                {categorias.length > 0 ? (
                  categorias.map((cat) => (
                    <label
                      key={cat.id}
                      className="flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer hover:bg-ice transition-colors group"
                    >
                      <input
                        type="checkbox"
                        checked={filtroCategorias.includes(cat.id)}
                        onChange={() => toggleCategoria(cat.id)}
                        className="w-4 h-4 rounded border-ice-dark text-gold focus:ring-gold/20"
                      />
                      <CategoryIcon categoryName={cat.nome} />
                      <span className="text-sm text-gray-600 group-hover:text-luxury-black transition-colors truncate">{cat.nome}</span>
                    </label>
                  ))
                ) : (
                  <p className="text-xs text-gray-400 px-2">Nenhuma categoria encontrada.</p>
                )}
              </div>
            </div>

            {/* Marcas */}
            <div>
              <h3 className="text-xs font-bold text-luxury-black uppercase tracking-wider mb-3">Marcas</h3>
              <div className="space-y-1 max-h-48 overflow-y-auto no-scrollbar">
                {marcas.length > 0 ? (
                  marcas.map((marca) => (
                    <label
                      key={marca.id}
                      className="flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer hover:bg-ice transition-colors group"
                    >
                      <input
                        type="checkbox"
                        checked={filtroMarcas.includes(marca.id)}
                        onChange={() => toggleMarca(marca.id)}
                        className="w-4 h-4 rounded border-ice-dark text-gold focus:ring-gold/20"
                      />
                      <span className="text-sm text-gray-600 group-hover:text-luxury-black transition-colors truncate">{marca.nome}</span>
                    </label>
                  ))
                ) : (
                  <p className="text-xs text-gray-400 px-2">Nenhuma marca encontrada.</p>
                )}
              </div>
            </div>

            {/* Preço */}
            <div>
              <h3 className="text-xs font-bold text-luxury-black uppercase tracking-wider mb-3">Faixa de Preço</h3>
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  value={precoMin}
                  onChange={(e) => setPrecoMin(e.target.value)}
                  placeholder="Min"
                  min="0"
                  className="w-full h-10 px-3 rounded-xl border border-ice-dark text-sm focus:outline-none focus:border-gold"
                />
                <span className="text-gray-400 text-sm">—</span>
                <input
                  type="number"
                  value={precoMax}
                  onChange={(e) => setPrecoMax(e.target.value)}
                  placeholder="Max"
                  min="0"
                  className="w-full h-10 px-3 rounded-xl border border-ice-dark text-sm focus:outline-none focus:border-gold"
                />
              </div>
            </div>

            {/* Limpar */}
            {hasFiltros && (
              <button
                onClick={limparFiltros}
                className="w-full h-10 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg>
                Limpar filtros
              </button>
            )}
          </div>
        </aside>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0">
          {/* Barra de busca mobile + ordenação */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1 md:hidden">
              <input
                type="text"
                value={buscaInput}
                onChange={(e) => setBuscaInput(e.target.value)}
                placeholder="Buscar produtos..."
                className="w-full h-11 pl-10 pr-4 rounded-xl border border-ice-dark text-sm focus:outline-none focus:border-gold"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-500 whitespace-nowrap">Ordenar:</label>
              <select
                value={ordenacao}
                onChange={(e) => setOrdenacao(e.target.value as SortOption)}
                className="h-10 px-3 rounded-xl border border-ice-dark text-sm focus:outline-none focus:border-gold bg-white"
              >
                <option value="relevancia">Relevância</option>
                <option value="menor-preco">Menor preço</option>
                <option value="maior-preco">Maior preço</option>
                <option value="nome">Nome (A-Z)</option>
              </select>
            </div>
          </div>

          {/* Grid de produtos */}
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="card overflow-hidden animate-pulse">
                  <div className="aspect-[4/3] bg-ice-dark" />
                  <div className="p-3 space-y-2">
                    <div className="h-3 bg-ice-dark rounded" />
                    <div className="h-3 bg-ice-dark rounded w-3/4" />
                    <div className="h-6 bg-ice-dark rounded mt-2" />
                  </div>
                </div>
              ))}
            </div>
          ) : produtosFiltrados.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4">
              {produtosFiltrados.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/></svg>
              <p className="text-gray-500 mb-2">Nenhum produto encontrado.</p>
              {hasFiltros && (
                <button
                  onClick={limparFiltros}
                  className="text-gold text-sm font-semibold hover:underline"
                >
                  Limpar filtros e tentar novamente
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sidebar Mobile (Drawer) */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-80 bg-white shadow-xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-ice-dark px-5 py-4 flex items-center justify-between">
              <h2 className="font-display font-bold text-lg text-luxury-black">Filtros</h2>
              <button onClick={() => setSidebarOpen(false)} className="w-8 h-8 rounded-full bg-ice flex items-center justify-center hover:bg-ice-dark transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-5 space-y-6">
              {/* Busca mobile */}
              <div>
                <h3 className="text-xs font-bold text-luxury-black uppercase tracking-wider mb-3">Buscar</h3>
                <input
                  type="text"
                  value={buscaInput}
                  onChange={(e) => setBuscaInput(e.target.value)}
                  placeholder="Buscar produtos..."
                  className="w-full h-10 px-3 rounded-xl border border-ice-dark text-sm focus:outline-none focus:border-gold"
                />
              </div>

              {/* Categorias mobile */}
              <div>
                <h3 className="text-xs font-bold text-luxury-black uppercase tracking-wider mb-3">Categorias</h3>
                <div className="space-y-1">
                  {categorias.map((cat) => (
                    <label key={cat.id} className="flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer hover:bg-ice transition-colors">
                      <input
                        type="checkbox"
                        checked={filtroCategorias.includes(cat.id)}
                        onChange={() => toggleCategoria(cat.id)}
                        className="w-4 h-4 rounded border-ice-dark"
                      />
                      <CategoryIcon categoryName={cat.nome} />
                      <span className="text-sm text-gray-600 truncate">{cat.nome}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Marcas mobile */}
              <div>
                <h3 className="text-xs font-bold text-luxury-black uppercase tracking-wider mb-3">Marcas</h3>
                <div className="space-y-1">
                  {marcas.map((marca) => (
                    <label key={marca.id} className="flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer hover:bg-ice transition-colors">
                      <input
                        type="checkbox"
                        checked={filtroMarcas.includes(marca.id)}
                        onChange={() => toggleMarca(marca.id)}
                        className="w-4 h-4 rounded border-ice-dark"
                      />
                      <span className="text-sm text-gray-600 truncate">{marca.nome}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Preço mobile */}
              <div>
                <h3 className="text-xs font-bold text-luxury-black uppercase tracking-wider mb-3">Faixa de Preço</h3>
                <div className="flex gap-2 items-center">
                  <input type="number" value={precoMin} onChange={(e) => setPrecoMin(e.target.value)} placeholder="Min" min="0" className="w-full h-10 px-3 rounded-xl border border-ice-dark text-sm focus:outline-none focus:border-gold" />
                  <span className="text-gray-400">—</span>
                  <input type="number" value={precoMax} onChange={(e) => setPrecoMax(e.target.value)} placeholder="Max" min="0" className="w-full h-10 px-3 rounded-xl border border-ice-dark text-sm focus:outline-none focus:border-gold" />
                </div>
              </div>

              {/* Aplicar */}
              <button
                onClick={() => setSidebarOpen(false)}
                className="w-full h-11 btn-gold text-sm font-semibold"
              >
                Ver resultados ({produtosFiltrados.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
