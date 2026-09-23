import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { listarProdutos, listarCategorias } from '../services/api';
import type { Product } from '../data/types';
import ProductCard from '../components/features/ProductCard';

export default function HomePage() {
  const [produtos, setProdutos] = useState<Product[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function carregar() {
      try {
        const [prod, cats] = await Promise.all([
          listarProdutos({ limit: 100 }),
          listarCategorias().catch(() => []),
        ]);
        setProdutos(prod.produtos || []);
        setCategorias(cats || []);
      } catch (e: any) {
        setError(e.message);
      }
    }
    carregar();
  }, []);

  const destaques = produtos.filter((p) => p.badge === 'Destaque').slice(0, 6);
  const sol = produtos.filter((p) => p.category === 'Sol').slice(0, 4);
  const grau = produtos.filter((p) => p.category === 'Grau').slice(0, 4);

  return (
    <div>
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-luxury-black via-luxury-dark to-luxury-black overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-10 left-10 w-64 h-64 bg-gold rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-gold rounded-full blur-3xl" />
        </div>
        <div className="container-site relative py-20 md:py-32">
          <div className="max-w-2xl">
            <p className="text-gold font-semibold uppercase tracking-widest text-sm mb-4 animate-fade-in">
              Ótica D'Griffe
            </p>
            <h1 className="font-display text-4xl md:text-6xl font-bold text-white leading-tight mb-6 animate-slide-up">
              Óculos Originais
              <span className="text-gold"> Ray-Ban, Michael Kors</span>
              <br /> Vogue e mais
            </h1>
            <p className="text-lg text-gray-300 mb-8 animate-slide-up">
              Até 5x sem juros ou desconto no Pix. Qualidade e estilo para você.
            </p>
            <div className="flex flex-wrap gap-4 animate-slide-up">
              <Link to="/catalogo" className="btn-gold">
                Ver Coleção
              </Link>
              <Link to="/medicao" className="btn-primary border border-gold/30 bg-transparent text-gold hover:bg-gold/10">
                Medição de Lentes
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Categorias */}
      <section className="py-12 bg-white">
        <div className="container-site">
          <h2 className="section-title text-center mb-8">Categorias</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {categorias.length > 0 ? (
              categorias.map((cat) => (
                <Link
                  key={cat.id}
                  to={`/catalogo?categoria=${cat.id}`}
                  className="card p-4 text-center group hover:-translate-y-1 transition-transform"
                >
                  <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-ice flex items-center justify-center">
                    <span className="text-gold font-bold text-lg">{cat.nome.charAt(0)}</span>
                  </div>
                  <p className="text-sm font-medium text-luxury-black group-hover:text-gold transition-colors">
                    {cat.nome}
                  </p>
                </Link>
              ))
            ) : (
              ['Sol', 'Grau', 'Ray-Ban', 'Grazi', 'Michael Kors', 'Infantil'].map((cat) => (
                <Link
                  key={cat}
                  to="/catalogo"
                  className="card p-4 text-center group hover:-translate-y-1 transition-transform"
                >
                  <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-ice flex items-center justify-center">
                    <span className="text-gold font-bold text-lg">{cat.charAt(0)}</span>
                  </div>
                  <p className="text-sm font-medium text-luxury-black group-hover:text-gold transition-colors">
                    {cat}
                  </p>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Destaques */}
      {destaques.length > 0 && (
        <section className="py-12 bg-ice">
          <div className="container-site">
            <div className="flex items-center justify-between mb-8">
              <h2 className="section-title">Destaques</h2>
              <Link to="/catalogo" className="text-sm font-semibold text-gold hover:underline">
                Ver mais →
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {destaques.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Óculos de Sol */}
      {sol.length > 0 && (
        <section className="py-12 bg-white">
          <div className="container-site">
            <div className="flex items-center justify-between mb-8">
              <h2 className="section-title">Óculos de Sol ☀️</h2>
              <Link to="/catalogo?categoria=sol" className="text-sm font-semibold text-gold hover:underline">
                Ver mais →
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {sol.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Óculos de Grau */}
      {grau.length > 0 && (
        <section className="py-12 bg-ice">
          <div className="container-site">
            <div className="flex items-center justify-between mb-8">
              <h2 className="section-title">Óculos de Grau 👓</h2>
              <Link to="/catalogo?categoria=grau" className="text-sm font-semibold text-gold hover:underline">
                Ver mais →
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {grau.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Error state */}
      {error && (
        <section className="py-12 bg-ice">
          <div className="container-site text-center">
            <p className="text-red-500 text-sm">{error}</p>
            <p className="text-gray-500 text-xs mt-2">Usando dados de demonstração...</p>
          </div>
        </section>
      )}
    </div>
  );
}
