/**
 * Banca exam profiles for edge functions.
 * Mirrors src/lib/examProfiles.ts but self-contained for Deno runtime.
 */

export interface BancaProfile {
  key: string;
  label: string;
  difficulty: number;
  style: string;
  tutorGuidance: string;
  osceEmphasis: boolean;
  specialtyWeights: Record<string, number>;
}

export const PROFILES: Record<string, BancaProfile> = {
  enamed: {
    key: "enamed", label: "ENAMED", difficulty: 3, osceEmphasis: false,
    specialtyWeights: { "Clínica Médica": 20, "Cirurgia": 15, "Pediatria": 12, "Ginecologia e Obstetrícia": 12, "Medicina Preventiva": 12, "Medicina de Emergência": 8, "Terapia Intensiva": 4, "Ortopedia": 4, "Oncologia": 4, "Angiologia": 3, "Urologia": 3, "Oftalmologia": 2, "Otorrinolaringologia": 1 },
    style: "Questões objetivas com caso clínico padrão. Cobertura ampla das grandes áreas. Foco em conduta e diagnóstico.",
    tutorGuidance: "Explicações objetivas e completas. O ENAMED cobra base ampla com foco em diagnóstico e conduta prática.",
  },
  enare: {
    key: "enare", label: "ENARE", difficulty: 4, osceEmphasis: false,
    specialtyWeights: { "Clínica Médica": 20, "Cirurgia": 15, "Pediatria": 12, "Ginecologia e Obstetrícia": 12, "Medicina Preventiva": 10, "Medicina de Emergência": 8, "Terapia Intensiva": 5, "Ortopedia": 4, "Oncologia": 4, "Angiologia": 3, "Urologia": 3, "Oftalmologia": 2, "Otorrinolaringologia": 2 },
    style: "Questões longas com caso clínico detalhado, 4 alternativas, foco em raciocínio clínico e conduta. Pegadinhas sutis baseadas em detalhes do caso.",
    tutorGuidance: "Explique com profundidade clínica, sempre incluindo diagnósticos diferenciais e critérios diagnósticos. Nível de residência médica.",
  },
  revalida: {
    key: "revalida", label: "Revalida (INEP)", difficulty: 3, osceEmphasis: true,
    specialtyWeights: { "Clínica Médica": 20, "Cirurgia": 15, "Pediatria": 12, "Ginecologia e Obstetrícia": 12, "Medicina Preventiva": 12, "Medicina de Emergência": 8, "Terapia Intensiva": 4, "Ortopedia": 4, "Oncologia": 4, "Angiologia": 3, "Urologia": 3, "Oftalmologia": 2, "Otorrinolaringologia": 1 },
    style: "Duas etapas: teórica (MCQ com caso clínico) e prática (OSCE). Foco em protocolos do SUS e Atenção Primária.",
    tutorGuidance: "Contextualizar com protocolos do SUS e Ministério da Saúde. Incluir manejo em UBS quando aplicável. Preparar para estações OSCE.",
  },
  usp: {
    key: "usp", label: "USP", difficulty: 5, osceEmphasis: true,
    specialtyWeights: { "Clínica Médica": 22, "Cirurgia": 18, "Pediatria": 12, "Ginecologia e Obstetrícia": 12, "Medicina de Emergência": 8, "Medicina Preventiva": 5, "Terapia Intensiva": 5, "Ortopedia": 5, "Oncologia": 4, "Oftalmologia": 3, "Angiologia": 2, "Urologia": 2, "Otorrinolaringologia": 2 },
    style: "Questões de alta complexidade com casos clínicos elaborados. Pegadinhas baseadas em exceções clínicas e detalhes fisiopatológicos.",
    tutorGuidance: "Aprofundar fisiopatologia e mecanismos. A USP cobra exceções e situações atípicas. Incluir evidências científicas recentes.",
  },
  unicamp: {
    key: "unicamp", label: "UNICAMP", difficulty: 5, osceEmphasis: true,
    specialtyWeights: { "Clínica Médica": 20, "Cirurgia": 15, "Pediatria": 15, "Ginecologia e Obstetrícia": 12, "Medicina de Emergência": 8, "Medicina Preventiva": 8, "Terapia Intensiva": 5, "Ortopedia": 4, "Oncologia": 4, "Angiologia": 3, "Urologia": 2, "Oftalmologia": 2, "Otorrinolaringologia": 2 },
    style: "Questões discursivas e MCQ. Casos complexos com múltiplas comorbidades. Abordagem integral do paciente.",
    tutorGuidance: "A UNICAMP valoriza abordagem integral. Incluir aspectos biopsicossociais quando relevante.",
  },
  unifesp: {
    key: "unifesp", label: "UNIFESP", difficulty: 4, osceEmphasis: true,
    specialtyWeights: { "Clínica Médica": 20, "Cirurgia": 18, "Pediatria": 12, "Ginecologia e Obstetrícia": 12, "Medicina de Emergência": 8, "Medicina Preventiva": 8, "Terapia Intensiva": 5, "Ortopedia": 4, "Oncologia": 4, "Angiologia": 3, "Urologia": 2, "Oftalmologia": 2, "Otorrinolaringologia": 2 },
    style: "Questões objetivas com caso clínico. Foco em condutas baseadas em evidências.",
    tutorGuidance: "Foco em medicina baseada em evidências. Condutas atualizadas e protocolos internacionais.",
  },
  "sus-sp": {
    key: "sus-sp", label: "SUS-SP", difficulty: 3, osceEmphasis: false,
    specialtyWeights: { "Clínica Médica": 22, "Cirurgia": 12, "Pediatria": 12, "Ginecologia e Obstetrícia": 12, "Medicina Preventiva": 12, "Medicina de Emergência": 8, "Terapia Intensiva": 4, "Ortopedia": 4, "Oncologia": 4, "Angiologia": 3, "Urologia": 3, "Oftalmologia": 2, "Otorrinolaringologia": 2 },
    style: "Casos curtos. Foco em Atenção Primária e protocolos do SUS. Saúde coletiva e vigilância epidemiológica.",
    tutorGuidance: "Contextualizar com protocolos do SUS-SP. Manejo na Atenção Primária.",
  },
  "sus-rj": {
    key: "sus-rj", label: "SUS-RJ", difficulty: 3, osceEmphasis: false,
    specialtyWeights: { "Clínica Médica": 22, "Cirurgia": 12, "Pediatria": 12, "Ginecologia e Obstetrícia": 12, "Medicina Preventiva": 12, "Medicina de Emergência": 8, "Terapia Intensiva": 4, "Ortopedia": 4, "Oncologia": 4, "Angiologia": 3, "Urologia": 3, "Oftalmologia": 2, "Otorrinolaringologia": 2 },
    style: "Questões objetivas focadas em protocolos do SUS. Casos clínicos curtos a moderados.",
    tutorGuidance: "Contextualizar com protocolos do SUS. Foco em Atenção Primária e manejo ambulatorial.",
  },
  amrigs: {
    key: "amrigs", label: "AMRIGS", difficulty: 3, osceEmphasis: false,
    specialtyWeights: { "Clínica Médica": 20, "Cirurgia": 15, "Pediatria": 12, "Ginecologia e Obstetrícia": 12, "Medicina Preventiva": 12, "Medicina de Emergência": 8, "Terapia Intensiva": 4, "Ortopedia": 4, "Oncologia": 4, "Angiologia": 3, "Urologia": 3, "Oftalmologia": 2, "Otorrinolaringologia": 1 },
    style: "Questões de múltipla escolha com casos clínicos. Padrão consolidado e previsível. Boa distribuição entre especialidades.",
    tutorGuidance: "Explicações objetivas e diretas. A AMRIGS cobra conteúdo clássico com boa distribuição.",
  },
  "ses-df": {
    key: "ses-df", label: "SES-DF", difficulty: 4, osceEmphasis: false,
    specialtyWeights: { "Clínica Médica": 20, "Cirurgia": 15, "Pediatria": 12, "Ginecologia e Obstetrícia": 12, "Medicina Preventiva": 12, "Medicina de Emergência": 8, "Terapia Intensiva": 4, "Ortopedia": 4, "Oncologia": 4, "Angiologia": 3, "Urologia": 3, "Oftalmologia": 2, "Otorrinolaringologia": 1 },
    style: "Questões elaboradas com casos clínicos detalhados. Nível elevado. Cobra detalhes de conduta e diagnóstico.",
    tutorGuidance: "Aprofundar condutas e critérios diagnósticos. A SES-DF cobra detalhes que diferenciam alternativas próximas.",
  },
  "psu-mg": {
    key: "psu-mg", label: "PSU-MG", difficulty: 3, osceEmphasis: false,
    specialtyWeights: { "Clínica Médica": 20, "Cirurgia": 15, "Pediatria": 12, "Ginecologia e Obstetrícia": 12, "Medicina Preventiva": 12, "Medicina de Emergência": 8, "Terapia Intensiva": 4, "Ortopedia": 4, "Oncologia": 4, "Angiologia": 3, "Urologia": 3, "Oftalmologia": 2, "Otorrinolaringologia": 1 },
    style: "Questões de múltipla escolha com casos clínicos. Foco em protocolos e diretrizes nacionais.",
    tutorGuidance: "Explicações claras com foco em diretrizes nacionais e protocolos atualizados.",
  },
  hcpa: {
    key: "hcpa", label: "HCPA", difficulty: 4, osceEmphasis: true,
    specialtyWeights: { "Clínica Médica": 20, "Cirurgia": 15, "Pediatria": 15, "Ginecologia e Obstetrícia": 12, "Medicina de Emergência": 8, "Medicina Preventiva": 8, "Terapia Intensiva": 5, "Ortopedia": 4, "Oncologia": 4, "Angiologia": 3, "Urologia": 2, "Oftalmologia": 2, "Otorrinolaringologia": 2 },
    style: "Questões de alto nível com casos complexos. Prova prática com estações OSCE. Foco em raciocínio clínico.",
    tutorGuidance: "Aprofundar raciocínio clínico e preparar para estações OSCE. O HCPA cobra excelência em abordagem clínica.",
  },
  einstein: {
    key: "einstein", label: "Einstein", difficulty: 5, osceEmphasis: true,
    specialtyWeights: { "Clínica Médica": 22, "Cirurgia": 15, "Pediatria": 12, "Ginecologia e Obstetrícia": 12, "Medicina de Emergência": 8, "Medicina Preventiva": 8, "Terapia Intensiva": 5, "Ortopedia": 4, "Oncologia": 4, "Angiologia": 3, "Urologia": 3, "Oftalmologia": 2, "Otorrinolaringologia": 2 },
    style: "Altíssima complexidade. Múltiplas comorbidades e decisões em cenário complexo. OSCE sofisticado.",
    tutorGuidance: "Incluir evidências de alto nível, guidelines internacionais e abordagem de casos complexos.",
  },
  "sirio-libanes": {
    key: "sirio-libanes", label: "Sírio-Libanês", difficulty: 5, osceEmphasis: true,
    specialtyWeights: { "Clínica Médica": 22, "Cirurgia": 15, "Pediatria": 12, "Ginecologia e Obstetrícia": 12, "Medicina de Emergência": 8, "Medicina Preventiva": 8, "Terapia Intensiva": 5, "Ortopedia": 4, "Oncologia": 4, "Angiologia": 3, "Urologia": 3, "Oftalmologia": 2, "Otorrinolaringologia": 2 },
    style: "Altíssima complexidade. Forte componente prático. Casos raros e atípicos.",
    tutorGuidance: "Incluir apresentações incomuns e diagnósticos diferenciais amplos.",
  },
  "santa-casa-sp": {
    key: "santa-casa-sp", label: "Santa Casa SP", difficulty: 4, osceEmphasis: false,
    specialtyWeights: { "Clínica Médica": 20, "Cirurgia": 20, "Pediatria": 12, "Ginecologia e Obstetrícia": 12, "Medicina de Emergência": 8, "Medicina Preventiva": 8, "Terapia Intensiva": 4, "Ortopedia": 4, "Oncologia": 4, "Angiologia": 3, "Urologia": 2, "Oftalmologia": 2, "Otorrinolaringologia": 1 },
    style: "Casos detalhados. Forte ênfase em Cirurgia. Pegadinhas baseadas em detalhes anatômicos e técnicos.",
    tutorGuidance: "Forte ênfase cirúrgica. Incluir detalhes técnicos e anatômicos.",
  },
};

