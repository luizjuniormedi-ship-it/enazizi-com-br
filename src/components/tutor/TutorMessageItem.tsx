import { memo, useMemo, useEffect, useState } from "react";
import { User, Copy, Film, Sparkles, Play, AlertCircle, Activity, Info, Zap, Clock, Terminal } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import tutorAvatar from "@/assets/tutor-avatar-hd.png";
import MultimediaControls from "@/components/agents/MultimediaControls";
import { useTutorCME } from "@/hooks/useTutorCME";
import { useUserRoles } from "@/hooks/useUserRoles";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter,
  DialogTrigger
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { TutorBlockRenderer } from "./blocks/TutorBlockRenderer";
import { extractInlineTutorBlocks } from "@/lib/tutor/extractInlineBlocks";
import type { Msg } from "@/components/tutor/TutorConstants";
import { AgileLessonPlayer } from "@/components/cinematic/AgileLessonPlayer";
import { logVideoRecommendationEvent } from "@/services/tutorVideoRecommendationService";
import { humanizeCMEMessage, FRIENDLY_STATUS_LABEL, friendlyStageLabel } from "@/components/cinematic/cmeUserMessages";

/** Convert bare URLs in text to markdown links so ReactMarkdown renders them clickable */
function linkifyBareUrls(text: string): string {
  return text.replace(
    /(?<!\]\()(?<!\()(https?:\/\/[^\s\)>\]]+)/g,
    (url) => `[${url.includes("pubmed") ? "Ver no PubMed" : url.includes("doi.org") ? "Ver DOI" : "Abrir link"}](${url})`
  );
}

function sanitizeReferenceUrl(href?: string): string {
  if (!href) return "https://pubmed.ncbi.nlm.nih.gov/";
  const trimmed = href.trim();
  const lower = trimmed.toLowerCase();
  const hasPlaceholder = ["url_do_pubmed", "url_do_doi", "/pmid", "/doi", "termo+de+busca"].some((token) =>
    lower.includes(token)
  );
  if (hasPlaceholder) {
    if (lower.includes("doi")) return "https://doi.org/";
    return "https://pubmed.ncbi.nlm.nih.gov/?term=medicina";
  }
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (trimmed.startsWith("www.")) return `https://${trimmed}`;
  return "https://pubmed.ncbi.nlm.nih.gov/";
}

interface TutorMessageItemProps {
  msg: Msg;
  onCopy: (text: string) => void;
  isLoading?: boolean;
  conversationId?: string;
  topic?: string;
  specialty?: string;
  isFirstMessage?: boolean;
}

