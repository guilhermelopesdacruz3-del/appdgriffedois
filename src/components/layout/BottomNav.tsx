interface BottomNavProps {
  activePage: string;
  onNavigate: (page: string) => void;
  dark?: boolean;
}

const navItems = [
  {
    id: "home",
    label: "Início",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? "0" : "1.5"} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        {!active && <polyline points="9 22 9 12 15 12 15 22" />}
      </svg>
    ),
  },
  {
    id: "catalog",
    label: "Catálogo",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? "0" : "1.5"} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    id: "loyalty",
    label: "Clube",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? "0" : "1.5"} strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
  {
    id: "profile",
    label: "Perfil",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? "0" : "1.5"} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
];

export default function BottomNav({ activePage, onNavigate, dark = false }: BottomNavProps) {
  const isDark = dark;
  const containerClass = isDark
    ? "border-white/10 bg-[#050505]/90"
    : "border-ice-dark/50 bg-ice/90";
  const activeText = isDark ? "text-white" : "text-luxury-black";
  const inactiveText = isDark ? "text-gray-400 hover:text-gray-300" : "text-gray-500 hover:text-gray-700";
  const underlineBg = isDark ? "bg-white" : "bg-luxury-black";

  return (
    <nav className={`fixed bottom-0 left-0 right-0 z-50 border-t backdrop-blur ${containerClass}`}>
      <div className="flex items-center justify-around h-16 px-2 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = activePage === item.id;
          const textClass = isActive ? activeText : inactiveText;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1 rounded-xl transition-all duration-200 ${textClass}`}
            >
              <div className={`relative ${isActive ? "scale-110" : ""} transition-transform duration-200`}>
                {item.icon(isActive)}
                {isActive && item.id === "loyalty" && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-gold rounded-full" />
                )}
              </div>
              <span className={`text-[10px] font-medium ${textClass}`}>
                {item.label}
              </span>
              {isActive && (
                <div className={`absolute -bottom-1 w-6 h-0.5 rounded-full ${underlineBg}`} />
              )}
            </button>
          );
        })}
      </div>
      {/* Safe area for phones with home indicator */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
