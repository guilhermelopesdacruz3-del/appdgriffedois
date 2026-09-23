import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { listarProdutos, listarCategorias, listarMarcas } from '../services/api';
import type { Product } from '../data/types';
import ProductCard from '../components/features/ProductCard';

export default function CatalogPage() {
  const [searchParams] = useSearchParams();
  const [produtos, setProdutos] = useState<Product[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [marcas, setMarcas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroCategoria, setFiltroCategoria] = useState<number | null>(null);
  const [filtroMarca, setFiltroMarca] = useState<number | null>(null);
  const [busca, setBusca] = useState('');

  const categoriaId = searchParams.get('categoria') ? Number(searchParams.get('categoria')) : null;
  const marcaId = searchParams.get('marca') ? Number(searchParams.get('marca')) : null;

  useEffect(() => {
    listarCategorias().then(setCategorias).catch(() => {});
    listarMarcas().then(setMarcas).catch(() => {});
  }, []);

  useEffect(() => {
    async function carregar() {
      setLoading(true);
      try {
        const filtroCat = filtroCategoria || categoriaId;
        const filtroMar = filtroMarca || marcaId;
        const res = await listarProdutos({
          limit: 100,
          categoriaId: filtroCat || undefined,
          marcaId: filtroMar || undefined,
          busca: busca.trim() || undefined,
        });
        setProdutos(res.produtos || []);
      } catch {
        setProdutos([]);
      } finally {
        setLoading(false);
      }
    }
    carregar();
  }, [filtroCategoria, filtroMarca, busca, categoriaId, marcaId]);

  return (
    <div className="container-site py-8">
      <h1 className="section-title mb-6">Coleção</h1>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => { setFiltroCategoria(null); setFiltroMarca(null); }}
          className={`px-4 py-2 rounded-full text-xs font-semibold transition-colors ${
            !filtroCategoria && !filtroMarca ? 'bg-luxury-black text-white' : 'bg-ice text-gray-600 hover:bg-ice-dark'
          }`}
        >
          Todos
        </button>
        {categorias.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setFiltroCategoria(filtroCategoria === cat.id ? null : cat.id)}
            className={`px-4 py-2 rounded-full text-xs font-semibold transition-colors ${
              filtroCategoria === cat.id ? 'bg-luxury-black text-white' : 'bg-ice text-gray-600 hover:bg-ice-dark'
            }`}
          >
            {cat.nome}
          </button>
        ))}
        {marcas.map((marca) => (
          <button
            key={marca.id}
            onClick={() => setFiltroMarca(filtroMarca === marca.id ? null : marca.id)}
            className={`px-4 py-2 rounded-full text-xs font-semibold transition-colors ${
              filtroMarca === marca.id ? 'bg-gold text-luxury-black' : 'bg-ice text-gray-600 hover:bg-ice-dark'
            }`}
          >
            {marca.nome}
          </button>
        ))}
      </div>

      {/* Busca */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Buscar produtos..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="w-full max-w-md h-11 px-4 rounded-xl border border-ice-dark text-sm focus:outline-none focus:border-gold"
        />
      </div>

      {/* Grid de produtos */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
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
      ) : produtos.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {produtos.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500">Nenhum produto encontrado.</p>
        </div>
      )}
    </div>
  );
}
