import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { listarProdutos, listarCategorias } from '../services/api';
import type { Product } from '../data/types';
import ProductCard from '../components/features/ProductCard';
import CategoryIcon from '../components/features/CategoryIcon';

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
  const ofertas = produtos.filter((p) => p.originalPrice && p.originalPrice > p.price).slice(0, 4);

  return (
    <div>
      {/* 1. Announcement Bar */}
      <div className="bg-luxury-black text-white py-2 px-4 text-center">
        <p className="text-xs font-medium tracking-wide">
          <span className="text-gold font-semibold">Frete Grátis</span> acima de R$ 299 •{' '}
          <span className="text-gold font-semibold">5% OFF</span> no Pix •{' '}
          <span className="text-gold font-semibold">Até 5x sem juros</span>
        </p>
      </div>

      {/* 2. Hero Banner */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=1920&q=80"
            alt="Óculos D'Griffe Wonders"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-luxury-black/90 via-luxury-black/70 to-luxury-black/30" />
        </div>
        <div className="container-site relative py-24 md:py-36">
          <div className="max-w-2xl">
            <p className="text-gold font-semibold uppercase tracking-widest text-sm mb-4 animate-fade-in">
              Ótica D'Griffe Wonders
            </p>
            <h1 className="font-display text-4xl md:text-6xl font-bold text-white leading-tight mb-6 animate-slide-up">
              Sua visão com o{' '}
              <span className="text-gold">estilo que você merece</span>
            </h1>
            <p className="text-lg text-gray-200 mb-8 animate-slide-up max-w-lg">
              Óculos originais Ray-Ban, Michael Kors, Vogue e mais. Lentes personalizadas com laboratório digital.
            </p>
            <div className="flex flex-wrap gap-4 animate-slide-up">
              <Link to="/catalogo" className="btn-gold text-base px-8 py-4 shadow-lg shadow-gold/30">
                Ver Coleção
              </Link>
              <Link
                to="/catalogo"
                className="px-8 py-4 rounded-xl border-2 border-white/30 text-white font-semibold hover:bg-white/10 transition-all text-base flex items-center gap-2"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                Monte com sua Lente
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Régua de Benefícios */}
      <section className="py-10 bg-white border-b border-ice-dark">
        <div className="container-site">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {BENEFITS.map((b, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-gold/10 text-gold flex items-center justify-center flex-shrink-0">
                  {b.icon}
                </div>
                <div>
                  <p className="text-sm font-bold text-luxury-black">{b.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Categorias em Destaque */}
      <section className="py-14 bg-ice">
        <div className="container-site">
          <div className="text-center mb-10">
            <h2 className="section-title">Categorias</h2>
            <p className="text-sm text-gray-500 mt-2">Encontre o óculos perfeito para você</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {categorias.length > 0 ? (
              categorias.map((cat) => (
                <Link
                  key={cat.id}
                  to={`/catalogo?categoria=${cat.id}`}
                  className="card p-5 text-center group hover:-translate-y-1 transition-all duration-300"
                >
                  <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-ice flex items-center justify-center group-hover:bg-gold/10 transition-colors">
                    <CategoryIcon categoryName={cat.nome} />
                  </div>
                  <p className="text-sm font-semibold text-luxury-black group-hover:text-gold transition-colors">
                    {cat.nome}
                  </p>
                </Link>
              ))
            ) : (
              ['Sol', 'Grau', 'Ray-Ban', 'Grazi', 'Michael Kors', 'Infantil'].map((cat) => (
                <Link
                  key={cat}
                  to="/catalogo"
                  className="card p-5 text-center group hover:-translate-y-1 transition-all duration-300"
                >
                  <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-ice flex items-center justify-center group-hover:bg-gold/10 transition-colors">
                    <CategoryIcon categoryName={cat} />
                  </div>
                  <p className="text-sm font-semibold text-luxury-black group-hover:text-gold transition-colors">
                    {cat}
                  </p>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>

      {/* 5. Banner "Monte Seu Óculos" */}
      <section className="py-14 bg-luxury-black text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gold rounded-full blur-3xl" />
        </div>
        <div className="container-site relative">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <div>
              <p className="text-gold font-semibold uppercase tracking-widest text-xs mb-3">Ferramenta Exclusiva</p>
              <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
                Monte Seu D'Griffe Wonders
              </h2>
              <p className="text-gray-300 mb-8 leading-relaxed">
                Personalize seu óculos com lentes sob medida. Escolha a armação, anexe sua receita e receba em casa.
              </p>
              <div className="space-y-4 mb-8">
                {[
                  { step: '1', title: 'Escolha a Armação', desc: 'Selecione o modelo que combina com seu estilo' },
                  { step: '2', title: 'Anexe sua Receita', desc: 'Envie a receita médica ou tire uma foto com régua' },
                  { step: '3', title: 'Receba em Casa', desc: 'Lentes produzidas com precisão e envio para todo Brasil' },
                ].map((item) => (
                  <div key={item.step} className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-gold/20 text-gold font-bold flex items-center justify-center flex-shrink-0 text-sm">
                      {item.step}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{item.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link to="/catalogo" className="btn-gold inline-flex items-center gap-2">
                Personalizar Meus Óculos Agora
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </Link>
            </div>
            <div className="hidden md:block">
              <div className="relative">
                <div className="absolute inset-0 bg-gold/20 rounded-3xl blur-2xl" />
                <img
                  src="https://images.unsplash.com/photo-1574258495973-f010dfbb5371?w=800&q=80"
                  alt="Monte seu óculos"
                  className="relative rounded-3xl shadow-2xl w-full object-cover aspect-[4/3]"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Vitrines de Produtos */}
      {/* Destaques */}
      {destaques.length > 0 && (
        <section className="py-14 bg-white">
          <div className="container-site">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="section-title">Destaques</h2>
                <p className="text-sm text-gray-500 mt-1">Os favoritos da coleção</p>
              </div>
              <Link to="/catalogo" className="text-sm font-semibold text-gold hover:underline flex items-center gap-1">
                Ver todos
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
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

      {/* Mais Vendidos (simulado com produtos aleatórios) */}
      <section className="py-14 bg-ice">
        <div className="container-site">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="section-title">Mais Vendidos</h2>
              <p className="text-sm text-gray-500 mt-1">Os queridinhos dos clientes</p>
            </div>
            <Link to="/catalogo" className="text-sm font-semibold text-gold hover:underline flex items-center gap-1">
              Ver todos
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
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
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="section-title">Ofertas Imperdíveis</h2>
                <p className="text-sm text-gray-500 mt-1">Descontos especiais por tempo limitado</p>
              </div>
              <Link to="/catalogo" className="text-sm font-semibold text-gold hover:underline flex items-center gap-1">
                Ver todas
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
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
      <section className="py-12 bg-ice">
        <div className="container-site">
          <div className="text-center mb-8">
            <h2 className="section-title">Nossas Marcas</h2>
            <p className="text-sm text-gray-500 mt-2">Grifes autorizadas e originais</p>
          </div>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-14">
            {BRANDS.map((brand) => (
              <div
                key={brand.name}
                className="w-28 h-16 flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity grayscale hover:grayscale-0"
              >
                <img
                  src={brand.logo}
                  alt={brand.name}
                  className="max-w-full max-h-full object-contain"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8. Newsletter */}
      <section className="py-14 bg-white">
        <div className="container-site">
          <div className="max-w-2xl mx-auto text-center">
            <div className="w-14 h-14 bg-gold/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#D4A017" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2"/>
                <path d="M22 6l-10 7L2 6"/>
              </svg>
            </div>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-luxury-black mb-3">
              Receba 10% OFF na primeira compra
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Cadastre seu e-mail e ganhe um cupom de desconto exclusivo. Fique por dentro das novidades e ofertas.
            </p>
            <form onSubmit={(e) => { e.preventDefault(); alert('Cadastro realizado! Você receberá o cupom por e-mail.'); }} className="flex gap-3 max-w-md mx-auto">
              <input
                type="email"
                placeholder="Seu melhor e-mail"
                required
                className="flex-1 h-12 px-4 rounded-xl border border-ice-dark text-sm focus:outline-none focus:border-gold"
              />
              <button type="submit" className="h-12 px-6 rounded-xl bg-luxury-black text-white text-sm font-semibold hover:bg-luxury-dark transition-colors whitespace-nowrap">
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
            <p className="text-gray-500 text-xs mt-2">Carregando produtos em breve...</p>
          </div>
        </section>
      )}
    </div>
  );
}
