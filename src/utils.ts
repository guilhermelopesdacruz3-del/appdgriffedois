export const productImages: Record<string, string> = {
  "sunglasses-gold-aviator": "/images/product-gold-aviator.jpg",
  "sunglasses-black-wayfarer": "/images/product-black-wayfarer.jpg",
  "product-cateye": "/images/product-cateye.jpg",
  "product-round": "/images/product-round.jpg",
  "mk-aviator": "/images/product-mk-aviator.jpg",
  "grazi-cateye": "/images/product-grazi-cateye.jpg",
  "armani-modern": "/images/product-armani-modern.jpg",
  "vogue-trendy": "/images/product-vogue-trendy.jpg",
};

export function getProductImage(imageKey: string): string {
  return productImages[imageKey] || "/images/product-gold-aviator.jpg";
}

export function formatPrice(price: number): string {
  return price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatInstallment(count: number, value: number): string {
  return `${count}x de ${value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
}

const EMAIL_RE = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;

/** Validação centralizada de e-mail (usada no checkout, fidelidade, perfil). */
export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test((email || "").trim());
}
