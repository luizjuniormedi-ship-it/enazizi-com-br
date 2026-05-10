import { motion } from "framer-motion";
import { User, Plus, Zap } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import ProgressiveBlocks from "./ProgressiveBlocks";
import { MascotAvatar } from "../mascot/MascotAvatar";

interface TutorV2MessageListProps {
  messages: any[];
  isTyping: boolean;
}

export default function TutorV2MessageList({ messages, isTyping }: TutorV2MessageListProps) {
  return (
    <div className="max-w-4xl mx-auto w-full pb-10">
      {messages.length === 0 && !isTyping && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <div className="mb-6">
            <MascotAvatar state="idle" size="lg" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Iniciando sua Sessão Premium</h3>
          <p className="text-slate-400 text-sm max-w-xs">
            Dê o primeiro passo. Pergunte algo ou peça para eu explicar um conceito clínico complexo.
          </p>
        </motion.div>
      )}

      {messages.map((msg, idx) => (
        <motion.div
          key={msg.id || idx}
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            "flex gap-4 mb-8 items-start",
            msg.role === "assistant" ? "flex-row" : "flex-row-reverse"
          )}
        >
          <div className="flex-shrink-0 mt-1">
            {msg.role === "assistant"
              ? <MascotAvatar state="teaching" size="sm" />
              : (
                <div className="h-10 w-10 rounded-2xl flex items-center justify-center bg-slate-800 border border-white/10">
                  <User className="h-5 w-5 text-slate-400" />
                </div>
              )}
          </div>
          
          <div className={cn(
            "p-5 rounded-[1.8rem] max-w-[85%] text-[14px] leading-relaxed shadow-xl relative",
            msg.role === "assistant" 
              ? "bg-slate-900/80 border border-white/5 text-slate-200 backdrop-blur-md" 
              : "bg-gradient-to-br from-indigo-600 to-indigo-700 text-white border border-white/10"
          )}>
            {msg.role === "assistant" ? (
              <ProgressiveBlocks content={msg.content} />
            ) : (
              <div className="prose prose-invert prose-sm max-w-none prose-p:text-white prose-headings:text-white">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            )}

            {msg.metadata?.flashcard_suggestion && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 p-5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 ring-1 ring-white/5 relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-100 transition-opacity">
                  <Plus className="h-4 w-4 text-indigo-400" />
                </div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-5 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                      <Zap className="h-3 w-3 text-indigo-400" />
                    </div>
                    <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest">Flashcard Sugerido</p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 px-3 text-[9px] font-black uppercase tracking-tighter gap-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30">
                    <Plus className="h-3 w-3" /> Salvar Card
                  </Button>
                </div>
                <div className="space-y-2">
                  <p className="text-[12px] font-bold text-white leading-tight">P: {msg.metadata.flashcard_suggestion.front}</p>
                  <p className="text-[12px] text-slate-400 italic leading-tight">R: {msg.metadata.flashcard_suggestion.back}</p>
                </div>
              </motion.div>
            )}
            
            {/* Message Timestamp/Status */}
            <div className={cn(
              "absolute -bottom-6 flex items-center gap-2 px-1",
              msg.role === "assistant" ? "left-2" : "right-2 flex-row-reverse"
            )}>
              <span className="text-[9px] font-bold text-slate-600 uppercase tracking-tighter">
                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              {msg.role === "assistant" && (
                <span className="text-[9px] font-black text-indigo-500/50 uppercase tracking-widest">Enazizi V2</span>
              )}
            </div>
          </div>
        </motion.div>
      ))}

      {isTyping && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex gap-4 mb-8"
        >
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20 ring-1 ring-white/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
            <img src={enaziziMascot} alt="Tutor ENAZIZI" className="h-10 w-10 object-cover animate-pulse" />
          </div>
          <div className="p-5 rounded-[1.8rem] bg-slate-900/50 border border-white/5 flex gap-1.5 items-center h-12 shadow-xl backdrop-blur-sm">
            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" />
            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.2s]" />
            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.4s]" />
          </div>
        </motion.div>
      )}
    </div>
  );
}
