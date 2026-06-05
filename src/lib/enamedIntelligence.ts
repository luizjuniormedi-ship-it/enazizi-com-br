
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

export const computeEnamedPriority = (
  historicalIncidence: number, // 0-10
  studentErrorCount: number,
  fsrsStability: number, // 0-1 (low is higher priority)
  daysToExam: number,
  currentMastery: number // 0-1
): number => {
  // Formula: Priority = (Incidence * 2) + (Errors * 1.5) + (1 - Stability) * 10 + (1 - Mastery) * 5
  // Adjust for proximity: if daysToExam < 30, multiply incidence weight
  const proximityMultiplier = daysToExam < 30 ? 1.5 : 1.0;
  
  const score = 
    (historicalIncidence * 2 * proximityMultiplier) + 
    (Math.min(studentErrorCount, 10) * 1.5) + 
    ((1 - Math.min(fsrsStability, 1)) * 10) + 
    ((1 - currentMastery) * 5);
    
  return Math.min(Math.max(score, 0), 100);
};
