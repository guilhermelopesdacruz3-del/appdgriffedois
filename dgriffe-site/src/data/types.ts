export interface Product {
  id: number;
  name: string;
  brand: string;
  code: string;
  price: number;
  originalPrice?: number;
  pixPrice: number;
  description: string;
  category: string;
  catIds?: number[];
  colors: string[];
  colorNames: string[];
  image: string;
  imagens?: string[];
  badge?: string;
  rating: number;
  reviews: number;
  installmentCount: number;
  installmentValue: number;
  variacoes?: string[];
  tamanhos?: string[];
}

export interface Afiliado {
  id: string;
  email: string;
  nome: string;
  telefone: string;
  criadoEm: string;
  totalVendas: number;
  totalComissao: number;
  ativo: boolean;
}

export interface AfiliadoVenda {
  id: string;
  afiliadoEmail: string;
  produtoNome: string;
  valor: number;
  comissao: number;
  status: 'pendente' | 'paga' | 'cancelada';
  criadoEm: string;
}

export interface AdminStats {
  totalAfiliados: number;
  totalVendas: number;
  totalComissao: number;
  afiliadosAtivos: number;
}
