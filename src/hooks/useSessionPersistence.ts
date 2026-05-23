import { useEffect, useRef, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface SessionData {
  id: string;
  session_data: Record<string, any>;
  updated_at: string;
  status: string;
}

interface UseSessionPersistenceOptions {
  moduleKey: string;
  enabled?: boolean;
  intervalMs?: number;
}

export const useSessionPersistence = ({ moduleKey, enabled = true, intervalMs = 30000 }: UseSessionPersistenceOptions) => {
  const { user } = useAuth();
  const [pendingSession, setPendingSession] = useState<SessionData | null>(null);
  const [checked, setChecked] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout>();
  const getStateRef = useRef<(() => Record<string, any>) | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  // Check for existing active session
  const checkForSession = useCallback(async () => {
    if (!user || !enabled) { setChecked(true); return null; }
    
    // Check localStorage backup first
    const backupKey = `enazizi_session_backup_${moduleKey}_${user.id}`;
    const backup = localStorage.getItem(backupKey);
    
    try {
      const { data } = await supabase
        .from("module_sessions")
        .select("id, session_data, updated_at, status")
        .eq("user_id", user.id)
        .eq("module_key", moduleKey)
        .eq("status", "active")
        .maybeSingle();

      let finalData = data;
      if (backup) {
        const parsed = JSON.parse(backup);
        // Use backup if it's newer than DB data
        if (!data || new Date(parsed.ts).getTime() > new Date(data.updated_at).getTime()) {
          console.info("[SessionPersistence] Using local backup as it is newer than DB data.");
          finalData = {
            id: data?.id || "temp_" + Date.now(),
            session_data: parsed.data,
            updated_at: new Date(parsed.ts).toISOString(),
            status: "active"
          };
        }
      }

      if (finalData) {
        setPendingSession(finalData as SessionData);
        if (finalData.id && !finalData.id.startsWith("temp_")) {
          sessionIdRef.current = finalData.id;
        }
      }
      setChecked(true);
      return finalData as SessionData | null;
    } catch (e) {
      console.warn("[SessionPersistence] checkForSession error:", e);
      if (backup) {
        const parsed = JSON.parse(backup);
        const data = {
          id: "temp_" + Date.now(),
          session_data: parsed.data,
          updated_at: new Date(parsed.ts).toISOString(),
          status: "active"
        };
        setPendingSession(data as SessionData);
        setChecked(true);
        return data as SessionData;
      }
      setChecked(true);
      return null;
    }
  }, [user, moduleKey, enabled]);


  // Save session
  const saveSession = useCallback(async (sessionData: Record<string, any>) => {
    if (!user || !enabled) return;
    
    // Save to localStorage as backup (offline-safe)
    const backupKey = `enazizi_session_backup_${moduleKey}_${user.id}`;
    localStorage.setItem(backupKey, JSON.stringify({
      data: sessionData,
      ts: Date.now()
    }));

    if (!navigator.onLine) {
      console.info("[SessionPersistence] Device offline, using local backup only.");
      return;
    }

    try {
      if (sessionIdRef.current) {
        const { error } = await supabase
          .from("module_sessions")
          .update({ session_data: sessionData as any, updated_at: new Date().toISOString() })
          .eq("id", sessionIdRef.current);
        
        if (error) throw error;
      } else {
        // Use upsert with onConflict for active sessions to avoid 409
        const { data, error } = await supabase
          .from("module_sessions")
          .upsert({
            user_id: user.id,
            module_key: moduleKey,
            session_data: sessionData as any,
            status: "active",
            updated_at: new Date().toISOString()
          }, { 
            onConflict: "user_id,module_key",
            ignoreDuplicates: false 
          })
          .select("id")
          .single();
          
        if (error) throw error;
        if (data) sessionIdRef.current = data.id;
      }
      
      localStorage.removeItem(backupKey);
    } catch (e) {
      console.warn("[SessionPersistence] saveSession error:", e);
    }
  }, [user, moduleKey, enabled]);


  // Save NOW (immediate, returns promise)
  const saveNow = useCallback(async () => {
    if (!getStateRef.current) return;
    const state = getStateRef.current();
    if (state && Object.keys(state).length > 0) {
      await saveSession(state);
    }
  }, [saveSession]);

  // Complete session
  const completeSession = useCallback(async () => {
    if (!sessionIdRef.current) return;
    try {
      await supabase
        .from("module_sessions")
        .update({ status: "completed" })
        .eq("id", sessionIdRef.current);
      sessionIdRef.current = null;
      setPendingSession(null);
    } catch (e) {
      console.warn("[SessionPersistence] completeSession error:", e);
    }
  }, []);

  // Abandon session
  const abandonSession = useCallback(async () => {
    if (!sessionIdRef.current && !pendingSession) return;
    const id = sessionIdRef.current || pendingSession?.id;
    if (!id) return;
    try {
      await supabase
        .from("module_sessions")
        .update({ status: "abandoned" })
        .eq("id", id);
      sessionIdRef.current = null;
      setPendingSession(null);
    } catch (e) {
      console.warn("[SessionPersistence] abandonSession error:", e);
    }
  }, [pendingSession]);

  // Register getState callback for auto-save
  const registerAutoSave = useCallback((getState: () => Record<string, any>) => {
    getStateRef.current = getState;
  }, []);

  // Auto-save interval + beforeunload with sendBeacon
  useEffect(() => {
    if (!enabled || !user) return;

    intervalRef.current = setInterval(() => {
      if (getStateRef.current) {
        const state = getStateRef.current();
        if (state && Object.keys(state).length > 0) {
          saveSession(state);
        }
      }
    }, intervalMs);

    const handleBeforeUnload = () => {
      if (!getStateRef.current || !sessionIdRef.current) return;
      const state = getStateRef.current();
      if (!state || Object.keys(state).length === 0) return;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      // Get session from localStorage directly to avoid async await in beforeunload
      const storageKey = `sb-${import.meta.env.VITE_SUPABASE_PROJECT_ID}-auth-token`;
      const sessionData = localStorage.getItem(storageKey);
      let token = supabaseKey;
      if (sessionData) {
        try {
          const parsed = JSON.parse(sessionData);
          token = parsed.access_token || supabaseKey;
        } catch (e) {
          console.warn("[SessionPersistence] Failed to parse auth token for beforeunload");
        }
      }

      if (supabaseUrl && supabaseKey && sessionIdRef.current) {
        const url = `${supabaseUrl}/rest/v1/module_sessions?id=eq.${sessionIdRef.current}`;
        const body = JSON.stringify({
          session_data: state,
          updated_at: new Date().toISOString(),
        });
        
        try {
          // [CORS_HARDENING] Standard fetch with keepalive and NO credentials.
          // Using the real user token in Authorization header allows RLS to pass
          // while credentials: 'omit' allows Access-Control-Allow-Origin: *
          fetch(url, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "apikey": supabaseKey,
              "Authorization": `Bearer ${token}`,
              "Prefer": "return=minimal",
            },
            body,
            keepalive: true,
            mode: 'cors',
            credentials: "omit",
          }).catch(() => {});
        } catch {
          // silent fallback
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      clearInterval(intervalRef.current);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [enabled, user, intervalMs, saveSession]);

  // Check on mount
  useEffect(() => {
    checkForSession();
  }, [checkForSession]);

  return {
    pendingSession,
    checked,
    saveSession,
    saveNow,
    completeSession,
    abandonSession,
    registerAutoSave,
    clearPending: () => setPendingSession(null),
  };
};
