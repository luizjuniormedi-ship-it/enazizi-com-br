/**
 * useProfileStatus — Sprint 1 hardening.
 *
 * Single source of truth for the user's profile gating state.
 * Backed by React Query so the profile is fetched ONCE per session and
 * shared across every guard / gate, instead of being re-fetched on every
 * navigation by ProtectedRoute's old useEffect.
 *
 * Also collapses the previous mix of localStorage flags into a single
 * derived "kind" the UI can switch on.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isProfileComplete } from "@/lib/profileValidation";

export type ProfileStatusKind =
  | "loading"
  | "anon"
  | "blocked"
  | "incomplete"
  | "pending"
  | "disabled"
  | "needs_welcome"
  | "needs_onboarding_v2"
  | "ready"
  | "error";

export interface ProfileStatus {
  kind: ProfileStatusKind;
  profile: ProfileRow | null;
  refresh: () => void;
}

interface ProfileRow {
  user_id: string;
  is_blocked: boolean | null;
  status: string | null;
  display_name: string | null;
  phone: string | null;
  periodo: number | null;
  faculdade: string | null;
  onboarding_version: number | null;
  user_type: string | null;
  target_exams: string[] | null;
}

const PROFILE_FIELDS =
  "user_id, is_blocked, status, display_name, phone, periodo, faculdade, onboarding_version, user_type, target_exams";

export function useProfileStatus(): ProfileStatus {
  const { user, loading: authLoading } = useAuth();

  const query = useQuery<ProfileRow | null>({
    queryKey: ["profile-status", user?.id ?? "anon"],
    enabled: !!user && !authLoading,
    staleTime: 5 * 60 * 1000, // 5 min — covers a typical study session
    gcTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select(PROFILE_FIELDS)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as ProfileRow | null;
    },
  });

  if (authLoading) return { kind: "loading", profile: null, refresh: () => query.refetch() };
  if (!user) return { kind: "anon", profile: null, refresh: () => query.refetch() };
  if (query.isLoading) return { kind: "loading", profile: null, refresh: () => query.refetch() };
  if (query.isError) return { kind: "error", profile: null, refresh: () => query.refetch() };

  const profile = query.data ?? null;

  if (profile?.is_blocked) {
    return { kind: "blocked", profile, refresh: () => query.refetch() };
  }

  const incomplete = !isProfileComplete({
    phone: profile?.phone ?? null,
    display_name: profile?.display_name ?? null,
    periodo: profile?.periodo ?? null,
    faculdade: profile?.faculdade ?? null,
    user_type: profile?.user_type ?? "estudante",
    target_exams: profile?.target_exams ?? null,
  });

  if (incomplete) return { kind: "incomplete", profile, refresh: () => query.refetch() };

  const status = profile?.status ?? "pending";
  if (status === "pending") return { kind: "pending", profile, refresh: () => query.refetch() };
  if (status === "disabled") return { kind: "disabled", profile, refresh: () => query.refetch() };

  // Onboarding V2 gating uses the database flag as source of truth.
  // localStorage is kept ONLY as an opt-out cache for skip behaviour.
  const obVersion = profile?.onboarding_version ?? 1;
  if (obVersion < 2) {
    const welcomeSeen = localStorage.getItem("enazizi_v2_welcome_seen") === "true";
    const onboardingDone = localStorage.getItem("enazizi_v2_onboarding_done") === "true";
    if (!welcomeSeen) return { kind: "needs_welcome", profile, refresh: () => query.refetch() };
    if (!onboardingDone)
      return { kind: "needs_onboarding_v2", profile, refresh: () => query.refetch() };
  }

  return { kind: "ready", profile, refresh: () => query.refetch() };
}
