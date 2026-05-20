
/**
 * ENAZIZI — COGNITIVE PRESSURE ENGINE v1.0
 * Monitors and controls the pedagogical pressure to prevent burnout and maximize retention.
 */

export interface PressureState {
  overload_risk: number;
  burnout_probability: number;
  frustration_level: number;
  fatigue_index: number;
  recommended_actions: string[];
  should_pause: boolean;
  intensity_modifier: number;
}

export interface PressureInput {
  error_streak: number;
  response_time_avg: number;
  abandonment_rate: number;
  success_rate_recent: number;
  session_duration_minutes: number;
}

export const evaluateCognitivePressure = (input: PressureInput): PressureState => {
  const { error_streak, response_time_avg, abandonment_rate, success_rate_recent, session_duration_minutes } = input;
  
  let overloadRisk = 0;
  const actions: string[] = [];
  
  // Logic to calculate overload risk
  if (error_streak >= 3) overloadRisk += 30;
  if (success_rate_recent < 30) overloadRisk += 25;
  if (session_duration_minutes > 120) overloadRisk += 20;
  if (abandonment_rate > 20) overloadRisk += 25;

  const fatigueIndex = Math.min(100, (session_duration_minutes / 180) * 100);
  const frustrationLevel = Math.min(100, error_streak * 20);
  
  if (overloadRisk > 70) {
    actions.push("reduce_difficulty");
    actions.push("suggest_break");
    actions.push("activate_recovery_mode");
  } else if (overloadRisk > 40) {
    actions.push("simplify_language");
    actions.push("increase_feedback");
  }

  return {
    overload_risk: overloadRisk,
    burnout_probability: Math.min(100, (overloadRisk + fatigueIndex) / 2),
    frustration_level: frustrationLevel,
    fatigue_index: fatigueIndex,
    recommended_actions: actions,
    should_pause: fatigueIndex > 85 || overloadRisk > 85,
    intensity_modifier: overloadRisk > 60 ? 0.5 : (overloadRisk < 20 ? 1.2 : 1.0)
  };
};
