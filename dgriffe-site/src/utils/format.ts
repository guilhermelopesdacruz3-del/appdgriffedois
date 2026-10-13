export function formatPrice(value: number): string {
  if (!value || value <= 0) return 'R$ 0,00';
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function formatInstallment(count: number, value: number): string {
  if (!count || count <= 0) return '';
  return `${count}x de ${formatPrice(value)}`;
}

export function getProductImage(image: string): string {
  if (!image) return '/images/product-placeholder.jpg';
  if (image.startsWith('http')) return image;
  return image;
}
