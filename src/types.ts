export interface Receita {
  id: string;
  user_id: string;
  email: string;
  tipo: "grau" | "lente";
  descricao: string;
  arquivo_url?: string | null;
  created_at: string;
  // Campos estruturados de receita óptica
  nome?: string | null;
  medico?: string | null;
  data_receita?: string | null;
  esf_od_longe?: number | null;
  cil_od_longe?: number | null;
  eixo_od_longe?: number | null;
  esf_oe_longe?: number | null;
  cil_oe_longe?: number | null;
  eixo_oe_longe?: number | null;
  esf_od_perto?: number | null;
  cil_od_perto?: number | null;
  eixo_od_perto?: number | null;
  esf_oe_perto?: number | null;
  cil_oe_perto?: number | null;
  eixo_oe_perto?: number | null;
  dip?: number | null;
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
