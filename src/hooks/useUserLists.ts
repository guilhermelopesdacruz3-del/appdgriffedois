import { useCallback, useEffect, useState } from "react";

// Hook genérico para persistir uma lista de IDs no localStorage.
// Usado por favoritos e "vistos recentemente".
function useIdList(key: string, max = 50) {
  const [ids, setIds] = useState<number[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as number[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(ids.slice(0, max)));
    } catch {
      /* ignora quota/privado */
    }
  }, [key, ids, max]);

  return [ids, setIds] as const;
}

export function useFavorites() {
  const [ids, setIds] = useIdList("dgriffe:favoritos", 100);

  const isFavorite = useCallback((id: number) => ids.includes(id), [ids]);

  const toggleFavorite = useCallback((id: number) => {
    setIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev]));
  }, [setIds]);

  return { favoriteIds: ids, isFavorite, toggleFavorite };
}

export function useRecentlyViewed() {
  const [ids, setIds] = useIdList("dgriffe:recentes", 12);

  const registerView = useCallback((id: number) => {
    setIds((prev) => [id, ...prev.filter((x) => x !== id)].slice(0, 12));
  }, [setIds]);

  return { recentIds: ids, registerView };
}
