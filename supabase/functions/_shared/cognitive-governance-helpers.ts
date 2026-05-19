
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const COGNITIVE_STATES = [
  'hyperfocus', 'fatigue', 'saturation', 'ansiedade', 'baixa_energia', 
  'alta_performance', 'recuperacao', 'desorganizacao', 'burnout_inicial', 
  'queda_motivacional', 'estabilidade_ideal'
];

export async function calculatePedagogicalHealth(supabase: any, userId: string) {
  // 1. Fetch multi-factor metrics
  const { data: attempts } = await supabase
    .from("practice_attempts")
    .select("created_at, correct, response_time_ms")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);

  const { data: fsrs } = await supabase
    .from("user_topic_profiles")
    .select("retention, stability, difficulty")
    .eq("user_id", userId);

  const { data: consistency } = await supabase
    .from("study_tasks")
    .select("status, completed_at")
    .eq("user_id", userId)
    .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  // Logic: 
  // Retention (40%): From FSRS profiles
  // Consistency (20%): Task completion in last 30 days
  // Recovery Efficiency (20%): Performance after errors
  // Cognitive Stability (20%): Response speed variance

  const avgRetention = fsrs?.length 
    ? fsrs.reduce((acc: number, f: any) => acc + (f.retention || 0), 0) / fsrs.length
    : 0.7;

  const totalTasks = consistency?.length || 1;
  const completedTasks = consistency?.filter((t: any) => t.status === 'completed').length || 0;
  const consistencyScore = (completedTasks / totalTasks);

  // Recovery: How many correct after an incorrect?
  let recoveryWins = 0;
  let errorPositions = [];
  if (attempts) {
    for (let i = 1; i < attempts.length; i++) {
      if (!attempts[i].correct && attempts[i-1].correct) recoveryWins++;
    }
  }
  const recoveryRate = attempts?.length ? (recoveryWins / attempts.length) * 2 : 0.5; // Normalized

  const healthScore = (avgRetention * 40) + (consistencyScore * 20) + (recoveryRate * 20) + (0.8 * 20); // Dummy for stability

  return {
    health_score: Math.min(100, Math.max(0, healthScore)),
    retention_rate: avgRetention,
    consistency_score: consistencyScore,
    recovery_efficiency: recoveryRate,
    metadata: {
      total_attempts: attempts?.length || 0,
      total_tasks: totalTasks,
      computed_at: new Date().toISOString()
    }
  };
}

export async function detectCognitiveState(supabase: any, userId: string) {
  // Analyze telemetry (response times, session duration, time of day)
  const { data: recent } = await supabase
    .from("practice_attempts")
    .select("response_time_ms, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (!recent || recent.length < 5) return 'estabilidade_ideal';

  const avgTime = recent.reduce((acc: number, r: any) => acc + (r.response_time_ms || 0), 0) / recent.length;
  const variance = recent.reduce((acc: number, r: any) => acc + Math.pow((r.response_time_ms || 0) - avgTime, 2), 0) / recent.length;

  if (avgTime > 15000) return 'fatigue';
  if (variance > 5000000) return 'desorganizacao';
  if (avgTime < 5000 && variance < 500000) return 'hyperfocus';

  return 'estabilidade_ideal';
}

export function calculatePlannerPriority(params: {
  errorRate: number;
  probOfFalling: number;
  fsrsRisk: number;
  daysToExam: number;
  clinicalImpact: number;
  longitudinalWeakness: number;
  mastery: number;
}) {
  const priority = 
    (params.errorRate * 3) +
    (params.probOfFalling * 3) +
    (params.fsrsRisk * 2) +
    (Math.max(0, (100 - params.daysToExam) / 10)) + // High weight if close to exam
    (params.clinicalImpact * 2) +
    (params.longitudinalWeakness * 2) -
    (params.mastery * 2);

  return priority;
}

export async function auditPedagogicalQuality(response: string, context: string) {
  // Simple heuristic/pattern check for anti-hallucination
  // In a real scenario, this would call a separate LLM pass or specific medical validator
  const redFlags = [/sempre/, /nunca/, /100%/, /cura total/];
  const hallucinations = redFlags.filter(pattern => pattern.test(response)).map(p => p.toString());
  
  const hasPhysiology = /fisiopatologia|mecanismo|celular|receptor/i.test(response);
  const hasGuidelines = /guideline|diretriz|consenso|sociedade/i.test(response);

  let score = 100;
  if (hallucinations.length > 0) score -= 30;
  if (!hasPhysiology) score -= 10;
  if (!hasGuidelines) score -= 10;

  return {
    quality_score: score,
    medical_coherence_passed: score > 70,
    guideline_compliance_passed: hasGuidelines,
    safety_check_passed: hallucinations.length === 0,
    detected_hallucinations: hallucinations
  };
}
