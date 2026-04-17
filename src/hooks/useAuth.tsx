import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface SignUpOptions {
  displayName: string;
  userType?: string;
  faculdade?: string;
  phone?: string;
  periodo?: number;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, options: SignUpOptions) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // Track login count for feedback survey (no reload - React state handles UI update)
      if (event === "SIGNED_IN") {
        // Mark fresh login for MissionEntry redirect
        localStorage.setItem("enazizi_last_login_ts", String(Date.now()));

        const uid = session?.user?.id;
        if (uid) {
          const key = `enazizi_login_count_${uid}`;
          const prev = parseInt(localStorage.getItem(key) || "0", 10);
          const createdAt = session?.user?.created_at;
          const isLegacyUser =
            !!createdAt && Date.now() - new Date(createdAt).getTime() > 24 * 60 * 60 * 1000;
          const nextCount = isLegacyUser ? Math.max(prev + 1, 3) : prev + 1;
          localStorage.setItem(key, String(nextCount));

          // Log login activity
          import("@/lib/activityLogger").then(({ logActivity }) => {
            logActivity(uid, "login");
          });
        }

        // ============================================================
        // GLOBAL REFRESH ON LOGIN (all platforms: web + PWA)
        // 1. Clear stale localStorage caches (missions, plans, snapshots)
        // 2. Clear ALL service worker caches
        // 3. Update SW + force reload if a new version is waiting
        // ============================================================
        try {
          // Force refresh on EVERY login transition (not just every 5 min).
          // We still guard against reload loops via sessionStorage flag below.
          const lastRefreshKey = "enazizi_last_global_refresh_ts";
          const shouldHardRefresh = true;

          if (shouldHardRefresh) {
            localStorage.setItem(lastRefreshKey, String(Date.now()));

            // 1. Purge stale per-user caches in localStorage
            const keysToPurge = Object.keys(localStorage).filter((k) =>
              k.startsWith("enazizi_mission_") ||
              k.startsWith("enazizi_dashboard_snapshot_") ||
              k.startsWith("enazizi_weekly_snap_") ||
              k.startsWith("enazizi_daily_plan_cache_") ||
              k.startsWith("rq-cache-")
            );
            keysToPurge.forEach((k) => {
              try { localStorage.removeItem(k); } catch { /* ignore */ }
            });

            // 2. Clear all Cache Storage entries (PWA + browser caches)
            if ("caches" in window) {
              caches.keys().then((names) => {
                names.forEach((name) => caches.delete(name).catch(() => {}));
              }).catch(() => {});
            }

            // 3. Update service worker; force activation of any new version
            if ("serviceWorker" in navigator) {
              navigator.serviceWorker.getRegistration().then((reg) => {
                if (!reg) return;
                reg.update().then(() => {
                  if (reg.waiting) {
                    reg.waiting.postMessage({ type: "SKIP_WAITING" });
                    let reloaded = false;
                    navigator.serviceWorker.addEventListener("controllerchange", () => {
                      if (reloaded) return;
                      reloaded = true;
                      window.location.reload();
                    });
                  }
                }).catch(() => {});
              }).catch(() => {});
            }

            // 4. MOBILE/PWA SAFETY NET: if the bundle release stored on this
            // device is older than the one currently running, force a hard
            // reload with cache-busting query so the WebView fetches fresh HTML.
            // This catches Android WebView / iOS standalone PWAs where the SW
            // serves stale assets even after login.
            try {
              const APP_RELEASE_KEY = "enazizi_release";
              const currentRelease = localStorage.getItem(APP_RELEASE_KEY);
              const loginRefreshFlag = "enazizi_login_hard_reload_done";
              const alreadyReloaded = sessionStorage.getItem(loginRefreshFlag);
              const isStandalonePWA =
                window.matchMedia("(display-mode: standalone)").matches ||
                // iOS Safari standalone
                (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

              if (!alreadyReloaded && (isStandalonePWA || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent))) {
                sessionStorage.setItem(loginRefreshFlag, "1");
                // Small delay to let auth state persist before reload
                setTimeout(() => {
                  const url = new URL(window.location.href);
                  url.searchParams.set("__r", currentRelease || String(Date.now()));
                  window.location.replace(url.toString());
                }, 800);
              }
            } catch {
              /* ignore */
            }
          }
        } catch {
          // Never block login on refresh errors
        }
      }

      // No-op on SIGNED_OUT — state is cleared by React
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, options: SignUpOptions) => {
    const metadata: Record<string, string | number> = { display_name: options.displayName };
    if (options.userType) metadata.user_type = options.userType;
    if (options.faculdade) metadata.faculdade = options.faculdade;
    if (options.phone) metadata.phone = options.phone;
    if (options.periodo) metadata.periodo = options.periodo;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
        emailRedirectTo: window.location.origin,
      },
    });
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error as Error | null };
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
