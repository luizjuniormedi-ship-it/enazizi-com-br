
/**
 * Perfis de bancas médicas brasileiras (Frontend).
 * Sincronizado com os perfis da Edge Function.
 */

export interface ReadinessWeights {
  specAccuracy: number;
  approvalScore: number;
  simulado: number;
  coverage: number;
  practical: number;
  consistency: number;
  reviewPenalty: number;
}

const DEFAULT_READINESS: ReadinessWeights = {
  specAccuracy: 0.30, approvalScore: 0.20, simulado: 0.15,
  coverage: 0.10, practical: 0.10, consistency: 0.10, reviewPenalty: 0.05,
};

export interface ExamProfile {
  key: string;
  label: string;
  difficulty: number;
  practicalFocus: number;
  osceEmphasis: boolean;
  specialtyWeights: Record<string, number>;
  style: string;
  engineModifiers: {
    reviewWeightMod: number;
    questionsWeightMod: number;
    practicalWeightMod: number;
    theoryWeightMod: number;
  };
  tutorGuidance: string;
  readinessWeights: ReadinessWeights;
  optionsCount?: number;
  mode?: "mcq" | "ce";
}

export const EXAM_PROFILES: Record<string, ExamProfile> = {
  enare: {
    key: "enare", label: "ENARE", difficulty: 4, practicalFocus: 0.3, osceEmphasis: false,
    specialtyWeights: { "Clínica Médica": 20, "Cirurgia": 15, "Pediatria": 12, "Ginecologia e Obstetrícia": 12, "Medicina Preventiva": 10, "Medicina de Emergência": 8, "Terapia Intensiva": 5, "Ortopedia": 4, "Oncologia": 4, "Angiologia": 3, "Urologia": 3, "Oftalmologia": 2, "Otorrinolaringologia": 2 },
    style: "Questões longas com caso clínico detalhado, 5 alternativas.",
    engineModifiers: { reviewWeightMod: 0, questionsWeightMod: 0.05, practicalWeightMod: 0, theoryWeightMod: -0.05 },
    tutorGuidance: "Explique com profundidade clínica, sempre incluindo diagnósticos diferenciais e critérios diagnósticos.",
    readinessWeights: { specAccuracy: 0.30, approvalScore: 0.20, simulado: 0.15, coverage: 0.15, practical: 0.05, consistency: 0.10, reviewPenalty: 0.05 },
    optionsCount: 5,
    mode: "mcq"
  },
  cebraspe: {
    key: "cebraspe", label: "CEBRASPE", difficulty: 4, practicalFocus: 0.2, osceEmphasis: false,
    specialtyWeights: { "Clínica Médica": 20, "Cirurgia": 15, "Pediatria": 12, "Ginecologia e Obstetrícia": 12, "Medicina Preventiva": 12, "Medicina de Emergência": 8, "Terapia Intensiva": 4, "Ortopedia": 4, "Oncologia": 4, "Angiologia": 3, "Urologia": 3, "Oftalmologia": 2, "Otorrinolaringologia": 1 },
    style: "CERTO/ERRADO; assertivas longas; interpretação profunda.",
    engineModifiers: { reviewWeightMod: 0.05, questionsWeightMod: 0, practicalWeightMod: 0, theoryWeightMod: -0.05 },
    tutorGuidance: "Foque em interpretação de texto e detalhes semânticos.",
    readinessWeights: { ...DEFAULT_READINESS },
    optionsCount: 2,
    mode: "ce"
  },
  fgv: {
    key: "fgv", label: "FGV", difficulty: 5, practicalFocus: 0.3, osceEmphasis: false,
    specialtyWeights: { "Clínica Médica": 20, "Cirurgia": 15, "Pediatria": 12, "Ginecologia e Obstetrícia": 12, "Medicina Preventiva": 12, "Medicina de Emergência": 8, "Terapia Intensiva": 4, "Ortopedia": 4, "Oncologia": 4, "Angiologia": 3, "Urologia": 3, "Oftalmologia": 2, "Otorrinolaringologia": 1 },
    style: "Contextual; raciocínio; alternativas longas.",
    engineModifiers: { reviewWeightMod: 0, questionsWeightMod: 0.1, practicalWeightMod: 0, theoryWeightMod: -0.1 },
    tutorGuidance: "Aprofunde no raciocínio clínico e na interpretação das alternativas.",
    readinessWeights: { ...DEFAULT_READINESS },
    optionsCount: 5,
    mode: "mcq"
  },
  usp: {
    key: "usp", label: "USP", difficulty: 5, practicalFocus: 0.35, osceEmphasis: true,
    specialtyWeights: { "Clínica Médica": 22, "Cirurgia": 18, "Pediatria": 12, "Ginecologia e Obstetrícia": 12, "Medicina de Emergência": 8, "Medicina Preventiva": 5, "Terapia Intensiva": 5, "Ortopedia": 5, "Oncologia": 4, "Oftalmologia": 3, "Angiologia": 2, "Urologia": 2, "Otorrinolaringologia": 2 },
    style: "Extremamente técnica; detalhes; armadilhas fisiopatológicas.",
    engineModifiers: { reviewWeightMod: -0.05, questionsWeightMod: 0.10, practicalWeightMod: 0.05, theoryWeightMod: -0.10 },
    tutorGuidance: "Aprofundar fisiopatologia e mecanismos.",
    readinessWeights: { specAccuracy: 0.35, approvalScore: 0.15, simulado: 0.20, coverage: 0.05, practical: 0.15, consistency: 0.05, reviewPenalty: 0.05 },
    optionsCount: 5,
    mode: "mcq"
  },
  enamed: {
    key: "enamed", label: "ENAMED", difficulty: 3, practicalFocus: 0.25, osceEmphasis: false,
    specialtyWeights: { "Clínica Médica": 20, "Cirurgia": 15, "Pediatria": 12, "Ginecologia e Obstetrícia": 12, "Medicina Preventiva": 12, "Medicina de Emergência": 8, "Terapia Intensiva": 4, "Ortopedia": 4, "Oncologia": 4, "Angiologia": 3, "Urologia": 3, "Oftalmologia": 2, "Otorrinolaringologia": 1 },
    style: "Questões objetivas com caso clínico padrão MEC/INEP.",
    engineModifiers: { reviewWeightMod: 0.05, questionsWeightMod: 0, practicalWeightMod: 0, theoryWeightMod: -0.05 },
    tutorGuidance: "Explicações objetivas e completas.",
    readinessWeights: { ...DEFAULT_READINESS },
    optionsCount: 5,
    mode: "mcq"
  }
};

