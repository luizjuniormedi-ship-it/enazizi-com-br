/**
 * Enaflix — Categorias do hub visual (estilo Netflix).
 * Cada categoria é uma "fileira" no catálogo.
 * A ordem aqui define a ordem de renderização.
 */
export type EnaflixCategoryId =
  | "continue"
  | "popular"
  | "recommended"
  | "avaliacao"
  | "treino"
  | "clinica"
  | "conteudo"
  | "progresso"
  | "gamificacao"
  | "ferramentas"
  | "professor"
  | "admin";

export interface EnaflixCategory {
  id: EnaflixCategoryId;
  title: string;
  subtitle?: string;
  /** Apenas exibe se houver pelo menos N módulos */
  minItems?: number;
  /** Restringe a categoria por role */
  requires?: "admin" | "professor";
  /** Categorias dinâmicas são alimentadas por uso/IA, não pelo campo `category` do módulo */
  dynamic?: boolean;
}

export const ENAFLIX_CATEGORIES: EnaflixCategory[] = [
  { id: "continue", title: "Continuar de onde parou", subtitle: "Retome sua jornada", dynamic: true, minItems: 1 },
  { id: "popular", title: "Mais usados", subtitle: "Os queridinhos do dia a dia", dynamic: true, minItems: 1 },
  { id: "recommended", title: "Recomendados para você", subtitle: "Sugestões inteligentes", dynamic: true, minItems: 1 },
  { id: "avaliacao", title: "Avaliação", subtitle: "Teste seu nível" },
  { id: "treino", title: "Treino & Revisão", subtitle: "Memória ativa e repetição espaçada" },
  { id: "clinica", title: "Clínica & Simulação", subtitle: "Casos reais e prática" },
  { id: "conteudo", title: "Conteúdo & Estudo", subtitle: "Aprenda com profundidade" },
  { id: "progresso", title: "Progresso & Estratégia", subtitle: "Acompanhe sua evolução" },
  { id: "gamificacao", title: "Gamificação", subtitle: "Conquiste, suba de nível, lidere" },
  { id: "ferramentas", title: "Ferramentas inteligentes", subtitle: "IA pedagógica do ENAZIZI" },
  { id: "professor", title: "Professor", subtitle: "Painel pedagógico", requires: "professor" },
  { id: "admin", title: "Administração", subtitle: "Operações internas", requires: "admin" },
];
