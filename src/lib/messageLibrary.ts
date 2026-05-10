/**
 * ENAZIZI Message Library — Humanized, contextual student communication templates.
 * 
 * Each template supports variable interpolation: {{student_name}}, {{weakest_topic}}, etc.
 */

export type StudentProfile = "consistent" | "oscillating" | "disengaged" | "studying_the_wrong_way" | "recovering";
export type StudentState = "active" | "attention" | "risk" | "critical";
export type TriggerType =
  | "inactivity"
  | "overdue_reviews"
  | "overdue_tasks"
  | "approval_score_drop"
  | "positive_reinforcement"
  | "daily_mission_missed"
  | "daily_mission_completed"
  | "content_locked"
  | "content_unlocked"
  | "return_after_absence"
  | "practical_training_recommendation"
  | "tutor_recommendation"
  | "simulado_recommendation"
  | "nivelamento_reminder"
  | "streak_milestone"
  | "weekly_summary";

export type ToneType = "supportive" | "motivational" | "corrective" | "celebratory" | "urgent_but_gentle";
export type DeliveryChannel = "in_app" | "dashboard_card" | "push" | "whatsapp" | "telegram";
export type Severity = "info" | "warning" | "critical";

export interface MessageTemplate {
  message_key: string;
  profile: StudentProfile | "all";
  state?: StudentState | "all";
  trigger_type: TriggerType;
  severity: Severity;
  title: string;
  body: string;
  cta_label: string;
  cta_path?: string;
  tone_type: ToneType;
  channels: DeliveryChannel[];
  cooldown_hours: number;
}

// ─── TEMPLATE LIBRARY ─────────────────────────────────────────────

