
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type ExperimentGroup = 'control' | 'experimental' | 'none';

export const useExperimentGroup = () => {
  const { user } = useAuth();

  const { data: group, isLoading } = useQuery({
    queryKey: ['user-experiment-group', user?.id],
    queryFn: async () => {
      if (!user) return 'none' as ExperimentGroup;

      // Chama a RPC para garantir que o usuário está atribuído ao experimento V6.1
      const { data: variantId, error: rpcError } = await supabase.rpc('assign_user_to_v6_experiment', {
        target_user_id: user.id
      });

      if (rpcError) {
        console.error("Error assigning user to experiment:", rpcError);
        return 'none' as ExperimentGroup;
      }

      return variantId as ExperimentGroup;
    },
    enabled: !!user,
    staleTime: Infinity, // A atribuição é permanente durante o estudo
  });

  return {
    group: group || 'none',
    isLoading,
    isExperimental: group === 'experimental',
    isControl: group === 'control'
  };
};
