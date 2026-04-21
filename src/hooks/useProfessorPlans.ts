import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type PlanIntensity = "leve" | "moderado" | "intenso";
export type PlanStatus = "active" | "paused" | "finished";

export interface ProfessorPlan {
  id: string;
  name: string;
  exam_date: string | null;
  intensity: PlanIntensity;
  status: PlanStatus;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreatePlanInput {
  name: string;
  exam_date?: string | null;
  intensity: PlanIntensity;
  notes?: string;
  target_user_ids: string[];
  target_class_ids: string[];
  subtopic_ids: string[];
}

const PLANS_KEY = ["professor_plans"];

export function useProfessorPlansList() {
  return useQuery({
    queryKey: PLANS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professor_plans")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as ProfessorPlan[];
    },
  });
}

export function useProfessorPlanDetail(planId: string | null) {
  return useQuery({
    queryKey: ["professor_plan", planId],
    enabled: !!planId,
    queryFn: async () => {
      const [planRes, targetsRes, subsRes, progRes] = await Promise.all([
        supabase.from("professor_plans").select("*").eq("id", planId!).maybeSingle(),
        supabase.from("professor_plan_targets").select("*").eq("plan_id", planId!),
        supabase
          .from("professor_plan_subtopics")
          .select("id, subtopic_id, sort_order, curriculum_subtopics(id, nome, topic_id, curriculum_topics(nome, specialty_id, curriculum_specialties(nome)))")
          .eq("plan_id", planId!)
          .order("sort_order", { ascending: true, nullsFirst: false }),
        supabase.from("professor_plan_progress").select("*").eq("plan_id", planId!),
      ]);
      if (planRes.error) throw planRes.error;
      return {
        plan: planRes.data as ProfessorPlan,
        targets: targetsRes.data || [],
        subtopics: subsRes.data || [],
        progress: progRes.data || [],
      };
    },
  });
}

export function useCreateProfessorPlan() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: CreatePlanInput) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Não autenticado");

      const { data: plan, error: pErr } = await supabase
        .from("professor_plans")
        .insert({
          name: input.name,
          exam_date: input.exam_date || null,
          intensity: input.intensity,
          notes: input.notes || null,
          created_by: uid,
        })
        .select()
        .single();
      if (pErr) throw pErr;

      const targetRows = [
        ...input.target_user_ids.map((u) => ({ plan_id: plan.id, user_id: u })),
        ...input.target_class_ids.map((c) => ({ plan_id: plan.id, class_id: c })),
      ];
      if (targetRows.length > 0) {
        const { error: tErr } = await supabase.from("professor_plan_targets").insert(targetRows);
        if (tErr) throw tErr;
      }

      if (input.subtopic_ids.length > 0) {
        const subRows = input.subtopic_ids.map((sid, i) => ({
          plan_id: plan.id,
          subtopic_id: sid,
          sort_order: i,
        }));
        const { error: sErr } = await supabase.from("professor_plan_subtopics").insert(subRows);
        if (sErr) throw sErr;
      }

      return plan as ProfessorPlan;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PLANS_KEY });
      toast({ title: "Plano criado", description: "Proficiência Guiada ativada." });
    },
    onError: (e: any) => {
      toast({ title: "Erro ao criar plano", description: e.message, variant: "destructive" });
    },
  });
}

export function useUpdatePlanStatus() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ planId, status }: { planId: string; status: PlanStatus }) => {
      const { error } = await supabase
        .from("professor_plans")
        .update({ status })
        .eq("id", planId);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: PLANS_KEY });
      qc.invalidateQueries({ queryKey: ["professor_plan", vars.planId] });
      toast({ title: "Status atualizado" });
    },
    onError: (e: any) => {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    },
  });
}

export function useDeleteProfessorPlan() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (planId: string) => {
      const { error } = await supabase.from("professor_plans").delete().eq("id", planId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PLANS_KEY });
      toast({ title: "Plano removido" });
    },
    onError: (e: any) => {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    },
  });
}

export function useCurriculumTree() {
  return useQuery({
    queryKey: ["curriculum_tree_for_plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("curriculum_specialties")
        .select(
          "id, nome, ordem, curriculum_topics(id, nome, ordem, curriculum_subtopics(id, nome, ativo))"
        )
        .eq("ativo", true)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useStudentsSearch(query: string) {
  return useQuery({
    queryKey: ["students_search", query],
    enabled: query.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, display_name, email, faculdade, user_type")
        .eq("user_type", "estudante")
        .or(`display_name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });
}
