import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Search, User, Heart, ShoppingBag, ChevronDown } from 'lucide-react';

const CATEGORIAS_MENU = [
  { to: '/catalogo?categorias=6299649', label: 'Óculos de Grau', icon: '👓' },
  { to: '/catalogo?categorias=6299628', label: 'Óculos de Sol', icon: '🕶️' },
  { to: '/catalogo?categorias=16815340', label: 'Lentes de Contato', icon: '👁️' },
  { to: '/catalogo?categorias=6299573', label: 'Ray-Ban', icon: '✨' },
  { to: '/catalogo?categorias=6299570', label: 'Michael Kors', icon: '✨' },
  { to: '/catalogo?categorias=6299575', label: 'Vogue', icon: '✨' },
];

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [buscaOpen, setBuscaOpen] = useState(false);
  const [buscaTexto, setBuscaTexto] = useState('');
  const [categoriasOpen, setCategoriasOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const buscaRef = useRef<HTMLDivElement>(null);

  const navLinks = [
    { to: '/', label: 'Início' },
    { to: '/catalogo', label: 'Coleção' },
    { to: '/medicao', label: 'Medição' },
    { to: '/historia', label: 'Nossa História' },
  ];

  const isActive = (path: string) => location.pathname === path;

  // Fechar busca ao clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (buscaRef.current && !buscaRef.current.contains(e.target as Node)) {
        setBuscaOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleBuscaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (buscaTexto.trim()) {
      navigate(`/catalogo?busca=${encodeURIComponent(buscaTexto.trim())}`);
      setBuscaOpen(false);
    }
  };

  return (
    <>
      {/* Top Bar - Vantagens */}
      <div className="bg-luxury-black text-white py-2 overflow-hidden">
        <div className="flex animate-marquee gap-16 text-[11px] font-medium tracking-wide whitespace-nowrap">
          {[
            '🚚 Entrega rápida para todo Brasil',
            '💰 5% OFF no Pix',
            '🔄 Troca grátis em até 30 dias',
            '🛡️ Produtos 100% originais',
            '📦 Frete grátis acima de R$ 299',
            '✨ Novidades toda semana',
          ].map((text, i) => (
            <span key={i} className="flex items-center gap-2 opacity-80 hover:opacity-100 transition-opacity">
              {text}
            </span>
          ))}
        </div>
      </div>

      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-ice-dark">
        <div className="container-site">
          <div className="flex items-center justify-between h-16 md:h-18">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5">
              <img
                src="/logo-dgriffe.png"
                alt="Ótica D'Griffe Wonders"
                className="w-9 h-9 md:w-10 md:h-10 rounded-full object-cover shadow-lg shadow-luxury-black/20"
              />
              <div className="hidden sm:block">
                <p className="text-[10px] text-gold font-semibold uppercase tracking-widest leading-none">Ótica</p>
                <p className="text-sm font-bold text-luxury-black leading-tight">D&apos;Griffe Wonders</p>
              </div>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`px-4 py-2.5 text-sm font-medium rounded-xl transition-all ${
                    isActive(link.to)
                      ? 'text-gold bg-gold/5'
                      : 'text-gray-600 hover:text-luxury-black hover:bg-ice'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              
              {/* Dropdown Categorias */}
              <div className="relative">
                <button
                  onClick={() => setCategoriasOpen(!categoriasOpen)}
                  className={`flex items-center gap-1 px-4 py-2.5 text-sm font-medium rounded-xl transition-all ${
                    categoriasOpen ? 'text-gold bg-gold/5' : 'text-gray-600 hover:text-luxury-black hover:bg-ice'
                  }`}
                >
                  Categorias
                  <ChevronDown size={14} className={`transition-transform ${categoriasOpen ? 'rotate-180' : ''}`} />
                </button>
                {categoriasOpen && (
                  <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-2xl shadow-xl border border-ice-dark py-2 z-50">
                    {CATEGORIAS_MENU.map((cat) => (
                      <Link
                        key={cat.label}
                        to={cat.to}
                        onClick={() => setCategoriasOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 hover:text-luxury-black hover:bg-ice transition-colors"
                      >
                        <span className="text-base">{cat.icon}</span>
                        {cat.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-1.5">
              {/* Busca Desktop */}
              <div ref={buscaRef} className="relative hidden md:block">
                <button
                  onClick={() => setBuscaOpen(!buscaOpen)}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-gray-500 hover:bg-ice hover:text-luxury-black transition-all"
                >
                  <Search size={18} />
                </button>
                {buscaOpen && (
                  <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-ice-dark p-4 z-50">
                    <form onSubmit={handleBuscaSubmit} className="relative">
                      <input
                        type="text"
                        value={buscaTexto}
                        onChange={(e) => setBuscaTexto(e.target.value)}
                        placeholder="Buscar óculos, marcas..."
                        autoFocus
                        className="w-full h-10 pl-10 pr-4 rounded-xl border border-ice-dark text-sm focus:outline-none focus:border-gold"
                      />
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    </form>
                    <div className="mt-3 space-y-1 max-h-64 overflow-y-auto">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider px-2 py-1">Sugestões</p>
                      {['Ray-Ban', 'Vogue', 'Óculos de Sol', 'Lentes de Contato'].map((sug) => (
                        <button
                          key={sug}
                          onClick={() => { setBuscaTexto(sug); navigate(`/catalogo?busca=${encodeURIComponent(sug)}`); setBuscaOpen(false); }}
                          className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-ice rounded-lg transition-colors"
                        >
                          {sug}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Favoritos */}
              <button className="hidden sm:flex w-10 h-10 rounded-full items-center justify-center text-gray-500 hover:bg-ice hover:text-red-500 transition-all">
                <Heart size={18} />
              </button>

              {/* Carrinho */}
              <Link
                to="/cart"
                className="relative w-10 h-10 rounded-full flex items-center justify-center text-gray-500 hover:bg-ice hover:text-luxury-black transition-all"
              >
                <ShoppingBag size={18} />
                <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-gold text-luxury-black text-[9px] font-bold rounded-full flex items-center justify-center">
                  0
                </span>
              </Link>

              {/* Conta */}
              <Link
                to="/login"
                className="hidden sm:flex w-10 h-10 rounded-full items-center justify-center text-gray-500 hover:bg-ice hover:text-luxury-black transition-all"
              >
                <User size={18} />
              </Link>

              {/* Entrar (desktop) */}
              <Link
                to="/login"
                className="hidden md:flex ml-1 px-4 py-2.5 text-sm font-semibold rounded-xl bg-luxury-black text-white hover:bg-luxury-dark transition-all"
              >
                Entrar
              </Link>

              {/* Mobile menu button */}
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="md:hidden w-10 h-10 rounded-full flex items-center justify-center text-gray-600 hover:bg-ice transition-colors"
              >
                {menuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="md:hidden bg-white border-t border-ice-dark">
            <div className="container-site py-3 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMenuOpen(false)}
                  className={`block px-4 py-3 text-sm font-medium rounded-xl transition-colors ${
                    isActive(link.to)
                      ? 'text-gold bg-gold/5'
                      : 'text-gray-600 hover:bg-ice'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                to="/catalogo"
                onClick={() => setMenuOpen(false)}
                className="block px-4 py-3 text-sm font-semibold text-gold bg-gold/5 rounded-xl"
              >
                Todas as Categorias
              </Link>
              <Link
                to="/login"
                onClick={() => setMenuOpen(false)}
                className="block px-4 py-3 text-sm font-medium text-gray-600 hover:bg-ice rounded-xl"
              >
                Minha Conta
              </Link>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
