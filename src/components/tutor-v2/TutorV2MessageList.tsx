import { motion } from "framer-motion";
import { User, Plus, Zap, Check, AlertCircle, X, Brain, HelpCircle, Activity, Layout, Lightbulb, AlertTriangle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ProgressiveBlocks from "./ProgressiveBlocks";
import { MascotAvatar } from "../mascot/MascotAvatar";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { InteractiveCognitiveCard } from "../tutor/pedagogical/InteractiveCognitiveCard";



interface TutorV2MessageListProps {
  messages: any[];
  isTyping: boolean;
  onIncrementalAction?: (action: string) => void;
}

export default function TutorV2MessageList({ messages, isTyping, onIncrementalAction }: TutorV2MessageListProps) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleSaveFsrs = async (content: string) => {
    if (!user?.id) return;
    const topic = content.slice(0, 80).replace(/[#*_]/g, "").trim();
    try {
      await (supabase.from("fsrs_cards") as any).insert({
        user_id: user.id,
        card_type: "tutor",
        due: new Date().toISOString(),
        stability: 0,
        difficulty: 0,
        elapsed_days: 0,
        scheduled_days: 0,
        reps: 0,
        lapses: 0,
        state: 0,
      });
      toast.success("Salvo no FSRS para revisão espaçada");
    } catch {
      toast.error("Erro ao salvar no FSRS");
    }
  };

  const handleGenerateFlashcard = (content: string) => {
    const topic = content.slice(0, 100).replace(/[#*_]/g, "").trim();
    navigate(`/dashboard/gerar-flashcards?topic=${encodeURIComponent(topic)}`);
  };

  const handleErrorBank = (content: string) => {
    navigate("/dashboard/banco-erros");
  };

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
            "flex gap-4 mb-12 items-start",
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
          
          <div className="flex-1 min-w-0">
            <div className={cn(
              "p-6 rounded-[2rem] text-[14px] leading-relaxed shadow-2xl relative transition-all duration-300",
              msg.role === "assistant" 
                ? "bg-slate-900/60 border border-white/5 text-slate-200 backdrop-blur-md" 
                : "bg-gradient-to-br from-indigo-600/90 to-indigo-700/90 text-white border border-white/10 ml-auto max-w-[85%]"
            )}>
              {msg.role === "assistant" ? (
                <ProgressiveBlocks content={msg.content} />
              ) : (
                <div className="prose prose-invert prose-sm max-w-none prose-p:text-white prose-headings:text-white">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              )}

              {/* FSRS / Flashcard Inline Actions */}
              {msg.role === "assistant" && !msg.metadata?.question_review && (
                <div className="mt-6 pt-6 border-t border-white/5 flex flex-wrap gap-2">
                  <InlineAction icon={Plus} label="Salvar no FSRS" onClick={() => handleSaveFsrs(msg.content)} />
                  <InlineAction icon={Brain} label="Gerar Flashcard" onClick={() => handleGenerateFlashcard(msg.content)} />
                  <InlineAction icon={Activity} label="Error Bank" onClick={() => handleErrorBank(msg.content)} />
                </div>
              )}

              {msg.metadata?.flashcard_suggestion && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 p-5 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 ring-1 ring-white/5 relative overflow-hidden group shadow-lg"
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
                    <Button variant="ghost" size="sm" className="h-7 px-3 text-[9px] font-black uppercase tracking-tighter gap-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 rounded-xl">
                      <Plus className="h-3 w-3" /> Salvar Card
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[12px] font-bold text-white leading-tight">P: {msg.metadata.flashcard_suggestion.front}</p>
                    <p className="text-[12px] text-slate-400 italic leading-tight">R: {msg.metadata.flashcard_suggestion.back}</p>
                  </div>
                </motion.div>
              )}

              {msg.metadata?.question_review && (
                <QuestionReviewBoard review={msg.metadata.question_review} />
              )}
            </div>

            {/* Message Metadata Footer / Reasoning Bar */}
            <div className={cn(
              "mt-3 flex items-center gap-4 px-2",
              msg.role === "assistant" ? "justify-start" : "justify-end"
            )}>
              <span className="text-[9px] font-bold text-slate-600 uppercase tracking-tighter">
                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              
              {msg.role === "assistant" && (
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="text-[9px] font-black text-indigo-500/50 uppercase tracking-widest p-0 h-auto hover:bg-transparent border-none">
                    Enazizi V2
                  </Badge>
                  <div className="h-3 w-[1px] bg-white/5" />
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter p-0 h-auto hover:bg-transparent flex items-center gap-1 border-none">
                      <Layout className="h-3 w-3" /> {msg.metadata?.model || "openai/gpt-5"}
                    </Badge>

                    {msg.metadata?.fallback_used && (
                      <Badge variant="outline" className="text-[8px] font-black text-amber-500/70 border-amber-500/20 bg-amber-500/5 px-1.5 h-4 uppercase">
                        Fallback
                      </Badge>
                    )}
                  </div>
                </div>
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
          <div className="flex-shrink-0">
            <MascotAvatar state="thinking" size="sm" />
          </div>
          <div className="p-6 rounded-[2rem] bg-slate-900/50 border border-white/5 flex gap-2 items-center h-14 shadow-xl backdrop-blur-sm">
            <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" />
            <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.2s]" />
            <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.4s]" />
          </div>
        </motion.div>
      )}
    </div>
  );
}

