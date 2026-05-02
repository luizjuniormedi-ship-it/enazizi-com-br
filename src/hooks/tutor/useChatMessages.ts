import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Msg, Conversation } from "@/components/tutor/TutorConstants";
import { FUNCTION_NAME } from "@/components/tutor/TutorConstants";
import { dualWriteTutorSession, dualWriteTutorMessage } from "@/lib/tutorDualWrite";
import { trackStudyActivity } from "@/lib/educationalEngine";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";

export function useChatMessages(userId: string | undefined) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const { isEnabled } = useFeatureFlags();
  const tutorDualWriteEnabled = isEnabled("new_tutor_flow_enabled");

  const loadConversations = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("chat_conversations")
      .select("id, title, created_at")
      .eq("user_id", userId)
      .eq("agent_type", FUNCTION_NAME)
      .order("updated_at", { ascending: false })
      .limit(20);
    setConversations(data || []);
  }, [userId]);

  const loadConversation = useCallback(async (convId: string) => {
    const { data } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });
    if (data && data.length > 0) {
      setMessages(data.map(m => ({ role: m.role as "user" | "assistant", content: m.content })));
    }
    setActiveConversationId(convId);
    setShowHistory(false);
    return data && data.length > 0;
  }, []);

  const createConversation = useCallback(async (title: string) => {
    if (!userId) return null;
    const { data: newConv } = await supabase
      .from("chat_conversations")
      .insert({ user_id: userId, agent_type: FUNCTION_NAME, title: title.slice(0, 60) })
      .select("id")
      .single();
    if (newConv) {
      setActiveConversationId(newConv.id);
      // Dual-write: create tutor_session (flag-gated)
      if (tutorDualWriteEnabled) dualWriteTutorSession({ userId, conversationId: newConv.id });
      return newConv.id;
    }
    return null;
  }, [userId]);

  const saveMessage = useCallback(async (convId: string, role: "user" | "assistant", content: string) => {
    if (!userId) return;
    await supabase.from("chat_messages").insert({
      conversation_id: convId, user_id: userId, role, content,
    });
    await supabase.from("chat_conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);
    // Dual-write: mirror to tutor_messages (flag-gated)
    if (tutorDualWriteEnabled) dualWriteTutorMessage({ userId, conversationId: convId, role, content });
  }, [userId]);

  const deleteConversation = useCallback(async (convId: string) => {
    await supabase.from("chat_conversations").delete().eq("id", convId);
    if (activeConversationId === convId) {
      setActiveConversationId(null);
      setMessages([]);
    }
    loadConversations();
  }, [activeConversationId, loadConversations]);

  const startNewSession = useCallback(() => {
    setActiveConversationId(null);
    setMessages([]);
    setShowHistory(false);
  }, []);

  return {
    messages, setMessages,
    conversations, activeConversationId, setActiveConversationId,
    showHistory, setShowHistory,
    loadConversations, loadConversation, createConversation,
    saveMessage, deleteConversation, startNewSession,
  };
}