export function getExamProfile(examKey: string | null | undefined): ExamProfile {
  if (!examKey) return EXAM_PROFILES.enare;
  const normalized = examKey.toLowerCase().replace('-sp', '').replace('_', '').replace('sp', '');
  return EXAM_PROFILES[normalized] || EXAM_PROFILES.enare;
}

/** Apply exam profile modifiers to base PlanWeights */
export function applyExamModifiers(
  baseWeights: { reviewWeight: number; theoryWeight: number; questionsWeight: number; practicalWeight: number; maxNewTopics: number; phase: string },
  profile: ExamProfile,
): typeof baseWeights {
  const m = profile.engineModifiers;
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  return {
    ...baseWeights,
    reviewWeight: clamp(baseWeights.reviewWeight + m.reviewWeightMod),
    theoryWeight: clamp(baseWeights.theoryWeight + m.theoryWeightMod),
    questionsWeight: clamp(baseWeights.questionsWeight + m.questionsWeightMod),
    practicalWeight: clamp(baseWeights.practicalWeight + m.practicalWeightMod),
  };
}

/** Merge multiple exam profiles into a balanced combined profile */
export function getMergedExamProfile(examKeys: string[]): ExamProfile {
  if (!examKeys || examKeys.length === 0) return EXAM_PROFILES.enare;
  if (examKeys.length === 1) return getExamProfile(examKeys[0]);

  const profiles = examKeys.map(k => getExamProfile(k)).filter(Boolean);
  if (profiles.length === 0) return EXAM_PROFILES.enare;

  const n = profiles.length;

  const difficulty = Math.round(profiles.reduce((s, p) => s + p.difficulty, 0) / n);
  const practicalFocus = profiles.reduce((s, p) => s + p.practicalFocus, 0) / n;
  const osceEmphasis = profiles.some(p => p.osceEmphasis);

  const allSpecialties = new Set(profiles.flatMap(p => Object.keys(p.specialtyWeights)));
  const specialtyWeights: Record<string, number> = {};
  for (const spec of allSpecialties) {
    const vals = profiles.map(p => p.specialtyWeights[spec]).filter(v => v != null);
    specialtyWeights[spec] = Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
  }

  const engineModifiers = {
    reviewWeightMod: profiles.reduce((s, p) => s + p.engineModifiers.reviewWeightMod, 0) / n,
    questionsWeightMod: profiles.reduce((s, p) => s + p.engineModifiers.questionsWeightMod, 0) / n,
    practicalWeightMod: profiles.reduce((s, p) => s + p.engineModifiers.practicalWeightMod, 0) / n,
    theoryWeightMod: profiles.reduce((s, p) => s + p.engineModifiers.theoryWeightMod, 0) / n,
  };

  return {
    key: "merged",
    label: "Perfil Combinado",
    difficulty,
    practicalFocus,
    osceEmphasis,
    specialtyWeights,
    style: "Perfil personalizado baseado na sua seleção de bancas.",
    engineModifiers,
    tutorGuidance: "Foque nos pontos comuns entre as bancas selecionadas.",
    readinessWeights: profiles[0].readinessWeights,
  };
}

