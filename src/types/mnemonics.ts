/**
 * Mnemonic Module — Complete TypeScript contracts.
 * Compatible with generate-mnemonic edge function and DB schema.
 */

// ══════════════════════════════════════════════════
// EDGE FUNCTION INPUT
// ══════════════════════════════════════════════════

export interface MnemonicRequest {
  tema: string;
  termos: string[];
  estilo: string;
  publico: string;
  original_result_id?: string;
  regenerate_image_only?: boolean;
  termos_digitados?: string[];
  termos_enriquecidos?: string[];
  termos_priorizados?: string[];
  subtopicos_relacionados?: string[];
  contexto_clinico?: MnemonicClinicalContext;
}

export interface MnemonicClinicalContext {
  tema_principal: string;
  subtopicos_relacionados: string[];
  palavras_chave: string[];
  diferenciais_relevantes: string[];
  termos_de_prova: string[];
  fontes_utilizadas: string[];
}

// ══════════════════════════════════════════════════
// AGENT OUTPUTS
// ══════════════════════════════════════════════════

export interface Associacao {
  letra: string;
  termo_original: string;
  representacao_no_mnemonico: string;
}

export interface GeneratorOutput {
  sigla: string;
  frase_mnemonica: string;
  explicacao_tecnica: string;
  explicacao_didatica: string;
  associacoes: Associacao[];
  observacoes?: string[];
}

export interface MedicalAuditOutput {
  score_medico: number;
  todos_os_termos_presentes: boolean;
  houve_omissao: boolean;
  houve_distorcao_semantica: boolean;
  ha_risco_clinico: boolean;
  letras_associadas_corretamente: boolean;
  erros_encontrados: string[];
  versao_corrigida?: GeneratorOutput;
}

export interface PedagogicalAuditOutput {
  score_pedagogico: number;
  facilidade_memorizacao: number;
  clareza: number;
  associacao_mental: number;
  aplicabilidade_em_aula: number;
  aplicabilidade_em_prova: number;
  pontos_fortes: string[];
  pontos_fracos: string[];
  versao_otimizada?: {
    frase_mnemonica?: string;
    explicacao_didatica?: string;
    cena_sugerida?: string;
  };
}

export interface VisualOutput {
  cena_visual: string;
  associacoes_visuais: Array<{ termo: string; elemento_visual: string }>;
  prompt_imagem: string;
}

export interface ConsolidatedOutput {
  sigla: string;
  frase_mnemonica: string;
  explicacao_tecnica: string;
  explicacao_didatica: string;
  cena_visual: string;
  prompt_imagem: string;
  alertas: string[];
}

// ══════════════════════════════════════════════════
// AGENT LOG
// ══════════════════════════════════════════════════

export interface AgentLog {
  agent: string;
  attempt: number;
  status: string;
  details: string;
}

// ══════════════════════════════════════════════════
// API RESPONSE
// ══════════════════════════════════════════════════

export interface MapaClinicoItem {
  termo_original: string;
  qualificadores: string[];
  representacao_no_mnemonico: string;
  explicacao: string;
}

export interface EstruturaProvaItem {
  item: string;
  ponto_chave_prova: string;
  armadilha_comum: string;
}

export interface DiferencialProva {
  diagnostico_comparado: string;
  diferencas_chave: string[];
  pegadinhas: string[];
}

export interface MemorizacaoAtiva {
  pergunta_rapida: string;
  resposta_esperada: string;
  gatilho_mental: string;
}

export interface CenaMemoravel {
  cena: string;
  personagens: string;
  acao: string;
  associacao_fonetica: string;
  emocao: string;
}

export interface PontoDeProva {
  pergunta_gatilho: string;
  resposta_esperada: string;
  armadilha_comum: string;
  dica_visual: string;
}

export interface AssociacaoVisualAvancada {
  termo: string;
  elemento_visual: string;
  associacao_fonetica?: string;
  acao_na_cena?: string;
}

