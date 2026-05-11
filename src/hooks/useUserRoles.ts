import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useEffect } from "react";
import { toast } from "sonner";

export const useUserRoles = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["user-roles", user?.id],
    queryFn: async () => {
      if (!user) return { roles: [], isAdmin: false, isProfessor: false };
      
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      
      if (error) throw error;
      
      const roles = (data || []).map((r: any) => r.role as string);
      return {
        roles,
        isAdmin: roles.includes("admin"),
        isProfessor: roles.includes("professor"),
      };
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 1, // 1 minuto (role revogada persiste < 1min)
    gcTime: 1000 * 60 * 5,
  });

  // Realtime subscription para detecção de mudanças de cargo no usuário logado
  useEffect(() => {
    if (!user) return;

    // Usamos um ID único para evitar conflito entre múltiplas instâncias do hook
    const channelId = `user-roles-${user.id}-${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelId)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_roles",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          console.info("[useUserRoles] Role change detected via Realtime, invalidating query...");
          queryClient.invalidateQueries({ queryKey: ["user-roles", user.id] });
          toast.info("Suas permissões de acesso foram atualizadas.", {
            description: "O sistema sincronizou seus novos privilégios."
          });
        }
      );

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.debug(`[useUserRoles] Subscribed to role changes for ${user.id}`);
      }
    });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  return {
    isAdmin: data?.isAdmin ?? false,
    isProfessor: data?.isProfessor ?? false,
    roles: data?.roles ?? [],
    loading: isLoading,
  };
};