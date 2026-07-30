export type TipoProdutoCheckout =
  | "oculos_sol_sem_grau"
  | "oculos_sol_com_grau"
  | "armacao_sem_grau"
  | "armacao_com_grau";

export type ModoUso = "longe" | "perto" | "ambos";

export interface ReceitaOftalmica {
  tem_grau_longe: boolean;
  tem_grau_perto: boolean;
  esf_od?: number | null;
  cil_od?: number | null;
  adicao?: number | null;
  observacoes?: string;
}

export type TipoLente =
  | "visao_simples_longe"
  | "visao_simples_perto"
  | "multifocal"
  | "ocupacional"
  | "bifocal";

export interface SelecaoLente {
  tipo: TipoLente;
  label: string;
}

export interface SelecaoCheckout {
  tipoProduto: TipoProdutoCheckout;
  receita?: ReceitaOftalmica;
  lente?: SelecaoLente;
}
