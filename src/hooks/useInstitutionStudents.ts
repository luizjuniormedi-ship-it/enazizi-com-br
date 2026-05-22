import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Lista de alunos visíveis ao professor logado, com filtros server-side.
 * Usa RPC `list_students_for_professor` (SECURITY DEFINER) que considera:
 *   - admin → todos
 *   - professor com instituição → alunos da mesma instituição
 *   - fallback (sem instituição vinculada) → alunos com a mesma faculdade do professor
 *
 * Substitui a busca cega anterior (`useStudentsSearch`) no fluxo de criação de
 * plano da Proficiência Guiada, sem alterar nenhuma RLS existente.
 */

export interface InstitutionStudent {
  user_id: string;
  display_name: string | null;
  email: string | null;
  faculdade: string | null;
  periodo: number | null;
  avatar_url: string | null;
}

export interface InstitutionStudentsFilters {
  faculdade?: string | null;
  periodo?: number | null;
  search?: string;
  classId?: string | null;
}

export function useInstitutionStudents(filters: InstitutionStudentsFilters = {}) {
  const { faculdade = null, periodo = null, search = "", classId = null } = filters;
  return useQuery({
    queryKey: ["institution_students", faculdade, periodo, search, classId],
    queryFn: async (): Promise<InstitutionStudent[]> => {
      const { data, error } = await (supabase as any).rpc(
        "list_students_for_professor",
        {
          _faculdade: faculdade,
          _periodo: periodo,
          _search: search?.trim() ? search.trim() : null,
          _limit: 200,
          _class_id: classId,
        }
      );
      if (error) throw error;
      return (data || []) as InstitutionStudent[];
    },
    staleTime: 60 * 1000,
  });
}

export interface InstitutionStudentFacets {
  faculdades: string[];
  periodos: number[];
  classes: { id: string; name: string }[];
}

export function useInstitutionStudentFacets() {
  return useQuery({
    queryKey: ["institution_students_facets"],
    queryFn: async (): Promise<InstitutionStudentFacets> => {
      const { data, error } = await (supabase as any).rpc(
        "list_student_facets_for_professor"
      );
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return {
        faculdades: (row?.faculdades || []) as string[],
        periodos: (row?.periodos || []) as number[],
        classes: (row?.classes || []) as { id: string; name: string }[],
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}
