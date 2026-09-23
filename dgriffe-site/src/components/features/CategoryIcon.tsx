interface CategoryIconProps {
  categoryName: string;
}

export default function CategoryIcon({ categoryName }: CategoryIconProps) {
  const name = (categoryName || '').toLowerCase();

  // Óculos de Sol
  if (name.includes('sol') || name.includes('sun') || name.includes('aviator') || name.includes('wayfarer')) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7h18" />
        <circle cx="7" cy="14" r="3" />
        <circle cx="17" cy="14" r="3" />
        <path d="M10 14h4" />
        <path d="M3 7l2-2" />
        <path d="M21 7l-2-2" />
      </svg>
    );
  }

  // Grau / Óculos de grau
  if (name.includes('grau') || name.includes('visão') || name.includes('lente')) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="6" cy="14" r="3" />
        <circle cx="18" cy="14" r="3" />
        <path d="M9 14h6" />
        <path d="M3 10V7a2 2 0 012-2h14a2 2 0 012 2v3" />
      </svg>
    );
  }

  // Ray-Ban
  if (name.includes('ray') || name.includes('ban')) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 8h18" />
        <circle cx="7" cy="14" r="3" />
        <circle cx="17" cy="14" r="3" />
        <path d="M10 14h4" />
        <path d="M3 8l1-3" />
        <path d="M21 8l-1-3" />
      </svg>
    );
  }

  // Vogue
  if (name.includes('vogue')) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 8l4-4 4 4" />
        <path d="M2 8h18" />
        <circle cx="7" cy="14" r="3" />
        <circle cx="17" cy="14" r="3" />
        <path d="M10 14h4" />
        <path d="M18 8l-1-3" />
        <path d="M14 8l1-3" />
      </svg>
    );
  }

  // Michael Kors
  if (name.includes('michael') || name.includes('kors') || name.includes('mk')) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M8 15V9l4 6 4-6v6" />
      </svg>
    );
  }

  // Infantil
  if (name.includes('infantil') || name.includes('criança') || name.includes('kids')) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <circle cx="9" cy="11" r="1" fill="currentColor" />
        <circle cx="15" cy="11" r="1" fill="currentColor" />
        <path d="M8 16s1.5-2 4-2 4 2 4 2" />
      </svg>
    );
  }

  // Joias / Acessórios
  if (name.includes('joia') || name.includes('acessório') || name.includes('prata') || name.includes('ouro')) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l3 6 6 1-4.5 4.5 1 6L12 16l-5.5 3.5 1-6L3 9l6-1z" />
      </svg>
    );
  }

  // Lentes de Contato
  if (name.includes('contato') || name.includes('lente de contato')) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v4" />
        <path d="M12 18v4" />
      </svg>
    );
  }

  // Padrão: óculos genérico
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="14" r="3" />
      <circle cx="18" cy="14" r="3" />
      <path d="M9 14h6" />
      <path d="M3 10V7a2 2 0 012-2h14a2 2 0 012 2v3" />
    </svg>
  );
}
