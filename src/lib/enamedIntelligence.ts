
import { supabase } from "@/integrations/supabase/client";

export interface WeightData {
  historical_incidence: number;
  statistical_weight: number;
  priority_level: number;
}

export const getThemeWeights = async (themeName: string, examType = 'ENAMED'): Promise<WeightData> => {
  const { data, error } = await supabase
    .from('enamed_theme_weights')
    .select('historical_incidence, statistical_weight, priority_level, enamed_curriculum_matrix(theme)')
    .eq('enamed_curriculum_matrix.theme', themeName)
    .eq('exam_type', examType)
    .maybeSingle();

  if (error || !data) {
    return { historical_incidence: 5, statistical_weight: 1, priority_level: 5 };
  }

  return {
    historical_incidence: Number(data.historical_incidence),
    statistical_weight: Number(data.statistical_weight),
    priority_level: data.priority_level
  };
};

/**
 * New Phase 2 Prioritization Motor:
 * Formula: Priority = (Incidence * 3) + (Errors * 2) + (FSRS Risk * 2) + (Proximity * 2) + (1 - Mastery * 1)
 */
export const computeEnamedPriority = (
  historicalIncidence: number, // 0-10
  studentErrorCount: number,
  fsrsStability: number, // 0-1 (low is higher priority)
  daysToExam: number,
  currentMastery: number // 0-1
): number => {
  // Normalize components
  const normalizedIncidence = historicalIncidence; // Already 0-10
  const normalizedErrors = Math.min(studentErrorCount, 10);
  const fsrsRisk = (1 - Math.min(fsrsStability, 1)) * 10;
  
  // Proximity score: 10 if < 30 days, 5 if < 60 days, else 0
  const proximityScore = daysToExam < 30 ? 10 : (daysToExam < 60 ? 5 : 0);
  
  const lackOfMastery = (1 - currentMastery) * 10;

  const score = 
    (normalizedIncidence * 3) + 
    (normalizedErrors * 2) + 
    (fsrsRisk * 2) + 
    (proximityScore * 2) + 
    (lackOfMastery * 1);
    
  // Cap at 100 for display
  return Math.min(Math.max(score, 0), 100);
};
