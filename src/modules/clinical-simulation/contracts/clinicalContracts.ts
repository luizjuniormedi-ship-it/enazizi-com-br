/**
 * clinicalContracts — contratos tipados edge↔frontend (Wave 1, Fase 3).
 *
 * Hoje o frontend infere semântica via `includes("mg/dl")`, `includes("g/dl")`,
 * `includes("leucócitos")` etc. Isso é frágil:
 *   - quebra com variações de português,
 *   - mascara bugs do edge,
 *   - acopla lógica clínica a strings.
 *
 * A partir da Wave 1.3 a edge function `clinical-simulation` retorna estes
 * campos estruturados. Até lá, o frontend pode usar `normalizeEdgeResponse()`
 * que aplica defaults seguros sem quebrar o legado.
 *
 * IMPORTANTE: este arquivo é TYPE-ONLY na fronteira do runtime. Zero side-effect.
 */

export type ResponseType =
  | "clinical"      // fala / sintoma / queixa
  | "lab"           // resultado laboratorial
  | "imaging"       // imagem / radiologia
  | "abcde"         // resposta a manobra ABCDE
  | "prescription"  // confirmação de prescrição
  | "treatment"     // confirmação de conduta
  | "diagnosis"     // confirmação de diagnóstico
  | "narrative";    // texto livre não classificado (fallback)

export type PatientStatus = "stable" | "warning" | "critical";

export interface EdgeResponseContract {
  /** Texto a renderizar no chat (obrigatório). */
  reply: string;

  /** Classificação semântica da resposta (Wave 1.3+). */
  response_type?: ResponseType;

  /** Status clínico atual do paciente (Wave 1.3+). */
  patient_status?: PatientStatus;

  /** Delta de score a aplicar (-100 .. +100). */
  score_delta?: number;

  /** Nível de deterioração (0..3). */
  deterioration_level?: number;

  /** Letras ABCDE detectadas na ação do aluno. */
  abcde_detected?: string[];

  /** Tags clínicas livres (para analytics / FSRS futuro — NÃO usar em runtime ainda). */
  clinical_tags?: string[];

  /** Sinais vitais atualizados (formato existente preservado). */
  vitals?: Partial<{ PA: string; FC: string; FR: string; Temp: string; SpO2: string }>;

  /** Outros campos legados (não tipados — preservados até Wave 1.4). */
  [k: string]: unknown;
}

/**
 * Normaliza uma resposta crua do edge para o contrato.
 * Aplica defaults seguros e nunca lança. Use em transição.
 */
export function normalizeEdgeResponse(raw: unknown): EdgeResponseContract {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    reply: typeof r.reply === "string" ? r.reply : (typeof r.message === "string" ? (r.message as string) : ""),
    response_type: r.response_type as ResponseType | undefined,
    patient_status: r.patient_status as PatientStatus | undefined,
    score_delta: typeof r.score_delta === "number" ? r.score_delta : undefined,
    deterioration_level: typeof r.deterioration_level === "number" ? r.deterioration_level : undefined,
    abcde_detected: Array.isArray(r.abcde_detected) ? (r.abcde_detected as string[]) : undefined,
    clinical_tags: Array.isArray(r.clinical_tags) ? (r.clinical_tags as string[]) : undefined,
    vitals: (r.vitals as EdgeResponseContract["vitals"]) ?? undefined,
    ...r,
  };
}

/** Mapeia patient_status novo (en) ↔ legado (pt) sem quebrar UI atual. */
export const PATIENT_STATUS_PT: Record<PatientStatus, string> = {
  stable: "estável",
  warning: "instável",
  critical: "crítico",
};
