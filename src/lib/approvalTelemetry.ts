/**
 * Approval Telemetry
 * ──────────────────
 * Persiste decisões da Aprovação Preditiva em `assistant_decisions`
 * (mesma tabela usada pelo Study Engine V3) — fire-and-forget,
 * com debounce por sessão para evitar spam.
 */
import { supabase } from "@/integrations/supabase/client";
import type { ApprovalPrediction } from "@/hooks/useApprovalPrediction";

const SESSION_KEY = "approval_telemetry_last";
const MIN_INTERVAL_MS = 5 * 60_000; // 5 min entre escritas
const MIN_DELTA = 2; // só persiste se score mudar ≥ 2 pts

interface LastSnapshot {
  ts: number;
  score: number;
  userId: string;
}

function readLast(): LastSnapshot | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as LastSnapshot) : null;
  } catch { return null; }
}

function writeLast(snap: LastSnapshot) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(snap)); } catch { /* noop */ }
}

export async function logApprovalPrediction(
  userId: string,
  prediction: ApprovalPrediction
): Promise<void> {
  if (!userId || !prediction?.hasEnoughData) return;

  const last = readLast();
  const now = Date.now();
  if (
    last &&
    last.userId === userId &&
    now - last.ts < MIN_INTERVAL_MS &&
    Math.abs(last.score - prediction.score) < MIN_DELTA
  ) {
    return;
  }

  try {
    await supabase.from("assistant_decisions").insert({
      user_id: userId,
      source_module: "approval-engine",
      decision_type: "approval_prediction",
      input_snapshot: {
        days_to_exam: prediction.daysToExam,
        breakdown: prediction.breakdown,
      },
      decision_output: {
        approval_score: prediction.score,
        trend: prediction.trend,
        risk: prediction.riskLevel,
        delta: prediction.delta,
        message: prediction.message,
      },
      confidence_score: prediction.hasEnoughData ? 0.85 : 0.5,
      justification: prediction.message,
    });
    writeLast({ ts: now, score: prediction.score, userId });
  } catch {
    // Telemetria nunca quebra UX
  }
}
