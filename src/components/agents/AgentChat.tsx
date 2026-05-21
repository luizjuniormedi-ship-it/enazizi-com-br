console.error("🔥 BUILD_FORENSE", {
  component: "AgentChat.tsx",
  timestamp: Date.now(),
  version: "PEDAGOGICAL_INCREMENTAL_V1"
});

// Forensics Log Store
const FORENSICS_STORE: any = {
  build: "FORENSE_REAL_V1",
  clicks: [],
  network: [],
  errors: [],
  sessions: []
};

// Global interceptors for forensics
if (typeof window !== 'undefined') {
  const originalLog = console.log;
  const originalError = console.error;
  
  console.log = (...args) => {
    if (String(args[0]).includes('[GERAR_AULA]')) {
      FORENSICS_STORE.clicks.push({ ts: Date.now(), data: args });
    }
    originalLog.apply(console, args);
  };

  window.addEventListener('error', (event) => {
    FORENSICS_STORE.errors.push({ 
      ts: Date.now(), 
      msg: event.message, 
      file: event.filename,
      line: event.lineno
    });
  });
}

import { useCallback, useEffect, useState, useRef } from "react";
import { Download } from "lucide-react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Loader2, Film, Sparkles, Play, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useFsrsDueCount } from "@/hooks/useFsrsDueCount";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ResumeSessionBanner from "@/components/layout/ResumeSessionBanner";
import { useAgentChat } from "./useAgentChat";
import AgentHeader from "./AgentHeader";
import AgentUploadsPicker from "./AgentUploadsPicker";
import AgentHistoryPanel from "./AgentHistoryPanel";
import { AgentQuickActions, AgentTimeline } from "./AgentQuickActions";
import AgentMessageList from "./AgentMessageList";
import AgentInputBar from "./AgentInputBar";
import type { QuickAction, LinkToAgent, Upload as UploadType } from "./agentChatTypes";
import { useTutorCME } from "@/hooks/useTutorCME";
import { useTutorAdaptiveSync } from "@/components/agents/hooks/useTutorAdaptiveSync";
import { extractInlineTutorBlocks } from "@/lib/tutor/extractInlineBlocks";
import { AgileLessonPlayer } from "@/components/cinematic/AgileLessonPlayer";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { TutorDiagnosticPanel } from "@/components/tutor/TutorDiagnosticPanel";
import { cn } from "@/lib/utils";

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
  /** Optional context for tutor pedagogical memory scoping. */
  topic?: string | null;
  subtopic?: string | null;
  specialty?: string | null;
  /** Optional pedagogical header rendered above the chat (e.g. mission hero + roadmap). */
  pedagogicalHeader?: (ctx: { messages: { role: string; content: string }[]; isLoading: boolean; userInput: string }) => React.ReactNode;
  /** Hide the uploads picker entirely (useful for pure tutor experiences). */
  hideUploadsPicker?: boolean;
  /** Optional initial conversation to load. */
  initialConversationId?: string | null;
}

