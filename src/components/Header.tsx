import { useState } from "react";

interface HeaderProps {
  cartCount: number;
  onCartClick: () => void;
  onBack?: () => void;
  title?: string;
  dark?: boolean;
  onSearch?: (query: string) => void;
}

export default function Header({ cartCount, onCartClick, onBack, title, dark = false, onSearch }: HeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    onSearch?.(value);
  };

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 ${dark ? 'bg-luxury-black' : 'glass'} transition-all duration-300`}>
      {/* Main Header Row */}
      <div className="flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-3">
          {onBack ? (
            <button
              onClick={onBack}
              className={`w-9 h-9 flex items-center justify-center rounded-full ${dark ? 'bg-luxury-gray text-white' : 'bg-ice text-luxury-black'}`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <span className="text-gold-gradient text-xl font-bold tracking-tight">D'</span>
              <span className={`text-lg font-bold tracking-[0.25em] ${dark ? 'text-white' : 'text-luxury-black'}`}>
                GRIFFE
              </span>
              <span className={`text-[8px] font-medium tracking-wider ml-1 ${dark ? 'text-gold' : 'text-gold'}`}>
                ÓTICA
              </span>
            </div>
          )}
          {title && (
            <span className={`text-base font-semibold ${dark ? 'text-white' : 'text-luxury-black'}`}>
              {title}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Search Toggle */}
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            className={`w-9 h-9 flex items-center justify-center rounded-full transition-all duration-300 ${
              searchOpen
                ? 'bg-luxury-black text-white'
                : dark
                  ? 'bg-luxury-gray text-white hover:bg-luxury-gray/80'
                  : 'bg-ice text-luxury-black hover:bg-ice-dark'
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </button>

          {/* Cart */}
          <button
            onClick={onCartClick}
            className={`w-9 h-9 flex items-center justify-center rounded-full relative transition-all ${
              dark ? 'bg-luxury-gray text-white' : 'bg-ice text-luxury-black hover:bg-ice-dark'
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 01-8 0" />
            </svg>
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-gold text-luxury-black text-[10px] font-bold rounded-full flex items-center justify-center animate-scale-in">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Expandable Search Bar */}
      <div
        className={`overflow-hidden transition-all duration-400 ease-in-out ${
          searchOpen ? 'max-h-16 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-4 pb-3">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Buscar óculos, marcas, estilos..."
              className="w-full h-10 bg-white rounded-xl px-4 pr-10 text-sm text-luxury-black placeholder-gray-400 border border-ice-dark focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/30 transition-all shadow-sm"
              autoFocus={searchOpen}
            />
            <svg
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </div>
        </div>
      </div>
    </header>
  );
}
