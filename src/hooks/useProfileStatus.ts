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

const PROFILE_FALLBACK_FIELDS =
  "user_id, is_blocked, status, display_name, phone, periodo, faculdade, onboarding_version, user_type, target_exam";

type ProfileQueryRow = ProfileRow | (Omit<ProfileRow, "target_exams"> & { target_exam?: string | null });

function normalizeProfileRow(data: ProfileQueryRow | null): ProfileRow | null {
  if (!data) return null;
  const targetExams = "target_exams" in data && Array.isArray(data.target_exams)
    ? data.target_exams
    : "target_exam" in data && data.target_exam
      ? [data.target_exam]
      : null;

  return {
    ...data,
    target_exams: targetExams,
  } as ProfileRow;
}

function shouldFallbackProfileQuery(error: any) {
  const status = Number(error?.status || error?.code || 0);
  const message = String(error?.message || error?.details || "");
  return status >= 500 || /target_exams|schema cache|column|profiles/i.test(message);
}

export function useProfileStatus(): ProfileStatus {
  const { user, session, loading: authLoading } = useAuth();

  const fetchProfile = async (fields: string): Promise<ProfileQueryRow | null> => {
    if (!user || !session?.access_token) return null;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 8000);
    const query = new URLSearchParams({ select: fields, user_id: `eq.${user.id}`, limit: "1" });

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/profiles?${query}`, {
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${session.access_token}`,
          Accept: "application/json",
        },
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const error = new Error(payload?.message || `Falha ao carregar perfil (${response.status})`) as Error & { status?: number; code?: string; details?: string };
        error.status = response.status;
        error.code = payload?.code;
        error.details = payload?.details;
        throw error;
      }
      return Array.isArray(payload) ? (payload[0] ?? null) : null;
    } catch (error) {
      if ((error as Error)?.name === "AbortError") throw new Error("Tempo limite ao carregar perfil");
      throw error;
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const query = useQuery<ProfileRow | null>({
    queryKey: ["profile-status", user?.id ?? "anon"],
    enabled: !!user && !authLoading,
    staleTime: 5 * 60 * 1000, // 5 min — covers a typical study session
    gcTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!user) return null;
      try {
        return normalizeProfileRow(await fetchProfile(PROFILE_FIELDS));
      } catch (error) {
        if (!shouldFallbackProfileQuery(error)) throw error;
        console.warn("[useProfileStatus] full profile query failed; retrying fallback fields", {
          code: (error as any)?.code,
          message: (error as Error)?.message,
        });
      }

      return normalizeProfileRow(await fetchProfile(PROFILE_FALLBACK_FIELDS));
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
