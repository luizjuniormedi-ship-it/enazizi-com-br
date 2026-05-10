import { memo, useMemo, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Copy, Volume2, VolumeX, Save, Check, Loader2, GraduationCap, User, Film, Play, Sparkles, AlertCircle, RefreshCw, BarChart3, LineChart, BookOpen } from "lucide-react";
import tutorAvatar from "@/assets/tutor-avatar-hd.png";
import { MemoryReuseBadge } from "@/components/tutor/MemoryReuseBadge";
import { TutorBlockRenderer } from "@/components/tutor/blocks/TutorBlockRenderer";
import { adjustMemoryQuality } from "@/lib/tutor/tutorMemory";
import type { Msg, LinkToAgent } from "./agentChatTypes";
import { useTutorCME } from "@/hooks/useTutorCME";
import { useUserRoles } from "@/hooks/useUserRoles";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { extractInlineTutorBlocks } from "@/lib/tutor/extractInlineBlocks";
import { validateTutorMessageForCME } from "@/lib/tutor/tutorValidation";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { humanizeCMEMessage, FRIENDLY_STATUS_LABEL, friendlyStageLabel } from "@/components/cinematic/cmeUserMessages";

interface AgentMessageItemProps {
  msg: Msg;
  index: number;
  title: string;
  isLoading: boolean;
  hasSpeechSynthesis: boolean;
  speakingMsgIdx: number | null;
  savingMsgIdx: number | null;
  isSaved: boolean;
  hasOnSaveMessage: boolean;
  linkToAgent?: LinkToAgent;
  selectedUploadIds: Set<string>;
  renderAssistantMessage?: (content: string) => React.ReactNode;
  onCopy: (text: string) => void;
  onSpeak: (text: string, idx: number) => void;
  onSave: (idx: number, content: string) => void;
  onLink: (content: string, uploadIds: string[]) => void;
  onRegenerateFromMemory?: (question: string) => void;
  conversationId?: string;
  topic?: string;
  subtopic?: string;
  specialty?: string;
}

const markdownComponents = {
  a: ({ href, children }: any) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">
      {children}
    </a>
  ),
};

