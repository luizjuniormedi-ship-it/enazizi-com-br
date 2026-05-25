import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { clearLoginRefreshSignature, forceLoginRefresh } from "@/lib/force-login-refresh";

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
  signUp: (email: string, password: string, options: SignUpOptions) => Promise<{ data: any; error: Error | null }>;
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
    // Sprint 1 hardening: forceLoginRefresh now fires ONLY on a real
    // SIGNED_IN event. The bootstrap getSession() path no longer triggers
    // a refresh — that was racing against the listener and contributing to
    // "Invalid Refresh Token" errors during hard reload.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      console.info(`[LOAD_USER] Auth event: ${event}`, { userId: nextSession?.user?.id });
      console.debug(`[Auth] event: ${event}`, { userId: nextSession?.user?.id });
      
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);

      if (event === "SIGNED_IN") {
        localStorage.setItem("enazizi_last_login_ts", String(Date.now()));

        const uid = nextSession?.user?.id;
        if (uid) {
          const key = `enazizi_login_count_${uid}`;
          const prev = parseInt(localStorage.getItem(key) || "0", 10);
          const createdAt = nextSession?.user?.created_at;
          const isLegacyUser =
            !!createdAt && Date.now() - new Date(createdAt).getTime() > 24 * 60 * 60 * 1000;
          const nextCount = isLegacyUser ? Math.max(prev + 1, 3) : prev + 1;
          localStorage.setItem(key, String(nextCount));

          // Defer activity log import to keep auth listener lightweight.
          import("@/lib/activityLogger")
            .then(({ logActivity }) => logActivity(uid, "login"))
            .catch(() => {});
        }

        // Single source of refresh — guarded internally by signature + in-flight flag.
        void forceLoginRefresh(nextSession);
      }

      if (event === "SIGNED_OUT") {
        clearLoginRefreshSignature();
        // Clear all session cache to prevent leaked data
        sessionStorage.clear();
      }

      if (event === "TOKEN_REFRESHED") {
        console.debug("[Auth] token refreshed");
      }
    });

    // Bootstrap: only hydrate state. Do NOT trigger forceLoginRefresh here.
    supabase.auth.getSession().then(({ data: { session: bootstrapSession } }) => {
      setSession(bootstrapSession);
      setUser(bootstrapSession?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, options: SignUpOptions) => {
    try {
      const metadata: Record<string, any> = {
        full_name: options.displayName || "",
        display_name: options.displayName || "",
        role: options.userType === "professor" ? "professor" : "student",
        user_type: options.userType || "student",
      };

      if (options.faculdade) metadata.faculdade = options.faculdade;
      if (options.phone) metadata.phone = options.phone;
      if (options.periodo) metadata.periodo = options.periodo;

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) console.warn("[Auth] signUp error:", error.message);
      return { data, error: error as Error | null };
    } catch (err) {
      console.warn("[Auth] signUp threw:", err);
      return { data: null, error: err as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    clearLoginRefreshSignature();
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
