import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useSessionPersistence } from "@/hooks/useSessionPersistence";
import { useTutorVoice } from "./hooks/useTutorVoice";
import { useTutorHistory } from "./hooks/useTutorHistory";
import { useTutorContext } from "./hooks/useTutorContext";
import { useTutorStream } from "./hooks/useTutorStream";
import type { Msg, QuickAction, TimelineEntry } from "./agentChatTypes";

interface UseAgentChatOptions {
  functionName: string;
  welcomeMessage: string;
  welcomeMessageWithUploads?: string;
  autoPromptAfterUpload?: string;
  quickActions?: QuickAction[];
  onSaveMessage?: (content: string) => Promise<number>;
  previousContentLoader?: () => Promise<string>;
  initialPrompt?: string;
  onSendRef?: React.MutableRefObject<((prompt: string) => void) | null>;
}

/**
 * useAgentChat — Sprint 2 refactor
 * Now a thin orchestrator that composes:
 *  - useTutorVoice   (STT/TTS/autoSpeak)
 *  - useTutorHistory (conversations + chat_messages persistence)
 *  - useTutorContext (uploads/RAG/welcome/previousContent)
 *
 * Public API is preserved for backward compatibility with AgentChat.tsx and
 * all consumers. No feature flags activated; behavior identical to V1.
 */
