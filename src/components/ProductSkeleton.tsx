// Placeholder de carregamento (skeleton) para os cards de produto.
// Reduz a sensação de espera vs. um spinner solto.

export function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm animate-pulse">
      <div className="aspect-[4/3] bg-ice-dark/40" />
      <div className="p-2.5 pb-2 space-y-2">
        <div className="h-2 w-12 bg-ice-dark/40 rounded" />
        <div className="h-3 w-3/4 bg-ice-dark/40 rounded" />
        <div className="h-3 w-1/2 bg-ice-dark/40 rounded" />
        <div className="h-8 w-full bg-ice-dark/30 rounded-lg mt-2" />
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 px-4">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
