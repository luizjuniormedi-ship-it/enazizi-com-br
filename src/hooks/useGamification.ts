import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Achievement {
  key: string;
  title: string;
  description: string;
  icon: string;
  category: "study" | "streak" | "social" | "milestone" | "evolution";
  condition: (stats: GamificationStats) => boolean;
}

export interface GamificationStats {
  xp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  weeklyXp: number;
  totalQuestions: number;
  totalSimulados: number;
  totalFlashcards: number;
  totalPlantao: number;
  totalAnamnese: number;
  totalReviews: number;
  totalMissions: number;
  approvalScore: number;
  errorsCorrected: number;
  topicsImproved: number;
  specialtiesMastered: number;
}

export const LEVEL_NAMES: Record<number, string> = {
  1: "Iniciante",
  2: "Iniciante",
  3: "Constante",
  4: "Constante",
  5: "Focado",
  6: "Focado",
  7: "Focado",
  8: "Competitivo",
  9: "Competitivo",
  10: "Competitivo",
  15: "Aprovação em Construção",
  20: "Especialista",
  25: "Elite Clínica",
  30: "Lenda da Medicina",
};

export function getLevelName(level: number): string {
  const thresholds = Object.keys(LEVEL_NAMES).map(Number).sort((a, b) => b - a);
  for (const t of thresholds) {
    if (level >= t) return LEVEL_NAMES[t];
  }
  return "Iniciante";
}

