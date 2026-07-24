import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Msg, Conversation } from "@/components/tutor/TutorConstants";
import { FUNCTION_NAME } from "@/components/tutor/TutorConstants";
import { dualWriteTutorSession, dualWriteTutorMessage } from "@/lib/tutorDualWrite";
import { trackStudyActivity } from "@/lib/educationalEngine";

/**
 * Hook de persistência do chat do Tutor (path legado `/dashboard/tutor-legacy`).
 *
 * A partir da Fase 2/3 (recuperação do Mentor IA v25):
 * - `createConversation` aceita `specialty` e `topic` e SEMPRE sincroniza
 *   com `tutor_sessions` para que o backend enxergue o contexto pedagógico
 *   (o gate anterior por feature-flag deixava tutor_sessions vazio para
 *   quem estivesse fora do rollout, o que quebrava a Fase 2).
 * - `saveMessage` continua sendo a única gravação primária em `chat_messages`
 *   e faz espelhamento fire-and-forget em `tutor_messages` via dualWrite.
 * - RLS já garante isolamento por `auth.uid()`; nunca passamos user_id
 *   vindo do frontend em consultas que dependem do dono.
 */
export function useChatMessages(userId: string | undefined) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const loadConversations = useCallback(async () => {
    if (!userId) return;
    // RLS: filtra por user_id = auth.uid() no servidor;
    // o .eq aqui é apenas otimização de índice.
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
      setMessages(data.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })));
    } else {
      setMessages([]);
    }
    setActiveConversationId(convId);
    setShowHistory(false);
    return data && data.length > 0;
  }, []);

  const createConversation = useCallback(
    async (title: string, opts?: { specialty?: string; topic?: string; mode?: "free" | "mission"; missionId?: string; phase?: string }) => {
      if (!userId) return null;
      const { data: newConv, error } = await supabase
        .from("chat_conversations")
        .insert({
          user_id: userId,
          agent_type: FUNCTION_NAME,
          title: title.slice(0, 60),
        })
        .select("id")
        .single();

      if (error || !newConv) {
        console.warn("[useChatMessages] createConversation failed:", error?.message);
        return null;
      }

      setActiveConversationId(newConv.id);

      // Sincroniza tutor_sessions com o contexto pedagógico (specialty/topic).
      // Sempre executa: sem esse mirror, o Tutor V3 recebe topic vazio.
      dualWriteTutorSession({
        userId,
        conversationId: newConv.id,
        mode: opts?.mode || "free",
        topic: opts?.topic,
        specialty: opts?.specialty,
        missionId: opts?.missionId,
        phase: opts?.phase,
      });

      return newConv.id;
    },
    [userId]
  );

  const saveMessage = useCallback(
    async (convId: string, role: "user" | "assistant", content: string) => {
      if (!userId) return;
      const { error } = await supabase.from("chat_messages").insert({
        conversation_id: convId,
        user_id: userId,
        role,
        content,
      });
      if (error) {
        console.warn("[useChatMessages] saveMessage failed:", error.message);
        return;
      }
      await supabase
        .from("chat_conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", convId);

      // Mirror fire-and-forget para tutor_messages.
      dualWriteTutorMessage({ userId, conversationId: convId, role, content });

      if (role === "user" && content.length > 10) {
        const conversation = conversations.find((c) => c.id === convId);
        const topic = conversation?.title || "Estudo Geral";
        trackStudyActivity({
          userId,
          topic,
          interactionCount: 1,
          studyTimeSeconds: 30,
        });
      }
    },
    [userId, conversations]
  );

  const deleteConversation = useCallback(
    async (convId: string) => {
      await supabase.from("chat_conversations").delete().eq("id", convId);
      if (activeConversationId === convId) {
        setActiveConversationId(null);
        setMessages([]);
      }
      loadConversations();
    },
    [activeConversationId, loadConversations]
  );

  const startNewSession = useCallback(() => {
    setActiveConversationId(null);
    setMessages([]);
    setShowHistory(false);
  }, []);

  return {
    messages,
    setMessages,
    conversations,
    activeConversationId,
    setActiveConversationId,
    showHistory,
    setShowHistory,
    loadConversations,
    loadConversation,
    createConversation,
    saveMessage,
    deleteConversation,
    startNewSession,
  };
}
