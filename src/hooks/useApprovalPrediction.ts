/**
 * useApprovalPrediction
 * ─────────────────────
 * Hook leve que combina dados já existentes (sem novas queries) e roda
 * o approvalEngine para devolver score, trend, risco e mensagem.
 *
 * Reusa: useCoreData, useStudyEngineImpact, useCoverageStatus, useAnalyticsSnapshot.
 * Trend é calculado comparando com o snapshot anterior salvo em approval_scores.
 */
import { useEffect, useMemo } from "react";
import {
  calculateApprovalScore,
  calculateTrend,
  type ApprovalEngineResult,
  type ApprovalTrend,
} from "@/engines/approvalEngine";
import { useCoreData } from "./useCoreData";
import { useStudyEngineImpact } from "./useStudyEngineImpact";
import { useCoverageStatus } from "./useCoverageStatus";
import { useAnalyticsSnapshot } from "./useAnalyticsSnapshot";
import { useAuth } from "./useAuth";
import { logApprovalPrediction } from "@/lib/approvalTelemetry";

export interface ApprovalPrediction extends ApprovalEngineResult {
  trend: ApprovalTrend;
  /** delta numérico (current - previous) ou null se sem histórico */
  delta: number | null;
  /** Dias até a prova (espelhado para conveniência) */
  daysToExam: number | null;
  /** Indica se há dados suficientes para confiar no resultado */
  hasEnoughData: boolean;
}

function daysUntil(dateISO: string | null | undefined): number | null {
  if (!dateISO) return null;
  const target = new Date(dateISO).getTime();
  if (Number.isNaN(target)) return null;
  const diff = Math.ceil((target - Date.now()) / 86400000);
  return diff;
}

export function useApprovalPrediction(): ApprovalPrediction | null {
  const { user } = useAuth();
  const { data: core } = useCoreData();
  const { data: impact } = useStudyEngineImpact();
  const { data: coverage } = useCoverageStatus();
  const { data: snapshot } = useAnalyticsSnapshot();

  const prediction = useMemo(() => {
    if (!core || !impact) return null;

    // ── Acurácia (últimas 100 tentativas)
    const recent = core.practiceAttempts.slice(0, 100);
    const accuracy = recent.length > 0
      ? (recent.filter(a => a.correct).length / recent.length) * 100
      : 0;

    // ── Cobertura curricular (obrigatórios)
    const coveragePct = coverage?.requiredCoveragePct ?? impact.coveragePct ?? 0;

    // ── Consistência (dias únicos com prática nos últimos 7)
    const since7 = Date.now() - 7 * 86400000;
    const uniqueDays = new Set(
      core.practiceAttempts
        .filter(a => new Date(a.created_at).getTime() >= since7)
        .map(a => a.created_at.slice(0, 10))
    );
    const consistency = (uniqueDays.size / 7) * 100;

    // ── Saúde do FSRS (em dia vs total)
    const totalRev = core.revisoes.length;
    const overdue = core.revisoes.filter(r => {
      if (r.status !== "pendente") return false;
      const due = new Date(r.data_revisao).getTime();
      return due < Date.now();
    }).length;
    const fsrsHealth = totalRev > 0
      ? Math.max(0, 100 - (overdue / totalRev) * 100)
      : 100; // sem revisões = saudável (não pune iniciante)

    // ── Volume
    const questionsVolume = impact.questions30d ?? 0;
    const questions7d = impact.questions7d ?? 0;

    // ── Dias até prova
    const daysToExam = daysUntil(core.profile.exam_date);

    const result = calculateApprovalScore({
      accuracy,
      coverage: coveragePct,
      consistency,
      fsrsHealth,
      questionsVolume,
      questions7d,
      fsrsDue: overdue,
      daysToExam,
    });

    // ── Trend: compara com o snapshot anterior em approval_scores (segundo mais recente)
    const history = core.approvalScores ?? [];
    const previous = history.length > 1 ? history[1].score : (snapshot?.approvalScore ?? null);
    const trend = calculateTrend(result.score, previous);
    const delta = previous != null ? result.score - previous : null;

    const hasEnoughData = recent.length >= 10 || questionsVolume >= 10;

    return {
      ...result,
      trend,
      delta,
      daysToExam,
      hasEnoughData,
    };
  }, [core, impact, coverage, snapshot]);
}