export const ACHIEVEMENTS: Achievement[] = [
  // Milestones - Questions
  { key: "first_question", title: "Primeira Questão", description: "Respondeu sua primeira questão", icon: "🎯", category: "milestone", condition: (s) => s.totalQuestions >= 1 },
  { key: "10_questions", title: "Dedicado", description: "Respondeu 10 questões", icon: "📝", category: "milestone", condition: (s) => s.totalQuestions >= 10 },
  { key: "50_questions", title: "Estudioso", description: "Respondeu 50 questões", icon: "📚", category: "milestone", condition: (s) => s.totalQuestions >= 50 },
  { key: "100_questions", title: "Centenário", description: "Respondeu 100 questões", icon: "💯", category: "milestone", condition: (s) => s.totalQuestions >= 100 },
  { key: "500_questions", title: "Mestre das Questões", description: "Respondeu 500 questões", icon: "🏅", category: "milestone", condition: (s) => s.totalQuestions >= 500 },
  // Study - Simulados & Flashcards
  { key: "first_simulado", title: "Primeiro Simulado", description: "Completou seu primeiro simulado", icon: "🏆", category: "study", condition: (s) => s.totalSimulados >= 1 },
  { key: "5_simulados", title: "Veterano de Provas", description: "Completou 5 simulados", icon: "🎖️", category: "study", condition: (s) => s.totalSimulados >= 5 },
  { key: "first_flashcard", title: "Memória Flash", description: "Criou seu primeiro flashcard", icon: "⚡", category: "study", condition: (s) => s.totalFlashcards >= 1 },
  { key: "50_flashcards", title: "Colecionador", description: "Criou 50 flashcards", icon: "🃏", category: "study", condition: (s) => s.totalFlashcards >= 50 },
  // Study - Plantão & Anamnese
  { key: "first_plantao", title: "Plantão Iniciante", description: "Completou seu primeiro plantão", icon: "🏥", category: "study", condition: (s) => s.totalPlantao >= 1 },
  { key: "5_plantao", title: "Plantonista Veterano", description: "Completou 5 plantões", icon: "🩺", category: "study", condition: (s) => s.totalPlantao >= 5 },
  { key: "first_anamnese", title: "Anamnese Completa", description: "Completou sua primeira anamnese", icon: "📋", category: "study", condition: (s) => s.totalAnamnese >= 1 },
  { key: "5_anamnese", title: "Entrevistador Clínico", description: "Completou 5 anamneses", icon: "🗣️", category: "study", condition: (s) => s.totalAnamnese >= 5 },
  // Study - Reviews
  { key: "first_review", title: "Rei da Revisão", description: "Completou sua primeira revisão no prazo", icon: "🔄", category: "study", condition: (s) => s.totalReviews >= 1 },
  { key: "50_reviews", title: "Memória de Elefante", description: "Completou 50 revisões", icon: "🐘", category: "study", condition: (s) => s.totalReviews >= 50 },
  // Streak
  { key: "streak_3", title: "Consistente", description: "Streak de 3 dias", icon: "🔥", category: "streak", condition: (s) => s.longestStreak >= 3 },
  { key: "streak_7", title: "Semana Perfeita", description: "Streak de 7 dias", icon: "🔥🔥", category: "streak", condition: (s) => s.longestStreak >= 7 },
  { key: "streak_14", title: "Duas Semanas Imparável", description: "Streak de 14 dias", icon: "💪", category: "streak", condition: (s) => s.longestStreak >= 14 },
  { key: "streak_30", title: "Mês de Ferro", description: "Streak de 30 dias", icon: "🏆🔥", category: "streak", condition: (s) => s.longestStreak >= 30 },
  // Level milestones
  { key: "level_5", title: "Nível 5 — Focado", description: "Alcançou o nível 5", icon: "⭐", category: "milestone", condition: (s) => s.level >= 5 },
  { key: "level_10", title: "Nível 10 — Competitivo", description: "Alcançou o nível 10", icon: "🌟", category: "milestone", condition: (s) => s.level >= 10 },
  { key: "level_25", title: "Nível 25 — Elite Clínica", description: "Alcançou o nível 25", icon: "💫", category: "milestone", condition: (s) => s.level >= 25 },
  // XP milestones
  { key: "xp_1000", title: "Mil XP", description: "Acumulou 1.000 XP", icon: "🎉", category: "milestone", condition: (s) => s.xp >= 1000 },
  { key: "xp_5000", title: "5K XP", description: "Acumulou 5.000 XP", icon: "🚀", category: "milestone", condition: (s) => s.xp >= 5000 },
  { key: "xp_10000", title: "10K XP", description: "Acumulou 10.000 XP", icon: "👑", category: "milestone", condition: (s) => s.xp >= 10000 },
  // Mission milestones
  { key: "first_mission", title: "Primeira Missão", description: "Completou sua primeira missão do dia", icon: "🚀", category: "milestone", condition: (s) => s.totalMissions >= 1 },
  { key: "10_missions", title: "Missionário", description: "Completou 10 missões", icon: "🎯", category: "milestone", condition: (s) => s.totalMissions >= 10 },
  // Approval Score
  { key: "approval_50", title: "Meio Caminho", description: "Approval Score acima de 50", icon: "📈", category: "milestone", condition: (s) => s.approvalScore >= 50 },
  { key: "approval_70", title: "Zona de Aprovação", description: "Approval Score acima de 70", icon: "🎓", category: "milestone", condition: (s) => s.approvalScore >= 70 },
  { key: "approval_90", title: "Quase Lá", description: "Approval Score acima de 90", icon: "🏅", category: "milestone", condition: (s) => s.approvalScore >= 90 },
  // Evolution - Learning-based achievements
  { key: "error_corrected_5", title: "Corretor de Falhas", description: "Corrigiu 5 erros recorrentes", icon: "🔧", category: "evolution", condition: (s) => s.errorsCorrected >= 5 },
  { key: "error_corrected_20", title: "Depurador Clínico", description: "Corrigiu 20 erros recorrentes", icon: "🛠️", category: "evolution", condition: (s) => s.errorsCorrected >= 20 },
  { key: "error_corrected_50", title: "Zero Defeitos", description: "Corrigiu 50 erros recorrentes", icon: "✅", category: "evolution", condition: (s) => s.errorsCorrected >= 50 },
  { key: "topics_improved_3", title: "Evoluindo", description: "Melhorou em 3 temas diferentes", icon: "📈", category: "evolution", condition: (s) => s.topicsImproved >= 3 },
  { key: "topics_improved_10", title: "Crescimento Constante", description: "Melhorou em 10 temas diferentes", icon: "🌱", category: "evolution", condition: (s) => s.topicsImproved >= 10 },
  { key: "topics_improved_25", title: "Transformação Total", description: "Melhorou em 25 temas diferentes", icon: "🦋", category: "evolution", condition: (s) => s.topicsImproved >= 25 },
  { key: "specialty_mastered_1", title: "Especialista", description: "Dominou uma especialidade (>80%)", icon: "🎓", category: "evolution", condition: (s) => s.specialtiesMastered >= 1 },
  { key: "specialty_mastered_3", title: "Polivalente", description: "Dominou 3 especialidades", icon: "🏆", category: "evolution", condition: (s) => s.specialtiesMastered >= 3 },
  { key: "specialty_mastered_5", title: "Domínio Amplo", description: "Dominou 5 especialidades", icon: "👑", category: "evolution", condition: (s) => s.specialtiesMastered >= 5 },
];

const XP_PER_LEVEL_BASE = 100;
const XP_GROWTH = 1.5;

export function xpForLevel(level: number): number {
  return Math.floor(XP_PER_LEVEL_BASE * Math.pow(XP_GROWTH, level - 1));
}

