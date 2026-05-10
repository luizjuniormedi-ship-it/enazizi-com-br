import { useState } from "react";
import { Sparkles, GraduationCap, Zap, Brain, Map as MapIcon, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { AgileLessonPlayer } from "@/components/cinematic/AgileLessonPlayer";

interface TutorV2ActionsProps {
  session: any;
}

export default function TutorV2Actions({ session }: TutorV2ActionsProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);
  const [lessonData, setLessonData] = useState<any>(null);
  const { toast } = useToast();

  const handleGenerateLesson = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-tutor-v2-lesson", {
        body: { sessionId: session.id }
      });

      if (error) throw error;

      setLessonData(data.lesson.content);
      setShowPlayer(true);
      
      toast({
        title: "Aula Gerada!",
        description: "Sua aula personalizada está pronta para estudo.",
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

  return (
    <div className="flex gap-2">
      <Button 
        size="sm" 
        variant="outline" 
        className="h-8 border-indigo-500/30 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 text-[10px] font-black uppercase tracking-widest gap-2"
        onClick={handleGenerateLesson}
        disabled={isGenerating}
      >
        <GraduationCap className="h-3 w-3" /> 
        {isGenerating ? "Gerando..." : "Gerar Aula"}
      </Button>

      <Button size="sm" variant="ghost" className="h-8 text-[10px] font-black uppercase tracking-widest gap-2 text-slate-500">
        <Plus className="h-3 w-3" /> FSRS
      </Button>

      <Button size="sm" variant="ghost" className="h-8 text-[10px] font-black uppercase tracking-widest gap-2 text-slate-500">
        <Zap className="h-3 w-3" /> Mnemônico
      </Button>

      <Button size="sm" variant="ghost" className="h-8 text-[10px] font-black uppercase tracking-widest gap-2 text-slate-500">
        <MapIcon className="h-3 w-3" /> Mapa Mental
      </Button>

      {showPlayer && (
        <AgileLessonPlayer 
          initialLesson={lessonData}
          onClose={() => setShowPlayer(false)}
        />
      )}
    </div>
  );
}
