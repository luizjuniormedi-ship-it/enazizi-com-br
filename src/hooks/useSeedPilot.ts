import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface SeedPilotInput {
  professorEmail: string;
  studentEmails: string[];
}

export interface SeedPilotResult {
  success: true;
  turma: { id: string; name: string };
  planoIndividual: { id: string; name: string };
  planoTurma: { id: string; name: string };
  warnings: string[];
}

/**
 * Invoca a edge function seed-proficiency-pilot.
 * Autorização é feita server-side via role admin do caller (JWT).
 */
export function useSeedPilot() {
  const { toast } = useToast();
  return useMutation<SeedPilotResult, Error, SeedPilotInput>({
    mutationFn: async (input) => {
      const { data, error } = await supabase.functions.invoke(
        "seed-proficiency-pilot",
        { body: input },
      );
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data as SeedPilotResult;
    },
    onSuccess: (data) => {
      toast({
        title: "Ambiente de piloto criado",
        description: `Turma + 2 planos. Avisos: ${data.warnings.length}`,
      });
    },
    onError: (e) => {
      toast({
        title: "Falha ao criar piloto",
        description: e.message,
        variant: "destructive",
      });
    },
  });
}
