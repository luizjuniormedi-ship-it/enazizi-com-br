import { memo, useMemo, useEffect } from "react";
import { User, Copy, Film, Sparkles, Play, AlertCircle } from "lucide-react";
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
  DialogFooter
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import type { Msg } from "@/components/tutor/TutorConstants";

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
}

const TutorMessageItem = memo(({ msg, onCopy, isLoading, conversationId, topic, specialty }: TutorMessageItemProps) => {
  const navigate = useNavigate();
  const { state, workerHealth, transformToVideo, triggerPedagogicalFallback, resetState } = useTutorCME();
  const { isAdmin, isProfessor, roles } = useUserRoles();
  const { isEnabled } = useFeatureFlags();

  const isCoordinator = roles.includes("coordenador") || roles.includes("coordinator");
  const hasPermission = isAdmin || isProfessor || isCoordinator;

  const flagsEnabled = isEnabled("cme_enabled") && 
                       isEnabled("tutor_cme_enabled") && 
                       isEnabled("cinematic_factory_enabled");

  // Critérios relaxados
  const criteria = useMemo(() => {
    const content = msg.content.toLowerCase();
    return {
      isLong: msg.content.length > 800,
      hasTitle: msg.content.includes('# ') || msg.content.includes('## '),
      hasStructure: msg.content.includes('- ') || msg.content.includes('1. '),
      isMedical: !!msg.content.match(/(médico|clínico|tratamento|diagnóstico|paciente|sintoma|medicina|anatomia|patologia)/i),
      isFeynman: content.includes('feynman'),
      hasSummary: content.includes('resumo') || content.includes('pontos-chave')
    };
  }, [msg.content]);

  const isEligible = Object.values(criteria).some(Boolean);

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
              >{linkifyBareUrls(msg.content)}</ReactMarkdown>
            </div>
            <MultimediaControls text={msg.content} />
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
              <button onClick={() => onCopy(msg.content)} className="p-1.5 rounded-lg hover:bg-background/50 backdrop-blur-sm" title="Copiar">
                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
            
            <div className="flex gap-2 mt-2 pt-2 border-t border-border/30 empty:hidden">
              {showCMEButton && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1.5 border-amber-500/30 text-amber-500 hover:bg-amber-500/10 animate-fade-in"
                  onClick={handleCMETransform}
                >
                  <Film className="h-3.5 w-3.5" /> 🎬 Transformar em Videoaula
                </Button>
              )}
              {showFallbackButton && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[10px] gap-1.5 text-muted-foreground hover:text-amber-500 border border-transparent hover:border-amber-500/20"
                  onClick={handleCMETransform}
                  title="Forçar criação mesmo sem estrutura detectada"
                >
                  <AlertCircle className="h-3 w-3" /> Criar videoaula a partir desta resposta
                </Button>
              )}
            </div>

            {/* Modal de Status CME */}
            <Dialog open={state.status !== 'idle'} onOpenChange={(open) => !open && resetState()}>
              <DialogContent className="sm:max-w-md bg-slate-950 border-white/10 text-white">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-amber-500" />
                    Fábrica de Vídeos CME
                  </DialogTitle>
                  <DialogDescription className="text-slate-400">
                    Transformando seu conteúdo pedagógico em uma experiência cinematográfica multimodal.
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
                      { id: 'scripting', label: 'Narrative Building' },
                      { id: 'graphing', label: 'Scene Graph' },
                      { id: 'rendering', label: 'GPU Rendering' }
                    ].map((step, idx) => (
                      <div key={step.id} className={cn(
                        "flex items-center gap-2 p-2 rounded-lg border text-[10px] font-bold uppercase tracking-tight transition-all duration-300",
                        state.progress > (idx * 25) || state.status === step.id ? "bg-amber-500/10 border-amber-500/20 text-amber-500" : "bg-white/5 border-white/5 text-slate-600"
                      )}>
                        <div className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          state.status === step.id ? "bg-amber-500 animate-pulse" : 
                          state.progress > (idx * 25) ? "bg-amber-500" : "bg-slate-700"
                        )} />
                        {step.label}
                      </div>
                    ))}
                  </div>

                  {state.isStuck && state.status === 'rendering' && (
                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg space-y-1">
                      <div className="flex items-center gap-2 text-blue-400 text-[10px] font-bold">
                        <AlertCircle className="h-3 w-3" />
                        WORKER OFFLINE
                      </div>
                      <p className="text-[9px] text-blue-300/70 italic">
                        Renderização automática pendente de worker GPU real. O projeto está pronto para edição no Builder.
                      </p>
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
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={resetState}
                    className="text-xs h-8"
                  >
                    Fechar
                  </Button>
                  {state.status === 'rendering' && (
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