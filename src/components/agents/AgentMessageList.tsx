import { memo, forwardRef } from "react";
import AgentMessageItem from "./AgentMessageItem";
import tutorAvatar from "@/assets/tutor-avatar-hd.png";
import type { Msg, LinkToAgent } from "./agentChatTypes";
import TutorNextStepBlock from "@/components/tutor/TutorNextStepBlock";


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
  onIncrementalAction?: (action: string) => void;
  /** CME integration props */
  conversationId?: string;
  topic?: string | null;
  subtopic?: string | null;
  specialty?: string | null;
}

const AgentMessageList = memo(
  forwardRef<HTMLDivElement, AgentMessageListProps>(
    (
      {
        messages, isLoading, loadingStage, title, hasSpeechSynthesis,
        speakingMsgIdx, savingMsgIdx, savedMsgIdxs, hasOnSaveMessage,
        linkToAgent, selectedUploadIds, renderAssistantMessage,
        onCopy, onSpeak, onSave, onLink, onRegenerateFromMemory, onIncrementalAction,
        conversationId, topic, subtopic, specialty
      },
      ref
    ) => (
      <div
        ref={ref}
        className="flex-1 px-4 sm:px-12 py-8 overflow-y-auto space-y-12 mb-2 sm:mb-3 min-h-0 scrollbar-hide selection:bg-primary/30"
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
            onRegenerateFromMemory={onRegenerateFromMemory}
            onIncrementalAction={onIncrementalAction}
            conversationId={conversationId}
            topic={topic || undefined}
            subtopic={subtopic || undefined}
            specialty={specialty || undefined}
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
        
        {messages.length > 1 && !isLoading && title.toLowerCase().includes("tutor") && (
          <TutorNextStepBlock 
            topic={topic} 
            specialty={specialty} 
            sessionId={conversationId} 
            content={messages[messages.length - 1]?.content}
          />
        )}
      </div>

    )
  )
);
AgentMessageList.displayName = "AgentMessageList";
export default AgentMessageList;
