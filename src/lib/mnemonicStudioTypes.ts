/**
 * Mnemonic Studio — TypeScript contracts for API-first mnemonic generation.
 */

// ══════════════════════════════════════════════════
// INPUT CONTRACT
// ══════════════════════════════════════════════════

export interface MnemonicStudioInput {
  tema: string;
  termos: string[];
  estilo: string;
  publico: string;
}

// ══════════════════════════════════════════════════
// OUTPUT CONTRACT
// ══════════════════════════════════════════════════

export interface AgentLogEntry {
  agent: string;
  attempt: number;
  status: string;
  details: string;
}

export interface MnemonicAssociacao {
  letra: string;
  termo_original: string;
  representacao_no_mnemonico: string;
}

export interface MnemonicAssociacaoVisual {
  termo: string;
  elemento_visual: string;
}

export interface MnemonicStudioData {
  request_id?: string;
  result_id?: string;
  tema: string;
  sigla: string;
  frase_mnemonica: string;
  explicacao_tecnica: string;
  explicacao_didatica: string;
  cena_visual: string;
  prompt_imagem: string;
  image_url: string | null;
  score_medico: number;
  score_pedagogico: number;
  score_final: number;
  alertas: string[];
  items_map: Array<{
    letter: string;
    word: string;
    original_item: string;
    symbol: string | null;
    symbol_reason: string | null;
  }>;
  associacoes?: MnemonicAssociacao[];
  associacoes_visuais?: MnemonicAssociacaoVisual[];
  agent_logs?: AgentLogEntry[];
  agentes?: Record<string, unknown>;
}

export interface MnemonicStudioResponse {
  success: boolean;
  data?: MnemonicStudioData;
  error?: string;
  details?: string;
  agent_logs?: AgentLogEntry[];
}

// ══════════════════════════════════════════════════
// UI STATE
// ══════════════════════════════════════════════════

export type MnemonicStudioStatus = "idle" | "loading" | "success" | "error";

export const ESTILOS = [
  { value: "engraçado", label: "Engraçado / Humor" },
  { value: "visual", label: "Visual / Cênico" },
  { value: "acronimo", label: "Acrônimo / Sigla" },
  { value: "historia", label: "Mini-história" },
  { value: "musical", label: "Musical / Rítmico" },
  { value: "frase + imagem mental", label: "Frase + Imagem Mental" },
] as const;

export const PUBLICOS = [
  { value: "residencia", label: "Residência Médica" },
  { value: "graduacao", label: "Graduação em Medicina" },
  { value: "enfermagem", label: "Enfermagem" },
  { value: "farmacia", label: "Farmácia" },
  { value: "geral", label: "Saúde em Geral" },
] as const;
