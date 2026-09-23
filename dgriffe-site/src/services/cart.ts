const CART_KEY = 'dgriffe:cart_id';

export interface CartItem {
  productId: number;
  productName: string;
  productImage?: string;
  price: number;
  quantidade: number;
  variacao?: string;
  frameOnly?: boolean;
  cpf?: string;
  dnp?: { oe: string; od: string } | null;
  recipeFile?: string;
  cartId: string;
  addedAt: number;
}

function getCartId(): string {
  let id = localStorage.getItem(CART_KEY);
  if (!id) {
    id = 'cart_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    localStorage.setItem(CART_KEY, id);
  }
  return id;
}

export function getCart(): CartItem[] {
  const id = getCartId();
  const data = localStorage.getItem(`dgriffe:cart_${id}`);
  return data ? JSON.parse(data) : [];
}

export function addToCart(item: Omit<CartItem, 'cartId' | 'addedAt'>): CartItem[] {
  const cartId = getCartId();
  const cart = getCart();
  const existing = cart.find((i) => i.productId === item.productId && i.variacao === item.variacao);
  if (existing) {
    existing.quantidade += item.quantidade;
  } else {
    cart.push({ ...item, cartId, addedAt: Date.now() });
  }
  localStorage.setItem(`dgriffe:cart_${cartId}`, JSON.stringify(cart));
  return cart;
}

export function removeFromCart(productId: number, variacao?: string): CartItem[] {
  const cartId = getCartId();
  let cart = getCart();
  cart = cart.filter((i) => !(i.productId === productId && (variacao === undefined || i.variacao === variacao)));
  localStorage.setItem(`dgriffe:cart_${cartId}`, JSON.stringify(cart));
  return cart;
}

export function updateCartItem(productId: number, quantidade: number, variacao?: string): CartItem[] {
  const cartId = getCartId();
  let cart = getCart();
  const idx = cart.findIndex((i) => i.productId === productId && (variacao === undefined || i.variacao === variacao));
  if (idx >= 0) {
    if (quantidade <= 0) {
      cart.splice(idx, 1);
    } else {
      cart[idx].quantidade = quantidade;
    }
    localStorage.setItem(`dgriffe:cart_${cartId}`, JSON.stringify(cart));
  }
  return cart;
}

export function clearCart(): void {
  const cartId = getCartId();
  localStorage.removeItem(`dgriffe:cart_${cartId}`);
}
