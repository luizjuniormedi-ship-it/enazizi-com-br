import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useSessionPersistence } from "@/hooks/useSessionPersistence";
import type { Msg, Conversation, Upload, QuickAction, TimelineEntry } from "./agentChatTypes";

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

  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", content: welcomeMessage }]);
  const [input, setInput] = useState("");
  const [hasShownUploadWelcome, setHasShownUploadWelcome] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<string>("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [availableUploads, setAvailableUploads] = useState<Upload[]>([]);
  const [selectedUploadIds, setSelectedUploadIds] = useState<Set<string>>(new Set());
  const [showUploads, setShowUploads] = useState(false);
  const [savingMsgIdx, setSavingMsgIdx] = useState<number | null>(null);
  const [savedMsgIdxs, setSavedMsgIdxs] = useState<Set<number>>(new Set());
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStep, setUploadStep] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [actionTimeline, setActionTimeline] = useState<TimelineEntry[]>([]);
  const [sendCooldown, setSendCooldown] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speakingMsgIdx, setSpeakingMsgIdx] = useState<number | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [uploadSearch, setUploadSearch] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isUploadingRef = useRef(false);
  const autoPromptFiredRef = useRef(false);
  const previousContentRef = useRef<string>("");
  const previousContentLoadedRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const initialPromptFiredRef = useRef(false);
  const lastMsgRef = useRef<number>(0);

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

  // Auto-save
  useEffect(() => {
    registerAutoSave(() => {
      if (messages.length <= 1) return {};
      return { messages, activeConversationId };
    });
  }, [messages, activeConversationId, registerAutoSave]);

  const handleResumeSession = useCallback(() => {
    if (!pendingSession?.session_data) return;
    const data = pendingSession.session_data as Record<string, any>;
    if (data.messages && Array.isArray(data.messages) && data.messages.length > 0) {
      setMessages(data.messages);
    }
    if (data.activeConversationId) setActiveConversationId(data.activeConversationId);
    clearPending();
  }, [pendingSession, clearPending]);

  const handleDiscardSession = useCallback(() => abandonSession(), [abandonSession]);

  // Load previous content for anti-repetition
  useEffect(() => {
    if (!user || !previousContentLoader || previousContentLoadedRef.current) return;
    previousContentLoadedRef.current = true;
    previousContentLoader().then((c) => { previousContentRef.current = c; }).catch(() => {});
  }, [user, previousContentLoader]);

  // Load uploads
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("uploads")
        .select("id, filename, extracted_text, category")
        .eq("user_id", user.id)
        .eq("status", "processed")
        .not("extracted_text", "is", null)
        .order("created_at", { ascending: false })
        .limit(20);
      if (data && data.length > 0) {
        setAvailableUploads(data);
        setSelectedUploadIds(new Set());
      }
    })();
  }, [user]);

  // Welcome with uploads
  useEffect(() => {
    if (hasShownUploadWelcome || !welcomeMessageWithUploads) return;
    if (availableUploads.length > 0 && selectedUploadIds.size > 0 && messages.length === 1 && messages[0].role === "assistant") {
      const selectedUploads = availableUploads.filter((u) => selectedUploadIds.has(u.id));
      const materialNames = selectedUploads.map((u) => u.filename).slice(0, 3).join(", ");
      const suffix = selectedUploads.length > 3 ? ` e mais ${selectedUploads.length - 3}` : "";
      const contextMsg = welcomeMessageWithUploads
        .replace("{materiais}", materialNames + suffix)
        .replace("{count}", String(selectedUploadIds.size));
      setMessages([{ role: "assistant", content: contextMsg }]);
      setHasShownUploadWelcome(true);
    }
  }, [availableUploads, selectedUploadIds, hasShownUploadWelcome, welcomeMessageWithUploads, messages]);

  const buildUserContext = useCallback((extraContext?: string) => {
    let ctx = "";
    if (extraContext) ctx += extraContext;
    if (previousContentRef.current) ctx += "\n\n" + previousContentRef.current;
    if (selectedUploadIds.size === 0) return ctx.trim();
    for (const upload of availableUploads) {
      if (!selectedUploadIds.has(upload.id)) continue;
      const snippet = upload.extracted_text?.slice(0, 3000) || "";
      if (ctx.length + snippet.length > 15000) break;
      ctx += `\n\n📄 ${upload.filename} (${upload.category || "material"}):\n${snippet}`;
    }
    return ctx.trim();
  }, [availableUploads, selectedUploadIds]);

  const toggleUpload = useCallback((id: string) => {
    setSelectedUploadIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedUploadIds((prev) => {
      if (prev.size === availableUploads.length) return new Set();
      return new Set(availableUploads.map((u) => u.id));
    });
  }, [availableUploads]);

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

  useEffect(() => { loadConversations(); }, [loadConversations]);

  const loadConversation = useCallback(async (convId: string) => {
    const { data } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });
    if (data && data.length > 0) {
      setMessages(data.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })));
    } else {
      setMessages([{ role: "assistant", content: welcomeMessage }]);
    }
    setActiveConversationId(convId);
    setShowHistory(false);
  }, [welcomeMessage]);

  const startNewConversation = useCallback(() => {
    completeSession();
    setActiveConversationId(null);
    setMessages([{ role: "assistant", content: welcomeMessage }]);
    setShowHistory(false);
  }, [completeSession, welcomeMessage]);

  const deleteConversation = useCallback(async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from("chat_conversations").delete().eq("id", convId);
    if (activeConversationId === convId) startNewConversation();
    loadConversations();
  }, [activeConversationId, startNewConversation, loadConversations]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = useCallback(async (overridePrompt?: string, contextOverride?: string) => {
    const text = overridePrompt || input.trim();
    if (!text || isLoading || sendCooldown || !user) return;

    setSendCooldown(true);
    setTimeout(() => setSendCooldown(false), 2000);

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const matchedAction = quickActions?.find((a) => a.prompt === text);
    const timelineEntry = matchedAction
      ? { label: matchedAction.label.replace(/^[^\s]+\s/, ""), icon: matchedAction.icon || "💬", time: timeStr }
      : { label: text.slice(0, 30) + (text.length > 30 ? "…" : ""), icon: "💬", time: timeStr };
    setActionTimeline((prev) => [...prev, timelineEntry].slice(-8));

    const userMsg: Msg = { role: "user", content: text };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput("");
    setIsLoading(true);
    setLoadingStage("🔍 Buscando referências científicas...");

    let convId = activeConversationId;
    if (!convId) {
      const convTitle = text.slice(0, 60);
      const { data: newConv } = await supabase
        .from("chat_conversations")
        .insert({ user_id: user.id, agent_type: functionName, title: convTitle })
        .select("id")
        .single();
      if (newConv) {
        convId = newConv.id;
        setActiveConversationId(convId);
        await supabase.from("chat_messages").insert({
          conversation_id: convId, user_id: user.id, role: "assistant", content: welcomeMessage,
        });
      }
    }

    if (convId) {
      await supabase.from("chat_messages").insert({
        conversation_id: convId, user_id: user.id, role: "user", content: text,
      });
      await supabase.from("chat_conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);
    }

    let assistantSoFar = "";
    const contextToSend = contextOverride ? buildUserContext(contextOverride) : buildUserContext();

    try {
      const { data: { session } } = await supabase.auth.getSession();
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
        const description = errData.error || errorMessages[resp.status] || "Erro ao conectar com o agente IA";
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
          if (last?.role === "assistant" && prev.length > 1 && prev[prev.length - 2]?.role === "user") {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
          }
          return [...prev, { role: "assistant", content: assistantSoFar }];
        });
      };
      const scheduleAssistantFlush = () => {
        if (pendingFlush) return;
        pendingFlush = true;
        if (typeof requestAnimationFrame !== "undefined") requestAnimationFrame(flushAssistant);
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
          if (result === "done") { streamDone = true; break; }
          if (result === "incomplete") { textBuffer = `${line}\n${textBuffer}`; break; }
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
          if (last?.role === "assistant" && prev.length > 1 && prev[prev.length - 2]?.role === "user") {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
          }
          return [...prev, { role: "assistant", content: assistantSoFar }];
        });
      }

      if (convId && assistantSoFar) {
        await supabase.from("chat_messages").insert({
          conversation_id: convId, user_id: user.id, role: "assistant", content: assistantSoFar,
        });
        loadConversations();
      }

      if (onSaveMessage && assistantSoFar) {
        try {
          const count = await onSaveMessage(assistantSoFar);
          if (count > 0) {
            const lastIdx = messages.length;
            setSavedMsgIdxs((prev) => new Set(prev).add(lastIdx));
            toast({ title: "✅ Salvo automaticamente!", description: `${count} item(ns) salvo(s) no seu banco.` });
            if (previousContentLoader) {
              previousContentLoader().then((c) => { previousContentRef.current = c; }).catch(() => {});
            }
          }
        } catch {}
      }
    } catch (e) {
      console.error(e);
      toast({ title: "Erro", description: "Falha ao conectar com o agente IA.", variant: "destructive" });
    } finally {
      setIsLoading(false);
      setLoadingStage("");
    }
  }, [input, isLoading, sendCooldown, user, messages, activeConversationId, quickActions, functionName, welcomeMessage, buildUserContext, CHAT_URL, toast, loadConversations, onSaveMessage, previousContentLoader]);

  // Expose handleSend to parent
  useEffect(() => {
    if (onSendRef) onSendRef.current = (prompt: string) => handleSend(prompt);
    return () => { if (onSendRef) onSendRef.current = null; };
  }, [onSendRef, handleSend]);

  // Auto-fire initialPrompt
  useEffect(() => {
    if (initialPrompt && !initialPromptFiredRef.current && user && !isLoading) {
      initialPromptFiredRef.current = true;
      const timer = setTimeout(() => handleSend(initialPrompt), 500);
      return () => clearTimeout(timer);
    }
  }, [initialPrompt, user, isLoading, handleSend]);

  const handleSaveMessage = useCallback(async (idx: number, content: string) => {
    if (!onSaveMessage || savingMsgIdx !== null) return;
    setSavingMsgIdx(idx);
    try {
      const count = await onSaveMessage(content);
      setSavedMsgIdxs((prev) => new Set(prev).add(idx));
      toast({ title: "Salvo!", description: `${count} questão(ões) salva(s) no seu banco.` });
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Erro ao salvar questões.", variant: "destructive" });
    } finally {
      setSavingMsgIdx(null);
    }
  }, [onSaveMessage, savingMsgIdx, toast]);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!", description: "Texto copiado para a área de transferência." });
  }, [toast]);

  // Speech-to-Text
  const hasSpeechRecognition = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const toggleListening = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.continuous = true;
    recognition.interimResults = true;
    let finalTranscript = "";
    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript + " ";
        else interim += event.results[i][0].transcript;
      }
      setInput(finalTranscript + interim);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening]);

  // Text-to-Speech
  const hasSpeechSynthesis = typeof window !== "undefined" && "speechSynthesis" in window;

  const speakText = useCallback((text: string, msgIdx: number) => {
    if (speakingMsgIdx === msgIdx) {
      window.speechSynthesis.cancel();
      setSpeakingMsgIdx(null);
      return;
    }
    window.speechSynthesis.cancel();
    const clean = text.replace(/[#*_`~>\[\]()!|]/g, "").replace(/\n{2,}/g, ". ").replace(/\n/g, " ");
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = "pt-BR";
    utterance.rate = 1;
    const voices = window.speechSynthesis.getVoices();
    const ptVoice = voices.find((v) => v.lang.startsWith("pt-BR")) || voices.find((v) => v.lang.startsWith("pt"));
    if (ptVoice) utterance.voice = ptVoice;
    utterance.onend = () => setSpeakingMsgIdx(null);
    utterance.onerror = () => setSpeakingMsgIdx(null);
    setSpeakingMsgIdx(msgIdx);
    window.speechSynthesis.speak(utterance);
  }, [speakingMsgIdx]);

  // Auto-speak
  useEffect(() => {
    if (!autoSpeak || !hasSpeechSynthesis) return;
    const lastIdx = messages.length - 1;
    const lastMsg = messages[lastIdx];
    if (lastMsg?.role === "assistant" && lastIdx > lastMsgRef.current && !isLoading && lastIdx > 0) {
      lastMsgRef.current = lastIdx;
      speakText(lastMsg.content, lastIdx);
    }
  }, [messages, isLoading, autoSpeak, hasSpeechSynthesis, speakText]);

  // Cleanup
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
    };
  }, []);

  return {
    // State
    messages, input, isLoading, loadingStage, conversations, activeConversationId,
    showHistory, availableUploads, selectedUploadIds, showUploads, savingMsgIdx,
    savedMsgIdxs, isUploading, uploadProgress, uploadStep, isFullscreen, actionTimeline,
    sendCooldown, isListening, speakingMsgIdx, autoSpeak, uploadSearch,
    pendingSession, sessionChecked,
    // Refs
    scrollRef, fileInputRef, isUploadingRef, autoPromptFiredRef, previousContentRef,
    // Setters used by upload handler
    setIsUploading, setUploadProgress, setUploadStep, setAvailableUploads, setSelectedUploadIds,
    setInput, setIsFullscreen, setShowHistory, setShowUploads, setUploadSearch, setAutoSpeak,
    // Handlers
    handleSend, handleResumeSession, handleDiscardSession, handleSaveMessage,
    toggleUpload, toggleAll, loadConversation, startNewConversation, deleteConversation,
    copyToClipboard, toggleListening, speakText, buildUserContext,
    // Capabilities
    hasSpeechRecognition, hasSpeechSynthesis,
    // Computed
    selectedCount: selectedUploadIds.size, totalUploads: availableUploads.length,
    // Toast for upload handler
    toast, user,
  };
}