export function useAgentChat(opts: UseAgentChatOptions) {
  const {
    functionName,
    welcomeMessage,
    welcomeMessageWithUploads,
    autoPromptAfterUpload,
    quickActions,
    onSaveMessage,
    previousContentLoader,
    initialPrompt,
    onSendRef,
  } = opts;

  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  // Core chat state (kept here — owned by orchestrator)
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: welcomeMessage },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<string>("");
  const [savingMsgIdx, setSavingMsgIdx] = useState<number | null>(null);
  const [savedMsgIdxs, setSavedMsgIdxs] = useState<Set<number>>(new Set());
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStep, setUploadStep] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [actionTimeline, setActionTimeline] = useState<TimelineEntry[]>([]);
  const [sendCooldown, setSendCooldown] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isUploadingRef = useRef(false);
  const autoPromptFiredRef = useRef(false);
  const initialPromptFiredRef = useRef(false);

  const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`;

  const {
    pendingSession,
    checked: sessionChecked,
    saveSession,
    completeSession,
    abandonSession,
    registerAutoSave,
    clearPending,
  } = useSessionPersistence({ moduleKey: functionName });

  // ── Specialized hooks ────────────────────────────────────────────────────
  const voice = useTutorVoice({ messages, isLoading, setInput });

  const context = useTutorContext({
    user,
    welcomeMessageWithUploads,
    messages,
    setMessages,
    previousContentLoader,
  });

  const history = useTutorHistory({
    user,
    functionName,
    welcomeMessage,
    setMessages,
    onStartNewConversation: completeSession,
  });

  const { streamResponse } = useTutorStream();

  // Auto-save (uses history.activeConversationId)
  useEffect(() => {
    registerAutoSave(() => {
      if (messages.length <= 1) return {};
      return { messages, activeConversationId: history.activeConversationId };
    });
  }, [messages, history.activeConversationId, registerAutoSave]);

  const handleResumeSession = useCallback(() => {
    if (!pendingSession?.session_data) return;
    const data = pendingSession.session_data as Record<string, any>;
    if (data.messages && Array.isArray(data.messages) && data.messages.length > 0) {
      setMessages(data.messages);
    }
    if (data.activeConversationId) history.setActiveConversationId(data.activeConversationId);
    clearPending();
  }, [pendingSession, clearPending, history]);

  const handleDiscardSession = useCallback(() => abandonSession(), [abandonSession]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = useCallback(
    async (overridePrompt?: string, contextOverride?: string) => {
      const text = overridePrompt || input.trim();
      if (!text || isLoading || sendCooldown || !user) return;

      setSendCooldown(true);
      setTimeout(() => setSendCooldown(false), 2000);

      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const matchedAction = quickActions?.find((a) => a.prompt === text);
      const timelineEntry = matchedAction
        ? {
            label: matchedAction.label.replace(/^[^\s]+\s/, ""),
            icon: matchedAction.icon || "💬",
            time: timeStr,
          }
        : {
            label: text.slice(0, 30) + (text.length > 30 ? "…" : ""),
            icon: "💬",
            time: timeStr,
          };
      setActionTimeline((prev) => [...prev, timelineEntry].slice(-8));

      const userMsg: Msg = { role: "user", content: text };
      const allMessages = [...messages, userMsg];
      setMessages(allMessages);
      setInput("");
      setIsLoading(true);
      setLoadingStage("🔍 Buscando referências científicas...");

      // Ensure conversation exists (delegated to useTutorHistory)
      const convId = await history.ensureConversation(text);
      if (convId) {
        await history.persistUserMessage(convId, text);
      }

      let assistantSoFar = "";
      const contextToSend = contextOverride
        ? context.buildUserContext(contextOverride)
        : context.buildUserContext();

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const accessToken = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const resp = await fetch(CHAT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            messages: allMessages.map((m) => ({ role: m.role, content: m.content })),
            userContext: contextToSend || undefined,
          }),
        });

        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}));
          const errorMessages: Record<number, string> = {
            429: "Limite de requisições atingido. Aguarde alguns segundos e tente novamente.",
            402: "Créditos de IA esgotados. Adicione créditos no seu workspace para continuar.",
            401: "Sessão expirada. Faça login novamente.",
            500: "Erro interno do servidor. Tente novamente.",
          };
          const description =
            errData.error || errorMessages[resp.status] || "Erro ao conectar com o agente IA";
          toast({ title: "Erro", description, variant: "destructive" });
          setIsLoading(false);
          setLoadingStage("");
          return;
        }

        if (!resp.body) throw new Error("No response body");

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let textBuffer = "";
        let streamDone = false;

        let pendingFlush = false;
        let lastFlushed = "";
        const flushAssistant = () => {
          pendingFlush = false;
          if (assistantSoFar === lastFlushed) return;
          lastFlushed = assistantSoFar;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (
              last?.role === "assistant" &&
              prev.length > 1 &&
              prev[prev.length - 2]?.role === "user"
            ) {
              return prev.map((m, i) =>
                i === prev.length - 1 ? { ...m, content: assistantSoFar } : m
              );
            }
            return [...prev, { role: "assistant", content: assistantSoFar }];
          });
        };
        const scheduleAssistantFlush = () => {
          if (pendingFlush) return;
          pendingFlush = true;
          if (typeof requestAnimationFrame !== "undefined")
            requestAnimationFrame(flushAssistant);
          else setTimeout(flushAssistant, 16);
        };

        const appendAssistantChunk = (content: string) => {
          if (!content) return;
          if (!assistantSoFar) setLoadingStage("✍️ Gerando resposta...");
          assistantSoFar += content;
          scheduleAssistantFlush();
        };

        const processSseLine = (rawLine: string): "ok" | "done" | "incomplete" => {
          let line = rawLine;
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") return "ok";
          if (!line.startsWith("data: ")) return "ok";
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") return "done";
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) appendAssistantChunk(content);
            return "ok";
          } catch {
            return "incomplete";
          }
        };

        while (!streamDone) {
          const { done, value } = await reader.read();
          if (done) break;
          textBuffer += decoder.decode(value, { stream: true });
          let newlineIndex: number;
          while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
            const line = textBuffer.slice(0, newlineIndex);
            textBuffer = textBuffer.slice(newlineIndex + 1);
            const result = processSseLine(line);
            if (result === "done") {
              streamDone = true;
              break;
            }
            if (result === "incomplete") {
              textBuffer = `${line}\n${textBuffer}`;
              break;
            }
          }
        }

        textBuffer += decoder.decode();
        if (textBuffer.trim()) {
          const remainingLines = textBuffer.split("\n");
          for (const line of remainingLines) {
            if (!line) continue;
            const result = processSseLine(line);
            if (result === "done") break;
          }
        }

        if (assistantSoFar !== lastFlushed) {
          lastFlushed = assistantSoFar;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (
              last?.role === "assistant" &&
              prev.length > 1 &&
              prev[prev.length - 2]?.role === "user"
            ) {
              return prev.map((m, i) =>
                i === prev.length - 1 ? { ...m, content: assistantSoFar } : m
              );
            }
            return [...prev, { role: "assistant", content: assistantSoFar }];
          });
        }

        if (convId && assistantSoFar) {
          await history.persistAssistantMessage(convId, assistantSoFar);
          history.loadConversations();
        }

        if (onSaveMessage && assistantSoFar) {
          try {
            const count = await onSaveMessage(assistantSoFar);
            if (count > 0) {
              const lastIdx = messages.length;
              setSavedMsgIdxs((prev) => new Set(prev).add(lastIdx));
              toast({
                title: "✅ Salvo automaticamente!",
                description: `${count} item(ns) salvo(s) no seu banco.`,
              });
              context.reloadPreviousContent();
            }
          } catch {
            /* noop */
          }
        }
      } catch (e) {
        console.error(e);
        toast({
          title: "Erro",
          description: "Falha ao conectar com o agente IA.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
        setLoadingStage("");
      }
    },
    [
      input,
      isLoading,
      sendCooldown,
      user,
      messages,
      quickActions,
      CHAT_URL,
      toast,
      onSaveMessage,
      history,
      context,
    ]
  );

  // Expose handleSend to parent
  useEffect(() => {
    if (onSendRef) onSendRef.current = (prompt: string) => handleSend(prompt);
    return () => {
      if (onSendRef) onSendRef.current = null;
    };
  }, [onSendRef, handleSend]);

  // Auto-fire initialPrompt
  useEffect(() => {
    if (initialPrompt && !initialPromptFiredRef.current && user && !isLoading) {
      initialPromptFiredRef.current = true;
      const timer = setTimeout(() => handleSend(initialPrompt), 500);
      return () => clearTimeout(timer);
    }
  }, [initialPrompt, user, isLoading, handleSend]);

  const handleSaveMessage = useCallback(
    async (idx: number, content: string) => {
      if (!onSaveMessage || savingMsgIdx !== null) return;
      setSavingMsgIdx(idx);
      try {
        const count = await onSaveMessage(content);
        setSavedMsgIdxs((prev) => new Set(prev).add(idx));
        toast({
          title: "Salvo!",
          description: `${count} questão(ões) salva(s) no seu banco.`,
        });
      } catch (e) {
        toast({
          title: "Erro",
          description: e instanceof Error ? e.message : "Erro ao salvar questões.",
          variant: "destructive",
        });
      } finally {
        setSavingMsgIdx(null);
      }
    },
    [onSaveMessage, savingMsgIdx, toast]
  );

  const copyToClipboard = useCallback(
    (text: string) => {
      navigator.clipboard.writeText(text);
      toast({
        title: "Copiado!",
        description: "Texto copiado para a área de transferência.",
      });
    },
    [toast]
  );

  return {
    // Core state
    messages,
    input,
    isLoading,
    loadingStage,
    savingMsgIdx,
    savedMsgIdxs,
    isUploading,
    uploadProgress,
    uploadStep,
    isFullscreen,
    actionTimeline,
    sendCooldown,
    pendingSession,
    sessionChecked,

    // History (proxied from useTutorHistory)
    conversations: history.conversations,
    activeConversationId: history.activeConversationId,
    showHistory: history.showHistory,
    setShowHistory: history.setShowHistory,
    loadConversation: history.loadConversation,
    startNewConversation: history.startNewConversation,
    deleteConversation: history.deleteConversation,

    // Context (proxied from useTutorContext)
    availableUploads: context.availableUploads,
    selectedUploadIds: context.selectedUploadIds,
    showUploads: context.showUploads,
    uploadSearch: context.uploadSearch,
    setAvailableUploads: context.setAvailableUploads,
    setSelectedUploadIds: context.setSelectedUploadIds,
    setShowUploads: context.setShowUploads,
    setUploadSearch: context.setUploadSearch,
    buildUserContext: context.buildUserContext,
    toggleUpload: context.toggleUpload,
    toggleAll: context.toggleAll,
    selectedCount: context.selectedCount,
    totalUploads: context.totalUploads,

    // Voice (proxied from useTutorVoice)
    isListening: voice.isListening,
    speakingMsgIdx: voice.speakingMsgIdx,
    autoSpeak: voice.autoSpeak,
    setAutoSpeak: voice.setAutoSpeak,
    toggleListening: voice.toggleListening,
    speakText: voice.speakText,
    hasSpeechRecognition: voice.hasSpeechRecognition,
    hasSpeechSynthesis: voice.hasSpeechSynthesis,

    // Refs
    scrollRef,
    fileInputRef,
    isUploadingRef,
    autoPromptFiredRef,
    previousContentRef: context.previousContentRef,

    // Setters used by upload handler / parent
    setIsUploading,
    setUploadProgress,
    setUploadStep,
    setInput,
    setIsFullscreen,

    // Handlers
    handleSend,
    handleResumeSession,
    handleDiscardSession,
    handleSaveMessage,
    copyToClipboard,

    // Toast / user (used by upload handler)
    toast,
    user,
  };
}
