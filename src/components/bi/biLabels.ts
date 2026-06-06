/**
 * Dicionário central de rótulos pt-BR + tooltips para o BI.
 * Garante consistência entre dashboards de aluno e professor.
 */
export const BI_LABELS = {
  // Aluno
  readiness: {
    label: "Índice de Prontidão",
    tooltip:
      "Escala 0–100. Combina seu acerto recente, cobertura curricular, retenção FSRS e desempenho em simulados para estimar o quanto você está pronto para a prova alvo.",
  },
  approvalChance: {
    label: "Chance Estimada de Aprovação",
    tooltip:
      "Projeção bayesiana comparando seu histórico ao de aprovados anteriores na mesma banca (ENARE/ENAMED). Atualiza diariamente.",
  },
  accuracy7d: {
    label: "Acerto (7 dias)",
    tooltip: "Percentual de questões respondidas corretamente nos últimos 7 dias.",
  },
  fsrsRetention: {
    label: "Retenção de Memória",
    tooltip:
      "Percentual de cards revisados no prazo com acerto, segundo o algoritmo FSRS de repetição espaçada.",
  },
  pace: {
    label: "Ritmo Médio",
    tooltip:
      "Tempo médio em segundos para responder uma questão, comparado ao tempo disponível por questão na prova real.",
  },
  lapses: {
    label: "Esquecimentos",
    tooltip:
      "Quantidade de cards que você já havia dominado e voltou a errar. Indicador de revisão urgente.",
  },
  streak: {
    label: "Sequência de Estudos",
    tooltip: "Dias consecutivos com pelo menos uma atividade significativa concluída.",
  },
  level: {
    label: "Nível",
    tooltip: "Nível de gamificação baseado em XP acumulado por estudo, acertos e revisões.",
  },

  // Professor
  classSize: {
    label: "Alunos na Turma",
    tooltip: "Total de alunos matriculados nesta turma.",
  },
  classReadiness: {
    label: "Prontidão Média da Turma",
    tooltip: "Média do Índice de Prontidão (0–100) de todos os alunos ativos da turma.",
  },
  studentsActive: {
    label: "Ativos",
    tooltip: "Alunos com atividade nos últimos 3 dias e sem sinais de risco.",
  },
  studentsAttention: {
    label: "Atenção",
    tooltip:
      "Alunos com queda recente de desempenho ou redução de engajamento nos últimos 7 dias.",
  },
  studentsRisk: {
    label: "Risco",
    tooltip:
      "Alunos com inatividade > 7 dias, revisões atrasadas críticas ou queda forte de acerto.",
  },
  studentsCritical: {
    label: "Crítico",
    tooltip:
      "Alunos com risk_score ≥ 80 — inatividade prolongada, múltiplas tarefas atrasadas e prontidão baixa simultaneamente.",
  },
  interventionImpact: {
    label: "Impacto da Intervenção",
    tooltip:
      "Variação no acerto médio dos alunos comparando 7 dias antes e 7 dias depois da intervenção aplicada.",
  },
} as const;

export type BiLabelKey = keyof typeof BI_LABELS;
