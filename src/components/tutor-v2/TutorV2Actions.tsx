import { useState } from "react";
import { 
  Sparkles, 
  GraduationCap, 
  Zap, 
  Brain, 
  Map as MapIcon, 
  Plus,
  Play,
  Maximize2,
  Stethoscope,
  Microscope,
  HelpCircle,
  Activity,
  RefreshCw,
  BookOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { AgileLessonPlayer } from "@/components/cinematic/AgileLessonPlayer";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface TutorV2ActionsProps {
  session: any;
  onSendMessage: (text: string, pedagogicalInteraction?: string, newTopic?: string) => void;
}

export default function TutorV2Actions({ session, onSendMessage }: TutorV2ActionsProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);
  const [lessonData, setLessonData] = useState<any>(null);
  const [activeMode, setActiveMode] = useState<'normal' | 'round' | 'change_topic'>('normal');
  const { toast } = useToast();

  const handleGenerateLesson = async (mode: 'normal' | 'round' = 'normal') => {
    setIsGenerating(true);
    setActiveMode(mode);
    try {
      console.log("[GERAR_AULA] FUNCTION_START", { sessionId: session.id, mode });
      const { data, error } = await supabase.functions.invoke("generate-tutor-v2-lesson", {
        body: { sessionId: session.id, mode }
      });

      if (error) throw error;

      const lesson = data?.lesson?.content || data?.lesson || data?.content || data;
      
      if (!lesson) {
        throw new Error("Não foi possível extrair o conteúdo da aula da resposta.");
      }

      setLessonData(lesson);
      setShowPlayer(true);
      
      toast({
        title: mode === 'round' ? "Round Clínico Iniciado!" : "Aula Gerada!",
        description: "Seu conteúdo personalizado está pronto para estudo.",
      });
    } catch (err) {
      console.error("Error generating lesson:", err);
      toast({
        title: "Erro ao gerar aula",
        description: "Houve um problema ao processar seu conteúdo médico.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleChangeTopic = () => {
    const newTopic = prompt("Para qual assunto médico deseja mudar?");
    if (newTopic && newTopic.trim()) {
      onSendMessage(`Quero mudar de assunto para ${newTopic}`, undefined, newTopic);
    }
  };

  return (
    <div className="flex gap-2">
      <AnimatePresence>
        {!isGenerating ? (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex gap-2"
          >
            <Button 
              size="sm" 
              variant="outline" 
              className="h-9 border-indigo-500/30 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 text-[10px] font-black uppercase tracking-widest gap-2 rounded-xl shadow-lg shadow-indigo-500/10"
              onClick={() => handleGenerateLesson('normal')}
            >
              <Play className="h-3.5 w-3.5 fill-current" /> 
              Aula Ágil
            </Button>

            <Button 
              size="sm" 
              variant="outline" 
              className="h-9 border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-[10px] font-black uppercase tracking-widest gap-2 rounded-xl hidden md:flex"
              onClick={() => handleGenerateLesson('round')}
            >
              <Stethoscope className="h-3.5 w-3.5" /> 
              Round Hospitalar
            </Button>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-3 px-4 h-9 rounded-xl bg-white/5 border border-white/10"
          >
            <div className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
              {activeMode === 'round' ? 'Sincronizando Preceptoria...' : 'Gerando Experiência Cognitiva...'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="h-9 w-[1px] bg-white/10 mx-1 hidden sm:block" />

      <div className="flex gap-1">
        <ActionButton 
          icon={RefreshCw} 
          label="Mudar de Assunto" 
          onClick={handleChangeTopic}
          className="border border-white/10 bg-white/5 text-indigo-400 hover:bg-white/10"
        />
        <ActionButton 
          icon={Zap} 
          label="Mnemônico" 
          onClick={() => {
            const topic = session?.topic || session?.title || "";
            if (topic) {
              window.open(`/dashboard/mnemonico?tema=${encodeURIComponent(topic)}&auto=1`, "_blank");
            } else {
              window.open("/dashboard/mnemonico", "_blank");
            }
          }}
        />
        <ActionButton 
          icon={Brain} 
          label="Gerar Flashcards" 
          onClick={async () => {
            const topic = session?.topic || session?.title || "";
            if (!topic) {
              toast({ title: "Erro", description: "Assunto não identificado.", variant: "destructive" });
              return;
            }
            try {
              toast({ title: "Iniciando", description: "Gerando 10 flashcards baseados no seu estudo atual..." });
              const { data, error } = await supabase.functions.invoke("generate-flashcards", {
                body: { topic, quantity: 10 }
              });
              if (error) throw error;
              toast({ title: "Sucesso!", description: `${data.count} flashcards gerados e salvos no FSRS.` });
              window.open(`/dashboard/flashcards`, "_blank");
            } catch (err: any) {
              toast({ title: "Erro", description: err.message, variant: "destructive" });
            }
          }}
        />
        <ActionButton 
          icon={AlertTriangle} 
          label="Erro Bank" 
          className="text-rose-400 border-rose-500/20 hover:bg-rose-500/10"
          onClick={() => {
            window.location.href = "/dashboard/questoes/revisao-erros";
          }}
        />
      </div>

      {showPlayer && (
        <AgileLessonPlayer 
          initialLesson={lessonData}
          onClose={() => setShowPlayer(false)}
        />
      )}
    </div>
  );
}

function ActionButton({ icon: Icon, label, onClick, className }: { icon: any, label: string, onClick?: () => void, className?: string }) {
  return (
    <Button 
      size="sm" 
      variant="ghost" 
      onClick={onClick}
      className={cn(
        "h-9 px-3 text-[9px] font-black uppercase tracking-tighter gap-1.5 text-slate-500 hover:text-white hover:bg-white/5 rounded-xl transition-all",
        className
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden md:inline">{label}</span>
    </Button>
  );
}
