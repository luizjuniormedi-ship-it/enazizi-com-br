/**
 * Distribuição de temas por incidência real em provas de residência médica.
 * Baseado em análise de provas ENARE, USP-SP, UNIFESP, SUS-SP (2020-2025).
 */

export interface SubtopicWeight {
  /** Nome da subárea (ex.: "Cardiologia") */
  name: string;
  /** Peso relativo dentro do tema pai (0–100, somando 100 entre os subtopics do mesmo tema) */
  weight: number;
}

export interface TopicWeight {
  topic: string;
  weight: number; // percentual 0-100
  /**
   * Subdivisão opcional do tema em subáreas (drill-down apenas visual).
   * Se presente, os pesos internos devem somar 100 (proporção dentro do tema).
   * Não é usado pelo gerador de prova — apenas pela prévia visual.
   */
  subtopics?: SubtopicWeight[];
}

export interface ExamProfile {
  name: string;
  totalQuestions: number;
  timeMinutes: number;
  cutoffEstimate: number; // % de acerto para aprovação (estimativa)
  topicWeights: TopicWeight[];
  difficultyMix: { easy: number; medium: number; hard: number }; // percentuais
}

/**
 * Subdivisão padrão de "Clínica Médica" em subáreas, com pesos plausíveis
 * baseados na incidência observada nas provas de residência (ENARE, USP-SP,
 * UNIFESP, SUS-SP). Total = 100. Reaproveitada por todos os perfis.
 *
 * IMPORTANTE: esta tabela é apenas para a PRÉVIA VISUAL da distribuição.
 * O gerador de prova (`src/pages/Simulados.tsx`) continua tratando
 * "Clínica Médica" como um único tema macro nesta fase.
 */
const CLINICA_MEDICA_SUBTOPICS: SubtopicWeight[] = [
  { name: "Cardiologia", weight: 22 },
  { name: "Pneumologia", weight: 14 },
  { name: "Gastroenterologia", weight: 12 },
  { name: "Endocrinologia", weight: 12 },
  { name: "Nefrologia", weight: 10 },
  { name: "Infectologia", weight: 10 },
  { name: "Hematologia", weight: 8 },
  { name: "Reumatologia", weight: 6 },
  { name: "Neurologia", weight: 6 },
];

