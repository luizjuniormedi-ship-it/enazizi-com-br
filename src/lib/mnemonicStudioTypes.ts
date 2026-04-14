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

export interface MnemonicStudioData {
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
}

export interface MnemonicStudioResponse {
  success: boolean;
  data?: MnemonicStudioData;
  error?: string;
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
] as const;

export const PUBLICOS = [
  { value: "residencia", label: "Residência Médica" },
  { value: "graduacao", label: "Graduação em Medicina" },
  { value: "enfermagem", label: "Enfermagem" },
  { value: "farmacia", label: "Farmácia" },
  { value: "geral", label: "Saúde em Geral" },
] as const;
