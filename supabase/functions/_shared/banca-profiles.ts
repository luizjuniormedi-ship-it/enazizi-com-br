/**
 * Banca exam profiles for edge functions.
 * Centralized and standardized for all modules.
 */

export interface BancaProfile {
  key: string;
  label: string;
  difficulty: number;
  style: string;
  tutorGuidance: string;
  osceEmphasis: boolean;
  specialtyWeights: Record<string, number>;
  optionsCount?: number;
  mode?: "mcq" | "ce"; // Multiple Choice vs Certo/Errado
}

export const PROFILES: Record<string, BancaProfile> = {
  enamed: {
    key: "enamed", label: "ENAMED", difficulty: 3, osceEmphasis: false,
    specialtyWeights: { "Clínica Médica": 20, "Cirurgia": 15, "Pediatria": 12, "Ginecologia e Obstetrícia": 12, "Medicina Preventiva": 12, "Medicina de Emergência": 8, "Terapia Intensiva": 4, "Ortopedia": 4, "Oncologia": 4, "Angiologia": 3, "Urologia": 3, "Oftalmologia": 2, "Otorrinolaringologia": 1 },
    style: "Padrão MEC/INEP; contextual; interdisciplinar; ética + SUS + clínica. Questões de múltipla escolha com caso clínico padrão.",
    tutorGuidance: "Explicações objetivas e completas. O ENAMED cobra base ampla com foco em diagnóstico e conduta prática.",
    optionsCount: 5,
    mode: "mcq"
  },
  enare: {
    key: "enare", label: "ENARE", difficulty: 4, osceEmphasis: false,
    specialtyWeights: { "Clínica Médica": 20, "Cirurgia": 15, "Pediatria": 12, "Ginecologia e Obstetrícia": 12, "Medicina Preventiva": 10, "Medicina de Emergência": 8, "Terapia Intensiva": 5, "Ortopedia": 4, "Oncologia": 4, "Angiologia": 3, "Urologia": 3, "Oftalmologia": 2, "Otorrinolaringologia": 2 },
    style: "Residência médica integrada; clínica prática; guideline recente; raciocínio aplicado. Questões longas com caso clínico detalhado.",
    tutorGuidance: "Explique com profundidade clínica, sempre incluindo diagnósticos diferenciais e critérios diagnósticos. Nível de residência médica.",
    optionsCount: 5,
    mode: "mcq"
  },
  cebraspe: {
    key: "cebraspe", label: "CEBRASPE", difficulty: 4, osceEmphasis: false,
    specialtyWeights: { "Clínica Médica": 20, "Cirurgia": 15, "Pediatria": 12, "Ginecologia e Obstetrícia": 12, "Medicina Preventiva": 12, "Medicina de Emergência": 8, "Terapia Intensiva": 4, "Ortopedia": 4, "Oncologia": 4, "Angiologia": 3, "Urologia": 3, "Oftalmologia": 2, "Otorrinolaringologia": 1 },
    style: "CERTO/ERRADO; assertivas longas; interpretação; pegadinha semântica; alta interdisciplinaridade. Use apenas 2 opções: Certo ou Errado.",
    tutorGuidance: "Foque em interpretação de texto e detalhes semânticos. O Cebraspe valoriza o conhecimento interdisciplinar.",
    optionsCount: 2,
    mode: "ce"
  },
  fgv: {
    key: "fgv", label: "FGV", difficulty: 5, osceEmphasis: false,
    specialtyWeights: { "Clínica Médica": 20, "Cirurgia": 15, "Pediatria": 12, "Ginecologia e Obstetrícia": 12, "Medicina Preventiva": 12, "Medicina de Emergência": 8, "Terapia Intensiva": 4, "Ortopedia": 4, "Oncologia": 4, "Angiologia": 3, "Urologia": 3, "Oftalmologia": 2, "Otorrinolaringologia": 1 },
    style: "Contextual; raciocínio; alternativas longas; interpretação profunda. Casos clínicos complexos e bem estruturados.",
    tutorGuidance: "Aprofunde no raciocínio clínico e na interpretação das alternativas. A FGV cobra alto nível de análise.",
    optionsCount: 5,
    mode: "mcq"
  },
  fcc: {
    key: "fcc", label: "FCC", difficulty: 3, osceEmphasis: false,
    specialtyWeights: { "Clínica Médica": 20, "Cirurgia": 15, "Pediatria": 12, "Ginecologia e Obstetrícia": 12, "Medicina Preventiva": 12, "Medicina de Emergência": 8, "Terapia Intensiva": 4, "Ortopedia": 4, "Oncologia": 4, "Angiologia": 3, "Urologia": 3, "Oftalmologia": 2, "Otorrinolaringologia": 1 },
    style: "Literalidade; doutrina; padrão conservador. Questões objetivas diretas baseadas em diretrizes.",
    tutorGuidance: "Foque em diretrizes e literalidade técnica. A FCC é conhecida por cobrar a 'letra da lei' médica.",
    optionsCount: 5,
    mode: "mcq"
  },
  usp: {
    key: "usp", label: "USP", difficulty: 5, osceEmphasis: true,
    specialtyWeights: { "Clínica Médica": 22, "Cirurgia": 18, "Pediatria": 12, "Ginecologia e Obstetrícia": 12, "Medicina de Emergência": 8, "Medicina Preventiva": 5, "Terapia Intensiva": 5, "Ortopedia": 5, "Oncologia": 4, "Oftalmologia": 3, "Angiologia": 2, "Urologia": 2, "Otorrinolaringologia": 2 },
    style: "Extremamente técnica; detalhes; armadilhas fisiopatológicas. Questões de alta complexidade com casos clínicos elaborados.",
    tutorGuidance: "Aprofundar fisiopatologia e mecanismos. A USP cobra exceções e situações atípicas. Incluir evidências científicas recentes.",
    optionsCount: 5,
    mode: "mcq"
  },
  revalida: {
    key: "revalida", label: "Revalida (INEP)", difficulty: 3, osceEmphasis: true,
    specialtyWeights: { "Clínica Médica": 20, "Cirurgia": 15, "Pediatria": 12, "Ginecologia e Obstetrícia": 12, "Medicina Preventiva": 12, "Medicina de Emergência": 8, "Terapia Intensiva": 4, "Ortopedia": 4, "Oncologia": 4, "Angiologia": 3, "Urologia": 3, "Oftalmologia": 2, "Otorrinolaringologia": 1 },
    style: "Foco em protocolos do SUS e Atenção Primária. Casos clínicos do cotidiano do médico geralista.",
    tutorGuidance: "Contextualizar com protocolos do SUS e Ministério da Saúde. Incluir manejo em UBS quando aplicável.",
    optionsCount: 5,
    mode: "mcq"
  },
  unicamp: {
    key: "unicamp", label: "UNICAMP", difficulty: 5, osceEmphasis: true,
    specialtyWeights: { "Clínica Médica": 20, "Cirurgia": 15, "Pediatria": 15, "Ginecologia e Obstetrícia": 12, "Medicina de Emergência": 8, "Medicina Preventiva": 8, "Terapia Intensiva": 5, "Ortopedia": 4, "Oncologia": 4, "Angiologia": 3, "Urologia": 2, "Oftalmologia": 2, "Otorrinolaringologia": 2 },
    style: "Casos complexos com múltiplas comorbidades. Abordagem integral do paciente.",
    tutorGuidance: "A UNICAMP valoriza abordagem integral. Incluir aspectos biopsicossociais quando relevante.",
    optionsCount: 5,
    mode: "mcq"
  },
  unifesp: {
    key: "unifesp", label: "UNIFESP", difficulty: 4, osceEmphasis: true,
    specialtyWeights: { "Clínica Médica": 20, "Cirurgia": 18, "Pediatria": 12, "Ginecologia e Obstetrícia": 12, "Medicina de Emergência": 8, "Medicina Preventiva": 8, "Terapia Intensiva": 5, "Ortopedia": 4, "Oncologia": 4, "Angiologia": 3, "Urologia": 2, "Oftalmologia": 2, "Otorrinolaringologia": 2 },
    style: "Foco em condutas baseadas em evidências. Questões objetivas com boa distribuição de temas.",
    tutorGuidance: "Foco em medicina baseada em evidências. Condutas atualizadas e protocolos internacionais.",
    optionsCount: 5,
    mode: "mcq"
  }
};

