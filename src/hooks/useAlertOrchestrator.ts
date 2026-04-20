/**
 * useAlertOrchestrator — fonte única de decisão de avisos
 * ────────────────────────────────────────────────────────
 * Consolida sinais de Approval Engine, Study Engine, Coverage, FSRS, Exam Date
 * e Inatividade num único modelo de alertas com:
 *   - prioridade (critical / important / contextual / informational)
 *   - camada (structural / contextual / ephemeral / deep)
 *   - dedupe via `dedupeKey`
 *   - caps por camada (structural ≤ 2, contextual ≤ 2, deep ≤ 1)
 *   - supressão cruzada (deep não abre se houver critical estrutural;
 *     min-mission cai para contextual quando há critical estrutural)
 *
 * Uso típico em um banner/card:
 *   const { getDecision } = useAlertOrchestrator();
 *   const decision = getDecision("exam-date");
 *   if (!decision.visible) return null;
 *
 * Toasts (camada `ephemeral`) NÃO são gerados por este hook nesta sprint —
 * `useRevisionNotifier`, `useMessageDelivery`, Toaster e Sonner permanecem
 * intactos. Use `getDecision("achievement")` / `getDecision("onboarding-popup")`
 * para gating futuro de toasts/popups.
 */
import { useMemo } from "react";
import {
  type AlertOrchestratorItem,
  type AlertSource,
  type AlertDecision,
  type AlertLayer,
  PRIORITY_RANK,
  LAYER_CAPS,
} from "@/types/alertOrchestrator";
import { buildCandidateAlerts, isExamDateSnoozed } from "@/lib/alertRules";
import { useApprovalPrediction } from "./useApprovalPrediction";
import { useCoreData } from "./useCoreData";
import { useStudyEngine } from "./useStudyEngine";
import { useStudyEngineImpact } from "./useStudyEngineImpact";
import { useFsrsDueCount } from "./useFsrsDueCount";
import { useAlertAnalytics } from "./useAlertAnalytics";
import { useFeatureFlags } from "./useFeatureFlags";
import { buildAdjustmentMap } from "@/lib/alertAdaptiveRanking";
import { shiftPriority } from "@/lib/alertPriorityUtils";

export interface AlertOrchestratorResult {
  structuralAlerts: AlertOrchestratorItem[];
  contextualAlerts: AlertOrchestratorItem[];
  ephemeralAlerts: AlertOrchestratorItem[];
  deepAlerts: AlertOrchestratorItem[];
  allAlerts: AlertOrchestratorItem[];
  /** Decisão para um `source` específico (usada por componentes individuais). */
  getDecision: (source: AlertSource) => AlertDecision;
}

