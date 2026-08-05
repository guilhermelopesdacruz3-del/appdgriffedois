import { useEffect, useState } from "react";
import { listarCategorias, listarMarcas, type FiltroCatalogo } from "../services/lojaIntegrada";

interface UseFiltrosCatalogoResult {
  categorias: FiltroCatalogo[];
  marcas: FiltroCatalogo[];
  loading: boolean;
}

/** Carrega as categorias e marcas reais da loja (para os chips de filtro). */
export function useFiltrosCatalogo(): UseFiltrosCatalogoResult {
  const [categorias, setCategorias] = useState<FiltroCatalogo[]>([]);
  const [marcas, setMarcas] = useState<FiltroCatalogo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;
    Promise.all([listarCategorias(), listarMarcas()])
      .then(([cats, marcas]) => {
        if (cancelado) return;
        setCategorias(cats);
        setMarcas(marcas);
      })
      .catch(() => { /* mantém vazio */ })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  return { categorias, marcas, loading };
}