export const MESSAGE_TEMPLATES: MessageTemplate[] = [

  // ── POSITIVE REINFORCEMENT ──────────────────────────────────────
  {
    message_key: "consistent_positive_rhythm",
    profile: "consistent",
    trigger_type: "positive_reinforcement",
    severity: "info",
    title: "Você está em um ótimo ritmo",
    body: "Seu progresso está consistente. Continue sua missão de hoje para consolidar essa vantagem.",
    cta_label: "Continuar missão",
    cta_path: "/dashboard/missao",
    tone_type: "celebratory",
    channels: ["in_app", "dashboard_card"],
    cooldown_hours: 24,
  },
  {
    message_key: "consistent_streak_fire",
    profile: "consistent",
    trigger_type: "streak_milestone",
    severity: "info",
    title: "{{streak_days}} dias seguidos! 🔥",
    body: "Poucos mantêm esse nível de consistência. Seu esforço vai se traduzir em resultado.",
    cta_label: "Ver progresso",
    cta_path: "/dashboard/conquistas",
    tone_type: "celebratory",
    channels: ["in_app"],
    cooldown_hours: 168, // 7 days
  },
  {
    message_key: "recovering_positive_return",
    profile: "recovering",
    trigger_type: "positive_reinforcement",
    severity: "info",
    title: "Você voltou a evoluir",
    body: "Seu desempenho melhorou nas últimas sessões. Continue hoje para transformar recuperação em consistência.",
    cta_label: "Seguir estudando",
    cta_path: "/dashboard/missao",
    tone_type: "motivational",
    channels: ["in_app", "dashboard_card"],
    cooldown_hours: 24,
  },

  // ── DAILY MISSION ───────────────────────────────────────────────
  {
    message_key: "mission_completed",
    profile: "all",
    trigger_type: "daily_mission_completed",
    severity: "info",
    title: "Missão concluída! ✅",
    body: "Você concluiu o plano de hoje. Seu score e sua consistência agradecerão amanhã.",
    cta_label: "Ver progresso",
    cta_path: "/dashboard/conquistas",
    tone_type: "celebratory",
    channels: ["in_app"],
    cooldown_hours: 12,
  },
  {
    message_key: "mission_missed_oscillating",
    profile: "oscillating",
    trigger_type: "daily_mission_missed",
    severity: "warning",
    title: "Sua missão de hoje ainda está aberta",
    body: "Alunos que completam a missão diária avançam até 3x mais rápido. Ainda dá tempo.",
    cta_label: "Começar agora",
    cta_path: "/dashboard/missao",
    tone_type: "supportive",
    channels: ["in_app", "push"],
    cooldown_hours: 12,
  },
  {
    message_key: "mission_missed_disengaged",
    profile: "disengaged",
    trigger_type: "daily_mission_missed",
    severity: "warning",
    title: "Você não começou hoje",
    body: "10 minutos hoje valem mais que 2 horas amanhã. O sistema já preparou algo leve para você.",
    cta_label: "Retomar",
    cta_path: "/dashboard/missao",
    tone_type: "urgent_but_gentle",
    channels: ["push", "whatsapp"],
    cooldown_hours: 24,
  },

  // ── INACTIVITY ──────────────────────────────────────────────────
  {
    message_key: "inactivity_day1",
    profile: "all",
    state: "attention",
    trigger_type: "inactivity",
    severity: "info",
    title: "Sentimos sua falta ontem",
    body: "Um dia sem estudar acontece. Volte hoje e mantenha o que construiu até aqui.",
    cta_label: "Voltar agora",
    cta_path: "/dashboard/missao",
    tone_type: "supportive",
    channels: ["in_app", "push"],
    cooldown_hours: 24,
  },
  {
    message_key: "inactivity_day3",
    profile: "all",
    state: "risk",
    trigger_type: "inactivity",
    severity: "warning",
    title: "Já são {{days_inactive}} dias sem entrar",
    body: "A curva de esquecimento está agindo. O sistema preparou um plano de retomada leve para você.",
    cta_label: "Retomar agora",
    cta_path: "/dashboard/missao",
    tone_type: "urgent_but_gentle",
    channels: ["push", "whatsapp"],
    cooldown_hours: 48,
  },
  {
    message_key: "inactivity_day7",
    profile: "all",
    state: "critical",
    trigger_type: "inactivity",
    severity: "critical",
    title: "Uma semana pode custar semanas de recuperação",
    body: "Seus concorrentes continuaram. O sistema recalibrou um retorno acessível para você.",
    cta_label: "Recomeçar agora",
    cta_path: "/dashboard/missao",
    tone_type: "urgent_but_gentle",
    channels: ["push", "whatsapp", "telegram"],
    cooldown_hours: 72,
  },

  // ── RETURN AFTER ABSENCE ────────────────────────────────────────
  {
    message_key: "return_welcome_back",
    profile: "all",
    trigger_type: "return_after_absence",
    severity: "info",
    title: "Bom te ver de volta! 👋",
    body: "Seu plano já foi ajustado para facilitar a retomada. Comece com algo leve.",
    cta_label: "Começar agora",
    cta_path: "/dashboard/missao",
    tone_type: "supportive",
    channels: ["in_app", "dashboard_card"],
    cooldown_hours: 72,
  },

  // ── OVERDUE REVIEWS ─────────────────────────────────────────────
  {
    message_key: "overdue_reviews_moderate",
    profile: "all",
    state: "attention",
    trigger_type: "overdue_reviews",
    severity: "warning",
    title: "{{overdue_reviews_count}} revisões aguardando você",
    body: "Revisões atrasadas aumentam o risco de esquecer o que já aprendeu. Recupere agora.",
    cta_label: "Fazer revisões",
    cta_path: "/dashboard/planner",
    tone_type: "corrective",
    channels: ["in_app", "dashboard_card", "push"],
    cooldown_hours: 12,
  },
  {
    message_key: "overdue_reviews_critical",
    profile: "all",
    state: "risk",
    trigger_type: "overdue_reviews",
    severity: "critical",
    title: "Sua memória está começando a escapar",
    body: "Você acumulou {{overdue_reviews_count}} revisões importantes. Recuperar isso agora é melhor do que avançar sem fixação.",
    cta_label: "Fazer revisões",
    cta_path: "/dashboard/planner",
    tone_type: "urgent_but_gentle",
    channels: ["in_app", "dashboard_card", "push"],
    cooldown_hours: 8,
  },

  // ── OVERDUE TASKS ───────────────────────────────────────────────
  {
    message_key: "overdue_tasks_attention",
    profile: "oscillating",
    trigger_type: "overdue_tasks",
    severity: "warning",
    title: "Tarefas acumulando",
    body: "Você tem tarefas pendentes no seu plano. Concluí-las mantém seu ritmo e score.",
    cta_label: "Ver plano",
    cta_path: "/dashboard/planner",
    tone_type: "corrective",
    channels: ["in_app", "push"],
    cooldown_hours: 24,
  },

  // ── APPROVAL SCORE DROP ─────────────────────────────────────────
  {
    message_key: "approval_drop_oscillating",
    profile: "oscillating",
    trigger_type: "approval_score_drop",
    severity: "warning",
    title: "Seu score de aprovação caiu",
    body: "Seu Approval Score estava em {{approval_score}}. Revisões pendentes e lacunas estão impactando. O plano foi ajustado.",
    cta_label: "Corrigir agora",
    cta_path: "/dashboard/missao",
    tone_type: "corrective",
    channels: ["in_app", "dashboard_card"],
    cooldown_hours: 48,
  },
  {
    message_key: "approval_drop_risk",
    profile: "all",
    state: "risk",
    trigger_type: "approval_score_drop",
    severity: "critical",
    title: "Seu plano pode estar atrasando sua aprovação",
    body: "Os dados mostram que revisões atrasadas e temas fracos estão pesando no seu score. Corrija agora.",
    cta_label: "Ajustar plano",
    cta_path: "/dashboard/missao",
    tone_type: "urgent_but_gentle",
    channels: ["in_app", "dashboard_card", "push"],
    cooldown_hours: 48,
  },

  // ── CONTENT LOCKED / UNLOCKED ───────────────────────────────────
  {
    message_key: "content_locked",
    profile: "all",
    trigger_type: "content_locked",
    severity: "warning",
    title: "Seu avanço foi pausado temporariamente",
    body: "Antes de abrir conteúdo novo, conclua suas revisões pendentes para manter seu rendimento.",
    cta_label: "Recuperar revisões",
    cta_path: "/dashboard/planner",
    tone_type: "corrective",
    channels: ["in_app", "dashboard_card"],
    cooldown_hours: 12,
  },
  {
    message_key: "content_unlocked",
    profile: "all",
    trigger_type: "content_unlocked",
    severity: "info",
    title: "Conteúdo novo liberado! 🎉",
    body: "Suas revisões estão em dia. Agora você pode avançar para novos temas com segurança.",
    cta_label: "Começar novo tema",
    cta_path: "/dashboard/missao",
    tone_type: "celebratory",
    channels: ["in_app"],
    cooldown_hours: 24,
  },

  // ── STUDYING THE WRONG WAY ─────────────────────────────────────
  {
    message_key: "wrong_way_low_performance",
    profile: "studying_the_wrong_way",
    trigger_type: "positive_reinforcement",
    severity: "warning",
    title: "Você está estudando, mas precisa ajustar a direção",
    body: "Seu esforço está alto, mas seus temas mais fracos ainda não melhoraram. O sistema separou o que corrigir agora.",
    cta_label: "Corrigir meu plano",
    cta_path: "/dashboard/missao",
    tone_type: "corrective",
    channels: ["in_app", "dashboard_card"],
    cooldown_hours: 48,
  },
  {
    message_key: "wrong_way_cognitive_dissonance",
    profile: "studying_the_wrong_way",
    trigger_type: "tutor_recommendation",
    severity: "warning",
    title: "Você está estudando… mas pode não estar estudando certo",
    body: "O Tutor IA identificou lacunas em {{weakest_topic}}. Uma sessão guiada pode resolver isso rápido.",
    cta_label: "Estudar com o Tutor",
    cta_path: "/dashboard/mentor",
    tone_type: "corrective",
    channels: ["in_app", "dashboard_card"],
    cooldown_hours: 48,
  },

  // ── RECOMMENDATIONS ─────────────────────────────────────────────
  {
    message_key: "practical_training_rec",
    profile: "all",
    trigger_type: "practical_training_recommendation",
    severity: "info",
    title: "Hora de praticar clinicamente",
    body: "Você já domina teoria em {{weakest_topic}}. Um caso clínico agora consolida seu aprendizado.",
    cta_label: "Ir para Plantão",
    cta_path: "/dashboard/plantao",
    tone_type: "motivational",
    channels: ["in_app", "dashboard_card"],
    cooldown_hours: 48,
  },
  {
    message_key: "tutor_recommendation",
    profile: "all",
    trigger_type: "tutor_recommendation",
    severity: "info",
    title: "O Tutor IA preparou algo para você",
    body: "Com base nos seus erros recentes, o Tutor pode esclarecer {{weakest_topic}} de forma rápida.",
    cta_label: "Estudar com Tutor",
    cta_path: "/dashboard/mentor",
    tone_type: "supportive",
    channels: ["in_app"],
    cooldown_hours: 24,
  },
  {
    message_key: "simulado_recommendation",
    profile: "all",
    trigger_type: "simulado_recommendation",
    severity: "info",
    title: "Teste seu progresso real",
    body: "Você estudou bastante essa semana. Um simulado agora mostra onde você realmente está.",
    cta_label: "Fazer simulado",
    cta_path: "/dashboard/simulados",
    tone_type: "motivational",
    channels: ["in_app", "dashboard_card"],
    cooldown_hours: 72,
  },

  // ── NIVELAMENTO ─────────────────────────────────────────────────
  {
    message_key: "nivelamento_reminder",
    profile: "all",
    trigger_type: "nivelamento_reminder",
    severity: "info",
    title: "Seu plano pode ficar mais preciso",
    body: "Refaça seu nivelamento para recalibrar seu estudo com base no seu momento atual.",
    cta_label: "Fazer nivelamento",
    cta_path: "/dashboard/nivelamento",
    tone_type: "supportive",
    channels: ["in_app", "dashboard_card"],
    cooldown_hours: 720, // 30 days
  },

  // ── WEEKLY SUMMARY ──────────────────────────────────────────────
  {
    message_key: "weekly_summary_positive",
    profile: "consistent",
    trigger_type: "weekly_summary",
    severity: "info",
    title: "Resumo da semana: parabéns! 🏆",
    body: "Você respondeu {{questions_week}} questões com {{accuracy_week}}% de acerto. Continue assim!",
    cta_label: "Ver analytics",
    cta_path: "/dashboard/analytics",
    tone_type: "celebratory",
    channels: ["in_app", "push"],
    cooldown_hours: 168,
  },
  {
    message_key: "weekly_summary_needs_improvement",
    profile: "oscillating",
    trigger_type: "weekly_summary",
    severity: "warning",
    title: "Resumo da semana: você pode mais",
    body: "Sua semana teve altos e baixos. O plano da próxima semana foi ajustado para focar nos pontos fracos.",
    cta_label: "Ver plano",
    cta_path: "/dashboard/planner",
    tone_type: "supportive",
    channels: ["in_app", "push"],
    cooldown_hours: 168,
  },

  // ── DISENGAGED SPECIFIC ─────────────────────────────────────────
  {
    message_key: "disengaged_plan_waiting",
    profile: "disengaged",
    trigger_type: "inactivity",
    severity: "warning",
    title: "Seu plano ainda está aqui",
    body: "Você ficou alguns dias sem entrar, mas o sistema já preparou um retorno mais leve para facilitar sua retomada.",
    cta_label: "Retomar agora",
    cta_path: "/dashboard/missao",
    tone_type: "supportive",
    channels: ["push", "whatsapp"],
    cooldown_hours: 48,
  },
];

