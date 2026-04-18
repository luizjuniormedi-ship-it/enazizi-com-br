import { forwardRef, useCallback } from "react";
import tutorAvatar from "@/assets/tutor-avatar-hd.png";
import TutorMessageItem from "@/components/tutor/TutorMessageItem";
import type { Msg } from "@/components/tutor/TutorConstants";

interface TutorMessageListProps {
  messages: Msg[];
  isLoading: boolean;
  onCopy: (text: string) => void;
}

const TutorMessageList = forwardRef<HTMLDivElement, TutorMessageListProps>(
  ({ messages, isLoading, onCopy }, ref) => {
    // Stable callback so memoized children don't invalidate
    const handleCopy = useCallback((text: string) => onCopy(text), [onCopy]);

    return (
      <div ref={ref} className="flex-1 rounded-xl border border-border/50 bg-card/50 p-2 sm:p-4 overflow-y-auto space-y-3 sm:space-y-4 mb-2 sm:mb-3 min-h-0 pattern-dots">
        {messages.map((msg, i) => (
          <TutorMessageItem key={i} msg={msg} onCopy={handleCopy} />
        ))}
        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex gap-2 sm:gap-3 animate-fade-in">
            <div className="h-12 w-9 sm:h-14 sm:w-11 rounded-xl overflow-hidden flex-shrink-0 tutor-glow bot-breathing ring-1 ring-primary/25 shadow-md">
              <img src={tutorAvatar} alt="Tutor" className="h-full w-full object-contain" />
            </div>
            <div className="rounded-xl px-4 py-3 bg-secondary/80 backdrop-blur-sm">
              <div className="flex gap-1.5 items-center">
                <div className="h-2 w-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="h-2 w-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="h-2 w-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);

TutorMessageList.displayName = "TutorMessageList";

export default TutorMessageList;
