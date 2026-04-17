import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { PendingMnemonic } from "@/lib/mnemonicAdaptiveService";

export function useDashboardMnemonic() {
  const { user } = useAuth();

  return useQuery<PendingMnemonic | null>({
    queryKey: ["dashboard-mnemonic", user?.id],
    enabled: !!user,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_mnemonic_links")
        .select("id, created_at, updated_at, mnemonic_asset_id, topic, next_review_at, times_shown, helped_after_error, improvement_delta, mnemonic_not_helping, accuracy_before, accuracy_after, mnemonic_assets(*)")
        .eq("user_id", user!.id)
        .eq("mnemonic_not_helping", false)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        if (error) throw error;
        return null;
      }

      const asset = (data as any).mnemonic_assets;
      if (!asset || asset.verdict === "rejected") return null;

      return {
        asset,
        link: data as any,
        reason: new Date(data.next_review_at) <= new Date() ? "spaced_review" : "pre_session",
      } satisfies PendingMnemonic;
    },
  });
}