export interface MnemonicResultData {
  request_id: string;
  result_id: string;
  tema: string;
  sigla: string;
  frase_mnemonica: string;
  explicacao_associacao?: string;
  explicacao_tecnica: string;
  explicacao_didatica: string;
  cena_visual: string;
  prompt_imagem: string;
  score_medico: number;
  score_pedagogico: number;
  score_linguistico: number;
  score_final: number;
  quality_flag: "high" | "medium" | "low";
  coverage_ok?: boolean;
  image_failed?: boolean;
  termos_digitados?: string[];
  termos_enriquecidos?: string[];
  termos_priorizados?: string[];
  subtopicos_relacionados?: string[];
  contexto_clinico?: MnemonicClinicalContext | null;
  alertas: string[];
  associacoes: Associacao[];
  associacoes_visuais: AssociacaoVisualAvancada[];
  image_url: string | null;
  items_map: Array<{
    letter: string;
    word: string;
    original_item: string;
    symbol: string | null;
    symbol_reason: string | null;
  }>;
  agent_logs: AgentLog[];
  mapa_clinico_completo?: MapaClinicoItem[];
  estrutura_prova?: { topico: string; itens_organizados: EstruturaProvaItem[] };
  diferencial_prova?: DiferencialProva;
  memorizacao_ativa?: MemorizacaoAtiva;
  // ═══ MEMORIZAÇÃO VISUAL AVANÇADA ═══
  cena_memoravel?: CenaMemoravel | null;
  pontos_de_prova?: PontoDeProva[];
}

export interface MnemonicApiResponse {
  success: boolean;
  data?: MnemonicResultData;
  error?: string;
  details?: string;
}

// ══════════════════════════════════════════════════
// HISTORY
// ══════════════════════════════════════════════════

export interface MnemonicHistoryItem {
  id: string;
  request_id: string;
  user_id: string;
  tema: string;
  sigla: string;
  frase_mnemonica: string;
  explicacao_tecnica: string | null;
  explicacao_didatica: string | null;
  cena_visual: string | null;
  prompt_imagem: string | null;
  associacoes_json: Associacao[];
  associacoes_visuais_json: Array<{ termo: string; elemento_visual: string }>;
  alertas_json: string[];
  score_medico: number;
  score_pedagogico: number;
  score_linguistico: number | null;
  score_final: number;
  aprovado: boolean;
  aprovado_medico: boolean;
  aprovado_pedagogico: boolean;
  image_url: string | null;
  versao: number;
  is_latest: boolean;
  created_at: string;
  updated_at: string;
  is_favorite?: boolean;
}

// ══════════════════════════════════════════════════
// FAVORITES
// ══════════════════════════════════════════════════

export interface FavoriteItem {
  id: string;
  user_id: string;
  result_id: string;
  created_at: string;
}

// ══════════════════════════════════════════════════
// FEEDBACK
// ══════════════════════════════════════════════════

export interface FeedbackPayload {
  result_id: string;
  request_id?: string;
  rating_general: number;
  rating_medical: number;
  rating_pedagogical: number;
  comentario?: string;
}

// ══════════════════════════════════════════════════
// REGENERATION
// ══════════════════════════════════════════════════

export type RegenerateStyle = "mais_facil" | "mais_tecnico" | "mais_visual" | "mais_curto";

export interface RegeneratePayload {
  tema: string;
  termos: string[];
  estilo: string;
  publico: string;
  style_hint: RegenerateStyle;
  original_result_id: string;
}

// ══════════════════════════════════════════════════
// UI STATE
// ══════════════════════════════════════════════════

export type MnemonicStatus = "idle" | "loading" | "success" | "error";

export const ESTILOS = [
  { value: "engraçado", label: "Engraçado / Humor" },
  { value: "visual", label: "Visual / Cênico" },
  { value: "acronimo", label: "Acrônimo / Sigla" },
  { value: "historia", label: "Mini-história" },
  { value: "musical", label: "Musical / Rítmico" },
  { value: "frase + imagem mental", label: "Frase + Imagem Mental" },
] as const;

export const PUBLICOS = [
  { value: "graduacao", label: "Graduação em Medicina" },
  { value: "residencia", label: "Residência Médica" },
] as const;

export const REGENERATE_OPTIONS: Array<{ value: RegenerateStyle; label: string; description: string }> = [
  { value: "mais_facil", label: "Mais fácil", description: "Simplifica linguagem e associações" },
  { value: "mais_tecnico", label: "Mais técnico", description: "Maior precisão clínica e terminologia" },
  { value: "mais_visual", label: "Mais visual", description: "Foco em cena visual e imagem mental" },
  { value: "mais_curto", label: "Mais curto", description: "Sigla e frase mais compactas" },
];
