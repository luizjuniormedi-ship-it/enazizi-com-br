import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useTutorV2Session(sessionId?: string) {
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<any>(null);

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
      } catch (err) {
        setError(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSession();
  }, [sessionId]);

  return { session, isLoading, error };
}