const AgentChat = ({
  title, subtitle, welcomeMessage, welcomeMessageWithUploads, placeholder, functionName,
  onSaveMessage, quickActions, renderAssistantMessage, showUploadButton, autoPromptAfterUpload,
  linkToAgent, previousContentLoader, initialPrompt, onSendRef,
  topic, subtopic, specialty, pedagogicalHeader, hideUploadsPicker, initialConversationId,
}: AgentChatProps) => {
  const navigate = useNavigate();
  const { totalDue, dueByTopic } = useFsrsDueCount();
  const chat = useAgentChat({
    functionName, welcomeMessage, welcomeMessageWithUploads, autoPromptAfterUpload,
    quickActions, onSaveMessage, previousContentLoader, initialPrompt, onSendRef,
    topic, subtopic, specialty, initialConversationId,
    fsrsContext: topic ? { dueCards: dueByTopic(topic), totalDue } : undefined,
  });

  // [TUTOR_28_RENDER_MESSAGES_COUNT]
  console.log(`[TUTOR_28_RENDER_MESSAGES_COUNT] count=${chat.messages.length}`);
  if (chat.messages.length > 0) {
    const lastMsg = chat.messages[chat.messages.length - 1];
    // [TUTOR_29_RENDER_LAST_MESSAGE]
    console.log(`[TUTOR_29_RENDER_LAST_MESSAGE] role=${lastMsg.role} contentLen=${lastMsg.content?.length}`);
    if (lastMsg.role === 'assistant' && lastMsg.content?.length > 0) {
      // [TUTOR_30_ASSISTANT_MESSAGE_VISIBLE]
      console.log(`[TUTOR_30_ASSISTANT_MESSAGE_VISIBLE] true`);
    }
  }

  const { isAdmin } = useAdminCheck();
  const { transformToVideo, state: cmeState, resetState: resetCmeState, showAgilePlayer, setShowAgilePlayer, triggerPedagogicalFallback, getLessonForMessage, generateTextualLesson } = useTutorCME();
  const sync = useTutorAdaptiveSync();

  const [sessionLesson, setSessionLesson] = useState<any>(null);

  useEffect(() => {
    if (chat.activeConversationId) {
      sync.logSessionStarted({
        conversationId: chat.activeConversationId,
        topic: topic || undefined,
        specialty: specialty || undefined
      });
    }
  }, [chat.activeConversationId, topic, specialty, sync]);

  useEffect(() => {
    const fetchSessionLesson = async () => {
      if (chat.activeConversationId) {
        // For full session, we can check by conversationId in the config
        const { data } = await supabase
          .from("cme_video_projects")
          .select("*, aggregation:cme_session_aggregations(*)")
          .contains('config', { tutor_conversation_id: chat.activeConversationId, is_full_session: true })
          .maybeSingle();
        
        if (data) setSessionLesson(data);
      }
    };
    fetchSessionLesson();
  }, [chat.activeConversationId]);

  const [lessonStatus, setLessonStatus] = useState<'idle' | 'processing' | 'ready' | 'failed'>('idle');
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [lessonData, setLessonData] = useState<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const downloadForensics = useCallback(() => {
    const logData = {
      ...FORENSICS_STORE,
      currentSession: {
        conversationId: chat.activeConversationId,
        messagesCount: chat.messages.length,
        lessonStatus,
        topic
      },
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(logData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `enazizi-tutor-forense-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [chat.activeConversationId, chat.messages.length, lessonStatus, topic]);

  useEffect(() => {
    window.addEventListener('download-forensics', downloadForensics);
    return () => window.removeEventListener('download-forensics', downloadForensics);
  }, [downloadForensics]);

  const handleTransformSession = useCallback(async () => {
    console.error("🔥 REAL_CLICK_SOURCE", {
      component: "AgentChat.tsx",
      handler: "handleTransformSession",
      ts: Date.now()
    });
    FORENSICS_STORE.clicks.push({
      type: "handleTransformSession",
      ts: Date.now(),
      conversationId: chat.activeConversationId
    });

    console.error("🔥 GERAR_AULA_REAL :: ARQUIVO=AgentChat.tsx :: HANDLER=handleTransformSession");
    console.log("[GERAR_AULA] CLICK", {
      conversationId: chat.activeConversationId,
      sessionId: chat.activeConversationId, // Fallback if no specific sessionId
      topic,
      messagesCount: chat.messages.length
    });
    
    if (chat.messages.length <= 1 || lessonStatus === 'processing') {
      console.warn("[GERAR_AULA] CLICK_SKIPPED", { length: chat.messages.length, status: lessonStatus });
      return;
    }

    // Cancelar qualquer request anterior em curso
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    setLessonStatus('processing');
    console.log("[GERAR_AULA] FUNCTION_START");

    try {
      const payload = {
        topic: topic || "Clínica Médica",
        conversationId: chat.activeConversationId,
        messages: chat.messages.map(m => ({ role: m.role, content: m.content })),
        lessonType: 'aula_completa'
      };
      
      FORENSICS_STORE.network.push({ type: 'request', ts: Date.now(), payload });

      const { data, error } = await supabase.functions.invoke('generate-tutor-lesson', {
        body: payload,
        signal: controller.signal
      });

      FORENSICS_STORE.network.push({ type: 'response', ts: Date.now(), data, error });

      console.log("[GERAR_AULA] FUNCTION_RESPONSE", { data, error });

      if (error) throw error;

      // Normalização da resposta conforme MODO HARD
      const lesson = data?.lesson || data?.data?.lesson || data?.result?.lesson || data?.content || data?.message;
      
      if (!lesson) {
        throw new Error("Resposta da função não contém uma aula válida.");
      }

      console.log("[GERAR_AULA] NORMALIZED_LESSON", lesson);
      
      setLessonData(lesson);
      setLessonStatus('ready');
      console.log("[GERAR_AULA] PLAYER_OPENED");
      toast.success("Aula gerada com sucesso!");
    } catch (err: any) {
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("[GERAR_AULA] ERROR", err);
      setLessonStatus('failed');
      toast.error(err.message || "Falha ao gerar aula.");
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setLessonStatus('idle'); // Ensure loading cleans up
    }
  }, [chat.messages, chat.activeConversationId, topic, lessonStatus]);


  // Upload handler
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !chat.user) return;
    e.target.value = "";

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["pdf", "txt", "docx"].includes(ext || "")) {
      chat.toast({ title: "Formato inválido", description: "Apenas PDF, TXT e DOCX são suportados.", variant: "destructive" });
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      chat.toast({ title: "Arquivo muito grande", description: "Máximo de 20MB.", variant: "destructive" });
      return;
    }

    chat.setIsUploading(true);
    chat.isUploadingRef.current = true;
    chat.autoPromptFiredRef.current = false;
    chat.setUploadProgress(5);
    chat.setUploadStep("Enviando arquivo...");

    try {
      const sanitizedName = file.name
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${chat.user.id}/${Date.now()}_${sanitizedName}`;
      const { error: storageError } = await supabase.storage.from("user-uploads").upload(storagePath, file);
      if (storageError) throw storageError;

      chat.setUploadProgress(20);
      chat.setUploadStep("Registrando...");

      const { data: uploadRow, error: insertError } = await supabase.from("uploads").insert({
        user_id: chat.user.id,
        filename: file.name,
        file_type: ext || "pdf",
        storage_path: storagePath,
        status: "pending",
        is_global: false,
      }).select("id").single();
      if (insertError || !uploadRow) throw insertError || new Error("Falha ao registrar upload");

      chat.setUploadProgress(30);
      chat.setUploadStep("Processando...");

      await supabase.functions.invoke("process-upload", { body: { uploadId: uploadRow.id } });

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

        chat.setUploadProgress(Math.min(progress, 95));
        chat.setUploadStep(stepLabels[step] || "Processando...");

        if (status.extracted_text && autoPromptAfterUpload && !chat.autoPromptFiredRef.current) {
          chat.autoPromptFiredRef.current = true;
          clearInterval(pollInterval);

          const directContext = `\n\n📄 ${status.filename || file.name} (material):\n${status.extracted_text.slice(0, 15000)}`;
          const newUpload: UploadType = {
            id: uploadRow.id,
            filename: status.filename,
            category: status.category,
            extracted_text: status.extracted_text,
          };
          chat.setAvailableUploads((prev) => (prev.some((u) => u.id === uploadRow.id) ? prev : [newUpload, ...prev]));
          chat.setSelectedUploadIds((prev) => new Set(prev).add(uploadRow.id));

          const prompt = autoPromptAfterUpload.replace("{filename}", file.name);
          chat.setIsUploading(false);
          chat.isUploadingRef.current = false;
          chat.setUploadProgress(100);
          chat.setUploadStep("Concluído!");
          setTimeout(() => {
            chat.setUploadProgress(0);
            chat.setUploadStep("");
            chat.handleSend(prompt, directContext);
          }, 300);
          return;
        }

        if (status.status === "processed" || status.status === "error") {
          clearInterval(pollInterval);
          chat.setUploadProgress(100);

          if (status.status === "processed" && status.extracted_text && !chat.autoPromptFiredRef.current) {
            const newUpload: UploadType = {
              id: uploadRow.id,
              filename: status.filename,
              category: status.category,
              extracted_text: status.extracted_text,
            };
            chat.setAvailableUploads((prev) => (prev.some((u) => u.id === uploadRow.id) ? prev : [newUpload, ...prev]));
            chat.setSelectedUploadIds((prev) => new Set(prev).add(uploadRow.id));
            chat.toast({ title: "✅ Material processado!", description: `${status.filename} está pronto para uso como contexto.` });
          } else if (status.status === "error") {
            chat.toast({ title: "Erro", description: "Falha ao processar o arquivo.", variant: "destructive" });
          }

          setTimeout(() => {
            chat.setIsUploading(false);
            chat.isUploadingRef.current = false;
            chat.setUploadProgress(0);
            chat.setUploadStep("");
          }, 1000);
        }
      }, 3000);

      setTimeout(() => {
        clearInterval(pollInterval);
        if (chat.isUploadingRef.current) {
          chat.setIsUploading(false);
          chat.isUploadingRef.current = false;
          chat.setUploadProgress(0);
          chat.setUploadStep("");
          chat.toast({ title: "Timeout", description: "O processamento demorou demais. Verifique na página de Uploads.", variant: "destructive" });
        }
      }, 300000);
    } catch (err) {
      console.error("Upload error:", err);
      chat.toast({ title: "Erro no upload", description: err instanceof Error ? err.message : "Falha ao enviar arquivo.", variant: "destructive" });
      chat.setIsUploading(false);
      chat.setUploadProgress(0);
      chat.setUploadStep("");
    }
  }, [chat, autoPromptAfterUpload]);

  const onUploadClick = useCallback(() => chat.fileInputRef.current?.click(), [chat.fileInputRef]);
  const onLink = useCallback(
    (content: string, uploadIds: string[]) => {
      if (!linkToAgent) return;
      navigate(linkToAgent.path, { state: { [linkToAgent.stateKey]: content, sharedUploadIds: uploadIds } });
    },
    [linkToAgent, navigate]
  );
  const onSendFromQuickAction = useCallback((prompt: string) => chat.handleSend(prompt), [chat.handleSend]);
  const onSendFromInput = useCallback(() => chat.handleSend(), [chat.handleSend]);
  const onToggleFullscreen = useCallback(() => chat.setIsFullscreen((v) => !v), [chat.setIsFullscreen]);
  const onToggleHistory = useCallback(() => chat.setShowHistory((v) => !v), [chat.setShowHistory]);
  const onToggleAutoSpeak = useCallback(() => chat.setAutoSpeak((v) => !v), [chat.setAutoSpeak]);
  const onToggleShowUploads = useCallback(() => chat.setShowUploads((v) => !v), [chat.setShowUploads]);

  const onIncrementalAction = useCallback((action: string) => {
    let prompt = "";
    switch (action) {
      case 'continue': prompt = "Compreendido, pode prosseguir para o próximo bloco da aula."; break;
      case 'deepen': prompt = "Gostaria de aprofundar mais este ponto técnico. Pode detalhar?"; break;
      case 'analogy': prompt = "Pode me dar uma analogia diferente para este conceito?"; break;
      case 'clinical': prompt = "Me dê um exemplo clínico de plantão real sobre isso."; break;
      case 'simplify': prompt = "Pode explicar de forma mais simples e didática?"; break;
      default: prompt = "Próximo bloco.";
    }
    (chat.handleSend as any)(prompt, undefined, action);
  }, [chat.handleSend]);

  const content = (
    <div className={`flex flex-col animate-in fade-in duration-1000 min-w-0 w-full relative h-full selection:bg-primary/30 ${chat.isFullscreen ? "fixed inset-0 z-[100] bg-black" : ""}`}>
      {/* Decorative Atmosphere inside chat */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-primary/5 blur-[120px] pointer-events-none -z-10" />
      <AgentHeader
        title={title}
        subtitle={subtitle}
        selectedCount={chat.selectedCount}
        isFullscreen={chat.isFullscreen}
        onToggleFullscreen={onToggleFullscreen}
        onNewConversation={chat.startNewConversation}
        onToggleHistory={onToggleHistory}
        autoSpeak={chat.autoSpeak}
        onToggleAutoSpeak={onToggleAutoSpeak}
        showUploadButton={showUploadButton}
        isUploading={chat.isUploading}
        onUploadClick={onUploadClick}
        onTransformSession={
          sessionLesson?.aggregation?.manual_video_url 
            ? () => window.open(sessionLesson.aggregation.manual_video_url, '_blank')
            : handleTransformSession
        }
        hasMessages={chat.messages.length > 1}
        lessonStatus={sessionLesson ? (sessionLesson.aggregation?.manual_video_url ? 'ready' : 'processing') : lessonStatus}
        isAdmin={isAdmin}
        onToggleDiagnostic={() => setShowDiagnostic(v => !v)}
      />

      <input type="file" ref={chat.fileInputRef} accept=".pdf,.txt,.docx" className="hidden" onChange={handleFileUpload} />

      {chat.isUploading && (
        <div className="mb-2 px-3 py-2 rounded-xl bg-primary/10 border border-primary/20">
          <div className="flex items-center gap-2 text-xs font-medium text-primary mb-1">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>{chat.uploadStep}</span>
          </div>
          <Progress value={chat.uploadProgress} className="h-1" />
        </div>
      )}

      {chat.sessionChecked && chat.pendingSession && chat.messages.length <= 1 && !initialPrompt && (
        <ResumeSessionBanner
          updatedAt={chat.pendingSession.updated_at}
          onResume={chat.handleResumeSession}
          onDiscard={chat.handleDiscardSession}
        />
      )}

      {!hideUploadsPicker && (
        <AgentUploadsPicker
          totalUploads={chat.totalUploads}
          selectedCount={chat.selectedCount}
          showUploads={chat.showUploads}
          onToggleShow={onToggleShowUploads}
          showUploadButton={showUploadButton}
          isUploading={chat.isUploading}
          onUploadClick={onUploadClick}
          uploadSearch={chat.uploadSearch}
          onSearchChange={chat.setUploadSearch}
          availableUploads={chat.availableUploads}
          selectedUploadIds={chat.selectedUploadIds}
          onToggleUpload={chat.toggleUpload}
          onToggleAll={chat.toggleAll}
        />
      )}

      {chat.showHistory && (
        <AgentHistoryPanel
          conversations={chat.conversations}
          activeConversationId={chat.activeConversationId}
          onLoad={chat.loadConversation}
          onDelete={chat.deleteConversation}
        />
      )}

      <AgentQuickActions
        quickActions={quickActions}
        visible={chat.messages.length <= 2 && !chat.isLoading}
        onSend={onSendFromQuickAction}
      />

      <AgentTimeline entries={chat.actionTimeline} />

      {isAdmin && showDiagnostic && (
        <div className="px-4 sm:px-12 mb-6">
          <TutorDiagnosticPanel />
        </div>
      )}

      {pedagogicalHeader?.({ messages: chat.messages, isLoading: chat.isLoading, userInput: chat.input })}

      <AgentMessageList

        ref={chat.scrollRef}
        messages={chat.messages}
        isLoading={chat.isLoading}
        loadingStage={chat.loadingStage}
        title={title}
        hasSpeechSynthesis={chat.hasSpeechSynthesis}
        speakingMsgIdx={chat.speakingMsgIdx}
        savingMsgIdx={chat.savingMsgIdx}
        savedMsgIdxs={chat.savedMsgIdxs}
        hasOnSaveMessage={!!onSaveMessage}
        linkToAgent={linkToAgent}
        selectedUploadIds={chat.selectedUploadIds}
        renderAssistantMessage={renderAssistantMessage}
        onCopy={chat.copyToClipboard}
        onSpeak={chat.speakText}
        onSave={chat.handleSaveMessage}
        onLink={onLink}
        onRegenerateFromMemory={chat.regenerateFromMemory}
        onIncrementalAction={onIncrementalAction}
        conversationId={chat.activeConversationId || undefined}
        topic={topic}
        subtopic={subtopic}
        specialty={specialty}
        isPedagogicalSession={!!chat.pedSession?.session}
      />

      <AgentInputBar
        input={chat.input}
        onInputChange={chat.setInput}
        placeholder={placeholder}
        isLoading={chat.isLoading}
        sendCooldown={chat.sendCooldown}
        onSend={onSendFromInput}
        hasSpeechRecognition={chat.hasSpeechRecognition}
        isListening={chat.isListening}
        onToggleListening={chat.toggleListening}
      />

      {/* CME Status Modal */}
      <Dialog open={cmeState.status !== 'idle'} onOpenChange={(open) => !open && resetCmeState()}>
        <DialogContent className="sm:max-w-md bg-slate-950 border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-500">
              <Sparkles className="h-5 w-5" />
              Fábrica de Vídeos CME
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              {cmeState.message || 'Processando pipeline de vídeo...'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-bold uppercase text-slate-500">
                <span>Progresso</span>
                <span>{cmeState.progress}%</span>
              </div>
              <Progress value={cmeState.progress} className="h-1 bg-white/5" />
            </div>

            {cmeState.isStuck && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-amber-400 text-[10px] font-bold">
                  <AlertCircle className="h-3 w-3" />
                  PIPELINE EM ESPERA
                </div>
                <p className="text-[9px] text-amber-300/70 italic">
                  O cluster GPU está com alta demanda. A aula interativa já está disponível abaixo.
                </p>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="w-full h-7 text-[10px] bg-amber-500/20 border-amber-500/30 text-amber-500 hover:bg-amber-500/30"
                  onClick={() => setShowAgilePlayer(true)}
                >
                  Abrir Aula Interativa (Slides)
                </Button>
              </div>
            )}

            {cmeState.status === 'failed' && (
              <div className="p-2 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-[10px] italic">
                Erro: {cmeState.error}
              </div>
            )}
          </div>

          <DialogFooter className="sm:justify-start gap-2">
            <Button type="button" variant="secondary" onClick={resetCmeState} className="text-xs h-8">
              Fechar
            </Button>
            
            <Button 
              type="button" 
              variant="outline" 
              onClick={downloadForensics} 
              className="text-[10px] h-8 gap-2 border-dashed opacity-50 hover:opacity-100"
            >
              <Download className="h-3 w-3" /> Logs Forenses
            </Button>

            {isAdmin && ['rendering', 'gpu_rendering', 'pending_hardware', 'ready'].includes(String(cmeState.status)) && (
              <Button
                type="button"
                className="bg-amber-600 hover:bg-amber-700 text-xs h-8 gap-2"
                onClick={() => {
                  resetCmeState();
                  navigate(`/admin/cinematic-engine/${cmeState.projectId}`);
                }}
              >
                <Play className="h-3 w-3" /> Monitorar GPU
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Agile Player Overlay */}
      {(showAgilePlayer || lessonStatus === 'ready') && (cmeState.aggregationId || lessonData) && (
        <AgileLessonPlayer 
          aggregationId={cmeState.aggregationId || undefined}
          initialLesson={lessonData}
          onClose={() => {
            setShowAgilePlayer(false);
            setLessonStatus('idle');
            setLessonData(null);
          }} 
        >
          {/* Inject Forensic Button in Player if needed, or keep it in the modal */}
        </AgileLessonPlayer>
      )}
    </div>
  );

  if (chat.isFullscreen) return createPortal(content, document.body);
  return content;
};

export default AgentChat;