const ALIASES: Record<string, string> = {
  amp: "amrigs",
};

const DEFAULT_PROFILE: BancaProfile = {
  key: "outra", label: "Residência Médica", difficulty: 3, osceEmphasis: false,
  specialtyWeights: { "Clínica Médica": 20, "Cirurgia": 15, "Pediatria": 12, "Ginecologia e Obstetrícia": 12, "Medicina Preventiva": 12, "Medicina de Emergência": 8, "Terapia Intensiva": 4, "Ortopedia": 4, "Oncologia": 4, "Angiologia": 3, "Urologia": 3, "Oftalmologia": 2, "Otorrinolaringologia": 1 },
  style: "Questões MCQ com caso clínico padrão residência médica.",
  tutorGuidance: "Explicações completas no padrão de residência médica brasileira.",
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
  const weights = Object.entries(profile.specialtyWeights)
    .sort(([, a], [, b]) => b - a)
    .map(([s, w]) => `  - ${s}: ${w}%`)
    .join("\n");

  return `
## ADAPTAÇÃO À BANCA: ${profile.label}
- Nível de dificuldade: ${profile.difficulty}/5
- Prova prática (OSCE): ${profile.osceEmphasis ? "SIM — incluir preparação prática" : "Não"}
- Estilo: ${profile.style}
- Orientação pedagógica: ${profile.tutorGuidance}
- Distribuição por especialidade:
${weights}
`;
}
