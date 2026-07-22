export interface Receita {
  id: string;
  user_id: string;
  email: string;
  tipo: "grau" | "lente";
  descricao: string;
  arquivo_url?: string | null;
  created_at: string;
}

export interface Favorito {
  id: string;
  user_id: string;
  produto_id: number;
  sku?: string | null;
  nome: string;
  imagem?: string | null;
  preco?: number | null;
  created_at: string;
}
