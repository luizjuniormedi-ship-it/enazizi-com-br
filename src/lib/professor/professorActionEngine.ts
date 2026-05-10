/**
 * professorActionEngine
 * Motor determinístico (sem LLM) que mapeia um StudentCognitiveRisk
 * em uma ação operacional sugerida ao professor.
 */

export interface StudentCognitiveRisk {
  user_id: string;
  display_name: string;
  risk_score: number;
  risk_level: "low" | "warning" | "critical";
  burnout_risk: "low" | "moderate" | "high";
  overload_score: number;
  avg_stability: number | null;
  avg_lapses: number | null;
  retention_score: number | null;
  theta_proxy: number | null;
  inactive_days: number;
  ignored_reviews: number;
  weak_specialty: string | null;
  suggested_action:
    | "recovery"
    | "reduce_load"
    | "mentoria"
    | "simulado_adaptativo"
    | "revisao_fsrs"
    | "monitorar";
  justification: string;
}

export type ProfessorActionType =
  | "assign_recovery"
  | "reduce_load"
  | "open_mentory"
  | "assign_fsrs_review"
  | "assign_adaptive_simulado"
  | "monitor";

export interface ProfessorAction {
  id: string;
  label: string;
  action_type: ProfessorActionType;
  severity: "low" | "medium" | "high" | "critical";
  justification: string;
  suggested_payload: Record<string, any>;
}

export function computeProfessorAction(r: StudentCognitiveRisk): ProfessorAction {
  const lapses = r.avg_lapses ?? 0;
  const ret = r.retention_score ?? 100;
  const sevFromRisk = r.risk_level === "critical" ? "critical" : r.risk_level === "warning" ? "high" : "low";

  if (lapses >= 2 && ret < 70) {
    return {
      id: `act_fsrs_${r.user_id}`,
      label: "Atribuir revisão FSRS",
      action_type: "assign_fsrs_review",
      severity: "high",
      justification: `Lapses ${lapses.toFixed(1)} e retenção ${ret}%. Reforço espaçado recomendado.`,
      suggested_payload: { focus: "fsrs_review", target_specialty: r.weak_specialty },
    };
  }
  if (r.weak_specialty && r.risk_level !== "low") {
    return {
      id: `act_recovery_${r.user_id}`,
      label: "Atribuir recovery dirigido",
      action_type: "assign_recovery",
      severity: sevFromRisk,
      justification: `Erros concentrados em ${r.weak_specialty}.`,
      suggested_payload: { specialty: r.weak_specialty, focus: "recovery" },
    };
  }
  if (r.overload_score > 30 && r.burnout_risk !== "low") {
    return {
      id: `act_reduce_${r.user_id}`,
      label: "Reduzir carga",
      action_type: "reduce_load",
      severity: r.burnout_risk === "high" ? "critical" : "high",
      justification: `Sobrecarga (${r.overload_score}) com burnout ${r.burnout_risk}.`,
      suggested_payload: { reduce_factor: 0.5 },
    };
  }
  if (r.inactive_days >= 5) {
    return {
      id: `act_mentory_${r.user_id}`,
      label: "Abrir mentoria",
      action_type: "open_mentory",
      severity: r.inactive_days >= 14 ? "critical" : "high",
      justification: `Inativo há ${r.inactive_days} dias.`,
      suggested_payload: { reason: "inactivity" },
    };
  }
  if (r.suggested_action === "simulado_adaptativo") {
    return {
      id: `act_sim_${r.user_id}`,
      label: "Atribuir simulado adaptativo",
      action_type: "assign_adaptive_simulado",
      severity: "medium",
      justification: r.justification,
      suggested_payload: { specialty: r.weak_specialty },
    };
  }
  return {
    id: `act_mon_${r.user_id}`,
    label: "Monitorar",
    action_type: "monitor",
    severity: "low",
    justification: "Sem sinais críticos no momento.",
    suggested_payload: {},
  };
}
