import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useTutorV2Messages(sessionId?: string) {
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) {
      setIsLoading(false);
      return;
    }

    const fetchMessages = async () => {
      setIsLoading(true);
      const { data } = await supabase
        .from("tutor_messages")
        .select("*")
        .eq("tutor_session_id", sessionId)
        .order("created_at", { ascending: true });

      if (data) setMessages(data);
      setIsLoading(false);
    };

    fetchMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel(`tutor_messages:${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'tutor_messages', filter: `tutor_session_id=eq.${sessionId}` },
        (payload) => {
          setMessages(prev => {
            const requestId = payload.new.metadata?.request_id || payload.new.id;
            
            // 1. Dedupe by canonical ID
            const exists = prev.some(m => 
              m.id === payload.new.id || 
              (m.metadata?.request_id && m.metadata.request_id === requestId) ||
              (m.id === requestId)
            );
            if (exists) return prev;
 
            // 2. Dedupe by content hash (safety for older messages or missing metadata)
            const isContentDuplicate = prev.some(m => 
              m.role === payload.new.role && 
              m.content === payload.new.content && 
              Math.abs(new Date(m.created_at).getTime() - new Date(payload.new.created_at).getTime()) < 10000
            );
            if (isContentDuplicate) return prev;

            return [...prev, payload.new];
          });
        }

      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  const addMessage = async (userId: string, role: string, content: string) => {
    const { data, error } = await supabase
      .from("tutor_messages")
      .insert({
        tutor_session_id: sessionId,
        user_id: userId,
        role,
        content
      })
      .select()
      .single();
    
    return { data, error };
  };

  return { messages, isLoading, addMessage, setMessages };
}
