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

        void forceLoginRefresh(session);
      }

      if (event === "SIGNED_OUT") {
        clearLoginRefreshSignature();
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (session) {
        void forceLoginRefresh(session);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, options: SignUpOptions) => {
    try {
      const metadata: Record<string, string | number> = { 
        full_name: options.displayName,
        display_name: options.displayName,
        role: options.userType === "professor" ? "professor" : "student",
        user_type: options.userType || "student"
      };
      
      if (options.faculdade) metadata.faculdade = options.faculdade;
      if (options.phone) metadata.phone = options.phone;
      if (options.periodo) metadata.periodo = options.periodo;

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      
      return { data, error: error as Error | null };
    } catch (err) {
      console.error("Erro inesperado no signUp:", err);
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
