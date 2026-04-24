/**
 * Cenários de teste semântico do Tutor IA.
 *
 * Cada cenário define:
 *  - id, label
 *  - seed (memória base que será criada se não existir)
 *  - variantes (perguntas que devem recuperar o seed via busca semântica/híbrida)
 *
 * O TestRunner consome essa lista para rodar batidas em massa.
 */
export interface ScenarioBlock {
  type: string;
  payload: Record<string, unknown>;
}

export interface ScenarioSeed {
  questionOriginal: string;
  questionNormalized: string;
  topic: string;
  subtopic: string;
  specialty: string;
  answerSummary: string;
  blocks: ScenarioBlock[];
}

export interface Scenario {
  id: "cardio" | "pneumo" | "neuro" | "hemo";
  label: string;
  emoji: string;
  seed: ScenarioSeed;
  variants: string[];
}

export const SCENARIOS: Scenario[] = [
  {
    id: "cardio",
    label: "Cardio · Insuficiência cardíaca",
    emoji: "❤️",
    seed: {
      questionOriginal: "Explique insuficiência cardíaca",
      questionNormalized: "insuficiencia cardiaca",
      topic: "Cardiologia",
      subtopic: "Insuficiência cardíaca",
      specialty: "Cardiologia",
      answerSummary:
        "Insuficiência cardíaca é uma síndrome clínica em que o coração não " +
        "consegue manter débito adequado. Classificada por FE (ICFEr/ICFEi/ICFEp). " +
        "Quadro: dispneia, ortopneia, DPN, edema, B3, turgência jugular.",
      blocks: [
        {
          type: "deep_dive",
          payload: {
            markdown:
              "## Insuficiência Cardíaca\n\nSíndrome clínica complexa com " +
              "hipoperfusão e/ou congestão. ICFEr (FE ≤ 40%), ICFEi (41–49%), " +
              "ICFEp (≥ 50%). Quadro: dispneia, ortopneia, DPN, edema, B3.",
          },
        },
      ],
    },
    variants: [
      "O que é ICC?",
      "IC com fração reduzida",
      "Paciente com dispneia e edema",
      "B3 e FEVE reduzida",
    ],
  },
  {
    id: "pneumo",
    label: "Pneumo · DPOC exacerbado",
    emoji: "🫁",
    seed: {
      questionOriginal: "Explique DPOC exacerbado",
      questionNormalized: "dpoc exacerbado",
      topic: "Pneumologia",
      subtopic: "DPOC",
      specialty: "Pneumologia",
      answerSummary:
        "DPOC exacerbado é piora aguda dos sintomas respiratórios em paciente " +
        "com doença pulmonar obstrutiva crônica. Quadro: dispneia, sibilos, " +
        "tosse, expectoração, hipoxemia e por vezes hipercapnia. Conduta: " +
        "broncodilatadores, corticoide sistêmico, antibiótico se indicado, O2 controlado.",
      blocks: [
        {
          type: "deep_dive",
          payload: {
            markdown:
              "## DPOC exacerbado\n\nPiora aguda dos sintomas. Sibilos, " +
              "dispneia, tosse, hipercapnia. Tratamento com broncodilatador, " +
              "corticoide e oxigenoterapia controlada.",
          },
        },
      ],
    },
    variants: [
      "DPOC com sibilos",
      "hipercapnia e dispneia",
      "exacerbação de DPOC",
      "chiado e falta de ar",
    ],
  },
  {
    id: "neuro",
    label: "Neuro · AVC isquêmico",
    emoji: "🧠",
    seed: {
      questionOriginal: "Explique acidente vascular cerebral",
      questionNormalized: "acidente vascular cerebral",
      topic: "Neurologia",
      subtopic: "AVC",
      specialty: "Neurologia",
      answerSummary:
        "AVC isquêmico é déficit neurológico focal súbito por oclusão arterial " +
        "cerebral. Quadro: hemiparesia, afasia, disartria, déficit visual. " +
        "Janela para trombólise: 4,5h. Avaliar NIHSS, TC sem contraste e ASPECTS.",
      blocks: [
        {
          type: "deep_dive",
          payload: {
            markdown:
              "## AVC isquêmico\n\nDéficit focal súbito. Hemiparesia, afasia, " +
              "disartria. Janela trombólise 4,5h. NIHSS + TC sem contraste.",
          },
        },
      ],
    },
    variants: [
      "AVC com hemiparesia",
      "afasia súbita",
      "déficit neurológico focal",
      "suspeita de AVCi",
    ],
  },
  {
    id: "hemo",
    label: "Hemato · Anemia ferropriva",
    emoji: "🩸",
    seed: {
      questionOriginal: "Explique anemia ferropriva",
      questionNormalized: "anemia ferropriva",
      topic: "Hematologia",
      subtopic: "Anemia ferropriva",
      specialty: "Hematologia",
      answerSummary:
        "Anemia ferropriva é a anemia mais comum, microcítica e hipocrômica, " +
        "por deficiência de ferro. Ferritina baixa é o marcador mais sensível. " +
        "Quadro: palidez, cansaço, glossite. Tratamento: reposição de ferro oral " +
        "e investigação da causa (sangramento, má absorção).",
      blocks: [
        {
          type: "deep_dive",
          payload: {
            markdown:
              "## Anemia ferropriva\n\nMicrocítica, hipocrômica. Ferritina " +
              "baixa. Palidez, cansaço, glossite. Tratar com ferro oral e " +
              "investigar causa.",
          },
        },
      ],
    },
    variants: [
      "ferritina baixa",
      "anemia microcítica",
      "palidez e cansaço",
      "deficiência de ferro",
    ],
  },
];

// Critérios de aprovação
export const VARIANT_PASS_RATE = 0.75; // ≥ 75% das variantes recuperam
export const SPRINT_PASS_RATE = 0.8; // ≥ 80% média geral
export const SIMILARITY_THRESHOLD = 0.4; // permissivo (backend já aplica dinâmico)
export const MIN_QUALITY = 80;