const ALIASES: Record<string, string> = {
  amp: "amrigs",
  "usp-sp": "usp",
  "santa_casa": "santa-casa-sp"
};

const DEFAULT_PROFILE: BancaProfile = {
  key: "outra", label: "Residência Médica", difficulty: 3, osceEmphasis: false,
  specialtyWeights: { "Clínica Médica": 20, "Cirurgia": 15, "Pediatria": 12, "Ginecologia e Obstetrícia": 12, "Medicina Preventiva": 12, "Medicina de Emergência": 8, "Terapia Intensiva": 4, "Ortopedia": 4, "Oncologia": 4, "Angiologia": 3, "Urologia": 3, "Oftalmologia": 2, "Otorrinolaringologia": 1 },
  style: "Questões MCQ com caso clínico padrão residência médica.",
  tutorGuidance: "Explicações completas no padrão de residência médica brasileira.",
  optionsCount: 5,
  mode: "mcq"
};

export interface BancaResolution {
  profile: BancaProfile;
  profileKey: string;
  aliasUsed: boolean;
  blueprintFound: boolean;
}

export function resolveBanca(key: string | null | undefined): BancaResolution {
  if (!key) return { profile: DEFAULT_PROFILE, profileKey: "outra", aliasUsed: false, blueprintFound: false };
  
  const normalized = key.toLowerCase().trim();
  const aliasKey = ALIASES[normalized];
  const profileKey = aliasKey || normalized;
  const aliasUsed = !!aliasKey;
  
  const profile = PROFILES[profileKey];
  const blueprintFound = !!profile;

  return {
    profile: profile || DEFAULT_PROFILE,
    profileKey: blueprintFound ? profileKey : "outra",
    aliasUsed,
    blueprintFound,
  };
}

export function getBancaProfile(key: string | null | undefined): BancaProfile {
  return resolveBanca(key).profile;
}

/** Build prompt block to inject into AI system prompts */
export function buildBancaBlock(profile: BancaProfile): string {
  return `
## ADAPTAÇÃO À BANCA: ${profile.label}
- Nível de dificuldade: ${profile.difficulty}/5
- Estilo: ${profile.style}
- Formato obrigatório: ${profile.mode === 'ce' ? "CERTO/ERRADO (2 alternativas: 'Certo', 'Errado')" : `Múltipla Escolha com exatamente ${profile.optionsCount || 5} alternativas (A, B, C, D, E)`}
- Orientação pedagógica: ${profile.tutorGuidance}
`;
}
