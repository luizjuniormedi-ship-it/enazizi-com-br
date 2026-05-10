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

      // Watchdog implementation - Reduzido para 20s conforme solicitado
      const watchdogTimeout = setTimeout(() => {
        if (isLoading) {
          console.error(`[TUTOR] WATCHDOG_TRIGGERED id=${requestId} - Stage: ${loadingStage} - elapsed=${Date.now() - startTime}ms`);
          setIsLoading(false);
          setLoadingStage("");
          const fallbackMsg = "Encontrei uma instabilidade temporária na base de conhecimento, mas vou continuar sua explicação com o conhecimento disponível.";
          
          setMessages(prev => {
            const last = prev[prev.length - 1];
            // Se já tivermos o assistant no final, mas vazio ou erro
            if (last && last.role === "assistant") {
              if (!last.content || last.isError) {
                return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: fallbackMsg, isError: true } : m);
              }
              return prev;
            }
            // Se a última for do user, adiciona o assistant fallback
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

      // Ensure conversation exists
      const convId = await history.ensureConversation(text);
      if (convId) {
        await history.persistUserMessage(convId, text);
        console.log(`[TUTOR] PERSIST_STARTED (user) id=${requestId}`);
      }

      let assistantSoFar = "";
      const contextToSend = contextOverride
        ? context.buildUserContext(contextOverride)
        : context.buildUserContext();

      // ── Memória pedagógica: lookup ANTES da IA ─────────────────────────
      try {
        setLoadingStage("🧠 Verificando memória pedagógica...");
        const reuse = await memory.lookup(text, user?.id ?? null);
        if (reuse && reuse.markdown) {
          console.log(`[TUTOR] MEMORY_HIT id=${requestId}`);
          clearTimeout(watchdogTimeout);
          import("@/lib/tutor/tutorMemory")
            .then(({ adjustMemoryQuality }) => adjustMemoryQuality(reuse.hit.id, +1))
            .catch(() => {});
          setLoadingStage("✨ Recuperando resposta da memória...");
          const md = reuse.markdown;
          const slices = [
            md.slice(0, Math.floor(md.length * 0.4)),
            md.slice(0, Math.floor(md.length * 0.75)),
            md,
          ];
          for (const partial of slices) {
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (
                last?.role === "assistant" &&
                prev.length > 1 &&
                prev[prev.length - 2]?.role === "user"
              ) {
                return prev.map((m, i) =>
                  i === prev.length - 1 ? { ...m, content: partial } : m,
                );
              }
              return [
                ...prev,
                { role: "assistant", content: partial },
              ];
            });
            await new Promise((r) => setTimeout(r, 90));
          }
          setMessages((prev) =>
            prev.map((m, i) =>
              i === prev.length - 1 && m.role === "assistant"
                ? {
                    ...m,
                    content: md,
                    memoryId: reuse.hit.id,
                    memoryReuseCount: (reuse.hit.reuse_count ?? 0) + 1,
                    sourceQuestion: text,
                    memoryQualityScore: reuse.hit.quality_score,
                    memoryScope: reuse.hit.scope,
                    memoryBlocks: reuse.hit.blocks,
                  }
                : m,
            ),
          );
          if (convId) {
            await history.persistAssistantMessage(convId, md);
            history.loadConversations();
          }
          telemetry.track("tutor_memory_reused", {
            memory_id: reuse.hit.id,
            quality_score: reuse.hit.quality_score,
            response_ms: Date.now() - tutorStartedAt,
            requestId
          });
          setIsLoading(false);
          setLoadingStage("");
          console.log(`[TUTOR] UI_UNLOCKED id=${requestId} source=memory`);
          return;
        }
      } catch (err) {
        if (import.meta.env.DEV) console.warn("[memory] lookup error", err);
      }
      
      // Redundant RAG removed — mentor-chat handles retrieval internally for better performance and resilience.
      setLoadingStage("🔍 Analisando material e referências...");
      
      let adaptiveContext: unknown = undefined;
      let adaptiveStatus: "off" | "ok" | "failed" | "skipped" = "off";
      let ragBibliography: any[] = [];

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

      const applyDelta = (fullText: string, data?: any) => {
        if (!assistantSoFar && fullText) console.log(`[TUTOR] STREAM_CHUNK_RECEIVED id=${requestId}`);
        assistantSoFar = fullText;
        if (data?.sources && Array.isArray(data.sources)) {
          ragBibliography = data.sources.map((s: any) => ({
            id: s.id,
            source: s.source || "Base de Conhecimento",
            content: s.content || "",
            document_id: s.document_id
          }));
        }

        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (
            last?.role === "assistant" &&
            prev.length > 1 &&
            prev[prev.length - 2]?.role === "user"
          ) {
            return prev.map((m, i) =>
              i === prev.length - 1 ? { ...m, content: fullText, bibliography: ragBibliography } : m
            );
          }
          return [...prev, { role: "assistant", content: fullText, bibliography: ragBibliography }];
        });
      };

      const fallbackMessage = "Encontrei uma instabilidade temporária na base de conhecimento, mas vou continuar sua explicação com o conhecimento disponível.";

      try {
        console.log(`[TUTOR] PROVIDER_STARTED id=${requestId}`);
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
          onFirstChunk: () => {
            console.log(`[TUTOR] PROVIDER_RESPONSE_RECEIVED id=${requestId}`);
            console.log(`[TUTOR] STREAM_STARTED id=${requestId}`);
            console.log(`[TUTOR] ASSISTANT_APPEND_STARTED id=${requestId}`);
            setLoadingStage("✍️ Gerando resposta...");
          },
          onDelta: applyDelta,
          onError: ({ status, message }) => {
            console.error(`[TUTOR] SEND_FAILED id=${requestId}`, { status, message });
            clearTimeout(watchdogTimeout);
            
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
        console.log(`[TUTOR] STREAM_FINISHED id=${requestId}`);
        console.log(`[TUTOR] ASSISTANT_APPEND_FINISHED id=${requestId}`);

        if (result === null && !assistantSoFar) {
          setIsLoading(false);
          setLoadingStage("");
          console.log(`[TUTOR] SEND_COMPLETED (empty) id=${requestId}`);
          console.log(`[TUTOR] LOADING_CLEARED id=${requestId}`);
          return;
        }

        if (convId && assistantSoFar) {
          console.log(`[TUTOR] PERSIST_STARTED id=${requestId}`);
          await history.persistAssistantMessage(convId, assistantSoFar);
          console.log(`[TUTOR] PERSIST_FINISHED id=${requestId}`);
          history.loadConversations();
        }

        if (assistantSoFar) {
          telemetry.track("tutor_response_received", {
            source: "ai",
            response_ms: Date.now() - tutorStartedAt,
            length: assistantSoFar.length,
            requestId
          });
          console.log(`[TUTOR] SEND_COMPLETED (success) id=${requestId}`);
        }

        // ── Memória pedagógica: persist DEPOIS da IA ────────────────────
        if (assistantSoFar && assistantSoFar.trim().length > 0) {
          memory
            .persist({
              question: text,
              answerMarkdown: assistantSoFar,
              userId: user?.id ?? null,
              topic,
              subtopic,
              specialty,
            })
            .catch(() => {});
        }

        console.log(`[TUTOR] SEND_COMPLETED id=${requestId}`);

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
        console.log(`[TUTOR] UI_UNLOCKED id=${requestId} elapsed=${Date.now() - startTime}ms`);
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

  // Auto-fire initialPrompt
  useEffect(() => {
    // Se temos um ID de conversa inicial sendo carregado, não disparar autostart
    if (initialConversationId) {
      console.debug("[useAgentChat] initialConversationId present, deferring initialPrompt autostart");
      initialPromptFiredRef.current = true;
      return;
    }

    // Se temos mensagens e o prompt inicial, e a conversa já é a ativa, marcamos como disparado para evitar duplicidade no refresh
    if (messages.length > 1 && initialPrompt && !initialPromptFiredRef.current) {
      // Formata o prompt esperado para comparação
      const formattedInitial = initialPrompt.toLowerCase().startsWith("quero estudar") 
        ? initialPrompt.toLowerCase() 
        : `quero estudar: ${initialPrompt.toLowerCase()}`;

      const hasInitialMessage = messages.some(m => 
        m.role === "user" && 
        (m.content.toLowerCase().includes(formattedInitial) || m.content.toLowerCase().includes(initialPrompt.toLowerCase()))
      );

      if (hasInitialMessage) {
        console.debug("[useAgentChat] initialPrompt already present in history, skipping autostart");
        initialPromptFiredRef.current = true;
        return;
      }
    }

    if (initialPrompt && !initialPromptFiredRef.current && user && !isLoading && !isAutoStartingRef.current) {
      // Se já temos histórico carregado (mais que a mensagem de boas vindas), não disparar autostart
      // Isso evita que o autostart limpe uma sessão existente que o usuário abriu.
      if (messages.length > 1) {
        console.debug("[useAgentChat] History already present, skipping autostart for initialPrompt");
        initialPromptFiredRef.current = true;
        return;
      }

      console.debug("[useAgentChat] triggering autostart for initialPrompt:", initialPrompt);
      isAutoStartingRef.current = true;
      
      const timer = setTimeout(async () => {
        try {
          if (pendingSession) {
            console.debug("[useAgentChat] Discarding pending session for autostart priority");
            handleDiscardSession();
          }
          
          console.debug("[useAgentChat] calling handleSend for initialPrompt");
          // Formata o prompt inicial para o padrão do Tutor IA
          const formattedPrompt = initialPrompt.toLowerCase().startsWith("quero estudar") 
            ? initialPrompt 
            : `Quero estudar: ${initialPrompt}`;
            
          await handleSend(formattedPrompt);
          initialPromptFiredRef.current = true;
        } catch (err) {
          console.error("[useAgentChat] autostart failed:", err);
        } finally {
          isAutoStartingRef.current = false;
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [initialPrompt, user, isLoading, handleSend, pendingSession, handleDiscardSession, messages, initialConversationId]);

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
