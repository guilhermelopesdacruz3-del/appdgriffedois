import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Search, User } from 'lucide-react';

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  const navLinks = [
    { to: '/', label: 'Início' },
    { to: '/catalogo', label: 'Coleção' },
    { to: '/medicao', label: 'Medição' },
    { to: '/historia', label: 'Nossa História' },
    { to: '/afiliado', label: 'Afiliado' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-ice-dark">
      <div className="container-site">
        <div className="flex items-center justify-between h-18">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-luxury-black rounded-full flex items-center justify-center">
              <span className="text-gold font-display font-bold text-base">D</span>
            </div>
            <div className="hidden sm:block">
              <p className="text-[11px] text-gold font-semibold uppercase tracking-widest">Ótica</p>
              <p className="text-sm font-bold text-luxury-black -mt-0.5">D&apos;Griffe Wonders</p>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-2">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`px-5 py-3 text-sm font-medium rounded-xl transition-colors ${
                  isActive(link.to)
                    ? 'text-gold bg-gold/5'
                    : 'text-gray-600 hover:text-luxury-black hover:bg-ice'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              to="/login"
              className="ml-2 px-5 py-3 text-sm font-semibold rounded-xl bg-luxury-black text-white hover:bg-luxury-dark transition-colors"
            >
              Entrar
            </Link>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button className="w-10 h-10 rounded-full flex items-center justify-center text-gray-500 hover:bg-ice transition-colors">
              <Search size={18} />
            </button>
            <Link
              to="/login"
              className="hidden sm:flex w-10 h-10 rounded-full items-center justify-center text-gray-500 hover:bg-ice transition-colors"
            >
              <User size={18} />
            </Link>
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
        <div className="md:hidden bg-white border-t border-ice-dark animate-slide-down">
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
              to="/admin"
              onClick={() => setMenuOpen(false)}
              className="block px-4 py-3 text-sm font-medium text-gray-600 hover:bg-ice rounded-xl transition-colors"
            >
              Admin
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