/** Perfis de provas reais de residência */
export const EXAM_PROFILES: Record<string, ExamProfile> = {
  ENARE: {
    name: "ENARE",
    totalQuestions: 100,
    timeMinutes: 300,
    cutoffEstimate: 62,
    difficultyMix: { easy: 25, medium: 50, hard: 25 },
    topicWeights: [
      { topic: "Clínica Médica", weight: 20, subtopics: CLINICA_MEDICA_SUBTOPICS },
      { topic: "Cirurgia", weight: 15 },
      { topic: "Pediatria", weight: 12 },
      { topic: "Ginecologia e Obstetrícia", weight: 12 },
      { topic: "Medicina Preventiva", weight: 10 },
      { topic: "Medicina de Emergência", weight: 8 },
      { topic: "Terapia Intensiva", weight: 5 },
      { topic: "Ortopedia", weight: 4 },
      { topic: "Oncologia", weight: 4 },
      { topic: "Angiologia", weight: 3 },
      { topic: "Urologia", weight: 3 },
      { topic: "Oftalmologia", weight: 2 },
      { topic: "Otorrinolaringologia", weight: 2 },
    ],
  },
  "USP-SP": {
    name: "USP-SP",
    totalQuestions: 100,
    timeMinutes: 300,
    cutoffEstimate: 68,
    difficultyMix: { easy: 20, medium: 45, hard: 35 },
    topicWeights: [
      { topic: "Clínica Médica", weight: 22, subtopics: CLINICA_MEDICA_SUBTOPICS },
      { topic: "Cirurgia", weight: 18 },
      { topic: "Pediatria", weight: 12 },
      { topic: "Ginecologia e Obstetrícia", weight: 12 },
      { topic: "Medicina Preventiva", weight: 5 },
      { topic: "Medicina de Emergência", weight: 8 },
      { topic: "Ortopedia", weight: 5 },
      { topic: "Oftalmologia", weight: 3 },
      { topic: "Terapia Intensiva", weight: 5 },
      { topic: "Oncologia", weight: 4 },
      { topic: "Angiologia", weight: 2 },
      { topic: "Urologia", weight: 2 },
      { topic: "Otorrinolaringologia", weight: 2 },
    ],
  },
  UNIFESP: {
    name: "UNIFESP",
    totalQuestions: 100,
    timeMinutes: 300,
    cutoffEstimate: 65,
    difficultyMix: { easy: 25, medium: 50, hard: 25 },
    topicWeights: [
      { topic: "Clínica Médica", weight: 20, subtopics: CLINICA_MEDICA_SUBTOPICS },
      { topic: "Cirurgia", weight: 18 },
      { topic: "Pediatria", weight: 12 },
      { topic: "Ginecologia e Obstetrícia", weight: 12 },
      { topic: "Medicina Preventiva", weight: 8 },
      { topic: "Medicina de Emergência", weight: 8 },
      { topic: "Psiquiatria", weight: 5 },
      { topic: "Terapia Intensiva", weight: 5 },
      { topic: "Ortopedia", weight: 4 },
      { topic: "Oncologia", weight: 3 },
      { topic: "Angiologia", weight: 2 },
      { topic: "Urologia", weight: 2 },
      { topic: "Oftalmologia", weight: 1 },
    ],
  },
  "SUS-SP": {
    name: "SUS-SP",
    totalQuestions: 100,
    timeMinutes: 300,
    cutoffEstimate: 60,
    difficultyMix: { easy: 30, medium: 50, hard: 20 },
    topicWeights: [
      { topic: "Clínica Médica", weight: 22, subtopics: CLINICA_MEDICA_SUBTOPICS },
      { topic: "Cirurgia", weight: 12 },
      { topic: "Pediatria", weight: 12 },
      { topic: "Ginecologia e Obstetrícia", weight: 12 },
      { topic: "Medicina Preventiva", weight: 12 },
      { topic: "Medicina de Emergência", weight: 8 },
      { topic: "Psiquiatria", weight: 5 },
      { topic: "Terapia Intensiva", weight: 4 },
      { topic: "Ortopedia", weight: 3 },
      { topic: "Oncologia", weight: 3 },
      { topic: "Angiologia", weight: 2 },
      { topic: "Urologia", weight: 2 },
      { topic: "Oftalmologia", weight: 2 },
      { topic: "Otorrinolaringologia", weight: 1 },
    ],
  },
  REVALIDA: {
    name: "REVALIDA",
    totalQuestions: 100,
    timeMinutes: 300,
    cutoffEstimate: 55,
    difficultyMix: { easy: 30, medium: 50, hard: 20 },
    topicWeights: [
      { topic: "Clínica Médica", weight: 20, subtopics: CLINICA_MEDICA_SUBTOPICS },
      { topic: "Cirurgia", weight: 12 },
      { topic: "Pediatria", weight: 12 },
      { topic: "Ginecologia e Obstetrícia", weight: 12 },
      { topic: "Medicina Preventiva", weight: 12 },
      { topic: "Medicina de Emergência", weight: 8 },
      { topic: "Psiquiatria", weight: 5 },
      { topic: "Terapia Intensiva", weight: 4 },
      { topic: "Ortopedia", weight: 4 },
      { topic: "Oncologia", weight: 3 },
      { topic: "Angiologia", weight: 3 },
      { topic: "Urologia", weight: 2 },
      { topic: "Oftalmologia", weight: 2 },
      { topic: "Otorrinolaringologia", weight: 1 },
    ],
  },
  GERAL: {
    name: "Prova Geral",
    totalQuestions: 100,
    timeMinutes: 300,
    cutoffEstimate: 60,
    difficultyMix: { easy: 30, medium: 50, hard: 20 },
    topicWeights: [
      { topic: "Clínica Médica", weight: 20, subtopics: CLINICA_MEDICA_SUBTOPICS },
      { topic: "Cirurgia", weight: 15 },
      { topic: "Pediatria", weight: 12 },
      { topic: "Ginecologia e Obstetrícia", weight: 12 },
      { topic: "Medicina Preventiva", weight: 10 },
      { topic: "Medicina de Emergência", weight: 8 },
      { topic: "Terapia Intensiva", weight: 5 },
      { topic: "Ortopedia", weight: 4 },
      { topic: "Oncologia", weight: 4 },
      { topic: "Angiologia", weight: 3 },
      { topic: "Urologia", weight: 3 },
      { topic: "Oftalmologia", weight: 2 },
      { topic: "Otorrinolaringologia", weight: 2 },
    ],
  },
};

/**
 * Resultado da prévia visual da distribuição de temas.
 *
 * Os campos `topic` e `count` são os mesmos do retorno antigo — totalmente
 * compatíveis com consumidores existentes (ex.: `Simulados.tsx`).
 *
 * Os campos novos (`percent` e `subtopics`) são apenas para a UI e podem ser
 * ignorados sem efeito colateral.
 */
export interface TopicDistributionItem {
  topic: string;
  count: number;
  /** Percentual do tema dentro da prova (0–100), arredondado. */
  percent: number;
  /**
   * Quebra opcional em subáreas, presente apenas quando o perfil definir
   * `subtopics` para o tema. Apenas informativa — NÃO usada pelo gerador.
   */
  subtopics?: { name: string; count: number; percent: number }[];
}