const TutorMessageItem = memo(({ msg, onCopy, isLoading, conversationId, topic, specialty, isFirstMessage }: TutorMessageItemProps) => {
  const navigate = useNavigate();
  const { state, workerHealth, transformToVideo, triggerPedagogicalFallback, retryRender, resetState, showAgilePlayer, setShowAgilePlayer, getLessonForMessage, findLessonByTopic } = useTutorCME();
  const { isAdmin, isProfessor, roles } = useUserRoles();
  const { isEnabled } = useFeatureFlags();

  const [lessonData, setLessonData] = useState<any>(null);
  const [activeAggregationId, setActiveAggregationId] = useState<string | null>(null);

  useEffect(() => {
    const fetchLesson = async () => {
      if (msg.role === "assistant") {
        if ((msg as any).id) {
          const lesson = await getLessonForMessage((msg as any).id);
          if (lesson) {
            setLessonData(lesson);
            return;
          }
        }
        if (topic) {
          const lesson = await findLessonByTopic(topic, conversationId);
          if (lesson) setLessonData(lesson);
        }
      }
    };
    fetchLesson();
  }, [msg, topic, getLessonForMessage, findLessonByTopic]);

  useEffect(() => {
    if (lessonData?.id) {
      logVideoRecommendationEvent('shown', {
        lessonId: lessonData.id,
        topic,
        title: lessonData.title,
        conversationId,
      });
    }
  }, [lessonData?.id, topic]);

  const isCoordinator = roles.includes("coordenador") || roles.includes("coordinator");
  const hasPermission = isAdmin || isProfessor || isCoordinator;

  const flagsEnabled = isEnabled("cme_enabled") && 
                       isEnabled("tutor_cme_enabled") && 
                       isEnabled("cinematic_factory_enabled");

  // Critérios relaxados
  const criteria = useMemo(() => {
    const content = msg.content.toLowerCase();
    const hasMedKeywords = !!msg.content.match(/(médico|clínico|tratamento|diagnóstico|paciente|sintoma|medicina|anatomia|patologia|saúde|médica)/i);
    
    return {
      isLong: msg.content.length > 200, // Reduced from 800 to be more inclusive
      hasTitle: msg.content.includes('#') || msg.content.includes('**'),
      hasStructure: msg.content.includes('- ') || msg.content.includes('1. ') || msg.content.includes('\n'),
      isMedical: hasMedKeywords,
      isFeynman: content.includes('feynman') || content.includes('explicação'),
      hasSummary: content.includes('resumo') || content.includes('pontos') || hasMedKeywords
    };
  }, [msg.content]);

  const isEligible = msg.content.length > 150; // Simple length check as primary eligibility

  // Logs de elegibilidade
  useEffect(() => {
    if (msg.role === "assistant" && !isLoading) {
      if (!hasPermission) {
        console.log(`[CME Eligibility Tutor] Oculto: Sem permissão (Roles: ${roles.join(", ")})`);
      } else if (!flagsEnabled) {
        console.log(`[CME Eligibility Tutor] Oculto: Flags desativadas`);
      } else if (!isEligible) {
        console.log(`[CME Eligibility Tutor] Oculto: Critérios não atingidos`, criteria);
      } else {
        console.log(`[CME Eligibility Tutor] Visível: Elegível`, criteria);
      }
    }
  }, [msg.role, isLoading, hasPermission, roles, flagsEnabled, isEligible, criteria]);

  const showCMEButton = msg.role === "assistant" && 
                       !isLoading && 
                       hasPermission && 
                       flagsEnabled && 
                       isEligible;
  
  const showFallbackButton = msg.role === "assistant" && 
                             !isLoading && 
                             hasPermission && 
                             flagsEnabled && 
                             !isEligible;

  const handleCMETransform = () => {
    transformToVideo({
      title: `Aula sobre ${topic || 'Medicina'}`,
      specialty: specialty || "Geral",
      topic: topic || "Clínica Médica",
      summary: msg.content.slice(0, 300),
      sourceContent: msg.content,
      blocks: [], 
      conversationId: conversationId || crypto.randomUUID(),
      messageId: (msg as any).id
    });
  };

  const { cleanedMarkdown, blocks } = useMemo(() => extractInlineTutorBlocks(msg.content), [msg.content]);

  return (
    <div className={`flex gap-2 sm:gap-3 ${msg.role === "user" ? "justify-end" : ""} animate-fade-in`}>
      {msg.role === "assistant" && (
        <div className="h-12 w-9 sm:h-14 sm:w-11 rounded-xl overflow-hidden flex-shrink-0 tutor-glow bot-breathing ring-1 ring-primary/25 shadow-md">
          <img src={tutorAvatar} alt="Tutor" className="h-full w-full object-contain" />
        </div>
      )}
      <div className={`rounded-xl px-3 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm leading-relaxed relative group ${
        msg.role === "user"
          ? "max-w-[85%] sm:max-w-[75%] bg-gradient-to-br from-primary to-primary/80 text-primary-foreground"
          : "w-full bg-secondary/80 backdrop-blur-sm text-secondary-foreground relative gradient-border-subtle"
      }`}>
        {msg.role === "assistant" ? (
          <>
            {/* Topic-based Video Lesson Preview (Before text) */}
            {lessonData && (isFirstMessage || (msg as any).id) && (
              <div className="mb-6 p-4 rounded-2xl bg-primary/5 border border-primary/20 animate-in fade-in slide-in-from-top-4 duration-500 relative group/video overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
                
                <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary shadow-lg shadow-primary/20 shrink-0">
                      <Film className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="flex h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80">Aula disponível no ENAFLIX</p>
                      </div>
                      <h4 className="text-sm font-bold text-foreground line-clamp-1 group-hover/video:text-primary transition-colors">
                        {lessonData.title || lessonData.topic}
                      </h4>
                      <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                        {lessonData.subject || "Videoaula de Medicina"} • {lessonData.topic || "Tópico Médico"}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button 
                      size="sm" 
                      className="flex-1 sm:flex-initial h-10 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl px-5 text-xs font-bold uppercase tracking-wider shadow-xl shadow-primary/30 transition-all hover:scale-105 active:scale-95"
                      onClick={() => {
                        logVideoRecommendationEvent('clicked', { 
                          lessonId: lessonData?.id, 
                          topic: topic || lessonData.topic, 
                          location: 'top_card_v2', 
                          conversationId 
                        });
                        if (lessonData?.id) {
                          navigate(`/dashboard/videoaulas/${lessonData.id}`);
                        } else {
                          toast.info("Abrindo aula completa...");
                        }
                      }}
                    >
                      <Play className="h-3.5 w-3.5 fill-current" /> Assistir Agora
                    </Button>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-primary/10 flex items-center gap-2">
                  <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="h-2.5 w-2.5 text-primary" />
                  </div>
                  <p className="text-[10px] text-muted-foreground italic leading-tight">
                    "Antes de continuar, recomendo assistir esta aula para ter a visão geral do tema."
                  </p>
                </div>
              </div>
            )}

            <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 text-xs sm:text-sm prose-p:my-3 prose-headings:mt-5 prose-headings:mb-2 prose-ul:my-3 prose-ol:my-3 prose-li:my-1 [&_p:has(+ul)]:mb-1 [&_p:has(+ol)]:mb-1 [&>p+p]:mt-4 [&_strong]:text-foreground [&_hr]:my-4 [&_blockquote]:my-3">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ href, children, ...props }) => {
                    const safeHref = sanitizeReferenceUrl(href);
                    return (
                      <a href={safeHref} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80" {...props}>
                        {children}
                      </a>
                    );
                  },
                }}
              >{linkifyBareUrls(cleanedMarkdown)}</ReactMarkdown>
            </div>

            {blocks.length > 0 && (
              <div className="mt-4">
                <TutorBlockRenderer 
                  blocks={blocks} 
                  conversationId={conversationId} 
                  topic={topic}
                />
              </div>
            )}
            <MultimediaControls text={msg.content} />
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
              <button onClick={() => onCopy(msg.content)} className="p-1.5 rounded-lg hover:bg-background/50 backdrop-blur-sm" title="Copiar">
                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
            
            <div className="flex flex-col gap-3 mt-4 pt-3 border-t border-border/30 empty:hidden">
              <div className="flex gap-2">

              {/* Botão de gerar aula interativa removido a pedido do usuário */}


              {lessonData && (
                <Button
                  variant="default"
                  size="sm"
                  className="h-7 text-xs gap-1.5 animate-fade-in bg-primary hover:bg-primary/90 text-primary-foreground"
                  onClick={() => {
                    logVideoRecommendationEvent('clicked', { lessonId: lessonData?.id, topic, location: 'bottom_button', conversationId });
                    if (lessonData?.id) {
                      navigate(`/dashboard/videoaulas/${lessonData.id}`);
                    } else {
                      toast.info("Esta aula está sendo preparada. Tente novamente em breve.");
                    }
                  }}
                >
                  <Play className="h-3.5 w-3.5 fill-current" /> Abrir Aula Completa
                </Button>
              )}

              {/* Botão de fallback removido a pedido do usuário */}

              </div>
              
              {msg.role === "assistant" && hasPermission && (
                <div className="bg-primary/5 rounded-lg p-2 border border-primary/10 flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                    Análise Cognitiva & Lineage
                  </span>
                  <div className="flex gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 px-2">
                          <Terminal className="h-3 w-3" /> Debug IA
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-2xl bg-slate-950 border-white/10 text-white max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2 text-primary">
                            <Terminal className="h-5 w-5" />
                            Modo Debug Pedagógico (Admin)
                          </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4 font-mono text-[10px]">
                          <div className="space-y-1">
                            <p className="text-muted-foreground uppercase font-bold">Metadata da Mensagem</p>
                            <div className="bg-white/5 p-2 rounded border border-white/10">
                              <p>ConversationID: {conversationId || 'N/A'}</p>
                              <p>Topic: {topic || 'N/A'}</p>
                              <p>Blocks Found: {blocks.length}</p>
                              <p>Tokens Estimated: {Math.ceil(msg.content.length / 4)}</p>
                              <p>Model: GPT-5 (Standard)</p>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <p className="text-muted-foreground uppercase font-bold">Estrutura de Blocos</p>
                            <div className="bg-white/5 p-2 rounded border border-white/10 whitespace-pre-wrap">
                              {JSON.stringify(blocks, null, 2)}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <p className="text-muted-foreground uppercase font-bold">Conteúdo Original (Raw)</p>
                            <div className="bg-white/5 p-2 rounded border border-white/10 whitespace-pre-wrap">
                              {msg.content}
                            </div>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 text-[10px] gap-1 px-2"
                      onClick={() => navigate('/admin/cme-executive')}
                    >
                      <Activity className="h-3 w-3" /> Dashboard
                    </Button>
                  </div>
                </div>
              )}
            </div>


            {/* Modal de Status CME */}
            <Dialog open={state.status !== 'idle'} onOpenChange={(open) => !open && resetState()}>
              <DialogContent className="sm:max-w-md bg-slate-950 border-white/10 text-white">
                {!isAdmin ? (
                  // ===== USER MODE (override freeze: cme-ux-correct-fix) =====
                  <>
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-amber-500" />
                        Geração da aula
                      </DialogTitle>
                      <DialogDescription className="text-slate-400">
                        {state.status === 'failed'
                          ? humanizeCMEMessage(state.error)
                          : (FRIENDLY_STATUS_LABEL[state.status === 'completed' || state.status === 'ready' ? 'ready' : 'processing'])}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-6 space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs text-slate-400">
                          <span className="truncate pr-2">{friendlyStageLabel(state.progress)}</span>
                          <span className="tabular-nums">{state.progress}%</span>
                        </div>
                        <Progress value={state.progress} className="h-2 bg-white/5" />
                      </div>
                      {state.isStuck && state.status !== 'failed' && (
                        <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg text-xs text-zinc-300">
                          Sua aula está demorando um pouco mais que o normal. Você pode aguardar ou usar uma versão alternativa em slides.
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full h-8 text-xs mt-2"
                            onClick={() => state.projectId && triggerPedagogicalFallback(state.projectId)}
                          >
                            Usar versão em slides
                          </Button>
                        </div>
                      )}
                      {state.status === 'failed' && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-xs">
                          {humanizeCMEMessage(state.error)}
                        </div>
                      )}
                    </div>
                    <DialogFooter className="sm:justify-end gap-2">
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
                      <Button type="button" variant="secondary" onClick={resetState} className="text-xs h-8">
                        Fechar
                      </Button>
                    </DialogFooter>
                  </>
                ) : (
                  // ===== ADMIN MODE: telemetria técnica completa =====
                  <>
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-amber-500" />
                        Fábrica de Vídeos CME
                      </DialogTitle>
                      <DialogDescription className="text-slate-400">
                        Processando com telemetria cognitiva e resiliência enterprise. {state.isStuck ? 'Recuperação automática acionada.' : 'Pipeline nominal.'}
                      </DialogDescription>
                    </DialogHeader>

                    <div className="py-6 space-y-6">
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
                          <span>Fase: {state.message || state.status}</span>
                          <span>{state.progress}%</span>
                        </div>
                        <Progress value={state.progress} className="h-1.5 bg-white/5" />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { id: 'planning', label: 'Semantic Planning' },
                          { id: 'mapping', label: 'Knowledge Mapping' },
                          { id: 'graphing', label: 'Scene Graphing' },
                          { id: 'worker_selection', label: 'Worker Selection' },
                          { id: 'gpu_rendering', label: 'GPU Render' },
                          { id: 'pending_hardware', label: 'Waiting Hardware' }
                        ].map((step, idx) => (
                          <div key={step.id} className={cn(
                            "flex items-center gap-2 p-2 rounded-lg border text-[10px] font-bold uppercase tracking-tight transition-all duration-300",
                            state.status === step.id ? "bg-amber-500/10 border-amber-500/20 text-amber-500" :
                            state.progress >= ([30, 35, 50, 70, 80, 65][idx]) ? "bg-amber-500/10 border-amber-500/20 text-amber-500" :
                            "bg-white/5 border-white/5 text-slate-600"
                          )}>
                            <div className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              state.status === step.id ? "bg-amber-500 animate-pulse" :
                              state.progress >= ([30, 35, 50, 70, 80, 65][idx]) ? "bg-amber-500" : "bg-slate-700"
                            )} />
                            {step.label}
                          </div>
                        ))}
                      </div>

                      {workerHealth && (
                        <div className="flex items-center gap-4 px-2 py-1 bg-white/5 rounded border border-white/10 text-[9px] text-slate-400">
                          <div className="flex items-center gap-1">
                            <div className={cn("h-1 w-1 rounded-full", workerHealth.workers_online > 0 ? "bg-green-500" : "bg-red-500")} />
                            GPU Workers: {workerHealth.workers_online}
                          </div>
                          {workerHealth.workers_online > 0 && (
                            <>
                              <div>VRAM: {Math.round((workerHealth.used_vram_mb / workerHealth.total_vram_mb) * 100)}%</div>
                              <div>Load: {Math.round(workerHealth.avg_load)}%</div>
                            </>
                          )}
                        </div>
                      )}

                      {state.isStuck && (
                        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg space-y-2">
                          <div className="flex items-center gap-2 text-amber-400 text-[10px] font-bold">
                            <AlertCircle className="h-3 w-3" />
                            PIPELINE EM ESPERA (STANDBY)
                          </div>
                          <p className="text-[9px] text-amber-300/70 italic">
                            O cluster GPU está com alta demanda ou offline. Você pode aguardar ou usar o fallback pedagógico instantâneo.
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full h-7 text-[10px] bg-amber-500/20 border-amber-500/30 text-amber-500 hover:bg-amber-500/30"
                            onClick={() => state.projectId && triggerPedagogicalFallback(state.projectId)}
                          >
                            Ativar Fallback de Slides
                          </Button>
                        </div>
                      )}

                      {state.projectId && (
                        <div className="text-[10px] text-slate-500 font-mono flex items-center gap-2">
                          <div className={cn("h-1 w-1 rounded-full bg-green-500", !state.isStuck && "animate-ping")} />
                          TELEMETRY: {state.isStuck ? 'STANDBY' : 'ACTIVE'} | ID_{state.projectId.slice(0, 8)}
                        </div>
                      )}

                      {state.status === 'failed' && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs italic">
                          Erro: {state.error}
                        </div>
                      )}
                    </div>

                    <DialogFooter className="sm:justify-start">
                      <Button type="button" variant="secondary" onClick={resetState} className="text-xs h-8">
                        Fechar
                      </Button>
                      {['rendering', 'render_job_creation', 'worker_selection', 'gpu_rendering', 'pending_hardware'].includes(String(state.status)) && (
                        <Button
                          type="button"
                          className="bg-amber-600 hover:bg-amber-700 text-xs h-8 gap-2"
                          onClick={() => {
                            resetState();
                            navigate(`/admin/cinematic-engine/${state.projectId}`);
                          }}
                        >
                          <Play className="h-3 w-3" /> Ver no Monitor
                        </Button>
                      )}
                    </DialogFooter>
                  </>
                )}
              </DialogContent>
            </Dialog>

            {/* Agile Player Overlay */}
            {showAgilePlayer && (activeAggregationId || state.aggregationId) && (
              <AgileLessonPlayer 
                aggregationId={activeAggregationId || state.aggregationId || ""} 
                onClose={() => {
                  setShowAgilePlayer(false);
                  setActiveAggregationId(null);
                }} 
              />
            )}
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
}, (prev, next) => 
  prev.msg.content === next.msg.content && 
  prev.msg.role === next.msg.role && 
  prev.onCopy === next.onCopy &&
  prev.isLoading === next.isLoading &&
  prev.conversationId === next.conversationId &&
  prev.topic === next.topic &&
  prev.specialty === next.specialty
);

TutorMessageItem.displayName = "TutorMessageItem";

export default TutorMessageItem;