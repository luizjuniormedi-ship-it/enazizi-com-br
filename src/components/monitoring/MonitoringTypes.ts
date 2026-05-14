export interface DashboardData {
  system: { status: string; uptime: string; apiResponseTime: number; errorRate: number };
  users: { activeNow: number; totalApproved: number; pendingApproval: number };
  studyEngine: { dailyPlansToday: number; tasksCompleted: number; overdueTasks: number; executionRate: number };
  ai: { totalCalls24h: number; avgResponseTime: number; failureRate: number; byModule: { name: string; calls: number }[] };
  learning: {
    avgApprovalScore: number;
    totalQuestionsBank: number;
    recentErrors: number;
    topTopics: { topic: string; count: number }[];
    weakTopics: { topic: string; accuracy: number; questions: number }[];
  };
  auth?: {
    loginSuccessRate: number;
    activeSessions: number;
    avgSessionDuration: number;
    tokenRefreshes24h: number;
  };
  tutor?: {
    avgLatency: number;
    avgSignalConfidence: number;
    signalDetectionRate: number;
    reinforcementRate: number;
  };
  content?: {
    quarantineVolume: number;
    auditBacklog: number;
    autoFixRate: number;
    avgEditorialGrade: number;
  };
  students?: StudentRow[];
  riskAlerts?: RiskAlert[];
  timestamp: string;
}

export interface WeakTopic {
  topic: string;
  specialty: string;
  weakness_score: number;
  accuracy: number;
  mastery: number;
}

export interface StudentRow {
  user_id: string;
  display_name: string;
  email: string;
  last_seen_at: string | null;
  approval_score: number;
  accuracy: number;
  risk_score: number;
  engagement_score: number;
  student_status: "active" | "attention" | "risk" | "critical";
  risk_reason: string;
  student_profile: "consistent" | "oscillating" | "disengaged" | "studying_the_wrong_way" | "recovering";
  next_best_action: string;
  weakest_topics: WeakTopic[];
  overdue_tasks: number;
  overdue_reviews: number;
  completed_tasks_7d: number;
  scheduled_tasks_7d: number;
  tutor_sessions_7d: number;
  simulados_30d: number;
  total_study_minutes_7d: number;
  risk_components: {
    inactivity: number;
    overdue_tasks: number;
    overdue_reviews: number;
    approval_drop: number;
    low_engagement: number;
  };
  engagement_components: {
    active_days: number;
    study_time: number;
    plan_execution: number;
    tutor_usage: number;
    simulado_usage: number;
    review_completion: number;
  };
  // Legacy compat
  tasks_completed?: number;
  tasks_overdue?: number;
  total_study_minutes?: number;
  status?: "green" | "yellow" | "red";
}

export interface RiskAlert {
  user_id: string;
  display_name: string;
  reason: string;
  severity: "low" | "medium" | "high";
  details: string;
  risk_score?: number;
  student_profile?: string;
}

export interface MentorSummary {
  total: number;
  active: number;
  attention: number;
  risk: number;
  critical: number;
  avg_approval: number;
  avg_risk: number;
  avg_engagement: number;
}
