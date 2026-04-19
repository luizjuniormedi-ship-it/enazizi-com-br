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
import { useTutorAdaptiveContext } from "./hooks/useTutorAdaptiveContext";
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
  const { fetchAdaptive, isAdaptiveEnabled } = useTutorAdaptiveContext();

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

      // Sprint 5 — Adaptive context (opt-in via flag, falha-silenciosa).
      // Não bloqueia o envio se desligado ou se a edge falhar.
      let adaptiveContext: unknown = undefined;
      let adaptiveStatus: "off" | "ok" | "failed" | "skipped" = "off";
      if (isAdaptiveEnabled) {
        const adaptive = await fetchAdaptive({
          message: text,
          conversationId: convId ?? null,
        });
        adaptiveStatus = adaptive.status;
        if (adaptive.context) {
          adaptiveContext = adaptive.context;
        }
      }

      // Helper: apply a streamed delta to the messages array (last assistant turn).
      const applyDelta = (fullText: string) => {
        assistantSoFar = fullText;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (
            last?.role === "assistant" &&
            prev.length > 1 &&
            prev[prev.length - 2]?.role === "user"
          ) {
            return prev.map((m, i) =>
              i === prev.length - 1 ? { ...m, content: fullText } : m
            );
          }
          return [...prev, { role: "assistant", content: fullText }];
        });
      };

      try {
        const result = await streamResponse({
          url: CHAT_URL,
          body: {
            messages: allMessages.map((m) => ({ role: m.role, content: m.content })),
            userContext: contextToSend || undefined,
            // Campo opcional — backends antigos podem ignorar sem erro.
            adaptiveContext: adaptiveContext,
            adaptiveMeta: { status: adaptiveStatus },
          },
          onFirstChunk: () => setLoadingStage("✍️ Gerando resposta..."),
          onDelta: applyDelta,
          onError: ({ status, message }) => {
            const errorMessages: Record<number, string> = {
              429: "Limite de requisições atingido. Aguarde alguns segundos e tente novamente.",
              402: "Créditos de IA esgotados. Adicione créditos no seu workspace para continuar.",
              401: "Sessão expirada. Faça login novamente.",
              500: "Erro interno do servidor. Tente novamente.",
            };
            const description =
              (status && errorMessages[status]) ||
              message ||
              "Erro ao conectar com o agente IA";
            toast({ title: "Erro", description, variant: "destructive" });
          },
        });

        if (result === null) {
          // Error already surfaced via onError
          setIsLoading(false);
          setLoadingStage("");
          return;
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
      streamResponse,
      isAdaptiveEnabled,
      fetchAdaptive,
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
