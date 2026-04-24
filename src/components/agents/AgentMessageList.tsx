import { memo, forwardRef } from "react";
import AgentMessageItem from "./AgentMessageItem";
import tutorAvatar from "@/assets/tutor-avatar-hd.png";
import type { Msg, LinkToAgent } from "./agentChatTypes";

interface AgentMessageListProps {
  messages: Msg[];
  isLoading: boolean;
  loadingStage: string;
  title: string;
  hasSpeechSynthesis: boolean;
  speakingMsgIdx: number | null;
  savingMsgIdx: number | null;
  savedMsgIdxs: Set<number>;
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

const AgentMessageList = memo(
  forwardRef<HTMLDivElement, AgentMessageListProps>(
    (
      {
        messages, isLoading, loadingStage, title, hasSpeechSynthesis,
        speakingMsgIdx, savingMsgIdx, savedMsgIdxs, hasOnSaveMessage,
        linkToAgent, selectedUploadIds, renderAssistantMessage,
        onCopy, onSpeak, onSave, onLink,
      },
      ref
    ) => (
      <div
        ref={ref}
        className="flex-1 rounded-xl border border-border/50 bg-card/50 p-2 sm:p-4 overflow-y-auto space-y-3 sm:space-y-4 mb-2 sm:mb-3 min-h-0 pattern-dots"
      >
        {messages.map((msg, i) => (
          <AgentMessageItem
            key={i}
            msg={msg}
            index={i}
            title={title}
            isLoading={isLoading}
            hasSpeechSynthesis={hasSpeechSynthesis}
            speakingMsgIdx={speakingMsgIdx}
            savingMsgIdx={savingMsgIdx}
            isSaved={savedMsgIdxs.has(i)}
            hasOnSaveMessage={hasOnSaveMessage}
            linkToAgent={linkToAgent}
            selectedUploadIds={selectedUploadIds}
            renderAssistantMessage={renderAssistantMessage}
            onCopy={onCopy}
            onSpeak={onSpeak}
            onSave={onSave}
            onLink={onLink}
          />
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
              {loadingStage && <p className="text-xs text-muted-foreground animate-pulse">{loadingStage}</p>}
            </div>
          </div>
        )}
      </div>
    )
  )
);
AgentMessageList.displayName = "AgentMessageList";
export default AgentMessageList;
