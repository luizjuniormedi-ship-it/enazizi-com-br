
export type TutorBlockId = 
  | "BLOCO_1_MISSAO_CLINICA"
  | "BLOCO_2_MAPA_DA_AULA"
  | "BLOCO_3_EXPLICACAO_LEIGA"
  | "BLOCO_4_FISIOPATOLOGIA_TECNICA"
  | "BLOCO_5_RACIOCINIO_CLINICO"
  | "BLOCO_6_CONDUTA"
  | "BLOCO_7_ACTIVE_RECALL"
  | "BLOCO_8_QUESTAO_ESTILO_PROVA"
  | "BLOCO_9_RESUMO_ALTA_RETENCAO";

export interface TutorBlock {
  id: TutorBlockId;
  title: string;
  objective: string;
}

export const PEDAGOGICAL_BLOCKS: Record<TutorBlockId, TutorBlock> = {
  BLOCO_1_MISSAO_CLINICA: {
    id: "BLOCO_1_MISSAO_CLINICA",
    title: "Missão Clínica",
    objective: "Apresentar por que o tema importa, caso clínico curto, gancho de prova e pergunta de entrada."
  },
  BLOCO_2_MAPA_DA_AULA: {
    id: "BLOCO_2_MAPA_DA_AULA",
    title: "Mapa da Aula",
    objective: "Mostrar o caminho do aprendizado, listar etapas e dizer o que o aluno vai dominar."
  },
  BLOCO_3_EXPLICACAO_LEIGA: {
    id: "BLOCO_3_EXPLICACAO_LEIGA",
    title: "Explicação Leiga",
    objective: "Explicar de forma simples, usando analogias e intuição."
  },
  BLOCO_4_FISIOPATOLOGIA_TECNICA: {
    id: "BLOCO_4_FISIOPATOLOGIA_TECNICA",
    title: "Fisiopatologia Técnica",
    objective: "Mecanismo, cascata, base molecular/celular quando relevante."
  },
  BLOCO_5_RACIOCINIO_CLINICO: {
    id: "BLOCO_5_RACIOCINIO_CLINICO",
    title: "Raciocínio Clínico",
    objective: "Sinais, sintomas, exames e diagnóstico diferencial."
  },
  BLOCO_6_CONDUTA: {
    id: "BLOCO_6_CONDUTA",
    title: "Conduta",
    objective: "Abordagem inicial, tratamento, priorização e erros comuns."
  },
  BLOCO_7_ACTIVE_RECALL: {
    id: "BLOCO_7_ACTIVE_RECALL",
    title: "Active Recall",
    objective: "Perguntas de recuperação para checar retenção."
  },
  BLOCO_8_QUESTAO_ESTILO_PROVA: {
    id: "BLOCO_8_QUESTAO_ESTILO_PROVA",
    title: "Questão Estilo Prova",
    objective: "Caso clínico com alternativas e correção comentada."
  },
  BLOCO_9_RESUMO_ALTA_RETENCAO: {
    id: "BLOCO_9_RESUMO_ALTA_RETENCAO",
    title: "Resumo de Alta Retenção",
    objective: "Resumo final, mapa mental, mnemônico e pontos de prova."
  }
};

export const BLOCK_SEQUENCE: TutorBlockId[] = [
  "BLOCO_1_MISSAO_CLINICA",
  "BLOCO_2_MAPA_DA_AULA",
  "BLOCO_3_EXPLICACAO_LEIGA",
  "BLOCO_4_FISIOPATOLOGIA_TECNICA",
  "BLOCO_5_RACIOCINIO_CLINICO",
  "BLOCO_6_CONDUTA",
  "BLOCO_7_ACTIVE_RECALL",
  "BLOCO_8_QUESTAO_ESTILO_PROVA",
  "BLOCO_9_RESUMO_ALTA_RETENCAO"
];

export function getInitialBlock(): TutorBlockId {
  return "BLOCO_1_MISSAO_CLINICA";
}

export function getNextBlock(currentBlock: TutorBlockId): TutorBlockId {
  const currentIndex = BLOCK_SEQUENCE.indexOf(currentBlock);
  if (currentIndex === -1 || currentIndex === BLOCK_SEQUENCE.length - 1) {
    return currentBlock;
  }
  return BLOCK_SEQUENCE[currentIndex + 1];
}

export type StudentIntent = 
  | "new_topic"
  | "answer_question"
  | "continue"
  | "doubt"
  | "shortcut_summary"
  | "other";

export function classifyStudentIntent(message: string): StudentIntent {
  const msg = message.toLowerCase().trim();
  
  if (msg.length === 0) return "continue";
  
  const continueKeywords = ["continue", "próximo", "prosseguir", "vamos", "ok", "adiante", "next"];
  if (continueKeywords.some(k => msg.includes(k)) && msg.length < 15) {
    return "continue";
  }
  
  const doubtKeywords = ["não entendi", "dúvida", "como assim", "explica melhor", "por que", "quê", "?", "pode repetir"];
  if (doubtKeywords.some(k => msg.includes(k))) {
    return "doubt";
  }
  
  const summaryKeywords = ["resumo", "resumir", "direto ao ponto", "final"];
  if (summaryKeywords.some(k => msg.includes(k)) && msg.length < 25) {
    return "shortcut_summary";
  }

  // Se a mensagem parece uma resposta curta ou contém opções de múltipla escolha
  if (msg.length < 50 || /^[a-e]\b/.test(msg)) {
    return "answer_question";
  }

  return "other";
}

export function decideTutorStep(
  currentBlock: TutorBlockId, 
  intent: StudentIntent
): { nextBlock: TutorBlockId; stayInBlock: boolean } {
  
  if (intent === "new_topic") {
    return { nextBlock: "BLOCO_1_MISSAO_CLINICA", stayInBlock: false };
  }

  if (intent === "doubt") {
    return { nextBlock: currentBlock, stayInBlock: true };
  }

  if (intent === "shortcut_summary") {
    return { nextBlock: "BLOCO_9_RESUMO_ALTA_RETENCAO", stayInBlock: false };
  }

  if (intent === "continue" || intent === "answer_question") {
    return { nextBlock: getNextBlock(currentBlock), stayInBlock: false };
  }

  // Default: advance if not a doubt
  return { nextBlock: getNextBlock(currentBlock), stayInBlock: false };
}