// ─── INTERPOLATION ────────────────────────────────────────────────

export interface MessageVariables {
  student_name?: string;
  weakest_topic?: string;
  approval_score?: number;
  overdue_reviews_count?: number;
  mission_count?: number;
  streak_days?: number;
  days_inactive?: number;
  questions_week?: number;
  accuracy_week?: number;
}

export function interpolate(text: string, vars: MessageVariables): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = vars[key as keyof MessageVariables];
    return val !== undefined ? String(val) : `{{${key}}}`;
  });
}

// ─── QUERY HELPERS ────────────────────────────────────────────────

export function findTemplates(opts: {
  trigger_type?: TriggerType;
  profile?: StudentProfile;
  state?: StudentState;
}): MessageTemplate[] {
  return MESSAGE_TEMPLATES.filter(t => {
    if (opts.trigger_type && t.trigger_type !== opts.trigger_type) return false;
    if (opts.profile && t.profile !== "all" && t.profile !== opts.profile) return false;
    if (opts.state && t.state && t.state !== "all" && t.state !== opts.state) return false;
    return true;
  });
}

export function getBestTemplate(opts: {
  trigger_type: TriggerType;
  profile: StudentProfile;
  state?: StudentState;
}): MessageTemplate | null {
  const matches = findTemplates(opts);
  // Prefer profile-specific over "all"
  const specific = matches.find(m => m.profile === opts.profile);
  return specific || matches[0] || null;
}

