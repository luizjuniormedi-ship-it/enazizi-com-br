import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useSessionPersistence } from "@/hooks/useSessionPersistence";
import ResumeSessionBanner from "@/components/layout/ResumeSessionBanner";
import { useNavigate } from "react-router-dom";
import { Send, Bot, User, Loader2, Plus, History, Trash2, FileText, ChevronDown, Check, Save, Upload, GraduationCap, Maximize2, Minimize2, Search, Paperclip, MoreVertical, Copy, ArrowRight, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import tutorAvatar from "@/assets/tutor-avatar-hd.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";

type Msg = { role: "user" | "assistant"; content: string };

interface Conversation {
  id: string;
  title: string;
  created_at: string;
}

interface Upload {
  id: string;
  filename: string;
  category: string | null;
  extracted_text: string | null;
}

interface QuickAction {
  label: string;
  prompt: string;
  icon?: string;
}

interface LinkToAgent {
  label: string;
  path: string;
  stateKey: string;
}

interface AgentChatProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  welcomeMessage: string;
  welcomeMessageWithUploads?: string;
  placeholder: string;
  functionName: string;
  onSaveMessage?: (content: string) => Promise<number>;
  quickActions?: QuickAction[];
  renderAssistantMessage?: (content: string) => React.ReactNode;
  showUploadButton?: boolean;
  autoPromptAfterUpload?: string;
  linkToAgent?: LinkToAgent;
  previousContentLoader?: () => Promise<string>;
  initialPrompt?: string;
  onSendRef?: React.MutableRefObject<((prompt: string) => void) | null>;
}

