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
import { useTutorMemoryBridge } from "./hooks/useTutorMemoryBridge";
import { telemetry } from "@/lib/pedagogicalTelemetry";
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
  /** Optional context propagated from TutorDrawer for memory scoping. */
  topic?: string | null;
  subtopic?: string | null;
  specialty?: string | null;
  /** Optional initial conversation to load. */
  initialConversationId?: string | null;
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
    topic = null,
    subtopic = null,
    specialty = null,
    initialConversationId = null,
  } = opts;

  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  // ── Memória pedagógica ──────────────────────────────────────────────────
  // Quando true, o próximo handleSend pula a busca em memória (forçar IA).
  const bypassMemoryRef = useRef(false);
  const memory = useTutorMemoryBridge({
    topic,
    subtopic,
    specialty,
    forceBypassRef: bypassMemoryRef,
  });

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
  const isAutoStartingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

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

  // Load initial conversation if provided
  useEffect(() => {
    if (initialConversationId && history.activeConversationId !== initialConversationId) {
      console.debug("[useAgentChat] Loading initial conversation:", initialConversationId);
      history.loadConversation(initialConversationId);
    }
  }, [initialConversationId, history.loadConversation]); // history.loadConversation is stable because of useCallback in useTutorHistory

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
      const requestId = crypto.randomUUID();
      const startTime = Date.now();
      console.log(`[TUTOR] SEND_STARTED id=${requestId}`);

      const text = overridePrompt || input.trim();
      if (!text || isLoading || sendCooldown || !user) {
        console.warn(`[TUTOR] SEND_SKIPPED id=${requestId}`, { text: !!text, isLoading, sendCooldown, user: !!user });
        return;
      }

      // Cancelar qualquer request anterior em curso
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

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
      console.log(`[TUTOR] REQUEST_CREATED id=${requestId}`);
      
      setInput("");
      setIsLoading(true);
      setLoadingStage("🔍 Buscando referências científicas...");
      const tutorStartedAt = Date.now();
      telemetry.track("tutor_message_sent", {
        topic: topic ?? null,
        subtopic: subtopic ?? null,
        message_length: text.length,
        requestId
      });

      // Watchdog implementation
      const watchdogTimeout = setTimeout(() => {
        if (isLoading) {
          console.error(`[TUTOR] WATCHDOG_TRIGGERED id=${requestId} - Stage: ${loadingStage} - elapsed=${Date.now() - startTime}ms`);
          setIsLoading(false);
          setLoadingStage("");
          const fallbackMsg = "Encontrei uma instabilidade temporária na base de conhecimento, mas vou continuar sua explicação com o conhecimento disponível.";
          
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last && last.role === "assistant") {
              if (!last.content || last.isError) {
                return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: fallbackMsg, isError: true } : m);
              }
              return prev;
            }
            if (last && last.role === "user") {
              return [...prev, { role: "assistant", content: fallbackMsg, isError: true }];
            }
            return prev;
          });

          toast({
            title: "Instabilidade Detectada",
            description: "A resposta está demorando mais que o esperado. O Tutor continuará com o conhecimento disponível.",
            variant: "destructive"
          });
        }
      }, 20000);

      const convId = await history.ensureConversation(text);
      if (convId) {
        await history.persistUserMessage(convId, text);
      }

      let assistantSoFar = "";
      let assistantMsgCreated = false;
      const contextToSend = contextOverride
        ? context.buildUserContext(contextOverride)
        : context.buildUserContext();

      try {
        setLoadingStage("🧠 Verificando memória pedagógica...");
        const reuse = await memory.lookup(text, user?.id ?? null);
        if (reuse && reuse.markdown) {
          clearTimeout(watchdogTimeout);
          setLoadingStage("✨ Recuperando resposta da memória...");
          const md = reuse.markdown;
          setMessages((prev) => [...prev, { 
            role: "assistant", 
            content: md,
            memoryId: reuse.hit.id,
            memoryReuseCount: (reuse.hit.reuse_count ?? 0) + 1,
            sourceQuestion: text,
            memoryQualityScore: reuse.hit.quality_score,
            memoryScope: reuse.hit.scope,
            memoryBlocks: reuse.hit.blocks,
          }]);
          if (convId) {
            await history.persistAssistantMessage(convId, md);
            history.loadConversations();
          }
          setIsLoading(false);
          setLoadingStage("");
          return;
        }
      } catch (err) {
        /* noop */
      }
      
      setLoadingStage("🔍 Analisando material e referências...");
      
      let adaptiveContext: unknown = undefined;
      let adaptiveStatus: "off" | "ok" | "failed" | "skipped" = "off";

      if (isAdaptiveEnabled) {
        const adaptive = await fetchAdaptive({
          message: text,
          conversationId: convId ?? null,
        });
        adaptiveStatus = adaptive.status;
        adaptiveContext = adaptive.context;
      }

      const applyDelta = (fullText: string, data?: any) => {
        if (!fullText) return;
        if (!assistantSoFar) setLoadingStage("✍️ Gerando resposta...");
        assistantSoFar = fullText;

        const ragBibliography = data?.sources?.map((s: any) => ({
          id: s.id,
          source: s.source || "Base de Conhecimento",
          content: s.content || "",
          document_id: s.document_id
        })) || [];

        if (!assistantMsgCreated) {
          assistantMsgCreated = true;
          setMessages((prev) => [...prev, { role: "assistant", content: assistantSoFar, bibliography: ragBibliography }]);
        } else {
          setMessages((prev) =>
            prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar, bibliography: ragBibliography } : m))
          );
        }
      };

      const fallbackMessage = "Encontrei uma instabilidade temporária na base de conhecimento, mas vou continuar sua explicação com o conhecimento disponível.";

      try {
        const result = await streamResponse({
          url: CHAT_URL,
          body: {
            messages: allMessages.map((m) => ({ role: m.role, content: m.content })),
            userContext: contextToSend || undefined,
            adaptiveContext: adaptiveContext,
            adaptiveMeta: { status: adaptiveStatus },
            conversationId: convId || undefined,
            topic: topic || undefined,
            subtopic: subtopic || undefined,
            specialty: specialty || undefined,
            requestId,
            sessionId: history.activeConversationId || undefined
          },
          signal: controller.signal,
          onFirstChunk: () => setLoadingStage("✍️ Gerando resposta..."),
          onDelta: applyDelta,
          onError: ({ status, message }) => {
            console.error(`[TUTOR] SEND_FAILED id=${requestId}`, { status, message });
            clearTimeout(watchdogTimeout);
            
            telemetry.track("tutor_error_detected", {
              requestId,
              status,
              reason: message,
              elapsed_ms: Date.now() - startTime,
              provider: "edge_function",
              phase: loadingStage
            });

            toast({ 
              title: "Tutor IA Indisponível", 
              description: message || "Erro ao conectar com o agente IA", 
              variant: "destructive" 
            });
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last && last.role === "assistant") {
                return prev.map((m, i) => i === prev.length - 1 ? { ...m, isError: true, content: fallbackMessage } : m);
              }
              return [...prev, { role: "assistant", content: fallbackMessage, isError: true }];
            });
          },
        });

        clearTimeout(watchdogTimeout);

        if (convId && assistantSoFar) {
          await history.persistAssistantMessage(convId, assistantSoFar);
          history.loadConversations();
        }

        if (assistantSoFar && assistantSoFar.trim().length > 0) {
          memory.persist({
            question: text,
            answerMarkdown: assistantSoFar,
            userId: user?.id ?? null,
            topic,
            subtopic,
            specialty,
          }).catch(() => {});
        }

        if (onSaveMessage && assistantSoFar) {
          try {
            const count = await onSaveMessage(assistantSoFar);
            if (count > 0) {
              setSavedMsgIdxs((prev) => new Set(prev).add(messages.length));
              toast({ title: "✅ Salvo automaticamente!", description: `${count} item(ns) salvo(s).` });
              context.reloadPreviousContent();
            }
          } catch { /* noop */ }
        }
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        console.error(`[TUTOR] SEND_FAILED id=${requestId}`, e);
        clearTimeout(watchdogTimeout);
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last && last.role === "assistant") {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: fallbackMessage, isError: true } : m);
          }
          return [...prev, { role: "assistant", content: fallbackMessage, isError: true }];
        });
      } finally {
        setIsLoading(false);
        setLoadingStage("");
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    },
    [input, isLoading, sendCooldown, user, quickActions, messages, telemetry, topic, subtopic, history, context, memory, isAdaptiveEnabled, fetchAdaptive, streamResponse, CHAT_URL, specialty, toast, onSaveMessage]
  );

  /**
   * Força a regeneração de uma resposta vinda da memória usando IA.
   * Usado pelo botão "Atualizar com IA" no MemoryReuseBadge.
   */
  const regenerateFromMemory = useCallback(
    (question: string) => {
      // Penaliza a memória cuja resposta o usuário rejeitou.
      const last = messages[messages.length - 1];
      if (last?.role === "assistant" && last.memoryId) {
        import("@/lib/tutor/tutorMemory")
          .then(({ adjustMemoryQuality }) => adjustMemoryQuality(last.memoryId!, -10))
          .catch(() => {});
      }
      telemetry.track("tutor_response_regenerated", {
        memory_id: last?.memoryId ?? null,
      });
      bypassMemoryRef.current = true;
      handleSend(question);
    },
    [handleSend, messages],
  );

  // Expose handleSend to parent
  useEffect(() => {
    if (onSendRef) onSendRef.current = (prompt: string) => handleSend(prompt);
    return () => {
      if (onSendRef) onSendRef.current = null;
    };
  }, [onSendRef, handleSend]);

  // Auto-fire initialPrompt once on mount — após session check
  useEffect(() => {
    if (!sessionChecked) return;
    if (pendingSession) return;
    if (!initialPrompt) return;
    if (initialPromptFiredRef.current) return;
    if (!user || isLoading) return;

    console.debug("[useAgentChat] Auto-firing initialPrompt:", initialPrompt);
    initialPromptFiredRef.current = true;
    
    // Pequeno delay para garantir estabilidade do mount
    const timer = setTimeout(() => {
      handleSend(initialPrompt);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [sessionChecked, pendingSession, initialPrompt, user, isLoading, handleSend]);

  // Cleanup no unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      window.speechSynthesis?.cancel();
    };
  }, []);

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
    regenerateFromMemory,

    // Toast / user (used by upload handler)
    toast,
    user,
  };
}
