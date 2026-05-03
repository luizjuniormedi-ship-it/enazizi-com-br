import { forwardRef, useCallback } from "react";
import TutorMessageItem from "@/components/tutor/TutorMessageItem";
import TutorThinkingIndicator from "@/components/tutor/TutorThinkingIndicator";
import type { Msg } from "@/components/tutor/TutorConstants";
import { cn } from "@/lib/utils";

interface TutorMessageListProps {
  messages: Msg[];
  isLoading: boolean;
  onCopy: (text: string) => void;
  conversationId?: string;
  topic?: string;
  specialty?: string;
}

const TutorMessageList = forwardRef<HTMLDivElement, TutorMessageListProps>(
  ({ messages, isLoading, onCopy, conversationId, topic, specialty }, ref) => {
    const handleCopy = useCallback((text: string) => onCopy(text), [onCopy]);

    return (
      <div
        ref={ref}
        className={cn(
          "relative flex-1 rounded-2xl overflow-y-auto p-2 sm:p-4 mb-2 sm:mb-3 min-h-0",
          "border border-white/[0.06] bg-card/40 backdrop-blur-md",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_8px_32px_-12px_hsl(var(--hue-tutor)/0.25)]",
        )}
      >
        {/* Atmosfera ambient — glow neural sutil no fundo */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(ellipse at 12% 0%, hsl(var(--hue-tutor) / 0.08), transparent 55%), radial-gradient(ellipse at 88% 100%, hsl(var(--hue-tutor) / 0.06), transparent 50%)",
          }}
        />

        {/* Pattern de pontos sutil — herda do .pattern-dots */}
        <div aria-hidden className="pointer-events-none absolute inset-0 pattern-dots opacity-40" />

        {/* Conteúdo (acima da atmosfera) */}
        <div className="relative space-y-3 sm:space-y-4">
          {messages.map((msg, i) => {
            const isFirstAssistantMessage = msg.role === "assistant" && !messages.slice(0, i).some(m => m.role === "assistant");
            return (
              <TutorMessageItem 
                key={i} 
                msg={msg} 
                onCopy={handleCopy} 
                isLoading={isLoading}
                conversationId={conversationId}
                topic={topic}
                specialty={specialty}
                isFirstMessage={isFirstAssistantMessage}
              />
            );
          })}

          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <TutorThinkingIndicator />
          )}
        </div>
      </div>
    );
  }
);

TutorMessageList.displayName = "TutorMessageList";

export default TutorMessageList;
