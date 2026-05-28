import React, { memo, useEffect, useRef } from "react";
import { Loader2, User } from "lucide-react";
import MessageBubble, { ChatMessage } from "./MessageBubble";

interface MessageListProps {
  messages: ChatMessage[];
  isTyping: boolean;
  isFinishing: boolean;
}

/**
 * Isola o re-render da lista de mensagens.
 * Cada bolha é memoizada por referência (msg === msg), portanto novas mensagens
 * só renderizam o item adicionado, não a lista inteira.
 */
const MessageList = memo(function MessageList({ messages, isTyping, isFinishing }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll APENAS o container interno, nunca a página.
    // Evita window.scrollTo implícito do scrollIntoView que empurra o layout.
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, isTyping, isFinishing]);

  return (
    <div ref={containerRef} className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain p-4 space-y-3">

      {messages.map((msg, i) => (
        <MessageBubble key={i} msg={msg} />
      ))}

      {isTyping && (
        <div className="flex gap-2 justify-start">
          <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-1">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="bg-muted/50 border border-border/50 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        </div>
      )}

      {isFinishing && (
        <div className="flex justify-center py-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Avaliando seu desempenho...</span>
          </div>
        </div>
      )}
    </div>
  );
});


export default MessageList;
