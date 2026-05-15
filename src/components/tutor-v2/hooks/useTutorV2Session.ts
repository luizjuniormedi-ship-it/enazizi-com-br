import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useTutorV2Session(sessionId?: string) {
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [stats, setStats] = useState({
    topicsCount: 0,
    retention: 0,
    errors: 0
  });

  useEffect(() => {
    if (!sessionId) {
      setIsLoading(false);
      return;
    }

    const fetchSession = async () => {
      setIsLoading(true);
      try {
        const { data, error: fetchError } = await supabase
          .from("tutor_sessions")
          .select("*")
          .eq("id", sessionId)
          .single();

        if (fetchError) throw fetchError;
        setSession(data);

        // Simulated session stats for the timeline
        setStats({
          topicsCount: 5,
          retention: 78,
          errors: 2
        });
      } catch (err) {
        setError(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSession();

    // Subscribe to session changes (real-time stage updates)
    const channel = supabase
      .channel(`tutor_session_${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tutor_sessions',
          filter: `id=eq.${sessionId}`
        },
        (payload) => {
          console.log("[TUTOR_V2] Real-time session update:", payload.new);
          setSession(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);


  return { session, isLoading, error, stats };
}