// ─── CHANNEL MAPPING ─────────────────────────────────────────────

export const TRIGGER_CHANNEL_MAP: Record<TriggerType, DeliveryChannel[]> = {
  inactivity: ["push", "whatsapp"],
  overdue_reviews: ["in_app", "push", "dashboard_card"],
  overdue_tasks: ["in_app", "push"],
  approval_score_drop: ["in_app", "dashboard_card"],
  positive_reinforcement: ["in_app", "dashboard_card"],
  daily_mission_missed: ["in_app", "push"],
  daily_mission_completed: ["in_app"],
  content_locked: ["in_app", "dashboard_card"],
  content_unlocked: ["in_app"],
  return_after_absence: ["in_app", "dashboard_card"],
  practical_training_recommendation: ["in_app", "dashboard_card"],
  tutor_recommendation: ["in_app"],
  simulado_recommendation: ["in_app", "dashboard_card"],
  nivelamento_reminder: ["in_app", "dashboard_card"],
  streak_milestone: ["in_app"],
  weekly_summary: ["in_app", "push"],
};

// ─── COOLDOWN MANAGEMENT ─────────────────────────────────────────

const COOLDOWN_STORAGE_KEY = "enazizi-msg-cooldowns";

interface CooldownMap {
  [messageKey: string]: number; // timestamp of last delivery
}

