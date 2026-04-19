import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Conversation, Msg } from "../agentChatTypes";

interface UseTutorHistoryOptions {
  user: { id: string } | null;
  functionName: string;
  welcomeMessage: string;
  setMessages: (messages: Msg[] | ((prev: Msg[]) => Msg[])) => void;
  /** Called when starting a fresh conversation (e.g. to clear pending session). */
  onStartNewConversation?: () => void;
}

/**
 * useTutorHistory
 * Owns: conversations list, active conversation id, load/create/delete conversations
 * and chat_messages persistence helpers.
 *
 * Behavior is preserved 1:1 from the previous monolithic useAgentChat.
 */
export function useTutorHistory({
  user,
  functionName,
  welcomeMessage,
  setMessages,
  onStartNewConversation,
}: UseTutorHistoryOptions) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("chat_conversations")
      .select("id, title, created_at")
      .eq("user_id", user.id)
      .eq("agent_type", functionName)
      .order("updated_at", { ascending: false })
      .limit(20);
    setConversations(data || []);
  }, [user, functionName]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const loadConversation = useCallback(
    async (convId: string) => {
      const { data } = await supabase
        .from("chat_messages")
        .select("role, content")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true });
      if (data && data.length > 0) {
        setMessages(
          data.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))
        );
      } else {
        setMessages([{ role: "assistant", content: welcomeMessage }]);
      }
      setActiveConversationId(convId);
      setShowHistory(false);
    },
    [welcomeMessage, setMessages]
  );

  const startNewConversation = useCallback(() => {
    onStartNewConversation?.();
    setActiveConversationId(null);
    setMessages([{ role: "assistant", content: welcomeMessage }]);
    setShowHistory(false);
  }, [onStartNewConversation, welcomeMessage, setMessages]);

  const deleteConversation = useCallback(
    async (convId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      await supabase.from("chat_conversations").delete().eq("id", convId);
      if (activeConversationId === convId) startNewConversation();
      loadConversations();
    },
    [activeConversationId, startNewConversation, loadConversations]
  );

  /**
   * Ensures a conversation exists for the current send. Creates a new one if none
   * is active, persisting the welcome message. Returns the conversation id (or null
   * if user is not authenticated / insert fails).
   */
  const ensureConversation = useCallback(
    async (firstUserText: string): Promise<string | null> => {
      if (!user) return null;
      if (activeConversationId) return activeConversationId;
      const convTitle = firstUserText.slice(0, 60);
      const { data: newConv } = await supabase
        .from("chat_conversations")
        .insert({ user_id: user.id, agent_type: functionName, title: convTitle })
        .select("id")
        .single();
      if (!newConv) return null;
      setActiveConversationId(newConv.id);
      await supabase.from("chat_messages").insert({
        conversation_id: newConv.id,
        user_id: user.id,
        role: "assistant",
        content: welcomeMessage,
      });
      return newConv.id;
    },
    [user, activeConversationId, functionName, welcomeMessage]
  );

  const persistUserMessage = useCallback(
    async (convId: string, content: string) => {
      if (!user) return;
      await supabase
        .from("chat_messages")
        .insert({ conversation_id: convId, user_id: user.id, role: "user", content });
      await supabase
        .from("chat_conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", convId);
    },
    [user]
  );

  const persistAssistantMessage = useCallback(
    async (convId: string, content: string) => {
      if (!user) return;
      await supabase
        .from("chat_messages")
        .insert({ conversation_id: convId, user_id: user.id, role: "assistant", content });
    },
    [user]
  );

  return {
    // State
    conversations,
    activeConversationId,
    showHistory,
    // Setters
    setActiveConversationId,
    setShowHistory,
    // Handlers
    loadConversations,
    loadConversation,
    startNewConversation,
    deleteConversation,
    ensureConversation,
    persistUserMessage,
    persistAssistantMessage,
  };
}