/**
 * Calcula quantas questões de cada tema gerar, proporcional ao total solicitado.
 *
 * Quando o tema tiver `subtopics` definidos no perfil, o resultado também
 * inclui a quebra proporcional em subáreas (com `count` e `percent` próprios).
 * Essa quebra é apenas informativa para a UI e NÃO altera o gerador atual.
 */
export function calculateTopicDistribution(
  profile: ExamProfile,
  totalQuestions: number
): TopicDistributionItem[] {
  const raw = profile.topicWeights.map(tw => ({
    topic: tw.topic,
    count: Math.round((tw.weight / 100) * totalQuestions),
    subtopicsSrc: tw.subtopics,
  }));

  // Ajusta para total exato
  const sum = raw.reduce((s, r) => s + r.count, 0);
  const diff = totalQuestions - sum;
  if (diff !== 0 && raw.length > 0) {
    // Distribui sobra/falta no maior
    raw.sort((a, b) => b.count - a.count);
    raw[0].count += diff;
  }

  return raw
    .filter(r => r.count > 0)
    .map<TopicDistributionItem>(r => {
      const percent = Math.round((r.count / totalQuestions) * 100);
      let subtopics: TopicDistributionItem["subtopics"];

      if (r.subtopicsSrc && r.subtopicsSrc.length > 0 && r.count > 0) {
        const subRaw = r.subtopicsSrc.map(s => ({
          name: s.name,
          count: Math.round((s.weight / 100) * r.count),
        }));
        // Garante que a soma dos subtopics bata com o count do tema
        const subSum = subRaw.reduce((s, x) => s + x.count, 0);
        const subDiff = r.count - subSum;
        if (subDiff !== 0 && subRaw.length > 0) {
          subRaw.sort((a, b) => b.count - a.count);
          subRaw[0].count += subDiff;
        }
        subtopics = subRaw
          .filter(s => s.count > 0)
          .map(s => ({
            name: s.name,
            count: s.count,
            percent: Math.round((s.count / totalQuestions) * 100),
          }));
      }

      return { topic: r.topic, count: r.count, percent, subtopics };
    });
}

/**
 * Calcula distribuição de dificuldade com base no perfil.
 */
export function calculateDifficultySlots(
  profile: ExamProfile,
  totalQuestions: number
): { easy: number; medium: number; hard: number } {
  const easy = Math.round((profile.difficultyMix.easy / 100) * totalQuestions);
  const hard = Math.round((profile.difficultyMix.hard / 100) * totalQuestions);
  const medium = totalQuestions - easy - hard;
  return { easy, medium, hard };
}

/**
 * Estima percentil do aluno com base na nota e nota de corte.
 * Modelo simplificado usando distribuição normal.
 */
export function estimatePercentile(score: number, cutoff: number): number {
  // Média estimada dos candidatos: cutoff + 5%
  const mean = cutoff + 5;
  // Desvio padrão estimado: ~15%
  const std = 15;
  // Z-score
  const z = (score - mean) / std;
  // Aproximação da CDF normal (Abramowitz & Stegun)
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  const cdf = z > 0 ? 1 - p : p;
  return Math.min(99, Math.max(1, Math.round(cdf * 100)));
}

/**
 * Calcula nota estimada na escala da banca.
 */
export function estimateGrade(score: number, cutoff: number): {
  grade: string;
  label: string;
  approved: boolean;
  message: string;
} {
  const diff = score - cutoff;
  if (score >= cutoff + 15) {
    return { grade: "A+", label: "Excelente", approved: true, message: "Desempenho muito acima da nota de corte. Aprovação com folga." };
  }
  if (score >= cutoff + 5) {
    return { grade: "A", label: "Muito bom", approved: true, message: "Desempenho acima da nota de corte. Boa chance de aprovação." };
  }
  if (score >= cutoff) {
    return { grade: "B", label: "Aprovado na margem", approved: true, message: "Desempenho próximo à nota de corte. Aprovação possível, mas margem estreita." };
  }
  if (score >= cutoff - 5) {
    return { grade: "C", label: "Abaixo do corte", approved: false, message: "Muito próximo da nota de corte. Foco nas áreas fracas pode virar o jogo." };
  }
  if (score >= cutoff - 15) {
    return { grade: "D", label: "Precisa melhorar", approved: false, message: "Abaixo da nota de corte. Intensifique os estudos nas áreas críticas." };
  }
  return { grade: "F", label: "Insuficiente", approved: false, message: "Desempenho muito abaixo da nota de corte. Revisão completa necessária." };
}
