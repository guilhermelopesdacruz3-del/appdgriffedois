// Mapa fixo de categorias conhecidas da D'Griffe
// A LI não retorna nomes úteis nas categorias (só descricao longa), então usamos este mapa
export const CATEGORIAS_FIXAS: Record<number, string> = {
  // Óculos
  6299628: 'Óculos de Sol',
  6299649: 'Óculos de Grau',
  6299650: 'Óculos de Sol',
  6299651: 'Óculos de Grau',
  6299652: 'Óculos de Sol',
  6299653: 'Óculos de Grau',
  6299654: 'Óculos de Sol',
  6299655: 'Óculos de Grau',
  6299656: 'Óculos de Sol',
  6299657: 'Óculos de Grau',
  6299658: 'Óculos de Sol',
  6299659: 'Óculos de Grau',
  6299660: 'Óculos de Sol',
  6299661: 'Óculos de Grau',
  6299662: 'Óculos de Sol',
  6299663: 'Óculos de Grau',
  6299664: 'Óculos de Sol',
  6299665: 'Óculos de Grau',
  // Lentes de Contato
  16815340: 'Lentes de Contato',
  // Joias / Acessórios
  17316211: 'Jóias',
  22523021: 'Prata 925',
  24407646: 'Colares & Brincos',
  24404732: 'Pulseiras',
  24404734: 'Tornozeleiras',
  24435834: 'Anéis',
  // Marcas (categorias de marca)
  6299560: 'Armani Exchange',
  6299564: 'Arnette',
  6299566: 'D\'Griffe',
  6299567: 'Grazi Massafera',
  6299568: 'Jean Monnier',
  6299569: 'Kipling',
  6299570: 'Michael Kors',
  6299571: 'Platini',
  6299572: 'Ralph Lauren',
  6299573: 'Ray-Ban',
  6299574: 'Tecnol',
  6299575: 'Vogue',
  // Outras
  24139766: 'Promoções',
};

// Retorna nome fixo ou gera nome genérico
export function getCategoriaNome(id: number): string {
  return CATEGORIAS_FIXAS[id] || `Categoria ${id}`;
}
