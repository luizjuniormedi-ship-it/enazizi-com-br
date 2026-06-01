import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { clearLoginRefreshSignature } from "@/lib/force-login-refresh";

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

const AUTH_BOOTSTRAP_TIMEOUT_MS = 8000;
const AUTH_ACTION_TIMEOUT_MS = 12000;

const withAuthTimeout = async <T,>(promise: Promise<T>, message: string, timeoutMs = AUTH_ACTION_TIMEOUT_MS) =>
  Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      window.setTimeout(() => reject(new Error(message)), timeoutMs)
    ),
  ]);

const getSessionWithTimeout = () =>
  withAuthTimeout(
    supabase.auth.getSession(),
    "Tempo limite ao carregar sessão",
    AUTH_BOOTSTRAP_TIMEOUT_MS
  );

const getUserWithTimeout = () =>
  withAuthTimeout(
    supabase.auth.getUser(),
    "Tempo limite ao validar usuário",
    AUTH_BOOTSTRAP_TIMEOUT_MS
  );

const clearLocalAuthCache = async () => {
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // ignore local cleanup errors
  }

  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith("sb-") && key.includes("auth-token"))
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    // ignore storage errors
  }
};

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
      console.info(`[SOAK_USER] Auth event: ${event}`, { userId: nextSession?.user?.id });
      console.debug(`[Auth] event: ${event}`, { userId: nextSession?.user?.id });

      if (event === "INITIAL_SESSION") {
        // Bootstrap below validates the cached session before trusting it.
        // Accepting INITIAL_SESSION blindly can redirect the login page using
        // a stale token when the auth /user endpoint is failing.
        return;
      }
      
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

        // [HOTFIX 2026-06-01] Hard reset on every SIGNED_IN estava causando:
        // (1) sensação de "login não carrega" — reload imediato após submit
        // (2) Cronograma e outras páginas pesadas em branco — IndexedDB era
        //     apagado a cada login, derrubando caches usados na 1ª render.
        // O refresh só é necessário quando a release muda; main.tsx já cuida
        // disso comparando RELEASE_KEY. Não precisamos disparar aqui.
        // void forceLoginRefresh(nextSession);
      }

      if (event === "SIGNED_OUT") {
        clearLoginRefreshSignature();
        // Clear all session cache to prevent leaked data
        sessionStorage.clear();
      }

      if (event === "TOKEN_REFRESHED") {
        console.info("[SOAK_RECONNECT] Token refreshed successfully");
        console.debug("[Auth] token refreshed");
      }
    });

    let mounted = true;

    // Bootstrap: only hydrate state. Do NOT trigger forceLoginRefresh here.
    // If the auth endpoint stalls/fails, never keep the app on an infinite spinner.
    getSessionWithTimeout()
      .then(async ({ data: { session: bootstrapSession } }) => {
        if (!mounted) return;
        if (bootstrapSession) {
          const { data: { user: verifiedUser }, error } = await getUserWithTimeout();
          if (error || !verifiedUser) {
            throw error ?? new Error("Sessão local inválida");
          }
          setSession(bootstrapSession);
          setUser(verifiedUser);
          return;
        }
        setSession(bootstrapSession);
        setUser(bootstrapSession?.user ?? null);
      })
      .catch(async (err) => {
        if (!mounted) return;
        console.warn("[Auth] bootstrap failed; releasing loading state", err);
        await clearLocalAuthCache();
        setSession(null);
        setUser(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
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

      const { data, error } = await withAuthTimeout(
        supabase.auth.signUp({
          email,
          password,
          options: {
            data: metadata,
            emailRedirectTo: window.location.origin,
          },
        }),
        "Tempo limite ao criar conta. Tente novamente em instantes."
      );

      if (error) console.warn("[Auth] signUp error:", error.message);
      return { data, error: error as Error | null };
    } catch (err) {
      console.warn("[Auth] signUp threw:", err);
      return { data: null, error: err as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await withAuthTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        "Tempo limite ao entrar. O backend demorou para responder; tente novamente em instantes."
      );
      if (!error && data.session) {
        setSession(data.session);
        setUser(data.session.user ?? null);
        setLoading(false);
      }
      return { error: error as Error | null };
    } catch (err) {
      console.warn("[Auth] signIn timeout/error:", err);
      return { error: err as Error };
    }
  };

  const signOut = async () => {
    clearLoginRefreshSignature();
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await withAuthTimeout(
        supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        }),
        "Tempo limite ao enviar recuperação de senha. Tente novamente em instantes."
      );
      return { error: error as Error | null };
    } catch (err) {
      console.warn("[Auth] resetPassword timeout/error:", err);
      return { error: err as Error };
    }
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
