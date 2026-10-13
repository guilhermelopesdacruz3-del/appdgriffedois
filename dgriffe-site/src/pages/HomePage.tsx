import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { listarProdutos, listarCategorias } from '../services/api';
import type { Product } from '../data/types';
import ProductCard from '../components/features/ProductCard';
import CategoryIcon from '../components/features/CategoryIcon';
import { getCategoriaNome } from '../data/categoriasMap';

const BENEFITS = [
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
    title: '100% Originais',
    desc: 'Garantia das melhores grifes',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    ),
    title: 'Troca Sem Complicação',
    desc: 'Até 30 dias para trocar',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="3" width="15" height="13" rx="1"/>
        <path d="M16 8h4l3 3v5h-7V8z"/>
        <circle cx="5.5" cy="18.5" r="2.5"/>
        <circle cx="18.5" cy="18.5" r="2.5"/>
      </svg>
    ),
    title: 'Envio Rápido',
    desc: 'Para todo o Brasil',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    ),
    title: 'Laboratório Digital',
    desc: 'Lentes sob medida com precisão',
  },
];

const BRANDS = [
  { name: 'Ray-Ban', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Ray-Ban_logo.svg/200px-Ray-Ban_logo.svg.png' },
  { name: 'Michael Kors', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Michael_Kors_logo.svg/200px-Michael_Kors_logo.svg.png' },
  { name: 'Vogue', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Vogue_Eyewear_logo.svg/200px-Vogue_Eyewear_logo.svg.png' },
  { name: 'Oakley', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Oakley_logo.svg/200px-Oakley_logo.svg.png' },
  { name: 'Prada', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Prada_logo.svg/200px-Prada_logo.svg.png' },
];

export default function HomePage() {
  const [produtos, setProdutos] = useState<Product[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [imagens, setImagens] = useState<any[]>([]);
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

  useEffect(() => {
    fetch('/api/site/imagens').then(r => r.json()).then(d => setImagens(d.imagens || [])).catch(() => {});
  }, []);

  const destaques = produtos.filter((p) => p.badge === 'Destaque').slice(0, 6);
  const ofertas = produtos.filter((p) => p.originalPrice && p.originalPrice > p.price).slice(0, 4);

  return (
    <div>
      {/* 1. Announcement Bar */}
      <div className="bg-neutral-900 text-white py-2.5 px-4 text-center">
        <p className="text-[11px] font-medium tracking-wide uppercase">
          Frete grátis acima de R$ 299 · 5% OFF no Pix · Até 5x sem juros
        </p>
      </div>

      {/* 2. Hero Banner — altura mínima fixa (full-bleed estilo Ray-Ban) */}
      <section className="relative overflow-hidden min-h-[70vh] md:min-h-[85vh] flex items-center">
        <div className="absolute inset-0">
          <img
            src={imagens.find((i: any) => i.tipo === 'hero')?.url || 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=1920&q=80'}
            alt="Óculos D'Griffe Wonders"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-transparent" />
        </div>
        <div className="container-site relative py-16 w-full">
          <div className="max-w-xl">
            <h1 className="font-sans text-4xl md:text-6xl font-bold text-white leading-[1.05] mb-5 tracking-tight">
              Sua visão com<br />estilo absoluto
            </h1>
            <p className="text-base md:text-lg text-white/85 mb-8 max-w-md">
              Óculos originais das melhores grifes. Lentes sob medida com laboratório digital.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/catalogo" className="px-8 py-3.5 bg-white text-neutral-900 text-[12px] font-bold uppercase tracking-widest hover:bg-neutral-200 transition-colors">
                Compre agora
              </Link>
              <Link
                to="/catalogo"
                className="px-8 py-3.5 border border-white/70 text-white text-[12px] font-bold uppercase tracking-widest hover:bg-white/10 transition-colors"
              >
                Ver coleção
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Tiles de Gênero — retrato, altura controlada */}
      <section className="grid grid-cols-1 md:grid-cols-3">
        {[
          { label: 'Para ela', img: 'https://images.unsplash.com/photo-1574258495973-f010dfbb5371?w=960&q=80', to: '/catalogo' },
          { label: 'Para ele', img: 'https://images.unsplash.com/photo-1508296695146-257a814070b4?w=960&q=80', to: '/catalogo' },
          { label: 'Infantil', img: 'https://images.unsplash.com/photo-1591076482161-42ce6da69f67?w=960&q=80', to: '/catalogo' },
        ].map((g) => (
          <Link key={g.label} to={g.to} className="relative group overflow-hidden h-64 md:h-80 lg:h-96">
            <img src={g.img} alt={g.label} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <div className="absolute bottom-6 left-6">
              <p className="text-white font-bold text-2xl uppercase tracking-wide">{g.label}</p>
              <span className="inline-block mt-2 text-white text-[11px] font-semibold uppercase tracking-widest border-b border-white/60 pb-0.5 group-hover:border-white">Comprar</span>
            </div>
          </Link>
        ))}
      </section>

      {/* 4. Régua de Benefícios */}
      <section className="py-8 bg-white border-b border-neutral-100">
        <div className="container-site">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {BENEFITS.map((b, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="text-neutral-900 flex-shrink-0">{b.icon}</div>
                <div>
                  <p className="text-[11px] font-bold text-neutral-900 uppercase tracking-wider">{b.title}</p>
                  <p className="text-[11px] text-neutral-500 mt-0.5">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Categorias em Destaque */}
      <section className="py-14 bg-white">
        <div className="container-site">
          <div className="text-center mb-10">
            <h2 className="rb-section-title">Categorias</h2>
            <p className="text-sm text-neutral-500 mt-2">Encontre o óculos perfeito para você</p>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {categorias.length > 0 ? (
              categorias.map((cat) => (
                <Link
                  key={cat.id}
                  to={`/catalogo?categoria=${cat.id}`}
                  className="rb-card-img py-6 text-center group transition-colors hover:bg-neutral-200"
                >
                  <div className="w-14 h-14 mx-auto mb-3 flex items-center justify-center text-neutral-700 group-hover:text-neutral-900">
                    <CategoryIcon categoryName={getCategoriaNome(cat.id)} />
                  </div>
                  <p className="text-[11px] font-semibold text-neutral-900 uppercase tracking-wider">
                    {getCategoriaNome(cat.id)}
                  </p>
                </Link>
              ))
            ) : (
              ['Sol', 'Grau', 'Ray-Ban', 'Grazi', 'Michael Kors', 'Infantil'].map((cat) => (
                <Link key={cat} to="/catalogo" className="rb-card-img py-6 text-center group transition-colors hover:bg-neutral-200">
                  <div className="w-14 h-14 mx-auto mb-3 flex items-center justify-center text-neutral-700 group-hover:text-neutral-900">
                    <CategoryIcon categoryName={cat} />
                  </div>
                  <p className="text-[11px] font-semibold text-neutral-900 uppercase tracking-wider">{cat}</p>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>

      {/* 6. Vitrines de Produtos */}
      {/* Destaques */}
      {destaques.length > 0 && (
        <section className="py-14 bg-white">
          <div className="container-site">
            <div className="flex items-center justify-between mb-8 border-b border-neutral-200 pb-4">
              <div>
                <h2 className="rb-section-title">Destaques</h2>
                <p className="text-xs text-neutral-500 mt-1">Os favoritos da coleção</p>
              </div>
              <Link to="/catalogo" className="text-[11px] font-bold uppercase tracking-widest text-neutral-900 hover:underline">
                Ver todos
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

      {/* Mais Vendidos */}
      <section className="py-14 bg-white">
        <div className="container-site">
          <div className="flex items-center justify-between mb-8 border-b border-neutral-200 pb-4">
            <div>
              <h2 className="rb-section-title">Triunfe nesta estação</h2>
              <p className="text-xs text-neutral-500 mt-1">Os modelos mais amados</p>
            </div>
            <Link to="/catalogo" className="text-[11px] font-bold uppercase tracking-widest text-neutral-900 hover:underline">
              Ver todos
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {produtos.slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </section>

      {/* Ofertas */}
      {ofertas.length > 0 && (
        <section className="py-14 bg-white">
          <div className="container-site">
            <div className="flex items-center justify-between mb-8 border-b border-neutral-200 pb-4">
              <div>
                <h2 className="rb-section-title">Ofertas</h2>
                <p className="text-xs text-neutral-500 mt-1">Descontos por tempo limitado</p>
              </div>
              <Link to="/catalogo" className="text-[11px] font-bold uppercase tracking-widest text-neutral-900 hover:underline">
                Ver todas
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {ofertas.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 7. Carrossel de Marcas */}
      <section className="py-12 bg-white overflow-hidden border-t border-neutral-100">
        <div className="container-site">
          <div className="text-center mb-8">
            <h2 className="rb-section-title">Nossas marcas</h2>
            <p className="text-sm text-neutral-500 mt-2">Grifes autorizadas e originais</p>
          </div>
        </div>
        <div className="relative">
          <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-white to-transparent z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-white to-transparent z-10" />
          <div className="flex animate-marquee gap-16 items-center py-4">
            {[...BRANDS, ...BRANDS].map((brand, i) => (
              <div
                key={`${brand.name}-${i}`}
                className="w-32 h-14 flex items-center justify-center opacity-40 hover:opacity-90 transition-opacity grayscale hover:grayscale-0 flex-shrink-0"
              >
                <img src={brand.logo} alt={brand.name} className="max-w-full max-h-full object-contain" loading="lazy" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8. Newsletter */}
      <section className="py-16 bg-neutral-100">
        <div className="container-site">
          <div className="max-w-xl mx-auto text-center">
            <h2 className="font-sans text-xl md:text-2xl font-bold text-neutral-900 uppercase tracking-wide mb-3">
              Receba 10% OFF na primeira compra
            </h2>
            <p className="text-sm text-neutral-500 mb-6">
              Cadastre seu e-mail e ganhe um cupom exclusivo. Fique por dentro das novidades e ofertas.
            </p>
            <form onSubmit={(e) => { e.preventDefault(); alert('Cadastro realizado! Você receberá o cupom por e-mail.'); }} className="flex gap-2 max-w-md mx-auto">
              <input
                type="email"
                placeholder="Seu melhor e-mail"
                required
                className="flex-1 h-12 px-4 bg-white border border-neutral-300 text-sm focus:outline-none focus:border-neutral-900"
              />
              <button type="submit" className="h-12 px-6 bg-neutral-900 text-white text-[11px] font-bold uppercase tracking-widest hover:bg-neutral-700 transition-colors whitespace-nowrap">
                Quero 10% OFF
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Error state */}
      {error && (
        <section className="py-8 bg-white">
          <div className="container-site text-center">
            <p className="text-red-500 text-sm">{error}</p>
            <p className="text-neutral-500 text-xs mt-2">Carregando produtos em breve...</p>
          </div>
        </section>
      )}
    </div>
  );
}