const AgentChat = ({ title, subtitle, icon, welcomeMessage, welcomeMessageWithUploads, placeholder, functionName, onSaveMessage, quickActions, renderAssistantMessage, showUploadButton, autoPromptAfterUpload, linkToAgent, previousContentLoader, initialPrompt, onSendRef }: AgentChatProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: welcomeMessage },
  ]);
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
  const [actionTimeline, setActionTimeline] = useState<{ label: string; icon: string; time: string }[]>([]);
  const [sendCooldown, setSendCooldown] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speakingMsgIdx, setSpeakingMsgIdx] = useState<number | null>(null);
  
  const [autoSpeak, setAutoSpeak] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isUploadingRef = useRef(false);
  const autoPromptFiredRef = useRef(false);
  const previousContentRef = useRef<string>("");
  const previousContentLoadedRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  
  const { toast } = useToast();

  // Session persistence for "continue where you left off"
  const {
    pendingSession,
    checked: sessionChecked,
    saveSession,
    completeSession,
    abandonSession,
    registerAutoSave,
    clearPending,
  } = useSessionPersistence({ moduleKey: functionName });

  // Register auto-save: persist messages + activeConversationId
  useEffect(() => {
    registerAutoSave(() => {
      if (messages.length <= 1) return {};
      return {
        messages,
        activeConversationId,
      };
    });
  }, [messages, activeConversationId, registerAutoSave]);

  const handleResumeSession = useCallback(() => {
    if (!pendingSession?.session_data) return;
    const data = pendingSession.session_data as Record<string, any>;
    if (data.messages && Array.isArray(data.messages) && data.messages.length > 0) {
      setMessages(data.messages);
    }
    if (data.activeConversationId) {
      setActiveConversationId(data.activeConversationId);
    }
    clearPending();
  }, [pendingSession, clearPending]);

  const handleDiscardSession = useCallback(() => {
    abandonSession();
  }, [abandonSession]);

  // Load previous content for anti-repetition
  useEffect(() => {
    if (!user || !previousContentLoader || previousContentLoadedRef.current) return;
    previousContentLoadedRef.current = true;
    previousContentLoader().then((content) => {
      previousContentRef.current = content;
    }).catch(() => {});
  }, [user, previousContentLoader]);

  const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`;

  const [uploadSearch, setUploadSearch] = useState("");

  // Load user uploads (filtered by user_id, limited to 20, none selected by default)
  useEffect(() => {
    if (!user) return;
    const loadUploads = async () => {
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
        // Start with none selected — user chooses manually
        setSelectedUploadIds(new Set());
      }
    };
    loadUploads();
  }, [user]);

  // Update welcome message when user manually selects uploads
  useEffect(() => {
    if (hasShownUploadWelcome || !welcomeMessageWithUploads) return;
    if (availableUploads.length > 0 && selectedUploadIds.size > 0 && messages.length === 1 && messages[0].role === "assistant") {
      const selectedUploads = availableUploads.filter(u => selectedUploadIds.has(u.id));
      const materialNames = selectedUploads
        .map(u => u.filename)
        .slice(0, 3)
        .join(", ");
      const suffix = selectedUploads.length > 3 ? ` e mais ${selectedUploads.length - 3}` : "";
      const contextMsg = welcomeMessageWithUploads
        .replace("{materiais}", materialNames + suffix)
        .replace("{count}", String(selectedUploadIds.size));
      setMessages([{ role: "assistant", content: contextMsg }]);
      setHasShownUploadWelcome(true);
    }
  }, [availableUploads, selectedUploadIds, hasShownUploadWelcome, welcomeMessageWithUploads, messages]);

  // Build context from selected uploads
  const buildUserContext = useCallback((extraContext?: string) => {
    let ctx = "";
    // Add extra context first (e.g. from a just-uploaded file)
    if (extraContext) {
      ctx += extraContext;
    }
    // Add anti-repetition context
    if (previousContentRef.current) {
      ctx += "\n\n" + previousContentRef.current;
    }
    if (selectedUploadIds.size === 0) return ctx.trim();
    for (const upload of availableUploads) {
      if (!selectedUploadIds.has(upload.id)) continue;
      const snippet = upload.extracted_text?.slice(0, 3000) || "";
      if (ctx.length + snippet.length > 15000) break;
      ctx += `\n\n📄 ${upload.filename} (${upload.category || "material"}):\n${snippet}`;
    }
    return ctx.trim();
  }, [availableUploads, selectedUploadIds]);

  const toggleUpload = (id: string) => {
    setSelectedUploadIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedUploadIds.size === availableUploads.length) {
      setSelectedUploadIds(new Set());
    } else {
      setSelectedUploadIds(new Set(availableUploads.map((u) => u.id)));
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    e.target.value = "";

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["pdf", "txt", "docx"].includes(ext || "")) {
      toast({ title: "Formato inválido", description: "Apenas PDF, TXT e DOCX são suportados.", variant: "destructive" });
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Máximo de 20MB.", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    isUploadingRef.current = true;
    autoPromptFiredRef.current = false;
    setUploadProgress(5);
    setUploadStep("Enviando arquivo...");

    try {
      const sanitizedName = file.name
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${user.id}/${Date.now()}_${sanitizedName}`;
      const { error: storageError } = await supabase.storage.from("user-uploads").upload(storagePath, file);
      if (storageError) throw storageError;

      setUploadProgress(20);
      setUploadStep("Registrando...");

      const { data: uploadRow, error: insertError } = await supabase.from("uploads").insert({
        user_id: user.id,
        filename: file.name,
        file_type: ext || "pdf",
        storage_path: storagePath,
        status: "pending",
        is_global: false,
      }).select("id").single();
      if (insertError || !uploadRow) throw insertError || new Error("Falha ao registrar upload");

      setUploadProgress(30);
      setUploadStep("Processando...");

      const { data: { session } } = await supabase.auth.getSession();
      await supabase.functions.invoke("process-upload", {
        body: { uploadId: uploadRow.id },
      });

      // Poll for completion
      const pollInterval = setInterval(async () => {
        const { data: status } = await supabase
          .from("uploads")
          .select("status, extracted_text, extracted_json, filename, category")
          .eq("id", uploadRow.id)
          .single();

        if (!status) return;

        const json = status.extracted_json as Record<string, any> | null;
        const progress = json?.progress || 30;
        const step = json?.step || "processing";

        const stepLabels: Record<string, string> = {
          downloading: "Baixando arquivo...",
          extracting_text: "Extraindo texto...",
          validating: "Validando conteúdo...",
          generating_flashcards: "Gerando flashcards...",
          generating_questions: "Gerando questões...",
          done: "Concluído!",
          error: "Erro no processamento",
        };

        setUploadProgress(Math.min(progress, 95));
        setUploadStep(stepLabels[step] || "Processando...");

        // Fire auto-prompt as soon as extracted_text is available (don't wait for full processing)
        if (status.extracted_text && autoPromptAfterUpload && !autoPromptFiredRef.current) {
          autoPromptFiredRef.current = true;
          clearInterval(pollInterval);

          // Build direct context from the just-extracted text (don't rely on state)
          const directContext = `\n\n📄 ${status.filename || file.name} (material):\n${status.extracted_text.slice(0, 15000)}`;

          const newUpload: Upload = {
            id: uploadRow.id,
            filename: status.filename,
            category: status.category,
            extracted_text: status.extracted_text,
          };
          setAvailableUploads(prev => {
            if (prev.some(u => u.id === uploadRow.id)) return prev;
            return [newUpload, ...prev];
          });
          setSelectedUploadIds(prev => new Set(prev).add(uploadRow.id));

          const prompt = autoPromptAfterUpload.replace("{filename}", file.name);
          setIsUploading(false);
          isUploadingRef.current = false;
          setUploadProgress(100);
          setUploadStep("Concluído!");
          setTimeout(() => {
            setUploadProgress(0);
            setUploadStep("");
            // Pass extracted text directly as context to avoid stale state
            handleSend(prompt, directContext);
          }, 300);
          return;
        }

        if (status.status === "processed" || status.status === "error") {
          clearInterval(pollInterval);
          setUploadProgress(100);

          if (status.status === "processed" && status.extracted_text && !autoPromptFiredRef.current) {
            const newUpload: Upload = {
              id: uploadRow.id,
              filename: status.filename,
              category: status.category,
              extracted_text: status.extracted_text,
            };
            setAvailableUploads(prev => {
              if (prev.some(u => u.id === uploadRow.id)) return prev;
              return [newUpload, ...prev];
            });
            setSelectedUploadIds(prev => new Set(prev).add(uploadRow.id));
            toast({ title: "✅ Material processado!", description: `${status.filename} está pronto para uso como contexto.` });
          } else if (status.status === "error") {
            toast({ title: "Erro", description: "Falha ao processar o arquivo.", variant: "destructive" });
          }

          setTimeout(() => {
            setIsUploading(false);
            isUploadingRef.current = false;
            setUploadProgress(0);
            setUploadStep("");
          }, 1000);
        }
      }, 3000);

      // Safety timeout after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        if (isUploadingRef.current) {
          setIsUploading(false);
          isUploadingRef.current = false;
          setUploadProgress(0);
          setUploadStep("");
          toast({ title: "Timeout", description: "O processamento demorou demais. Verifique na página de Uploads.", variant: "destructive" });
        }
      }, 300000);

    } catch (err) {
      console.error("Upload error:", err);
      toast({ title: "Erro no upload", description: err instanceof Error ? err.message : "Falha ao enviar arquivo.", variant: "destructive" });
      setIsUploading(false);
      setUploadProgress(0);
      setUploadStep("");
    }
  };

  // Load conversation list
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

  const loadConversation = async (convId: string) => {
    const { data } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });
    if (data && data.length > 0) {
      setMessages(data.map(m => ({ role: m.role as "user" | "assistant", content: m.content })));
    } else {
      setMessages([{ role: "assistant", content: welcomeMessage }]);
    }
    setActiveConversationId(convId);
    setShowHistory(false);
  };

  const startNewConversation = () => {
    completeSession();
    setActiveConversationId(null);
    setMessages([{ role: "assistant", content: welcomeMessage }]);
    setShowHistory(false);
  };

  const deleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from("chat_conversations").delete().eq("id", convId);
    if (activeConversationId === convId) startNewConversation();
    loadConversations();
  };

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = async (overridePrompt?: string, contextOverride?: string) => {
    const text = overridePrompt || input.trim();
    if (!text || isLoading || sendCooldown || !user) return;

    // Rate limiting: 2s cooldown between sends
    setSendCooldown(true);
    setTimeout(() => setSendCooldown(false), 2000);

    // Add to action timeline
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const matchedAction = quickActions?.find(a => a.prompt === text);
    const timelineEntry = matchedAction
      ? { label: matchedAction.label.replace(/^[^\s]+\s/, ''), icon: matchedAction.icon || "💬", time: timeStr }
      : { label: text.slice(0, 30) + (text.length > 30 ? "…" : ""), icon: "💬", time: timeStr };
    setActionTimeline(prev => [...prev, timelineEntry].slice(-8));

    const userMsg: Msg = { role: "user", content: text };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    if (!overridePrompt) setInput("");
    else setInput("");
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

      // rAF-throttled flush: at most 1 React render per frame (~60Hz)
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
        if (typeof requestAnimationFrame !== "undefined") {
          requestAnimationFrame(flushAssistant);
        } else {
          setTimeout(flushAssistant, 16);
        }
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

      // Flush final UTF-8 bytes + remaining buffered lines
      textBuffer += decoder.decode();

      if (textBuffer.trim()) {
        const remainingLines = textBuffer.split("\n");
        for (const line of remainingLines) {
          if (!line) continue;
          const result = processSseLine(line);
          if (result === "done") break;
        }
      }

      // Final synchronous flush so UI shows complete message before persistence
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

      // Auto-save flashcards/questions after streaming completes
      if (onSaveMessage && assistantSoFar) {
        try {
          const count = await onSaveMessage(assistantSoFar);
          if (count > 0) {
            const lastIdx = messages.length; // index of the assistant message just added
            setSavedMsgIdxs((prev) => new Set(prev).add(lastIdx));
            toast({ title: "✅ Salvo automaticamente!", description: `${count} item(ns) salvo(s) no seu banco.` });
            // Invalidate previous content cache so next generation includes new items
            if (previousContentLoader) {
              previousContentLoader().then((content) => {
                previousContentRef.current = content;
              }).catch(() => {});
            }
          }
        } catch {
          // Silent fail for auto-save - user can still save manually
        }
      }
    } catch (e) {
      console.error(e);
      toast({ title: "Erro", description: "Falha ao conectar com o agente IA.", variant: "destructive" });
    } finally {
      setIsLoading(false);
      setLoadingStage("");
    }
  };

  // Expose handleSend to parent via ref
  useEffect(() => {
    if (onSendRef) {
      onSendRef.current = (prompt: string) => handleSend(prompt);
    }
    return () => {
      if (onSendRef) onSendRef.current = null;
    };
  }, [onSendRef, messages, user, isLoading, activeConversationId]);

  // Auto-fire initialPrompt once on mount
  const initialPromptFiredRef = useRef(false);
  useEffect(() => {
    if (initialPrompt && !initialPromptFiredRef.current && user && !isLoading) {
      initialPromptFiredRef.current = true;
      // Small delay to ensure component is fully mounted
      const timer = setTimeout(() => handleSend(initialPrompt), 500);
      return () => clearTimeout(timer);
    }
  }, [initialPrompt, user]);

  const handleSaveMessage = async (idx: number, content: string) => {
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
  };

  const selectedCount = selectedUploadIds.size;
  const totalUploads = availableUploads.length;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!", description: "Texto copiado para a área de transferência." });
  };

  // Speech-to-Text
  const hasSpeechRecognition = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const toggleListening = () => {
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
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + " ";
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setInput(finalTranscript + interim);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  // Text-to-Speech
  const hasSpeechSynthesis = typeof window !== "undefined" && "speechSynthesis" in window;

  const speakText = (text: string, msgIdx: number) => {
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
    const ptVoice = voices.find(v => v.lang.startsWith("pt-BR")) || voices.find(v => v.lang.startsWith("pt"));
    if (ptVoice) utterance.voice = ptVoice;
    utterance.onend = () => { setSpeakingMsgIdx(null); };
    utterance.onerror = () => { setSpeakingMsgIdx(null); };
    setSpeakingMsgIdx(msgIdx);
    window.speechSynthesis.speak(utterance);
  };

  // Auto-speak last assistant message when autoSpeak is on
  const lastMsgRef = useRef<number>(0);
  useEffect(() => {
    if (!autoSpeak || !hasSpeechSynthesis) return;
    const lastIdx = messages.length - 1;
    const lastMsg = messages[lastIdx];
    if (lastMsg?.role === "assistant" && lastIdx > lastMsgRef.current && !isLoading && lastIdx > 0) {
      lastMsgRef.current = lastIdx;
      speakText(lastMsg.content, lastIdx);
    }
  }, [messages, isLoading, autoSpeak]);

  // Cleanup speech on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
    };
  }, []);

  const content = (
    <div className={`flex flex-col animate-fade-in min-w-0 w-full ${isFullscreen ? "fixed inset-0 z-[100] bg-background p-2 sm:p-4" : "h-full"}`}>
      {/* Header — Tutor style */}
      <div className="mb-2 sm:mb-3 flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1 flex items-center gap-3">
          <div className="h-14 w-11 sm:h-[4.5rem] sm:w-14 rounded-2xl overflow-hidden flex-shrink-0 tutor-glow float-gentle ring-2 ring-primary/30 shadow-lg">
            <img src={tutorAvatar} alt={title} className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-bold truncate">{title}</h1>
            <p className="text-[10px] sm:text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <div className="flex gap-1.5 flex-shrink-0 items-center">
          {selectedCount > 0 && (
            <span className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-primary/15 to-accent/15 text-primary text-[10px] font-semibold border border-primary/20">
              <Paperclip className="h-3 w-3" /> {selectedCount} material(is)
            </span>
          )}
          <Button variant="outline" size="icon" onClick={() => setIsFullscreen(!isFullscreen)} className="h-8 w-8" title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}>
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={startNewConversation}>
                <Plus className="h-4 w-4 mr-2" /> Nova conversa
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowHistory(!showHistory)}>
                <History className="h-4 w-4 mr-2" /> Histórico
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setAutoSpeak(!autoSpeak)}>
                <Volume2 className="h-4 w-4 mr-2" /> {autoSpeak ? "Desativar auto-fala" : "Ativar auto-fala"}
              </DropdownMenuItem>
              {showUploadButton && (
                <DropdownMenuItem onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                  <Upload className="h-4 w-4 mr-2" /> {isUploading ? "Enviando..." : "Enviar material"}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>


      {/* Hidden file input */}
      <input type="file" ref={fileInputRef} accept=".pdf,.txt,.docx" className="hidden" onChange={handleFileUpload} />

      {/* Upload progress */}
      {isUploading && (
        <div className="mb-2 px-3 py-2 rounded-xl bg-primary/10 border border-primary/20">
          <div className="flex items-center gap-2 text-xs font-medium text-primary mb-1">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>{uploadStep}</span>
          </div>
          <Progress value={uploadProgress} className="h-1" />
        </div>
      )}

      {/* Resume session banner */}
      {sessionChecked && pendingSession && messages.length <= 1 && (
        <ResumeSessionBanner
          updatedAt={pendingSession.updated_at}
          onResume={handleResumeSession}
          onDiscard={handleDiscardSession}
        />
      )}

      {/* Materials selector — compact */}
      {(totalUploads > 0 || showUploadButton) && (
        <div className="mb-2">
          <div className="flex gap-1.5">
            <button
              onClick={() => totalUploads > 0 && setShowUploads(!showUploads)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-medium transition-colors flex-1 ${
                selectedCount > 0
                  ? "bg-gradient-to-r from-primary/10 to-accent/10 text-primary border border-primary/20"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
              disabled={totalUploads === 0}
            >
              <Paperclip className="h-3 w-3 flex-shrink-0" />
              {totalUploads === 0 ? "Nenhum material" : selectedCount > 0 ? `${selectedCount} material(is) selecionado(s)` : `Selecionar materiais (${totalUploads})`}
              {totalUploads > 0 && <ChevronDown className={`h-3 w-3 ml-auto transition-transform ${showUploads ? "rotate-180" : ""}`} />}
            </button>
            {showUploadButton && (
              <Button variant="outline" size="sm" className="h-7 px-2.5 gap-1 text-[10px] sm:text-xs flex-shrink-0" disabled={isUploading} onClick={() => fileInputRef.current?.click()}>
                {isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                Enviar
              </Button>
            )}
          </div>

          {showUploads && totalUploads > 0 && (
            <div className="glass-card p-2.5 mt-1.5 space-y-1.5">
              {totalUploads > 5 && (
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <input type="text" placeholder="Buscar..." value={uploadSearch} onChange={(e) => setUploadSearch(e.target.value)}
                    className="w-full pl-6 pr-3 py-1 rounded-md border border-input bg-background text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                </div>
              )}
              <button onClick={toggleAll} className="flex items-center gap-2 px-2 py-1 text-[10px] font-medium text-primary hover:text-primary/80 transition-colors w-full rounded-md hover:bg-primary/5">
                <Checkbox checked={selectedCount === totalUploads} className="h-3 w-3" onCheckedChange={toggleAll} />
                {selectedCount === totalUploads ? "Desmarcar todos" : `Selecionar todos (${totalUploads})`}
              </button>
              <div className="max-h-28 overflow-y-auto space-y-0.5">
                {availableUploads
                  .filter(u => !uploadSearch || u.filename.toLowerCase().includes(uploadSearch.toLowerCase()))
                  .map((u) => (
                    <label key={u.id} className={`flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer text-[10px] sm:text-xs transition-colors ${selectedUploadIds.has(u.id) ? "bg-primary/5" : "hover:bg-secondary"}`}>
                      <Checkbox checked={selectedUploadIds.has(u.id)} onCheckedChange={() => toggleUpload(u.id)} className="h-3 w-3" />
                      <FileText className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className="truncate flex-1">{u.filename}</span>
                    </label>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* History panel */}
      {showHistory && (
        <div className="glass-card p-3 mb-2 max-h-48 overflow-y-auto space-y-1">
          {conversations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">Nenhuma conversa salva.</p>
          ) : conversations.map((c) => (
            <div key={c.id} onClick={() => loadConversation(c.id)}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${activeConversationId === c.id ? "bg-primary/10 text-primary" : "hover:bg-secondary"}`}>
              <span className="truncate flex-1 mr-2">{c.title}</span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString("pt-BR")}</span>
                <button onClick={(e) => deleteConversation(c.id, e)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick actions — pill style */}
      {quickActions && quickActions.length > 0 && messages.length <= 2 && !isLoading && (
        <div className="flex gap-1.5 overflow-x-auto pb-1.5 mb-2 scrollbar-hide">
          {quickActions.map((action, idx) => (
            <button key={idx} onClick={() => handleSend(action.prompt)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-medium bg-gradient-to-br from-primary/10 to-accent/10 text-primary hover:from-primary/20 hover:to-accent/20 transition-colors border border-primary/20 flex-shrink-0 whitespace-nowrap">
              {action.icon && <span>{action.icon}</span>}
              {action.label.replace(/^[^\s]+\s/, '')}
            </button>
          ))}
        </div>
      )}

      {/* Action Timeline */}
      {actionTimeline.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 mb-2 scrollbar-hide">
          {actionTimeline.map((entry, idx) => (
            <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-border/60 bg-muted/50 text-[10px] font-medium text-muted-foreground whitespace-nowrap flex-shrink-0">
              <span>{entry.icon}</span>
              <span className="max-w-[100px] truncate">{entry.label}</span>
              <span className="text-muted-foreground/60">{entry.time}</span>
            </span>
          ))}
        </div>
      )}

      {/* Chat Messages — Premium */}
      <div ref={scrollRef} className="flex-1 rounded-xl border border-border/50 bg-card/50 p-2 sm:p-4 overflow-y-auto space-y-3 sm:space-y-4 mb-2 sm:mb-3 min-h-0 pattern-dots">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 sm:gap-3 ${msg.role === "user" ? "justify-end" : ""} animate-fade-in`}>
            {msg.role === "assistant" && (
              <div className="h-12 w-9 sm:h-14 sm:w-11 rounded-xl overflow-hidden flex-shrink-0 tutor-glow bot-breathing ring-1 ring-primary/25 shadow-md">
                <img src={tutorAvatar} alt={title} className="h-full w-full object-contain" />
              </div>
            )}
            <div className={`rounded-xl px-3 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm leading-relaxed relative group ${
              msg.role === "user"
                ? "max-w-[85%] sm:max-w-[75%] bg-gradient-to-br from-primary to-primary/80 text-primary-foreground"
                : "w-full bg-secondary/80 backdrop-blur-sm text-secondary-foreground relative gradient-border-subtle"
            }`}>
              {msg.role === "assistant" ? (
                <>
                  {renderAssistantMessage ? renderAssistantMessage(msg.content) : (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 text-xs sm:text-sm prose-p:my-3 prose-headings:mt-5 prose-headings:mb-2 prose-ul:my-3 prose-ol:my-3 prose-li:my-1 [&_p:has(+ul)]:mb-1 [&_p:has(+ol)]:mb-1 [&>p+p]:mt-4 [&_strong]:text-foreground [&_hr]:my-4 [&_blockquote]:my-3">
                      <ReactMarkdown components={{ a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">{children}</a> }}>{msg.content}</ReactMarkdown>
                    </div>
                  )}
                  <button onClick={() => copyToClipboard(msg.content)}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-background/50 backdrop-blur-sm" title="Copiar">
                    <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  {hasSpeechSynthesis && (
                    <button onClick={() => speakText(msg.content, i)}
                      className="absolute top-2 right-9 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-background/50 backdrop-blur-sm" title={speakingMsgIdx === i ? "Parar" : "Ouvir"}>
                      {speakingMsgIdx === i ? <VolumeX className="h-3.5 w-3.5 text-primary animate-pulse" /> : <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />}
                    </button>
                  )}
                  {/* Save & Link buttons */}
                  <div className="flex gap-2 mt-2 pt-2 border-t border-border/30 empty:hidden">
                    {onSaveMessage && i > 0 && !isLoading && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5"
                        disabled={savingMsgIdx === i || savedMsgIdxs.has(i)}
                        onClick={() => handleSaveMessage(i, msg.content)}>
                        {savedMsgIdxs.has(i) ? <><Check className="h-3.5 w-3.5 text-success" /> Salvo</> :
                         savingMsgIdx === i ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando...</> :
                         <><Save className="h-3.5 w-3.5" /> Salvar</>}
                      </Button>
                    )}
                    {linkToAgent && i > 0 && !isLoading && (
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5"
                        onClick={() => {
                          const truncated = msg.content.slice(0, 10000);
                          const uploadIds = Array.from(selectedUploadIds);
                          navigate(linkToAgent.path, { state: { [linkToAgent.stateKey]: truncated, sharedUploadIds: uploadIds } });
                        }}>
                        <GraduationCap className="h-3.5 w-3.5" /> {linkToAgent.label}
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <span className="whitespace-pre-wrap">{msg.content}</span>
              )}
            </div>
            {msg.role === "user" && (
              <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-xl bg-accent/20 flex items-center justify-center flex-shrink-0">
                <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-accent" />
              </div>
            )}
          </div>
        ))}
        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex gap-2 sm:gap-3 animate-fade-in">
            <div className="h-12 w-9 sm:h-14 sm:w-11 rounded-xl overflow-hidden flex-shrink-0 tutor-glow bot-breathing ring-1 ring-primary/25 shadow-md">
              <img src={tutorAvatar} alt={title} className="h-full w-full object-contain" />
            </div>
            <div className="rounded-xl px-4 py-3 bg-secondary/80 backdrop-blur-sm space-y-1.5">
              <div className="flex gap-1.5 items-center">
                <div className="h-2 w-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="h-2 w-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="h-2 w-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              {loadingStage && (
                <p className="text-xs text-muted-foreground animate-pulse">{loadingStage}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Input — Enhanced */}
      <div className="flex gap-2">
        <Input
          placeholder={isListening ? "🎤 Ouvindo..." : placeholder}
          className={`bg-background/60 backdrop-blur-sm border-border/60 text-sm h-10 sm:h-11 rounded-xl ${isListening ? "ring-2 ring-red-400/50 border-red-400/50" : ""}`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          disabled={isLoading}
        />
        {hasSpeechRecognition && (
          <Button onClick={toggleListening} size="icon" variant={isListening ? "destructive" : "outline"}
            className={`flex-shrink-0 h-10 w-10 sm:h-11 sm:w-11 rounded-xl ${isListening ? "animate-pulse" : ""}`}
            title={isListening ? "Parar de ouvir" : "Falar"}>
            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
        )}
        <Button onClick={() => handleSend()} size="icon"
          className="glow flex-shrink-0 h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
          disabled={isLoading || sendCooldown || !input.trim()}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );

  if (isFullscreen) return createPortal(content, document.body);
  return content;
};

export default AgentChat;
