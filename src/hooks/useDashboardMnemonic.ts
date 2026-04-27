import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useCoreData } from "./useCoreData";
import type { PendingMnemonic } from "@/lib/mnemonicAdaptiveService";

export function useDashboardMnemonic() {
  const { user } = useAuth();
  const { data: coreData } = useCoreData();
  const resetAt = coreData?.profile.last_study_plan_reset_at ?? null;

  return useQuery<PendingMnemonic | null>({
    queryKey: ["dashboard-mnemonic", user?.id, resetAt],
    enabled: !!user,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    queryFn: async () => {
      let query = supabase
        .from("user_mnemonic_links")
        .select("id, created_at, updated_at, mnemonic_asset_id, topic, next_review_at, times_shown, helped_after_error, improvement_delta, mnemonic_not_helping, accuracy_before, accuracy_after, mnemonic_assets(*)")
        .eq("user_id", user!.id)
        .eq("mnemonic_not_helping", false);

      if (resetAt) query = query.gt("updated_at", resetAt);

      const { data, error } = await query
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (import.meta.env.DEV) {
        console.log("[RESET-DEBUG]", { component: "AdaptiveMnemonicCard", source: "user_mnemonic_links", resetAt, data });
      }

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