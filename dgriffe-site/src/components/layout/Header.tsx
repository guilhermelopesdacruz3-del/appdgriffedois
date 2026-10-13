import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Search, User, Heart, ShoppingBag, ChevronDown } from 'lucide-react';

const CATEGORIAS_MENU = [
  { to: '/catalogo?categorias=6299649', label: 'Óculos de Grau' },
  { to: '/catalogo?categorias=6299628', label: 'Óculos de Sol' },
  { to: '/catalogo?categorias=16815340', label: 'Lentes de Contato' },
  { to: '/catalogo?categorias=6299573', label: 'Ray-Ban' },
  { to: '/catalogo?categorias=6299570', label: 'Michael Kors' },
  { to: '/catalogo?categorias=6299575', label: 'Vogue' },
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
      {/* Top Bar - estilo Ray-Ban: preta, limpa, maiúsculas */}
      <div className="bg-neutral-900 text-white py-2 overflow-hidden">
        <div className="flex animate-marquee gap-14 text-[10px] font-medium uppercase tracking-widest whitespace-nowrap">
          {[
            'Frete grátis acima de R$ 299',
            '5% OFF no Pix',
            'Troca grátis em até 30 dias',
            'Produtos 100% originais',
            'Até 5x sem juros',
            'Novidades toda semana',
          ].map((text, i) => (
            <span key={i} className="flex items-center gap-2 opacity-90">{text}</span>
          ))}
        </div>
      </div>

      {/* Header principal — branco, minimalista */}
      <header className="sticky top-0 z-50 bg-white border-b border-neutral-200">
        <div className="container-site">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5">
              <img
                src="/logo-dgriffe.png"
                alt="Ótica D'Griffe Wonders"
                className="w-9 h-9 rounded-full object-cover"
              />
              <div className="hidden sm:block">
                <p className="text-sm font-bold text-neutral-900 uppercase tracking-widest leading-tight">
                  D&apos;Griffe Wonders
                </p>
              </div>
            </Link>

            {/* Desktop Nav — links maiúsculos, hover discreto */}
            <nav className="hidden md:flex items-center gap-7">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`text-[12px] font-semibold uppercase tracking-widest transition-colors ${
                    isActive(link.to)
                      ? 'text-neutral-900 border-b-2 border-neutral-900 pb-0.5'
                      : 'text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  {link.label}
                </Link>
              ))}

              {/* Dropdown Categorias */}
              <div className="relative">
                <button
                  onClick={() => setCategoriasOpen(!categoriasOpen)}
                  className={`flex items-center gap-1 text-[12px] font-semibold uppercase tracking-widest transition-colors ${
                    categoriasOpen ? 'text-neutral-900' : 'text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  Categorias
                  <ChevronDown size={13} className={`transition-transform ${categoriasOpen ? 'rotate-180' : ''}`} />
                </button>
                {categoriasOpen && (
                  <div className="absolute top-full left-0 mt-3 w-56 bg-white border border-neutral-200 shadow-lg py-2 z-50">
                    {CATEGORIAS_MENU.map((cat) => (
                      <Link
                        key={cat.label}
                        to={cat.to}
                        onClick={() => setCategoriasOpen(false)}
                        className="block px-4 py-2.5 text-[12px] text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 uppercase tracking-wider transition-colors"
                      >
                        {cat.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </nav>

            {/* Actions — ícones discretos */}
            <div className="flex items-center gap-1">
              <div ref={buscaRef} className="relative hidden md:block">
                <button
                  onClick={() => setBuscaOpen(!buscaOpen)}
                  className="w-9 h-9 flex items-center justify-center text-neutral-600 hover:text-neutral-900 transition-colors"
                >
                  <Search size={17} />
                </button>
                {buscaOpen && (
                  <div className="absolute top-full right-0 mt-3 w-80 bg-white border border-neutral-200 shadow-lg p-4 z-50">
                    <form onSubmit={handleBuscaSubmit} className="relative">
                      <input
                        type="text"
                        value={buscaTexto}
                        onChange={(e) => setBuscaTexto(e.target.value)}
                        placeholder="Buscar óculos, marcas..."
                        autoFocus
                        className="w-full h-10 pl-9 pr-4 border border-neutral-300 text-sm focus:outline-none focus:border-neutral-900"
                      />
                      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                    </form>
                    <div className="mt-3 space-y-1">
                      <p className="text-[10px] text-neutral-400 uppercase tracking-widest px-1 py-1">Sugestões</p>
                      {['Ray-Ban', 'Vogue', 'Óculos de Sol', 'Lentes de Contato'].map((sug) => (
                        <button
                          key={sug}
                          onClick={() => { setBuscaTexto(sug); navigate(`/catalogo?busca=${encodeURIComponent(sug)}`); setBuscaOpen(false); }}
                          className="w-full text-left px-2 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50 uppercase tracking-wider transition-colors"
                        >
                          {sug}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button className="hidden sm:flex w-9 h-9 items-center justify-center text-neutral-600 hover:text-neutral-900 transition-colors">
                <Heart size={17} />
              </button>

              <Link to="/cart" className="relative w-9 h-9 flex items-center justify-center text-neutral-600 hover:text-neutral-900 transition-colors">
                <ShoppingBag size={17} />
                <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-neutral-900 text-white text-[9px] font-bold flex items-center justify-center rounded-full">
                  0
                </span>
              </Link>

              <Link to="/login" className="hidden sm:flex w-9 h-9 items-center justify-center text-neutral-600 hover:text-neutral-900 transition-colors">
                <User size={17} />
              </Link>

              <Link
                to="/login"
                className="hidden md:flex ml-2 px-5 py-2 text-[11px] font-bold uppercase tracking-widest bg-neutral-900 text-white hover:bg-neutral-700 transition-colors"
              >
                Entrar
              </Link>

              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="md:hidden w-9 h-9 flex items-center justify-center text-neutral-700 transition-colors"
              >
                {menuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="md:hidden bg-white border-t border-neutral-200">
            <div className="container-site py-2">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMenuOpen(false)}
                  className={`block px-2 py-3 text-[12px] font-semibold uppercase tracking-widest transition-colors ${
                    isActive(link.to) ? 'text-neutral-900' : 'text-neutral-600'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <Link to="/catalogo" onClick={() => setMenuOpen(false)} className="block px-2 py-3 text-[12px] font-semibold text-neutral-900 uppercase tracking-widest">
                Todas as Categorias
              </Link>
              <Link to="/login" onClick={() => setMenuOpen(false)} className="block px-2 py-3 text-[12px] font-semibold text-neutral-600 uppercase tracking-widest">
                Minha Conta
              </Link>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
