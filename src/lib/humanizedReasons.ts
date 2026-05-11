import type { StudyRecommendation } from "@/lib/studyEngine";

/**
 * Maps internal engine reasons to simple, human-readable explanations.
 * Max 120 chars, always pt-BR, never exposes technical logic.
 */

const TYPE_REASONS: Record<string, string> = {
  review: "Esse é o momento ideal de revisar para não esquecer.",
  error_review: "Você errou esse tema recentemente. Vamos corrigir isso.",
  practice: "Sua acurácia está baixa nesse tema. É um ponto importante para prova.",
  clinical: "Hora de treinar na prática — casos clínicos consolidam o conhecimento.",
  new: "Novo conteúdo recomendado pelo sistema para expandir sua base.",
  simulado: "Simulados ajudam a medir seu preparo real para a prova.",
  chronicle: "Aprofunde com uma crônica médica imersiva.",
};

const OBJECTIVE_REASONS: Record<string, string> = {
  review: "Revisão programada para fixar o conteúdo na memória de longo prazo.",
  correction: "Reforço direcionado para corrigir um ponto fraco identificado.",
  reinforcement: "Tema com baixa acurácia — reforço para melhorar seu desempenho.",
  new_content: "Novo conteúdo selecionado para avançar no seu plano de estudos.",
  practice: "Prática focada para consolidar o que você já estudou.",
};

/**
 * Returns a short, student-friendly explanation of why this task was chosen.
 * Never exposes internal scores, weights, or technical details.
 */
export function getHumanReadableReason(task: StudyRecommendation): string {
  // 0. Process raw technical FSRS reason strings (Safety layer)
  if (task.reason?.startsWith("FSRS:") || task.reason?.includes("lapsos:") || task.reason?.includes("Estabilidade:")) {
    if (task.priority >= 90) return "Revisão crítica — revisar agora evita que você esqueça o conteúdo.";
    if (task.priority >= 70) return "Seu cérebro está prestes a esquecer esse tema. Vamos revisar?";
    return "Hora de fortalecer sua base com uma revisão rápida.";
  }

  // 1. Check for overdue review signals in the raw reason
  if (task.type === "review" && (task.priority >= 90 || task.reason?.includes("atrasada"))) {
    return "Revisão atrasada — revisar agora evita que você esqueça o conteúdo.";
  }

  // 2. Critical error pattern
  if (task.type === "error_review" && task.priority >= 85) {
    return "Tema com muitos erros acumulados. Corrigir agora é prioridade.";
  }

  // 3. Practice gap (clinical with high priority)
  if (task.type === "clinical" && task.priority >= 75) {
    return "Seu desempenho teórico está bom, mas falta prática clínica.";
  }

  // 4. Low accuracy weak topic
  if (task.type === "practice" && task.reason?.includes("Acerto de")) {
    const match = task.reason.match(/(\d+)%/);
    if (match) {
      const pct = parseInt(match[1]);
      if (pct < 40) return "Acurácia muito baixa nesse tema. Reforço urgente.";
      if (pct < 60) return "Sua acurácia nesse tema precisa melhorar antes da prova.";
    }
  }

  // 5. Objective-based
  if (task.objective && OBJECTIVE_REASONS[task.objective]) {
    return OBJECTIVE_REASONS[task.objective];
  }

  // 6. Type-based fallback
  if (TYPE_REASONS[task.type]) {
    return TYPE_REASONS[task.type];
  }

  // 7. Final fallback
  return "Vamos reforçar esse tema para melhorar sua base.";
}
