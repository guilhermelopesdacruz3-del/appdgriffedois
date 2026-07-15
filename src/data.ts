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
  colors: string[];
  colorNames: string[];
  has3D: boolean;
  hasTryOn: boolean;
  image: string;
  badge?: string;
  rating: number;
  reviews: number;
  installmentCount: number;
  installmentValue: number;
}

/**
 * Os produtos, clientes e pedidos deste app agora vêm da API da Loja
 * Integrada em tempo real — veja src/services/lojaIntegrada.
 *
 * - Produtos: src/hooks/useProdutos.ts (usado em App.tsx)
 * - Cliente logado: src/hooks/useCliente.ts (usado em ProfilePage.tsx)
 * - Pedidos do cliente: src/hooks/usePedidos.ts (usado em ProfilePage.tsx)
 *
 * O array mockado que existia aqui foi removido. Se o proxy (veja /server)
 * ainda não estiver configurado, as telas mostram um estado vazio/erro em
 * vez de dados fixos — assim você percebe rápido se a integração caiu.
 */

export const categories = [
  { id: 1, name: "Sol", icon: "☀️", count: 24 },
  { id: 2, name: "Grau", icon: "👓", count: 18 },
  { id: 3, name: "Ray-Ban", icon: "🕶️", count: 12 },
  { id: 4, name: "Grazi", icon: "✨", count: 8 },
  { id: 5, name: "Michael Kors", icon: "💎", count: 6 },
  { id: 6, name: "Infantil", icon: "🧒", count: 10 },
];

export const benefits = [
  { id: 1, name: "Desconto 10% primeira compra", points: 500, unlocked: true, icon: "🎁" },
  { id: 2, name: "Frete grátis em todo Brasil", points: 1000, unlocked: true, icon: "🚀" },
  { id: 3, name: "Limpeza premium anual", points: 1500, unlocked: true, icon: "✨" },
  { id: 4, name: "Acesso antecipado lançamentos", points: 2000, unlocked: false, icon: "🔑" },
  { id: 5, name: "Gravação personalizada", points: 3000, unlocked: false, icon: "🏆" },
  { id: 6, name: "Consultoria de estilo VIP", points: 5000, unlocked: false, icon: "👑" },
  { id: 7, name: "Garantia estendida 3 anos", points: 7500, unlocked: false, icon: "🛡️" },
  { id: 8, name: "Clube exclusivo Black Card", points: 10000, unlocked: false, icon: "♠️" },
];

// Pedidos agora vêm da Loja Integrada — veja src/hooks/usePedidos.ts