export function levelFromXp(totalXp: number): { level: number; currentLevelXp: number; nextLevelXp: number } {
  let level = 1;
  let remaining = totalXp;
  while (remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level);
    level++;
  }
  return { level, currentLevelXp: remaining, nextLevelXp: xpForLevel(level) };
}

export const XP_REWARDS = {
  question_answered: 5,
  question_correct: 10,
  simulado_completed: 50,
  flashcard_created: 3,
  plantao_completed: 75,
  anamnese_completed: 60,
  discursive_completed: 30,
  daily_login: 10,
  streak_bonus: 5,
  mission_completed: 100,
  review_on_time: 15,
  approval_improvement: 25,
  // Smart XP - learning-based
  error_corrected: 20,
  topic_improved: 30,
  specialty_level_up: 50,
  reinforcement_success: 15,
};

/** Calculate smart XP multiplier based on learning context */
export function getSmartXpMultiplier(context: {
  isErrorCorrection?: boolean;
  isTopicImproved?: boolean;
  isRepetition?: boolean;
  consecutiveCorrect?: number;
}): number {
  let multiplier = 1.0;
  if (context.isErrorCorrection) multiplier += 0.5;
  if (context.isTopicImproved) multiplier += 0.3;
  if (context.isRepetition) multiplier *= 0.6;
  if (context.consecutiveCorrect && context.consecutiveCorrect >= 3) multiplier += 0.2;
  return Math.round(multiplier * 10) / 10;
}

interface GamificationData {
  xp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  weeklyXp: number;
  lastActivityDate: string | null;
}

interface GamificationQueryData {
  gamification: GamificationData;
  unlockedKeys: Set<string>;
}

async function fetchGamificationData(userId: string): Promise<GamificationQueryData> {
  const [gamRes, achRes] = await Promise.all([
    supabase.from("user_gamification").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("user_achievements").select("achievement_key").eq("user_id", userId),
  ]);

  let gamification: GamificationData;

  if (!gamRes.data) {
    const { data, error } = await supabase
      .from("user_gamification")
      .upsert({ user_id: userId }, { onConflict: 'user_id' })
      .select()
      .single();
      
    if (error) {
      // If still fails, try to fetch again (might have been created by another call)
      const { data: retryData } = await supabase.from("user_gamification").select("*").eq("user_id", userId).maybeSingle();
      if (retryData) {
        const g = retryData as any;
        gamification = {
          xp: g.xp, level: g.level, currentStreak: g.current_streak,
          longestStreak: g.longest_streak, weeklyXp: g.weekly_xp,
          lastActivityDate: g.last_activity_date,
        };
      } else {
        gamification = { xp: 0, level: 1, currentStreak: 0, longestStreak: 0, weeklyXp: 0, lastActivityDate: null };
      }
    } else {
      gamification = { xp: 0, level: 1, currentStreak: 0, longestStreak: 0, weeklyXp: 0, lastActivityDate: null };
    }
  } else {
    const g = gamRes.data as any;
    gamification = {
      xp: g.xp, level: g.level, currentStreak: g.current_streak,
      longestStreak: g.longest_streak, weeklyXp: g.weekly_xp,
      lastActivityDate: g.last_activity_date,
    };
  }

  const unlockedKeys = new Set((achRes.data || []).map((a: any) => a.achievement_key));
  return { gamification, unlockedKeys };
}

