/**
 * useInterventionEngine — Next Best Action (V1 determinística)
 * ─────────────────────────────────────────────────────────────
 * Decide UMA ação prioritária a executar agora, com base nos dados já
 * existentes (sem novas queries, sem IA). Reutiliza:
 *   - useApprovalPrediction
 *   - useStudyEngineImpact
 *   - useFsrsDueCount
 *
 * Princípios:
 *   - Pura: dada a entrada, sempre devolve a mesma saída
 *   - Defensiva: retorna `null` se inputs ainda estão carregando
 *   - Não compete com o Alert Orchestrator (não emite alertas)
 *   - Apenas SUGERE a próxima ação concreta com 1-clique
 */
import { useMemo } from "react";
import { useApprovalPrediction } from "./useApprovalPrediction";
import { useStudyEngineImpact } from "./useStudyEngineImpact";
import { useFsrsDueCount } from "./useFsrsDueCount";

export type InterventionType =
  | "min-mission"
  | "fsrs"
  | "recovery"
  | "coverage"
  | "default";

export interface InterventionAction {
  type: InterventionType;
  title: string;
  description: string;
  ctaLabel: string;
  /** Rota destino — usada pelo componente para navegação. */
  href: string;
  /** Prioridade interna (apenas para telemetria/ordenação futura). */
  weight: number;
}

interface InterventionInputs {
  questions7d: number | null;
  totalDue: number | null;
  riskLevel: "high" | "medium" | "low" | null;
  requiredCoveragePct: number | null;
  ready: boolean;
}

/**
 * Pura — pode ser testada sem React.
 * Retorna `null` se os dados ainda não estiverem prontos.
 */
export function getNextBestAction(
  i: InterventionInputs
): InterventionAction | null {
  if (!i.ready) return null;

  const questions7d = i.questions7d ?? 0;
  const totalDue = i.totalDue ?? 0;
  const requiredCoveragePct = i.requiredCoveragePct ?? 100;

  // 1) 🚨 Inatividade — maior prioridade
  if (questions7d === 0) {
    return {
      type: "min-mission",
      title: "Missão destrava",
      description: "Vamos destravar com 10 questões + 1 revisão",
      ctaLabel: "Começar agora",
      href: "/banco-questoes?mode=quick10",
      weight: 100,
    };
  }

  // 2) 📚 FSRS backlog alto
  if (totalDue > 50) {
    return {
      type: "fsrs",
      title: "Revisões pendentes",
      description: `Você tem ${totalDue} revisões críticas`,
      ctaLabel: "Revisar agora",
      href: "/flashcards",
      weight: 80,
    };
  }

  // 3) 📉 Risco alto de reprovação
  if (i.riskLevel === "high") {
    return {
      type: "recovery",
      title: "Modo recuperação",
      description: "Foque em prática para recuperar desempenho",
      ctaLabel: "Fazer 10 questões",
      href: "/banco-questoes?mode=quick10",
      weight: 70,
    };
  }

  // 4) 🔥 Cobertura baixa
  if (requiredCoveragePct < 50) {
    return {
      type: "coverage",
      title: "Cobertura insuficiente",
      description: "Você precisa avançar nos conteúdos obrigatórios",
      ctaLabel: "Continuar plano",
      href: "/cronograma",
      weight: 50,
    };
  }

  // 5) 🟢 Default — usuário bem
  return {
    type: "default",
    title: "Continue evoluindo",
    description: "Vamos manter o ritmo com prática",
    ctaLabel: "Fazer questões",
    href: "/banco-questoes",
    weight: 10,
  };
}

export function useInterventionEngine(): InterventionAction | null {
  const prediction = useApprovalPrediction();
  const { data: impact } = useStudyEngineImpact();
  const { totalDue, isLoading: fsrsLoading } = useFsrsDueCount();

  return useMemo(() => {
    // Aguarda inputs mínimos antes de decidir (defensivo).
    const ready = !!impact && !fsrsLoading;
    return getNextBestAction({
      questions7d: impact?.questions7d ?? null,
      totalDue: totalDue ?? null,
      riskLevel: prediction?.riskLevel ?? null,
      requiredCoveragePct: impact?.requiredCoveragePct ?? null,
      ready,
    });
  }, [
    impact,
    totalDue,
    fsrsLoading,
    prediction?.riskLevel,
  ]);
}
