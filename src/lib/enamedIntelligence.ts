
import { supabase } from "@/integrations/supabase/client";

export interface WeightData {
  historical_incidence: number;
  statistical_weight: number;
  priority_level: number;
  frequency_score?: number;
  recency_score?: number;
  difficulty_score?: number;
  approval_impact_score?: number;
  global_priority?: number;
  potential_gain?: number;
}

export const getThemeWeights = async (themeName: string, examType = 'ENAMED'): Promise<WeightData> => {
  const { data, error } = await supabase
    .from('enamed_theme_weights')
    .select(`
      historical_incidence, 
      statistical_weight, 
      priority_level, 
      frequency_score, 
      recency_score, 
      difficulty_score, 
      approval_impact_score, 
      global_weight,
      enamed_curriculum_matrix!inner(theme, id)
    `)
    .eq('enamed_curriculum_matrix.theme', themeName)
    .eq('exam_type', examType)
    .maybeSingle();

  if (error || !data) {
    return { historical_incidence: 5, statistical_weight: 1, priority_level: 5 };
  }

  const impactRes = await supabase
    .from('enamed_impact_scores')
    .select('global_priority')
    .eq('theme_id', (data.enamed_curriculum_matrix as any).id)
    .maybeSingle();

  return {
    historical_incidence: Number(data.historical_incidence),
    statistical_weight: Number(data.statistical_weight),
    priority_level: data.priority_level,
    frequency_score: Number(data.frequency_score || 0),
    recency_score: Number(data.recency_score || 0),
    difficulty_score: Number(data.difficulty_score || 0),
    approval_impact_score: Number(data.approval_impact_score || 0),
    global_priority: Number(impactRes.data?.global_priority || data.global_weight || 0)
  };
};

/**
 * New Phase 2 Prioritization Motor:
 * Formula: Priority = (Incidência × 3) + (Erros × 2) + (Risco FSRS × 2) + (Proximidade × 2) + (1 - Domínio × 1)
 */
export const computeEnamedPriority = (
  historicalIncidence: number, // 0-10
  studentErrorCount: number,
  fsrsStability: number, // 0-1 (low stability is higher risk/priority)
  daysToExam: number,
  currentMastery: number // 0-1
): number => {
  // Normalize components to 0-10
  const incidenceScore = historicalIncidence; // Already 0-10
  const errorsScore = Math.min(studentErrorCount, 10);
  const fsrsRiskScore = (1 - Math.min(fsrsStability, 1)) * 10;
  
  // Proximity score: 10 if < 30 days, 5 if < 60 days, 2 if < 90, else 0
  const proximityScore = daysToExam < 30 ? 10 : (daysToExam < 60 ? 5 : (daysToExam < 90 ? 2 : 0));
  
  const lackOfMasteryScore = (1 - currentMastery) * 10;

  const score = 
    (incidenceScore * 3) + 
    (errorsScore * 2) + 
    (fsrsRiskScore * 2) + 
    (proximityScore * 2) + 
    (lackOfMasteryScore * 1);
    
  // Normalize result to 0-100 range
  // Max possible: (10*3) + (10*2) + (10*2) + (10*2) + (10*1) = 30 + 20 + 20 + 20 + 10 = 100
  return Math.min(Math.max(score, 0), 100);
};
