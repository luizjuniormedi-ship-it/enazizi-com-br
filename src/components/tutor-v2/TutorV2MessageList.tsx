import { motion, AnimatePresence } from "framer-motion";
import { Brain, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

interface TutorV2MessageListProps {
  messages: any[];
  isTyping: boolean;
}

export default function TutorV2MessageList({ messages, isTyping }: TutorV2MessageListProps) {
  return (
    <div className="max-w-4xl mx-auto w-full">
      {messages.map((msg, idx) => (
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "flex gap-4 mb-8",
            msg.role === "assistant" ? "flex-row" : "flex-row-reverse"
          )}
        >
          <div className={cn(
            "h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-1",
            msg.role === "assistant" ? "bg-indigo-500 shadow-lg shadow-indigo-500/20" : "bg-slate-700"
          )}>
            {msg.role === "assistant" ? <Brain className="h-5 w-5 text-white" /> : <User className="h-5 w-5 text-white" />}
          </div>
          
          <div className={cn(
            "p-4 rounded-2xl max-w-[80%] text-[13px] leading-relaxed prose prose-invert prose-sm",
            msg.role === "assistant" ? "bg-slate-800/50 border border-white/5 text-slate-200" : "bg-indigo-600 text-white"
          )}>
            <ReactMarkdown>
              {msg.content}
            </ReactMarkdown>
          </div>
        </motion.div>
      ))}

      {isTyping && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex gap-4 mb-8"
        >
          <div className="h-8 w-8 rounded-xl bg-indigo-500 flex items-center justify-center flex-shrink-0">
            <Brain className="h-5 w-5 text-white animate-pulse" />
          </div>
          <div className="p-4 rounded-2xl bg-slate-800/50 border border-white/5 flex gap-1 items-center h-10">
            <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" />
            <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]" />
            <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]" />
          </div>
        </motion.div>
      )}
    </div>
  );
}
