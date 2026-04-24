import { memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Copy, Volume2, VolumeX, Save, Check, Loader2, GraduationCap, User } from "lucide-react";
import tutorAvatar from "@/assets/tutor-avatar-hd.png";
import { MemoryReuseBadge } from "@/components/tutor/MemoryReuseBadge";
import { TutorBlockRenderer } from "@/components/tutor/blocks/TutorBlockRenderer";
import { adjustMemoryQuality } from "@/lib/tutor/tutorMemory";
import type { Msg, LinkToAgent } from "./agentChatTypes";

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
  }: AgentMessageItemProps) => {
    return (
      <div className={`flex gap-2 sm:gap-3 ${msg.role === "user" ? "justify-end" : ""} animate-fade-in`}>
        {msg.role === "assistant" && (
          <div className="h-12 w-9 sm:h-14 sm:w-11 rounded-xl overflow-hidden flex-shrink-0 tutor-glow bot-breathing ring-1 ring-primary/25 shadow-md">
            <img src={tutorAvatar} alt={title} className="h-full w-full object-contain" />
          </div>
        )}
        <div
          className={`rounded-xl px-3 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm leading-relaxed relative group ${
            msg.role === "user"
              ? "max-w-[85%] sm:max-w-[75%] bg-gradient-to-br from-primary to-primary/80 text-primary-foreground"
              : "w-full bg-secondary/80 backdrop-blur-sm text-secondary-foreground relative gradient-border-subtle"
          }`}
        >
          {msg.role === "assistant" ? (
            <>
              {renderAssistantMessage ? (
                renderAssistantMessage(msg.content)
              ) : (
                <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 text-xs sm:text-sm prose-p:my-3 prose-headings:mt-5 prose-headings:mb-2 prose-ul:my-3 prose-ol:my-3 prose-li:my-1 [&_p:has(+ul)]:mb-1 [&_p:has(+ol)]:mb-1 [&>p+p]:mt-4 [&_strong]:text-foreground [&_hr]:my-4 [&_blockquote]:my-3">
                  <ReactMarkdown components={markdownComponents}>{msg.content}</ReactMarkdown>
                </div>
              )}
              {msg.memoryId && msg.sourceQuestion && (
                <div className="mt-3">
                  <MemoryReuseBadge
                    reuseCount={msg.memoryReuseCount}
                    qualityScore={msg.memoryQualityScore}
                    scope={msg.memoryScope}
                    onRegenerate={
                      onRegenerateFromMemory && !isLoading
                        ? () => onRegenerateFromMemory(msg.sourceQuestion!)
                        : undefined
                    }
                  />
                </div>
              )}
              <button
                onClick={() => onCopy(msg.content)}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-background/50 backdrop-blur-sm"
                title="Copiar"
              >
                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              {hasSpeechSynthesis && (
                <button
                  onClick={() => onSpeak(msg.content, index)}
                  className="absolute top-2 right-9 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-background/50 backdrop-blur-sm"
                  title={speakingMsgIdx === index ? "Parar" : "Ouvir"}
                >
                  {speakingMsgIdx === index ? (
                    <VolumeX className="h-3.5 w-3.5 text-primary animate-pulse" />
                  ) : (
                    <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </button>
              )}
              <div className="flex gap-2 mt-2 pt-2 border-t border-border/30 empty:hidden">
                {hasOnSaveMessage && index > 0 && !isLoading && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1.5"
                    disabled={savingMsgIdx === index || isSaved}
                    onClick={() => onSave(index, msg.content)}
                  >
                    {isSaved ? (
                      <><Check className="h-3.5 w-3.5 text-success" /> Salvo</>
                    ) : savingMsgIdx === index ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando...</>
                    ) : (
                      <><Save className="h-3.5 w-3.5" /> Salvar</>
                    )}
                  </Button>
                )}
                {linkToAgent && index > 0 && !isLoading && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1.5"
                    onClick={() => onLink(msg.content.slice(0, 10000), Array.from(selectedUploadIds))}
                  >
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
    );
  },
  (prev, next) =>
    prev.msg.role === next.msg.role &&
    prev.msg.content === next.msg.content &&
    prev.msg.memoryId === next.msg.memoryId &&
    prev.index === next.index &&
    prev.isLoading === next.isLoading &&
    prev.speakingMsgIdx === next.speakingMsgIdx &&
    prev.savingMsgIdx === next.savingMsgIdx &&
    prev.isSaved === next.isSaved &&
    prev.selectedUploadIds === next.selectedUploadIds
);
AgentMessageItem.displayName = "AgentMessageItem";
export default AgentMessageItem;
