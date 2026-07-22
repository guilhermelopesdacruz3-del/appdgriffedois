// Catálogo de DEMONSTRAÇÃO (temporário).
// Usado só quando a Loja Integrada não devolve produtos (ex.: chaves LI ausentes).
// Some automaticamente quando as chaves LI forem configuradas e o catálogo real carregar.
// Imagens de demonstração (Unsplash) — apenas p/ visualizar o fluxo.
import type { Product } from "./data";

function mk(p: Partial<Product> & Pick<Product, "id" | "name" | "brand" | "price" | "pixPrice" | "category" | "image">): Product {
  return {
    code: `DEMO-${p.id}`,
    originalPrice: undefined,
    description: "Produto de demonstração — aparece só até configurar as chaves da Loja Integrada.",
    colors: ["Preto", "Tartaruga"],
    colorNames: ["Preto", "Tartaruga"],
    has3D: false,
    hasTryOn: false,
    badge: "Demo",
    rating: 4.8,
    reviews: 120,
    installmentCount: 6,
    installmentValue: Math.round(p.price / 6),
    ...p,
  } as Product;
}

export const demoProducts: Product[] = [
  mk({ id: 9001, name: "Solar Aviador Classic", brand: "Ray-Ban", price: 899, pixPrice: 849, category: "Sol", image: "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=600&q=80", hasTryOn: true }),
  mk({ id: 9002, name: "Grau Round Gold", brand: "D'Griffe", price: 599, pixPrice: 549, category: "Grau", image: "https://images.unsplash.com/photo-1556306535-0f09a937f8b3?w=600&q=80", has3D: true }),
  mk({ id: 9003, name: "Grazi Massafera Glow", brand: "Grazi Massafera", price: 749, pixPrice: 699, category: "Grau", image: "https://images.unsplash.com/photo-1577803645773-f96470509666?w=600&q=80" }),
  mk({ id: 9004, name: "MK Pavé Slim", brand: "Michael Kors", price: 1090, pixPrice: 999, category: "Sol", image: "https://images.unsplash.com/photo-1511499767150-a48a237f74de?w=600&q=80" }),
  mk({ id: 9005, name: "Infantil Kids Blue", brand: "D'Griffe Kids", price: 349, pixPrice: 319, category: "Infantil", image: "https://images.unsplash.com/photo-1591076482161-42ce6da69f67?w=600&q=80" }),
  mk({ id: 9006, name: "Wayfarer Original", brand: "Ray-Ban", price: 950, pixPrice: 899, category: "Sol", image: "https://images.unsplash.com/photo-1473496169904-658ba7c44d8a?w=600&q=80", hasTryOn: true }),
  mk({ id: 9007, name: "Grau Titanium Light", brand: "D'Griffe", price: 689, pixPrice: 639, category: "Grau", image: "https://images.unsplash.com/photo-1574258495973-f010dfbb5371?w=600&q=80" }),
  mk({ id: 9008, name: "Sol Espelhado Rose", brand: "Grazi Massafera", price: 799, pixPrice: 749, category: "Sol", image: "https://images.unsplash.com/photo-1511497764226-ebfa6f18da75?w=600&q=80" }),
];

export const isDemoProduct = (id?: number) => id !== undefined && id >= 9000 && id <= 9999;
