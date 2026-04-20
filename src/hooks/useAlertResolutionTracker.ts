/**
 * useAlertResolutionTracker — fecha o loop alerta → ação → resultado
 * ────────────────────────────────────────────────────────────────────
 * Observa o estado real do usuário (exam_date, fsrs due, questions7d,
 * approval risk) e, quando um alerta previamente exposto deixa de ser
 * necessário, registra um evento `resolved` na tabela `alert_events`.
 *
 * Fontes monitoradas:
 *   - exam-date          → exam_date passa de null para preenchido
 *   - fsrs-backlog       → totalDue cai abaixo de 20
 *   - inactivity         → questions7d sai de 0
 *   - approval-risk      → riskLevel sai de "high"
 *
 * Dedup: usa sessionStorage para registrar 1× por sessão por source
 * (não resolver múltiplas vezes a mesma melhoria).
 *
 * Uso (1 vez no layout autenticado, junto com useAlertTelemetry):
 *   useAlertResolutionTracker();
 */
import { useEffect, useRef } from "react";
import { trackAlertEvent } from "@/lib/alertTelemetry";
import { useApprovalPrediction } from "./useApprovalPrediction";
import { useCoreData } from "./useCoreData";
import { useStudyEngineImpact } from "./useStudyEngineImpact";
import { useFsrsDueCount } from "./useFsrsDueCount";
import type {
  AlertOrchestratorItem,
  AlertSource,
} from "@/types/alertOrchestrator";

const RESOLUTION_KEY = "alert_orch_resolved_v1";

interface ResolvedCache {
  [source: string]: number; // timestamp ms
}

function readCache(): ResolvedCache {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(RESOLUTION_KEY);
    return raw ? (JSON.parse(raw) as ResolvedCache) : {};
  } catch {
    return {};
  }
}

function writeCache(cache: ResolvedCache): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(RESOLUTION_KEY, JSON.stringify(cache));
  } catch {
    /* não-fatal */
  }
}

function alreadyResolvedThisSession(source: string): boolean {
  const cache = readCache();
  return typeof cache[source] === "number";
}

function markResolved(source: string): void {
  const cache = readCache();
  cache[source] = Date.now();
  writeCache(cache);
}

function buildStub(
  source: AlertSource,
  priority: AlertOrchestratorItem["priority"],
  layer: AlertOrchestratorItem["layer"],
  dedupeKey?: string
): AlertOrchestratorItem {
  return {
    id: `resolved-${source}`,
    source,
    message: "",
    visible: false,
    priority,
    layer,
    dedupeKey,
    legacyOrigin: "core",
    viaBridge: false,
  };
}

export function useAlertResolutionTracker(): void {
  const prediction = useApprovalPrediction();
  const { data: core } = useCoreData();
  const { data: impact } = useStudyEngineImpact();
  const { totalDue } = useFsrsDueCount();

  // Snapshot do "estado anterior" para detectar transições
  const prev = useRef<{
    examDateMissing?: boolean;
    fsrsHigh?: boolean;
    inactive?: boolean;
    highRisk?: boolean;
  }>({});

  useEffect(() => {
    const examMissing = !!core && !core.profile.exam_date;
    const fsrsHigh = (totalDue ?? 0) > 20;
    const inactive = (impact?.questions7d ?? 0) === 0;
    const highRisk = prediction?.riskLevel === "high";

    const wasExamMissing = prev.current.examDateMissing;
    const wasFsrsHigh = prev.current.fsrsHigh;
    const wasInactive = prev.current.inactive;
    const wasHighRisk = prev.current.highRisk;

    // 1) exam-date: estava faltando, agora está preenchido
    if (
      wasExamMissing === true &&
      examMissing === false &&
      !alreadyResolvedThisSession("exam-date")
    ) {
      trackAlertEvent({
        alert: buildStub("exam-date", "critical", "structural", "exam-date-missing"),
        eventType: "resolved" as const,
        extra: { trigger: "profile.exam_date filled" },
      });
      markResolved("exam-date");
    }

    // 2) fsrs-backlog: backlog caiu para abaixo do threshold
    if (
      wasFsrsHigh === true &&
      fsrsHigh === false &&
      !alreadyResolvedThisSession("fsrs-backlog")
    ) {
      trackAlertEvent({
        alert: buildStub("fsrs-backlog", "important", "structural"),
        eventType: "resolved" as const,
        extra: { trigger: "fsrs due dropped < 20", currentDue: totalDue },
      });
      markResolved("fsrs-backlog");
    }

    // 3) inactivity: voltou a fazer questões
    if (
      wasInactive === true &&
      inactive === false &&
      !alreadyResolvedThisSession("inactivity")
    ) {
      trackAlertEvent({
        alert: buildStub("inactivity", "important", "structural"),
        eventType: "resolved" as const,
        extra: {
          trigger: "questions7d > 0",
          questions7d: impact?.questions7d,
        },
      });
      markResolved("inactivity");
    }

    // 4) approval-risk: saiu de high
    if (
      wasHighRisk === true &&
      highRisk === false &&
      !alreadyResolvedThisSession("approval-risk")
    ) {
      trackAlertEvent({
        alert: buildStub("approval-risk", "critical", "structural"),
        eventType: "resolved" as const,
        extra: {
          trigger: "riskLevel exited 'high'",
          newRiskLevel: prediction?.riskLevel,
        },
      });
      markResolved("approval-risk");
    }

    prev.current = {
      examDateMissing: examMissing,
      fsrsHigh,
      inactive,
      highRisk,
    };
  }, [core, totalDue, impact, prediction]);
}
