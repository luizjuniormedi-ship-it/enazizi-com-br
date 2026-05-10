import { motion } from "framer-motion";
import { User, Plus } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import enaziziMascot from "@/assets/enazizi-mascot.png";

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
            "h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-1 overflow-hidden",
            msg.role === "assistant" ? "bg-indigo-500/10 ring-1 ring-indigo-500/30 shadow-lg shadow-indigo-500/20" : "bg-slate-700"
          )}>
            {msg.role === "assistant"
              ? <img src={enaziziMascot} alt="Tutor ENAZIZI" className="h-8 w-8 object-cover" />
              : <User className="h-5 w-5 text-white" />}
          </div>
          
          <div className={cn(
            "p-4 rounded-2xl max-w-[80%] text-[13px] leading-relaxed prose prose-invert prose-sm",
            msg.role === "assistant" ? "bg-slate-800/50 border border-white/5 text-slate-200" : "bg-indigo-600 text-white"
          )}>
            <ReactMarkdown>
              {msg.content}
            </ReactMarkdown>

            {msg.metadata?.flashcard_suggestion && (
              <div className="mt-4 p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest">Sugestão FSRS</p>
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-[8px] font-black uppercase tracking-tighter gap-1">
                    <Plus className="h-2 w-2" /> Criar Card
                  </Button>
                </div>
                <p className="text-[11px] font-bold text-white mb-1">P: {msg.metadata.flashcard_suggestion.front}</p>
                <p className="text-[11px] text-slate-400 italic">R: {msg.metadata.flashcard_suggestion.back}</p>
              </div>
            )}
          </div>
        </motion.div>
      ))}

      {isTyping && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex gap-4 mb-8"
        >
          <div className="h-8 w-8 rounded-xl bg-indigo-500/10 ring-1 ring-indigo-500/30 flex items-center justify-center flex-shrink-0 overflow-hidden">
            <img src={enaziziMascot} alt="Tutor ENAZIZI" className="h-8 w-8 object-cover animate-pulse" />
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
