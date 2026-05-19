console.error("🔥 BUILD_FORENSE", {
  component: "AgentMessageItem.tsx",
  timestamp: Date.now(),
  version: "FORENSE_V1"
});
import { memo, useMemo, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Copy, Volume2, VolumeX, Save, Check, Loader2, GraduationCap, User, Film, Play, Sparkles, AlertCircle, RefreshCw, BarChart3, LineChart, BookOpen, ArrowRight } from "lucide-react";
import tutorAvatar from "@/assets/tutor-avatar-hd.png";
import { MemoryReuseBadge } from "@/components/tutor/MemoryReuseBadge";
import { TutorBlockRenderer } from "@/components/tutor/blocks/TutorBlockRenderer";
import { adjustMemoryQuality } from "@/lib/tutor/tutorMemory";
import type { Msg, LinkToAgent } from "./agentChatTypes";
import { useTutorCME } from "@/hooks/useTutorCME";
import { useUserRoles } from "@/hooks/useUserRoles";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { extractInlineTutorBlocks } from "@/lib/tutor/extractInlineBlocks";
import { splitPedagogicalSections } from "@/lib/tutor/splitPedagogicalSections";
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

    const [unlockedSections, setUnlockedSections] = useState(1);
    const pedagogicalSections = useMemo(() => {
      if (msg.role !== "assistant") return [renderedMarkdown];
      return splitPedagogicalSections(renderedMarkdown);
    }, [renderedMarkdown, msg.role]);

    const isAllTextUnlocked = unlockedSections >= pedagogicalSections.length;

    // Validação Gating Enterprise
    const validation = useMemo(() => {
      return validateTutorMessageForCME(msg.content, cognitiveBlocks);
    }, [msg.content, cognitiveBlocks]);

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
            <div className="space-y-6">
              <AnimatePresence mode="popLayout">
                {pedagogicalSections.slice(0, unlockedSections).map((section, sIdx) => (
                  <motion.div
                    key={sIdx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="relative"
                  >
                    {renderAssistantMessage ? (
                      renderAssistantMessage(section)
                    ) : (
                      <div className="prose prose-sm dark:prose-invert max-w-none prose-p:text-base sm:prose-p:text-lg prose-p:leading-relaxed prose-p:text-white/80 prose-headings:text-white prose-headings:font-black prose-headings:tracking-tighter prose-strong:text-primary prose-strong:font-bold">
                        <ReactMarkdown components={markdownComponents}>{section}</ReactMarkdown>
                      </div>
                    )}
                    
                    {sIdx === unlockedSections - 1 && !isAllTextUnlocked && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="mt-6 flex justify-center"
                      >
                        <button
                          onClick={() => setUnlockedSections(prev => prev + 1)}
                          className="group relative flex items-center gap-3 px-8 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-bold text-sm tracking-tight hover:bg-white/10 hover:border-primary/30 transition-all active:scale-95 shadow-lg"
                        >
                          <div className="absolute inset-0 bg-primary/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                          <span>Entendi, avançar para etapa {sIdx + 2}</span>
                          <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                        </button>
                      </motion.div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {isAllTextUnlocked && hasCognitiveBlocks && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 pt-6 border-t border-white/5"
                >
                  <TutorBlockRenderer
                    blocks={cognitiveBlocks}
                    onQuizAnswered={({ correct }) => {
                      if (!msg.memoryId) return;
                      adjustMemoryQuality(msg.memoryId, correct ? 3 : -5).catch(() => {});
                    }}
                  />
                </motion.div>
              )}

              {isAllTextUnlocked && msg.bibliography && msg.bibliography.length > 0 && (
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
                {isAllTextUnlocked && hasOnSaveMessage && index > 0 && !isLoading && (
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
                
                {isAllTextUnlocked && showCMEButton && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1.5 border-amber-500/30 text-amber-500 hover:bg-amber-500/10 animate-fade-in shadow-sm shadow-amber-500/20"
                      onClick={() => handleCMETransform(true)}
                    >
                      <Film className="h-3.5 w-3.5" /> 🎬 Transformar Sessão Completa em Videoaula
                    </Button>
                  </div>
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
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none prose-p:text-base sm:prose-p:text-lg prose-p:leading-relaxed prose-p:text-white/80">
              <ReactMarkdown components={markdownComponents}>{msg.content}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    );
  }
);

AgentMessageItem.displayName = "AgentMessageItem";
export default AgentMessageItem;
