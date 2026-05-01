import { useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Loader2, Film } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
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
import { extractInlineTutorBlocks } from "@/lib/tutor/extractInlineBlocks";

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
}

const AgentChat = ({
  title, subtitle, welcomeMessage, welcomeMessageWithUploads, placeholder, functionName,
  onSaveMessage, quickActions, renderAssistantMessage, showUploadButton, autoPromptAfterUpload,
  linkToAgent, previousContentLoader, initialPrompt, onSendRef,
  topic, subtopic, specialty,
}: AgentChatProps) => {
  const navigate = useNavigate();
  const chat = useAgentChat({
    functionName, welcomeMessage, welcomeMessageWithUploads, autoPromptAfterUpload,
    quickActions, onSaveMessage, previousContentLoader, initialPrompt, onSendRef,
    topic, subtopic, specialty,
  });

  const { transformToVideo, state: cmeState } = useTutorCME();

  const handleTransformSession = useCallback(async () => {
    if (chat.messages.length === 0) return;
    
    // Find the last assistant message to get some context for the title
    const lastAssistantMessage = [...chat.messages].reverse().find(m => m.role === "assistant");
    if (!lastAssistantMessage) return;

    const cognitiveBlocks = extractInlineTutorBlocks(lastAssistantMessage.content);
    const summaryBlock = cognitiveBlocks.find(b => b.type === 'summary');
    const baseTitle = summaryBlock?.payload?.title || `Aula sobre ${topic || 'Medicina'}`;
    const title = `🎬 Videoaula Completa: ${baseTitle}`;
    const summary = summaryBlock?.payload?.bullets?.join(". ") || lastAssistantMessage.content.slice(0, 300);

    await transformToVideo({
      title,
      specialty: specialty || "Geral",
      topic: topic || "Clínica Médica",
      summary,
      sourceContent: lastAssistantMessage.content,
      blocks: cognitiveBlocks,
      conversationId: chat.activeConversationId || crypto.randomUUID(),
      isFullSession: true
    });
  }, [chat.messages, chat.activeConversationId, specialty, topic, transformToVideo]);

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

  const content = (
    <div className={`flex flex-col animate-fade-in min-w-0 w-full ${chat.isFullscreen ? "fixed inset-0 z-[100] bg-background p-2 sm:p-4" : "h-full"}`}>
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
        onTransformSession={functionName.includes("tutor") ? handleTransformSession : undefined}
        hasMessages={chat.messages.filter(m => m.role === "assistant").length > 0}
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

      {chat.sessionChecked && chat.pendingSession && chat.messages.length <= 1 && (
        <ResumeSessionBanner
          updatedAt={chat.pendingSession.updated_at}
          onResume={chat.handleResumeSession}
          onDiscard={chat.handleDiscardSession}
        />
      )}

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
        conversationId={chat.activeConversationId || undefined}
        topic={topic}
        subtopic={subtopic}
        specialty={specialty}
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
    </div>
  );

  if (chat.isFullscreen) return createPortal(content, document.body);
  return content;
};

export default AgentChat;