function QuestionReviewBoard({ review }: { review: any }) {
  const alts = ['A', 'B', 'C', 'D', 'E'];
  
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "mt-8 p-8 rounded-[2.5rem] border shadow-2xl overflow-hidden relative backdrop-blur-xl",
        review.is_correct 
          ? "bg-emerald-500/5 border-emerald-500/20 ring-1 ring-emerald-500/10" 
          : "bg-rose-500/5 border-rose-500/20 ring-1 ring-rose-500/10"
      )}
    >
      {/* Visual Status Indicator */}
      <div className="absolute top-0 right-0 p-8 opacity-5">
        {review.is_correct ? <Check className="h-32 w-32" /> : <X className="h-32 w-32" />}
      </div>

      <div className="flex items-center justify-between mb-8 relative z-10">
        <div className="flex items-center gap-3">
          <div className={cn(
            "h-10 w-10 rounded-2xl flex items-center justify-center shadow-lg",
            review.is_correct ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
          )}>
            {review.is_correct ? <Check className="h-6 w-6" /> : <X className="h-6 w-6" />}
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Question Review Mode</p>
            <h4 className="text-sm font-black text-white uppercase tracking-wider">{review.is_correct ? "Raciocínio Perfeito" : "Correção Clínica"}</h4>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest border-white/10 bg-white/5 px-3 py-1">
            {review.exam_style || "ENARE"}
          </Badge>
          <Badge variant="outline" className={cn(
            "text-[10px] font-black uppercase tracking-widest px-3 py-1",
            review.difficulty === 'hard' ? "border-rose-500/30 text-rose-400 bg-rose-500/10" : "border-indigo-500/30 text-indigo-400 bg-indigo-500/10"
          )}>
            {review.difficulty || "Médio"}
          </Badge>
        </div>
      </div>

      {/* Alternatives Analysis */}
      <div className="space-y-3 mb-8 relative z-10">
        {alts.map(alt => {
          const isCorrect = review.correct_answer === alt;
          const isStudent = review.student_answer === alt;
          
          return (
            <div 
              key={alt}
              className={cn(
                "p-4 rounded-2xl border flex items-center justify-between transition-all duration-300",
                isCorrect ? "bg-emerald-500/10 border-emerald-500/40 scale-[1.02] shadow-lg shadow-emerald-500/10" : 
                isStudent && !isCorrect ? "bg-rose-500/10 border-rose-500/40 opacity-80" :
                "bg-white/5 border-white/5 opacity-40 grayscale"
              )}
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  "h-8 w-8 rounded-xl flex items-center justify-center text-xs font-black",
                  isCorrect ? "bg-emerald-500 text-white" : 
                  isStudent ? "bg-rose-500 text-white" : 
                  "bg-slate-800 text-slate-500"
                )}>
                  {alt}
                </div>
                <span className={cn(
                  "text-[12px] font-bold",
                  isCorrect ? "text-white" : isStudent ? "text-rose-400" : "text-slate-500"
                )}>
                  {isCorrect ? "Alternativa Correta" : isStudent ? "Sua Escolha" : "Distrator"}
                </span>
              </div>
              {isCorrect && <Check className="h-4 w-4 text-emerald-400" />}
              {isStudent && !isCorrect && <X className="h-4 w-4 text-rose-400" />}
            </div>
          );
        })}
      </div>

      {/* Clinical Pearls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 relative z-10">
        <div className="p-5 rounded-3xl bg-amber-500/5 border border-amber-500/20">
          <div className="flex items-center gap-2 mb-2 text-amber-500">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">Pegadinha da Banca</span>
          </div>
          <p className="text-[12px] text-amber-200/80 leading-relaxed font-medium">
            {review.trap_type || "Foco no distrator mais comum."}
          </p>
        </div>
        <div className="p-5 rounded-3xl bg-indigo-500/5 border border-indigo-500/20">
          <div className="flex items-center gap-2 mb-2 text-indigo-400">
            <Lightbulb className="h-4 w-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">Âncora de Memória</span>
          </div>
          <p className="text-[12px] text-indigo-200/80 leading-relaxed font-medium italic">
            "{review.memory_anchor || "Foco no conceito central."}"
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-6 border-t border-white/5 relative z-10">
        <Button variant="ghost" size="sm" className="h-9 px-4 text-[10px] font-black uppercase tracking-widest gap-2 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 rounded-xl">
          <Plus className="h-3.5 w-3.5" /> Adicionar ao Error Bank
        </Button>
        <Button variant="ghost" size="sm" className="h-9 px-4 text-[10px] font-black uppercase tracking-widest gap-2 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 text-indigo-300 rounded-xl">
          <Zap className="h-3.5 w-3.5" /> Gerar Flashcard FSRS
        </Button>
      </div>
    </motion.div>
  );
}

function InlineAction({ icon: Icon, label, onClick }: { icon: any, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all group"
    >
      <Icon className="h-3 w-3 text-slate-500 group-hover:text-indigo-400 transition-colors" />
      <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 group-hover:text-slate-300 transition-colors">{label}</span>
    </button>
  );
}

