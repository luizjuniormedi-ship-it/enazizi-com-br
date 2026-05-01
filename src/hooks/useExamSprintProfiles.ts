
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Migration helper to ensure exam_sprint_profiles table exists or handle data logic.
 * The schema already has `cme_exam_sprint_profiles` based on the previous audit.
 */

export const useExamSprintProfiles = (lessonId?: string) => {
  return useQuery({
    queryKey: ["exam-sprint-profiles", lessonId],
    queryFn: async () => {
      const query = supabase.from("cme_exam_sprint_profiles").select("*");
      if (lessonId) query.eq("lesson_id", lessonId);
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!lessonId
  });
};