function getCooldowns(): CooldownMap {
  try {
    return JSON.parse(localStorage.getItem(COOLDOWN_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function setCooldown(messageKey: string): void {
  const map = getCooldowns();
  map[messageKey] = Date.now();
  localStorage.setItem(COOLDOWN_STORAGE_KEY, JSON.stringify(map));
}

export function isOnCooldown(template: MessageTemplate): boolean {
  const map = getCooldowns();
  const lastSent = map[template.message_key];
  if (!lastSent) return false;
  const cooldownMs = template.cooldown_hours * 60 * 60 * 1000;
  return Date.now() - lastSent < cooldownMs;
}

export function markDelivered(messageKey: string): void {
  setCooldown(messageKey);
}

// ─── STUDENT PROFILE DETECTION ────────────────────────────────────

export function detectStudentProfile(data: {
  streak: number;
  daysInactive: number;
  recentAccuracy: number;
  overdueReviews: number;
  questionsThisWeek: number;
  approvalScoreTrend: "up" | "down" | "stable";
  errorRate: number;
}): { profile: StudentProfile; state: StudentState } {
  let profile: StudentProfile;
  let state: StudentState;

  // Profile detection
  if (data.daysInactive >= 5) {
    profile = "disengaged";
  } else if (data.questionsThisWeek >= 20 && data.recentAccuracy < 50 && data.errorRate > 40) {
    profile = "studying_the_wrong_way";
  } else if (data.streak >= 5 && data.recentAccuracy >= 60) {
    profile = "consistent";
  } else if (data.approvalScoreTrend === "up" && data.daysInactive <= 2) {
    profile = "recovering";
  } else {
    profile = "oscillating";
  }

  // State detection
  if (data.daysInactive >= 7 || (data.overdueReviews > 20 && data.recentAccuracy < 40)) {
    state = "critical";
  } else if (data.overdueReviews > 10 || data.daysInactive >= 3 || data.recentAccuracy < 50) {
    state = "risk";
  } else if (data.overdueReviews > 5 || data.approvalScoreTrend === "down") {
    state = "attention";
  } else {
    state = "active";
  }

  return { profile, state };
}