const AgentMessageItem = memo(
  ({
    msg, index, title, isLoading, hasSpeechSynthesis, speakingMsgIdx, savingMsgIdx,
    isSaved, hasOnSaveMessage, linkToAgent, selectedUploadIds, renderAssistantMessage,
    onCopy, onSpeak, onSave, onLink, onRegenerateFromMemory,
    conversationId, topic, subtopic, specialty
  }: AgentMessageItemProps) => {
    const navigate = useNavigate();
    const { state, transformToVideo, retryRender, logEligibility, resetState } = useTutorCME();
    const { isAdmin, isProfessor, roles } = useUserRoles();
    const { isEnabled } = useFeatureFlags();

    const isCoordinator = roles.includes("coordenador") || roles.includes("coordinator");
    const hasPermission = isAdmin || isProfessor || isCoordinator;

    const flagsEnabled = isEnabled("cme_enabled") && 
                         isEnabled("tutor_cme_enabled") && 
                         isEnabled("cinematic_factory_enabled");

    const memoryCognitiveBlocks = useMemo(
      () => (Array.isArray(msg.memoryBlocks) ? msg.memoryBlocks.filter(Boolean) : []),
      [msg.memoryBlocks],
    );

    const { cleanedMarkdown, inlineBlocks } = useMemo(() => {
      if (msg.role !== "assistant") return { cleanedMarkdown: msg.content, inlineBlocks: [] };
      const { cleanedMarkdown, blocks } = extractInlineTutorBlocks(msg.content);
      return { cleanedMarkdown, inlineBlocks: blocks };
    }, [msg.role, msg.content]);

    const cognitiveBlocks = memoryCognitiveBlocks.length > 0 ? memoryCognitiveBlocks : inlineBlocks;
    const hasCognitiveBlocks = cognitiveBlocks.length > 0;
    const renderedMarkdown = cleanedMarkdown || msg.content;

    // Novo: Validação Gating Enterprise
    const validation = useMemo(() => {
      return validateTutorMessageForCME(msg.content, cognitiveBlocks);
    }, [msg.content, cognitiveBlocks]);

    // Logs de elegibilidade para auditoria
    useEffect(() => {
      if (msg.role === "assistant" && !isLoading && (msg as any).id) {
        logEligibility({
          messageId: (msg as any).id,
          eligible: validation.eligible,
          rejectionReason: validation.rejectionReason,
          structureScore: validation.structureScore,
          cognitiveDensity: validation.cognitiveDensity,
          metrics: validation.metrics
        });
      }
    }, [msg.role, isLoading, validation, (msg as any).id]);

    const showCMEButton = msg.role === "assistant" && 
                         !isLoading && 
                         hasPermission && 
                         flagsEnabled && 
                         validation.eligible;
    
    const showFallbackButton = msg.role === "assistant" && 
                               !isLoading && 
                               hasPermission && 
                               flagsEnabled && 
                               !validation.eligible;

    const handleCMETransform = (isFullSession: boolean = false) => {
      console.error(`🔥 GERAR_AULA_REAL :: ARQUIVO=AgentMessageItem.tsx :: HANDLER=handleCMETransform :: isFullSession=${isFullSession}`);
      const summaryBlock = cognitiveBlocks.find(b => b.type === 'summary');
      const baseTitle = summaryBlock?.payload?.title || `Aula sobre ${topic || 'Medicina'}`;
      const title = isFullSession ? `🎬 Videoaula Completa: ${baseTitle}` : baseTitle;
      const summary = summaryBlock?.payload?.bullets?.join(". ") || msg.content.slice(0, 300);

      transformToVideo({
        title,
        specialty: specialty || "Geral",
        topic: topic || "Clínica Médica",
        summary,
        sourceContent: msg.content,
        blocks: cognitiveBlocks,
        conversationId: conversationId || crypto.randomUUID(),
        messageId: (msg as any).id,
        isFullSession
      });
    };

    return (
      <div className={cn(
        "flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700",
        msg.role === "user" ? "items-end" : "items-start w-full"
      )}>
        {msg.role === "assistant" && (
          <div className="flex items-center gap-4 group/avatar">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl overflow-hidden flex-shrink-0 tutor-glow float-gentle ring-1 ring-primary/40 shadow-xl bg-black/40">
              <img src={tutorAvatar} alt={title} className="h-full w-full object-contain" />
            </div>
            <div className="flex flex-col">
               <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80">Cognitive Engine</span>
               <span className="text-xs font-bold text-white/40">IA Mentor Premium</span>
            </div>
          </div>
        )}
        
        <div
          className={cn(
            "rounded-3xl relative transition-all duration-500",
            msg.role === "user"
              ? "max-w-[85%] sm:max-w-[60%] px-6 py-4 bg-white/5 border border-white/10 text-white/90 backdrop-blur-xl shadow-xl hover:border-primary/30"
              : cn(
                  "w-full px-0 py-2 text-white/90",
                  msg.isError && "bg-destructive/10 border border-destructive/20 rounded-2xl px-4 py-3"
                )
          )}
        >
          {msg.role === "assistant" ? (
            <>
              {renderedMarkdown && renderedMarkdown.trim().length > 0 && (
                renderAssistantMessage ? (
                  renderAssistantMessage(renderedMarkdown)
                ) : (
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-p:text-base sm:prose-p:text-lg prose-p:leading-relaxed prose-p:text-white/80 prose-headings:text-white prose-headings:font-black prose-headings:tracking-tighter prose-strong:text-primary prose-strong:font-bold">
                    <ReactMarkdown components={markdownComponents}>{renderedMarkdown}</ReactMarkdown>
                  </div>
                )
              )}
              {hasCognitiveBlocks && (
                <div className="mt-3">
                  <TutorBlockRenderer
                    blocks={cognitiveBlocks}
                    onQuizAnswered={({ correct }) => {
                      if (!msg.memoryId) return;
                      adjustMemoryQuality(msg.memoryId, correct ? 3 : -5).catch(() => {});
                    }}
                  />
                </div>
              )}

              {msg.role === "assistant" && msg.bibliography && msg.bibliography.length > 0 && (
                <div className="mt-4 p-4 rounded-2xl bg-primary/5 border border-primary/10 animate-fade-in">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-primary mb-3 flex items-center gap-2">
                    <BookOpen className="h-3 w-3" /> Fontes Consultadas na Base de Conhecimento
                  </h4>
                  <div className="space-y-3">
                    {msg.bibliography.map((ref, i) => (
                      <div key={i} className="text-xs text-white/70 leading-relaxed pl-3 border-l-2 border-primary/20">
                        <span className="font-bold text-white/90">[{ref.source || "Fonte Confiável"}{ref.page ? ` p.${ref.page}` : ''}]:</span> {ref.content}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-border/30 empty:hidden">
                {hasOnSaveMessage && index > 0 && !isLoading && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1.5"
                    disabled={savingMsgIdx === index || isSaved}
                    onClick={() => onSave(index, msg.content)}
                  >
                    {isSaved ? <><Check className="h-3.5 w-3.5 text-success" /> Salvo</> : <><Save className="h-3.5 w-3.5" /> Salvar</>}
                  </Button>
                )}
                
                {showCMEButton && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1.5 border-amber-500/30 text-amber-500 hover:bg-amber-500/10 animate-fade-in shadow-sm shadow-amber-500/20"
                      onClick={() => handleCMETransform(true)}
                    >
                      <Film className="h-3.5 w-3.5" /> 🎬 Transformar Sessão Completa em Videoaula
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[10px] gap-1.5 text-muted-foreground hover:text-amber-500 border border-transparent hover:border-amber-500/20"
                      onClick={() => handleCMETransform(false)}
                      title="Transformar apenas esta resposta em vídeo"
                    >
                      <Sparkles className="h-3 w-3" /> Apenas esta resposta
                    </Button>
                  </div>
                )}

                {showFallbackButton && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1.5 border-amber-500/30 text-amber-500 hover:bg-amber-500/10"
                      onClick={() => handleCMETransform(true)}
                    >
                      <Film className="h-3.5 w-3.5" /> 🎬 Transformar Sessão Completa
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[10px] gap-1.5 text-muted-foreground hover:text-amber-500 border border-transparent hover:border-amber-500/20"
                      onClick={() => handleCMETransform(false)}
                      title={validation.rejectionReason}
                    >
                      <AlertCircle className="h-3 w-3" /> Criar desta resposta
                    </Button>
                  </div>
                )}

                {/* Histórico Multimodal / Ações Enterprise */}
                {isAdmin && (
                  <>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 text-[10px] gap-1 text-muted-foreground"
                      onClick={() => navigate('/admin/cme-origins')}
                    >
                      <LineChart className="h-3 w-3" /> Linhagem
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 text-[10px] gap-1 text-muted-foreground"
                      onClick={() => navigate('/admin/monitoring')}
                    >
                      <BarChart3 className="h-3 w-3" /> Analytics
                    </Button>
                  </>
                )}
                
                {msg.isError && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
                    onClick={() => onRegenerateFromMemory?.(msg.sourceQuestion || "")}
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Tentar novamente
                  </Button>
                )}
              </div>

              {/* Telemetria Realtime Expandida */}
              <Dialog open={state.status !== 'idle'} onOpenChange={(open) => !open && resetState()}>
                <DialogContent className="sm:max-w-md bg-slate-950 border-white/10 text-white overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 animate-pulse" />
                  {!isAdmin ? (
                    // ===== USER MODE (override freeze: cme-ux-correct-fix) =====
                    <>
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-amber-500">
                          <Sparkles className="h-5 w-5" />
                          Geração da aula
                        </DialogTitle>
                        <DialogDescription className="text-slate-400 text-xs">
                          {state.status === 'failed'
                            ? humanizeCMEMessage(state.error)
                            : (FRIENDLY_STATUS_LABEL[state.status === 'ready' ? 'ready' : 'processing'])}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4 space-y-4">
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs text-slate-400">
                            <span className="truncate pr-2">{friendlyStageLabel(state.progress)}</span>
                            <span className="tabular-nums text-amber-500">{state.progress}%</span>
                          </div>
                          <Progress value={state.progress} className="h-1.5 bg-white/5" />
                        </div>
                        {state.status === 'failed' && (
                          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-xs">
                            {humanizeCMEMessage(state.error)}
                          </div>
                        )}
                      </div>
                      <DialogFooter className="flex sm:justify-end gap-2 items-center">
                        {state.status === 'failed' && state.projectId && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-8"
                            onClick={() => state.projectId && retryRender(state.projectId)}
                          >
                            Tentar novamente
                          </Button>
                        )}
                        <Button variant="ghost" onClick={resetState} className="text-xs h-8">
                          Fechar
                        </Button>
                      </DialogFooter>
                    </>
                  ) : (
                    // ===== ADMIN MODE: telemetria técnica completa =====
                    <>
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-amber-500">
                          <Sparkles className="h-5 w-5" />
                          CME Cinematic Factory Enterprise
                        </DialogTitle>
                        <DialogDescription className="text-slate-400 text-xs">
                          Status da Unidade de Processamento Cinematográfico ENAZIZI.
                        </DialogDescription>
                      </DialogHeader>

                      <div className="py-4 space-y-5">
                        <div className="space-y-2">
                          <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-slate-500">
                            <span>STAGE: {state.message || state.status}</span>
                            <span className="text-amber-500">{state.progress}%</span>
                          </div>
                          <Progress value={state.progress} className="h-1 bg-white/5" />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { id: 'planning', label: 'Semantic Planning' },
                            { id: 'mapping', label: 'Knowledge Mapping' },
                            { id: 'scripting', label: 'Narrative Building' },
                            { id: 'graphing', label: 'Scene Graph' },
                            { id: 'voice', label: 'Voice Rendering' },
                            { id: 'rendering', label: 'GPU Rendering' },
                            { id: 'hls', label: 'HLS Generation' },
                            { id: 'cdn', label: 'CDN Validation' }
                          ].map((step, idx) => (
                            <div key={step.id} className={cn(
                              "flex items-center gap-2 p-1.5 rounded border text-[9px] font-bold uppercase transition-all duration-500",
                              state.progress > (idx * 12.5) || state.status === step.id ? "bg-amber-500/10 border-amber-500/20 text-amber-500" : "bg-white/5 border-white/5 text-slate-700"
                            )}>
                              <div className={cn(
                                "h-1 w-1 rounded-full",
                                state.status === step.id ? "bg-amber-500 shadow-[0_0_5px_rgba(245,158,11,0.5)] animate-pulse" :
                                state.progress > (idx * 12.5) ? "bg-amber-500" : "bg-slate-800"
                              )} />
                              {step.label}
                            </div>
                          ))}
                        </div>

                        {state.isStuck && state.status === 'rendering' && (
                          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg space-y-1 animate-in fade-in slide-in-from-top-2">
                            <div className="flex items-center gap-2 text-blue-400 text-[10px] font-bold">
                              <AlertCircle className="h-3 w-3" />
                              WORKER OFFLINE
                            </div>
                            <p className="text-[9px] text-blue-300/70 italic">
                              A renderização automática ainda não está conectada a um worker GPU real. O projeto foi estruturado e está pronto para visualização no Builder.
                            </p>
                          </div>
                        )}

                        <div className="p-3 bg-white/5 border border-white/5 rounded-lg space-y-2">
                          <div className="flex justify-between text-[9px] text-slate-500">
                            <span>WORKER: {state.isStuck ? 'NONE_AVAILABLE' : (state.workerId || (state.workerStatus === 'online' ? 'ALLOCATING...' : 'OFFLINE'))}</span>
                            <span>LATENCY: {state.isStuck ? '---' : (state.progress > 0 ? 'CALCULATING...' : '---')}</span>
                          </div>
                          <div className="flex justify-between text-[9px] text-slate-500">
                            <span>ID: {state.projectId?.slice(0, 12) || 'QUEUED'}</span>
                            <span className={cn("text-green-500", state.isStuck && "text-amber-500")}>
                              {state.isStuck ? 'POLLING INACTIVE' : 'REALTIME TELEMETRY ACTIVE'}
                            </span>
                          </div>
                        </div>

                        {state.status === 'failed' && (
                          <div className="space-y-2">
                            <div className="p-2 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-[10px] italic">
                              FAILURE: {state.error}
                            </div>
                            <Button
                              onClick={() => state.projectId && retryRender(state.projectId)}
                              variant="outline"
                              size="sm"
                              className="w-full h-8 text-[10px] gap-2 border-red-500/30 text-red-500 hover:bg-red-500/10"
                            >
                              <RefreshCw className="h-3 w-3" /> REENFILEIRAR RENDERIZAÇÃO (RETRY)
                            </Button>
                          </div>
                        )}
                      </div>

                      <DialogFooter className="flex sm:justify-between items-center">
                        <Button variant="ghost" onClick={resetState} className="text-[10px] h-7">Fechar</Button>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-amber-600 hover:bg-amber-700 text-[10px] h-7 gap-2 shadow-lg shadow-amber-900/20"
                            onClick={() => {
                              resetState();
                              navigate(state.projectId ? `/admin/cinematic-engine/${state.projectId}` : '/admin/cinematic-engine');
                            }}
                          >
                            <Play className="h-3 w-3" /> ABRIR NO CME
                          </Button>
                        </div>
                      </DialogFooter>
                    </>
                  )}
                </DialogContent>
              </Dialog>
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
    );
  },
  (prev, next) =>
    prev.msg.role === next.msg.role &&
    prev.msg.content === next.msg.content &&
    prev.msg.memoryId === next.msg.memoryId &&
    prev.msg.memoryBlocks === next.msg.memoryBlocks &&
    prev.index === next.index &&
    prev.isLoading === next.isLoading &&
    prev.speakingMsgIdx === next.speakingMsgIdx &&
    prev.savingMsgIdx === next.savingMsgIdx &&
    prev.isSaved === next.isSaved &&
    prev.selectedUploadIds === next.selectedUploadIds &&
    prev.conversationId === next.conversationId &&
    prev.topic === next.topic &&
    prev.subtopic === next.subtopic &&
    prev.specialty === next.specialty
);
AgentMessageItem.displayName = "AgentMessageItem";
export default AgentMessageItem;
