// Fonte única das regras de fidelidade no FRONT (espelho do backend/server/db.ts).
// O backend é a fonte de verdade em produção; aqui usamos para renderizar
// níveis/cashback quando o cliente está logado e o /api/fidelidade responde.
// Mantemos os mesmos valores do plano oficial para não divergir.

export type Nivel = {
  id: "cliente" | "gold" | "platinum" | "diamond";
  nome: string;
  min: number;
  max: number | null;
  cashbackAdicional: number;
  cupomAniversario: number;
  beneficios: string[];
  cor: string;
};

export const NIVEIS: Nivel[] = [
  { id: "cliente", nome: "Cliente D'Griffe", min: 0, max: 4999, cashbackAdicional: 0, cupomAniversario: 0, beneficios: ["Benefício fidelidade", "Cashback base", "Acesso completo ao app"], cor: "#9aa0a6" },
  { id: "gold", nome: "Gold", min: 5000, max: 14999, cashbackAdicional: 2, cupomAniversario: 50, beneficios: ["Cashback base +2%", "Promoções antecipadas", "Cupom aniversário R$50"], cor: "#D4A853" },
  { id: "platinum", nome: "Platinum", min: 15000, max: 29999, cashbackAdicional: 3, cupomAniversario: 100, beneficios: ["Cashback base +3%", "Cupom aniversário R$100", "Atendimento prioritário", "Garantia estendida"], cor: "#4b6cb7" },
  { id: "diamond", nome: "Diamond", min: 30000, max: null, cashbackAdicional: 5, cupomAniversario: 200, beneficios: ["Cashback base +5%", "Cupom aniversário R$200", "Atendimento VIP", "Eventos exclusivos"], cor: "#b06ad6" },
];

export const CASHBACK_BASE: Record<string, number> = {
  grau: 2,
  solar: 2,
  joias: 2,
  relogios: 1,
};

export const BENEFICIO_BASE = { parcelado: 10, pix: 15 };
export const TETO_BENEFICIOS_PERC = 20;

// Indicação (plano oficial)
export const INDICACAO_CREDITO_RS = 50;
export const INDICACAO_PONTOS = 200;
export const INDICACAO_LIMITE_ANUAL = 10;

// Clube Família (plano oficial)
export const FAMILIA_LIMITE_MEMBROS = 5;
export const FAMILIA_PERCENTUAL_PONTOS = 20;
export const CREDITOS_FAMILIA: Record<number, number> = { 5000: 50, 10000: 100, 20000: 200 };

// Missões (plano oficial)
export const MISSOES = [
  { id: "cadastro_completo", descricao: "Completar cadastro", pontos: 100, tipo: "cadastro" as const },
  { id: "primeira_compra", descricao: "Primeira compra", pontos: 500, tipo: "primeira_compra" as const },
  { id: "avaliar_atendimento", descricao: "Avaliar atendimento", pontos: 100, tipo: "avaliacao" as const },
  { id: "indicacao_convertida", descricao: "Indicação convertida em venda", pontos: 200, tipo: "indicacao_convertida" as const },
  { id: "recompra_12m", descricao: "Recompra em até 12 meses", pontos: 400, tipo: "recompra" as const },
];

// Regras de validade (plano oficial)
export const VALIDADE_PONTOS_MESES_SEM_MOV = 24;
export const VALIDADE_PONTOS_MESES_EXPIRACAO = 36;
export const VALIDADE_CASHBACK_MESES_SEM_MOV = 12;
export const VALIDADE_CASHBACK_DIAS_ADICIONAIS = 180;

// Mensagens automáticas
export function msgCashbackDisponivel(valor: number): string {
  return `Você possui R$ ${valor.toFixed(2).replace(".", ",")} de cashback disponível.`;
}
export function msgPtsParaNivel(_pontos: number, proxNome: string, ptsParaProx: number): string {
  return `Faltam apenas ${ptsParaProx.toLocaleString("pt-BR")} pontos para atingir o nível ${proxNome}.`;
}
export function msgCashbackReducaoPrazo(): string {
  return "Seu cashback será reduzido em 30 dias por falta de movimentação.";
}
export function msgParabensNivel(nome: string): string {
  return `Parabéns! Você atingiu o nível ${nome}.`;
}
export function msgEconomiaTotal(valor: number): string {
  return `Você economizou R$ ${valor.toFixed(2).replace(".", ",")} através dos benefícios D'Griffe.`;
}
export function msgCreditosFamiliaDisponiveis(valor: number): string {
  return `Sua família possui R$ ${valor.toFixed(2).replace(".", ",")} em Créditos Família disponíveis.`;
}

export function calcularNivel(pontos: number): { nivel: Nivel; indice: number; prox: Nivel | null; ptsParaProx: number; progresso: number } {
  const p = Math.max(0, Math.floor(pontos));
  let indice = 0;
  for (let i = 0; i < NIVEIS.length; i++) if (p >= NIVEIS[i].min) indice = i;
  const nivel = NIVEIS[indice];
  const prox = indice < NIVEIS.length - 1 ? NIVEIS[indice + 1] : null;
  const ptsParaProx = prox ? Math.max(0, prox.min - p) : 0;
  const base = nivel.min;
  const topo = prox ? prox.min : nivel.min + 5000;
  const progresso = prox ? Math.min(100, ((p - base) / (topo - base)) * 100) : 100;
  return { nivel, indice, prox, ptsParaProx, progresso };
}