export function useGamification() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newAchievement, setNewAchievement] = useState<Achievement | null>(null);

  const { data, isLoading: loading } = useQuery({
    queryKey: ["gamification", user?.id],
    queryFn: () => fetchGamificationData(user!.id),
    enabled: !!user,
    staleTime: 60 * 1000, // 60s
    gcTime: 5 * 60 * 1000,
  });

  const gamification = data?.gamification ?? null;
  const unlockedKeys = data?.unlockedKeys ?? new Set<string>();

  const addXp = useCallback(async (amount: number, activityType?: string) => {
    if (!user || !gamification) return;
    
    const today = new Date().toISOString().split("T")[0];
    const lastDate = gamification.lastActivityDate;
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    
    let newStreak = gamification.currentStreak;
    if (lastDate !== today) {
      newStreak = lastDate === yesterday ? gamification.currentStreak + 1 : 1;
    }
    const longestStreak = Math.max(gamification.longestStreak, newStreak);
    
    const streakBonus = newStreak > 1 ? XP_REWARDS.streak_bonus * Math.min(newStreak, 10) : 0;
    const totalAmount = amount + streakBonus;
    
    const newXp = gamification.xp + totalAmount;
    const { level } = levelFromXp(newXp);

    // Check weekly reset
    let currentWeeklyXp = gamification.weeklyXp;
    const { data: freshData } = await supabase
      .from("user_gamification")
      .select("weekly_reset_at, weekly_xp")
      .eq("user_id", user.id)
      .single();
    
    if (freshData) {
      const resetAt = new Date(freshData.weekly_reset_at);
      if (new Date() >= resetAt) {
        currentWeeklyXp = 0;
        const nextMonday = new Date();
        nextMonday.setDate(nextMonday.getDate() + ((8 - nextMonday.getDay()) % 7 || 7));
        nextMonday.setHours(0, 0, 0, 0);
        await supabase.from("user_gamification").update({
          weekly_xp: 0,
          weekly_reset_at: nextMonday.toISOString(),
        }).eq("user_id", user.id);
      } else {
        currentWeeklyXp = freshData.weekly_xp;
      }
    }
    
    const newWeeklyXp = currentWeeklyXp + totalAmount;

    await supabase.from("user_gamification").update({
      xp: newXp, level, current_streak: newStreak, longest_streak: longestStreak,
      weekly_xp: newWeeklyXp, last_activity_date: today, updated_at: new Date().toISOString(),
    }).eq("user_id", user.id);

    // Optimistic update
    const newGam: GamificationData = { xp: newXp, level, currentStreak: newStreak, longestStreak, weeklyXp: newWeeklyXp, lastActivityDate: today };
    queryClient.setQueryData<GamificationQueryData>(["gamification", user.id], (old) => ({
      gamification: newGam,
      unlockedKeys: old?.unlockedKeys ?? new Set(),
    }));

    // Check achievements
    const stats: GamificationStats = {
      xp: newXp, level, currentStreak: newStreak, longestStreak,
      weeklyXp: newWeeklyXp, totalQuestions: 0, totalSimulados: 0, totalFlashcards: 0,
      totalPlantao: 0, totalAnamnese: 0, totalReviews: 0, totalMissions: 0, approvalScore: 0,
      errorsCorrected: 0, topicsImproved: 0, specialtiesMastered: 0,
    };

    const [qRes, simRes, fcRes, plRes, anRes, revRes, apRes, errRes, domRes] = await Promise.all([
      supabase.from("practice_attempts").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("exam_sessions").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "finished"),
      supabase.from("flashcards").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("simulation_history").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("anamnesis_results").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("revisoes").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "concluida"),
      supabase.from("approval_scores").select("score").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1),
      supabase.from("error_bank").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("dominado", true),
      supabase.from("medical_domain_map").select("domain_score").eq("user_id", user.id),
    ]);
    stats.totalQuestions = qRes.count || 0;
    stats.totalSimulados = simRes.count || 0;
    stats.totalFlashcards = fcRes.count || 0;
    stats.totalPlantao = plRes.count || 0;
    stats.totalAnamnese = anRes.count || 0;
    stats.totalReviews = revRes.count || 0;
    stats.approvalScore = (apRes.data && apRes.data[0]) ? Number((apRes.data[0] as any).score) : 0;
    stats.errorsCorrected = errRes.count || 0;
    stats.specialtiesMastered = (domRes.data || []).filter((d: any) => d.domain_score >= 80).length;
    // topicsImproved: count topics with accuracy >= 70 and at least 5 questions
    const { count: improvedCount } = await supabase.from("user_topic_profiles").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("accuracy", 70).gte("total_questions", 5);
    stats.topicsImproved = improvedCount || 0;

    for (const ach of ACHIEVEMENTS) {
      if (!unlockedKeys.has(ach.key) && ach.condition(stats)) {
        await supabase.from("user_achievements").insert({ user_id: user.id, achievement_key: ach.key });
        queryClient.setQueryData<GamificationQueryData>(["gamification", user.id], (old) => {
          const newKeys = new Set(old?.unlockedKeys ?? []);
          newKeys.add(ach.key);
          return { gamification: old?.gamification ?? newGam, unlockedKeys: newKeys };
        });
        setNewAchievement(ach);
        setTimeout(() => setNewAchievement(null), 4000);
      }
    }

    return totalAmount;
  }, [user, gamification, unlockedKeys, queryClient]);

  const dismissAchievement = useCallback(() => setNewAchievement(null), []);
  const refetch = useCallback(() => {
    if (user) queryClient.invalidateQueries({ queryKey: ["gamification", user.id] });
  }, [user, queryClient]);

  return { gamification, loading, addXp, unlockedKeys, newAchievement, dismissAchievement, refetch };
}
