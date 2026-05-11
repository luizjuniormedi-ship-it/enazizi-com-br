import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Detecta se o aluno autenticado tem um plano de Proficiência Guiada ATIVO.
 * Considera tanto alvo direto (user_id) quanto alvo por turma (class_id via class_members).
 *
 * Retorna o plano + subtemas estruturais + progresso + recursos vinculados.
 * Se não houver plano ativo, retorna null e a UI deve cair no fallback antigo.
 */

export interface ActivePlanLinkedResource {
  id: string;
  resource_type: "simulado" | "assignment" | "clinical_case" | "video_room" | "mentor_plan";
  resource_id: string;
}

export interface ActivePlanSubtopic {
  id: string;
  subtopic_id: string;
  sort_order: number | null;
  curriculum_subtopics?: {
    id: string;
    nome: string;
    topic_id: string;
    curriculum_topics?: {
      nome: string;
      specialty_id: string;
      curriculum_specialties?: { nome?: string; titulo?: string; title?: string; name?: string };
    };
  } | null;
}

export interface ActivePlanProgress {
  progress_percent: number;
  current_week: number;
  weekly_goal_status: "done" | "partial" | "missed";
  completed_tasks: number;
  pending_tasks: number;
  overdue_tasks: number;
  last_activity_at: string | null;
}

export interface ActiveProfessorPlan {
  id: string;
  name: string;
  exam_date: string | null;
  intensity: "leve" | "moderado" | "intenso";
  status: "active";
  notes: string | null;
  created_by: string;
  daysUntilExam: number | null;
  subtopics: ActivePlanSubtopic[];
  linkedResources: ActivePlanLinkedResource[];
  progress: ActivePlanProgress | null;
  /** Nome de exibição do professor responsável (display_name ou email) */
  professorName: string | null;
}

export function useStudentActivePlan() {
  return useQuery({
    queryKey: ["student_active_proficiency_plan"],
    staleTime: 60_000,
    queryFn: async (): Promise<ActiveProfessorPlan | null> => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return null;

      // 1) Encontrar plan_ids onde o usuário é alvo direto
      const { data: directTargets } = await supabase
        .from("professor_plan_targets")
        .select("plan_id")
        .eq("user_id", uid);
      const directPlanIds = (directTargets ?? []).map((t) => t.plan_id);

      // 2) Encontrar turmas ativas do usuário e plan_ids alvo por essas turmas
      const { data: classRows } = await supabase
        .from("class_members")
        .select("class_id")
        .eq("user_id", uid)
        .eq("is_active", true);
      const classIds = (classRows ?? []).map((c) => c.class_id);

      let classPlanIds: string[] = [];
      if (classIds.length > 0) {
        const { data: classTargets } = await supabase
          .from("professor_plan_targets")
          .select("plan_id")
          .in("class_id", classIds);
        classPlanIds = (classTargets ?? []).map((t) => t.plan_id);
      }

      const candidateIds = Array.from(new Set([...directPlanIds, ...classPlanIds]));
      if (candidateIds.length === 0) return null;

      // 3) Buscar planos ativos (mais recente primeiro)
      const { data: plans, error: plansErr } = await supabase
        .from("professor_plans")
        .select("id, name, exam_date, intensity, status, notes, created_by, created_at")
        .in("id", candidateIds)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1);
      if (plansErr) throw plansErr;
      const plan = plans?.[0];
      if (!plan) return null;

      // 4) Carregar subtemas + progresso + linked resources em paralelo
      const [subsRes, progRes, linkedRes, profRes] = await Promise.all([
        supabase
          .from("professor_plan_subtopics")
          .select(
            "id, subtopic_id, sort_order, curriculum_subtopics(id, nome, topic_id, curriculum_topics(nome, specialty_id, curriculum_specialties(id, nome)))",
          )
          .eq("plan_id", plan.id)
          .order("sort_order", { ascending: true, nullsFirst: false }),
        supabase
          .from("professor_plan_progress")
          .select(
            "progress_percent, current_week, weekly_goal_status, completed_tasks, pending_tasks, overdue_tasks, last_activity_at",
          )
          .eq("plan_id", plan.id)
          .eq("user_id", uid)
          .maybeSingle(),
        supabase
          .from("professor_plan_linked_resources")
          .select("id, resource_type, resource_id")
          .eq("plan_id", plan.id),
        supabase
          .from("profiles")
          .select("display_name, email")
          .eq("user_id", plan.created_by)
          .maybeSingle(),
      ]);

      const daysUntilExam = plan.exam_date
        ? Math.ceil((new Date(plan.exam_date).getTime() - Date.now()) / 86400000)
        : null;

      return {
        id: plan.id,
        name: plan.name,
        exam_date: plan.exam_date,
        intensity: plan.intensity as ActiveProfessorPlan["intensity"],
        status: "active",
        notes: plan.notes,
        created_by: plan.created_by,
        daysUntilExam,
        subtopics: (subsRes.data ?? []) as unknown as ActivePlanSubtopic[],
        linkedResources: (linkedRes.data ?? []) as ActivePlanLinkedResource[],
        progress: (progRes.data ?? null) as ActivePlanProgress | null,
        professorName:
          (profRes.data as any)?.display_name ?? (profRes.data as any)?.email ?? null,
      };
    },
  });
}