export function useAlertOrchestrator(): AlertOrchestratorResult {
  const prediction = useApprovalPrediction();
  const { data: core } = useCoreData();
  const { adaptive } = useStudyEngine();
  const { data: impact } = useStudyEngineImpact();
  const { totalDue } = useFsrsDueCount();
  const { isEnabled } = useFeatureFlags();
  const adaptiveEnabled = isEnabled("alert_adaptive_ranking_enabled");
  // Janela curta (7d) para reagir rapidamente; só consulta se a flag estiver on.
  const analytics = useAlertAnalytics({
    windowDays: 7,
    scopeToCurrentUser: true,
  });

  return useMemo(() => {
    // 1) Snapshot consolidado para regras puras
    const candidates = buildCandidateAlerts({
      examDateMissing: !!core && !core.profile.exam_date,
      examDateSnoozed: isExamDateSnoozed(),
      approval: prediction
        ? {
            riskLevel: prediction.riskLevel,
            trend: prediction.trend,
            delta: prediction.delta,
            score: prediction.score,
            hasEnoughData: prediction.hasEnoughData,
          }
        : null,
      requiredCoveragePct: impact?.requiredCoveragePct ?? 100,
      recoveryActive: !!adaptive?.recoveryMode,
      recoveryHeavyActive: !!adaptive?.heavyRecovery?.active,
      recoveryReason: adaptive?.recoveryReason ?? null,
      fsrsDue: totalDue ?? 0,
      questions7d: impact?.questions7d ?? 0,
      tasksCompleted7d: impact?.tasksCompleted7d ?? 0,
      tasksCreated7d: impact?.tasksCreated7d ?? 0,
    });

    // 2) Dedupe por `dedupeKey` — mantém o de maior prioridade;
    //    em empate, prefere structural.
    const byKey = new Map<string, AlertOrchestratorItem[]>();
    const noKey: AlertOrchestratorItem[] = [];
    for (const c of candidates) {
      if (!c.dedupeKey) {
        noKey.push(c);
        continue;
      }
      const arr = byKey.get(c.dedupeKey) ?? [];
      arr.push(c);
      byKey.set(c.dedupeKey, arr);
    }

    const deduped: AlertOrchestratorItem[] = [...noKey];
    const suppressedByDedupe: AlertOrchestratorItem[] = [];
    for (const [, group] of byKey) {
      if (group.length === 1) {
        deduped.push(group[0]);
        continue;
      }
      const sorted = [...group].sort((a, b) => {
        const dp = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
        if (dp !== 0) return dp;
        if (a.layer === "structural" && b.layer !== "structural") return -1;
        if (b.layer === "structural" && a.layer !== "structural") return 1;
        return 0;
      });
      const winner = sorted[0];
      deduped.push(winner);
      for (const loser of sorted.slice(1)) {
        suppressedByDedupe.push({
          ...loser,
          visible: false,
          suppressedBy: `dedupe:${winner.id}`,
        });
      }
    }

    // 2.5) ADAPTIVE RANKING (Fase 5) — ajusta prioridade com base em
    //      performance histórica (CTR, fadiga, resolução). 100% defensivo:
    //      só atua se a feature flag estiver ON e a fonte tiver delta != 0.
    //      Pisos de segurança em `applySafetyFloor` impedem rebaixamento
    //      excessivo de exam-date / approval-risk / recovery / fsrs-backlog.
    const adjustmentMap = adaptiveEnabled
      ? buildAdjustmentMap(analytics.bySource)
      : new Map<string, { delta: number; reason: string; clamped: boolean }>();

    const adaptive_applied = deduped.map((a) => {
      const adj = adjustmentMap.get(String(a.source));
      if (!adj || adj.delta === 0) return a;
      const newPriority = shiftPriority(a.priority, adj.delta);
      if (newPriority === a.priority) return a;
      return {
        ...a,
        priority: newPriority,
        metadata: {
          ...(a.metadata ?? {}),
          adaptiveDelta: adj.delta,
          adaptiveReason: adj.reason,
          adaptivePriorityFrom: a.priority,
        },
      };
    });

    // 3) Supressão cruzada: se há qualquer critical estrutural,
    //    rebaixa min-mission de contextual→contextual (já é) e mantém,
    //    mas garante que NUNCA suba para structural. Também marca
    //    deep como suprimido.
    const hasCriticalStructural = adaptive_applied.some(
      (a) => a.priority === "critical" && a.layer === "structural"
    );

    const adjusted = adaptive_applied.map((a) => {
      // min-mission nunca é structural; já entra como contextual.
      // Aqui apenas reforçamos o invariante.
      if (a.source === "min-mission" && hasCriticalStructural) {
        return {
          ...a,
          layer: "contextual" as AlertLayer,
          priority: "contextual" as const,
        };
      }
      return a;
    });

    // 4) Caps por camada — ordena por prioridade (desc) e aplica cap.
    const orderByPriority = (
      a: AlertOrchestratorItem,
      b: AlertOrchestratorItem
    ) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];

    const byLayer = (layer: AlertLayer) =>
      adjusted.filter((a) => a.layer === layer).sort(orderByPriority);

    const finalize = (
      items: AlertOrchestratorItem[],
      cap: number
    ): { kept: AlertOrchestratorItem[]; capped: AlertOrchestratorItem[] } => {
      if (cap === Infinity || items.length <= cap) {
        return { kept: items, capped: [] };
      }
      return {
        kept: items.slice(0, cap),
        capped: items.slice(cap).map((a) => ({
          ...a,
          visible: false,
          suppressedBy: `${a.layer}-cap`,
        })),
      };
    };

    const structural = finalize(byLayer("structural"), LAYER_CAPS.structural);
    const contextual = finalize(byLayer("contextual"), LAYER_CAPS.contextual);
    const ephemeral = finalize(byLayer("ephemeral"), LAYER_CAPS.ephemeral);
    const deepRaw = byLayer("deep");
    // Deep só abre se NÃO houver critical estrutural visível
    const deepVisible = hasCriticalStructural ? [] : deepRaw;
    const deepSuppressed = hasCriticalStructural
      ? deepRaw.map((a) => ({
          ...a,
          visible: false,
          suppressedBy: "critical-structural-active",
        }))
      : [];
    const deep = finalize(deepVisible, LAYER_CAPS.deep);

    const all: AlertOrchestratorItem[] = [
      ...structural.kept,
      ...structural.capped,
      ...contextual.kept,
      ...contextual.capped,
      ...ephemeral.kept,
      ...ephemeral.capped,
      ...deep.kept,
      ...deep.capped,
      ...deepSuppressed,
      ...suppressedByDedupe,
    ];

    const getDecision = (source: AlertSource): AlertDecision => {
      // Alertas implícitos não-emitidos (achievement / onboarding-popup):
      // tratamos como gating — só "visível" se não houver critical estrutural.
      if (source === "achievement" || source === "onboarding-popup") {
        if (hasCriticalStructural) {
          return {
            visible: false,
            priority: "informational",
            layer: source === "achievement" ? "ephemeral" : "deep",
            suppressedBy: "critical-structural-active",
          };
        }
        return {
          visible: true,
          priority: "informational",
          layer: source === "achievement" ? "ephemeral" : "deep",
        };
      }

      const matches = all.filter((a) => a.source === source);
      if (matches.length === 0) {
        return { visible: false, priority: null, layer: null };
      }
      // Preferimos o item visível; senão, o mais "alto" suprimido.
      const visibleHit = matches.find((a) => a.visible);
      if (visibleHit) {
        return {
          visible: true,
          priority: visibleHit.priority,
          layer: visibleHit.layer,
        };
      }
      const top = [...matches].sort(orderByPriority)[0];
      return {
        visible: false,
        priority: top.priority,
        layer: top.layer,
        suppressedBy: top.suppressedBy,
      };
    };

    return {
      structuralAlerts: structural.kept,
      contextualAlerts: contextual.kept,
      ephemeralAlerts: ephemeral.kept,
      deepAlerts: deep.kept,
      allAlerts: all,
      getDecision,
    };
  }, [prediction, core, adaptive, impact, totalDue]);
}
