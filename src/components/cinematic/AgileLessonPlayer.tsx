
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronRight, 
  ChevronLeft, 
  X, 
  Play, 
  CheckCircle2, 
  Brain, 
  HelpCircle,
  Volume2,
  Image as ImageIcon
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface AgileLessonPlayerProps {
  aggregationId?: string;
  initialLesson?: any;
  onClose: () => void;
}

export const AgileLessonPlayer = ({ aggregationId, initialLesson, onClose }: AgileLessonPlayerProps) => {
  console.error("🔥 PLAYER_OPEN_ATTEMPT", { aggregationId, initialLesson });
  useEffect(() => {
    console.error("🔥 PLAYER_MOUNTED");
  }, []);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showQuiz, setShowQuiz] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [quizAnswered, setQuizAnswered] = useState(false);

  useEffect(() => {
    const fetchBlocks = async () => {
      if (initialLesson) {
        console.log("[AGILE_PLAYER] Using initialLesson", initialLesson);
        const mappedBlocks = [
          { title: initialLesson.title, content: initialLesson.intro, block_type: 'introduction', block_order: 0 },
          ...(initialLesson.sections || []).map((s: any, idx: number) => ({
            title: s.title,
            content: `${s.explanation || s.content}\n\n${s.clinicalApplication ? `**Aplicação Clínica:** ${s.clinicalApplication}` : ""}`,
            block_type: 'deep_dive',
            block_order: idx + 1,
            scene_graph_data: { questions: s.questions || [] }
          })),
          { title: "Resumo Final", content: initialLesson.summary, block_type: 'summary', block_order: 100 }
        ];
        
        // Se houver questões globais da aula
        if (initialLesson.questions && initialLesson.questions.length > 0) {
          mappedBlocks.push({
            title: "Quiz de Consolidação",
            content: "Teste seus conhecimentos sobre esta aula.",
            block_type: 'mini_quiz',
            block_order: 101,
            scene_graph_data: { questions: initialLesson.questions }
          });
        }
        
        setBlocks(mappedBlocks);
        setIsLoading(false);
        return;
      }

      if (!aggregationId) {
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('cme_lesson_blocks')
        .select('*')
        .eq('aggregation_id', aggregationId)
        .order('block_order', { ascending: true });
      
      if (data) setBlocks(data);
      setIsLoading(false);
    };

    fetchBlocks();
  }, [aggregationId, initialLesson]);

  const currentBlock = blocks[currentIndex];
  const progress = blocks.length > 0 ? ((currentIndex + 1) / blocks.length) * 100 : 0;

  const handleNext = () => {
    if (currentIndex < blocks.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setShowQuiz(false);
      setSelectedOption(null);
      setQuizAnswered(false);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setShowQuiz(false);
      setSelectedOption(null);
      setQuizAnswered(false);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Preparando Experiência Ágil...</p>
        </div>
      </div>
    );
  }

  if (!currentBlock) return null;

  const questions = currentBlock.scene_graph_data?.questions || [];
  const hasQuiz = questions.length > 0;

  return (
    <div className="fixed inset-0 z-[100] bg-zinc-950 text-white flex flex-col overflow-hidden animate-in fade-in duration-500">
      {/* Background Decor */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/30 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/20 rounded-full blur-[120px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 p-6 flex items-center justify-between border-b border-white/5 bg-black/40 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-white/10">
            <X className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-sm font-black uppercase tracking-tight truncate max-w-[200px] sm:max-w-md">
              {currentBlock.title}
            </h2>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
              Bloco {currentIndex + 1} de {blocks.length}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
           <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-black italic">
             MODO ÁGIL
           </Badge>
        </div>
      </header>

      {/* Progress */}
      <Progress value={progress} className="h-1 rounded-none bg-white/5 relative z-10" />

      {/* Main Content */}
      <main className="flex-1 relative z-10 overflow-y-auto p-6 sm:p-12 max-w-4xl mx-auto w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="space-y-8"
          >
            {/* Stage/Type Badge */}
            <div className="flex items-center gap-2">
               <div className="h-8 w-8 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
                 {currentBlock.block_type === 'mini_quiz' ? <HelpCircle className="h-4 w-4" /> : <Brain className="h-4 w-4" />}
               </div>
               <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                 {currentBlock.block_type === 'mini_quiz' ? 'Conhecimento Interativo' : 'Deep Dive Cognitivo'}
               </span>
            </div>

            {/* Content Area */}
            <div className="prose prose-invert prose-p:text-zinc-300 prose-p:leading-relaxed prose-headings:text-white prose-headings:font-black max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {currentBlock.content}
              </ReactMarkdown>
            </div>

            {/* Quiz Section */}
            {hasQuiz && !showQuiz && (
              <Button 
                onClick={() => setShowQuiz(true)}
                className="w-full h-14 bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest rounded-2xl gap-3 shadow-lg shadow-primary/20"
              >
                <HelpCircle className="h-5 w-5" /> Testar Conhecimento
              </Button>
            )}

            {showQuiz && questions.map((q: any, qIdx: number) => (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                key={qIdx} 
                className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 space-y-6"
              >
                <h3 className="text-lg font-bold text-white leading-snug">{q.statement}</h3>
                <div className="space-y-3">
                  {q.options.map((opt: string, optIdx: number) => (
                    <button
                      key={optIdx}
                      disabled={quizAnswered}
                      onClick={() => setSelectedOption(optIdx)}
                      className={cn(
                        "w-full p-4 rounded-2xl text-left text-sm font-medium transition-all border",
                        selectedOption === optIdx 
                          ? "bg-primary/20 border-primary text-primary" 
                          : "bg-white/5 border-white/5 hover:border-white/20 text-zinc-400",
                        quizAnswered && optIdx === q.correctIndex && "bg-emerald-500/20 border-emerald-500 text-emerald-500",
                        quizAnswered && selectedOption === optIdx && optIdx !== q.correctIndex && "bg-red-500/20 border-red-500 text-red-500"
                      )}
                    >
                      <div className="flex gap-4">
                        <span className="flex-shrink-0 w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center font-bold text-[10px]">
                          {String.fromCharCode(65 + optIdx)}
                        </span>
                        <span>{opt}</span>
                      </div>
                    </button>
                  ))}
                </div>

                {!quizAnswered && selectedOption !== null && (
                  <Button 
                    onClick={() => setQuizAnswered(true)}
                    className="w-full bg-white text-black font-black uppercase h-12 rounded-2xl"
                  >
                    Confirmar Resposta
                  </Button>
                )}

                {quizAnswered && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-4 border-t border-white/5 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-bold">
                       {selectedOption === q.correctIndex ? (
                         <span className="text-emerald-500">Correto!</span>
                       ) : (
                         <span className="text-red-500">Incorreto. A resposta certa é {String.fromCharCode(65 + q.correctIndex)}.</span>
                       )}
                    </div>
                    <p className="text-xs text-zinc-500 leading-relaxed italic">
                      {q.explanation}
                    </p>
                  </motion.div>
                )}
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer Controls */}
      <footer className="relative z-10 p-6 border-t border-white/5 bg-black/40 backdrop-blur-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <Button 
            variant="ghost" 
            onClick={handlePrev} 
            disabled={currentIndex === 0}
            className="rounded-2xl h-12 px-6 gap-2 text-zinc-500 hover:text-white hover:bg-white/5"
          >
            <ChevronLeft className="h-5 w-5" /> Anterior
          </Button>

          <Button 
            onClick={handleNext} 
            className="bg-white text-black hover:bg-zinc-200 rounded-2xl h-12 px-8 font-black uppercase tracking-widest gap-2 shadow-xl shadow-white/5"
          >
            {currentIndex === blocks.length - 1 ? 'Finalizar' : 'Próximo'} <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </footer>
    </div>
  );
};
