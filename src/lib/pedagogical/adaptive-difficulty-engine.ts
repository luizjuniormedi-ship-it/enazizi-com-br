
/**
 * ENAZIZI — ADAPTIVE DIFFICULTY ENGINE v1.0
 * Calibrates pedagogical target parameters based on the multi-dimensional cognitive state.
 */

export interface DifficultyCalibration {
  target_difficulty: 'easy' | 'medium' | 'hard' | 'extreme';
  reasoning_depth: 'conceptual' | 'associative' | 'integrative' | 'complex' | 'critical';
  cognitive_load: 'low' | 'moderate' | 'high' | 'very_high';
  question_style: 'direct' | 'pattern_recognition' | 'clinical_case' | 'multidisciplinary' | 'hardcore_residency';
  pacing_strategy: 'guided' | 'standard' | 'pressure' | 'recovery';
  retry_probability: number;
  tutor_intervention_level: 'active' | 'passive' | 'minimal' | 'none';
  estimated_time_factor: number;
  trap_score_max: number;
}

export interface CognitiveInput {
  state: string;
  retention_score: number;
  cognitive_load: number;
  error_pressure: number;
  trajectory_health: number;
  fatigue_level?: number;
  recent_accuracy?: number;
}

export const calibrateDifficulty = (input: CognitiveInput): DifficultyCalibration => {
  const { state, retention_score, cognitive_load, error_pressure } = input;
  
  // Base configuration
  let cal: DifficultyCalibration = {
    target_difficulty: 'medium',
    reasoning_depth: 'associative',
    cognitive_load: 'moderate',
    question_style: 'clinical_case',
    pacing_strategy: 'standard',
    retry_probability: 0.2,
    tutor_intervention_level: 'passive',
    estimated_time_factor: 1.0,
    trap_score_max: 30
  };

  // State-based adjustments
  switch (state) {
    case 'novato':
      cal.target_difficulty = 'easy';
      cal.reasoning_depth = 'conceptual';
      cal.cognitive_load = 'low';
      cal.question_style = 'direct';
      cal.pacing_strategy = 'guided';
      cal.tutor_intervention_level = 'active';
      cal.trap_score_max = 5;
      break;

    case 'exposto':
      cal.target_difficulty = 'easy';
      cal.reasoning_depth = 'associative';
      cal.cognitive_load = 'low';
      cal.question_style = 'pattern_recognition';
      cal.trap_score_max = 15;
      break;

    case 'retencao_fraca':
      cal.target_difficulty = 'easy';
      cal.reasoning_depth = 'conceptual';
      cal.cognitive_load = 'low';
      cal.question_style = 'direct';
      cal.pacing_strategy = 'recovery';
      cal.retry_probability = 0.8;
      cal.tutor_intervention_level = 'active';
      break;

    case 'recuperacao':
      cal.target_difficulty = 'easy';
      cal.reasoning_depth = 'associative';
      cal.cognitive_load = 'low';
      cal.question_style = 'clinical_case';
      cal.pacing_strategy = 'recovery';
      cal.tutor_intervention_level = 'active';
      cal.estimated_time_factor = 1.5;
      break;

    case 'praticando':
      cal.target_difficulty = 'medium';
      cal.reasoning_depth = 'integrative';
      cal.cognitive_load = 'moderate';
      cal.question_style = 'clinical_case';
      break;

    case 'consolidacao':
      cal.target_difficulty = 'hard';
      cal.reasoning_depth = 'complex';
      cal.cognitive_load = 'high';
      cal.question_style = 'multidisciplinary';
      cal.trap_score_max = 60;
      break;

    case 'dominio':
      cal.target_difficulty = 'extreme';
      cal.reasoning_depth = 'critical';
      cal.cognitive_load = 'very_high';
      cal.question_style = 'hardcore_residency';
      cal.pacing_strategy = 'pressure';
      cal.trap_score_max = 95;
      cal.estimated_time_factor = 0.8;
      break;

    case 'risco_esquecimento':
      cal.target_difficulty = 'medium';
      cal.reasoning_depth = 'associative';
      cal.cognitive_load = 'moderate';
      cal.question_style = 'clinical_case';
      cal.retry_probability = 0.9;
      break;
  }

  // Pressure modifiers
  if (error_pressure > 80) {
    cal.target_difficulty = 'easy';
    cal.cognitive_load = 'low';
    cal.pacing_strategy = 'recovery';
    cal.tutor_intervention_level = 'active';
  }

  if (cognitive_load > 85) {
    cal.cognitive_load = 'low';
    cal.estimated_time_factor = 1.3;
  }

  return cal;
};
