
export interface CurriculumTheme {
  id: string;
  greatArea: string;
  specialty: string;
  theme: string;
  subtheme?: string;
  competence?: string;
}

export interface ThemeWeight {
  themeId: string;
  examType: string;
  historicalIncidence: number;
  statisticalWeight: number;
  priorityLevel: number;
  yearReference: number;
}

export interface ReadinessStats {
  greatArea: string;
  currentScore: number;
  targetScore: number;
  readinessIndex: number;
  masteryLevel: 'beginner' | 'intermediate' | 'advanced' | 'mastery';
}

export interface TargetExam {
  examId: string;
  priority: number;
  examDate?: string;
}
