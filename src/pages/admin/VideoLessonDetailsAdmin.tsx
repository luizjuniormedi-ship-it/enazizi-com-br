import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  ChevronLeft, 
  Video, 
  ExternalLink, 
  FileText, 
  ShieldCheck,
  Calendar,
  Layers,
  Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { VideoAnalyticsDrilldown } from "@/components/admin/VideoAnalyticsDrilldown";
import CognitiveHeatmap from "@/components/admin/CognitiveHeatmap";
import { toast } from "sonner";

const VideoLessonDetailsAdmin = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: lesson, isLoading } = useQuery({
    queryKey: ["admin-video-lesson-details", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_video_lessons")
        .select("*")
        .eq("id", id)
        .single();
      
      if (error) {
        toast.error("Erro ao carregar detalhes: " + error.message);
        throw error;
      }
      return data;
    }
  });

  if (isLoading) return <div className="p-10 text-center">Carregando detalhes...</div>;
  if (!lesson) return <div className="p-10 text-center">Videoaula não encontrada.</div>;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <Button 
            variant="ghost" 
            size="sm" 
            className="gap-2 -ml-2 mb-2" 
            onClick={() => navigate("/admin/video-lessons")}
          >
            <ChevronLeft className="h-4 w-4" /> Voltar para Biblioteca
          </Button>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-3xl font-bold tracking-tight">{lesson.title}</h1>
            <Badge variant="outline" className="bg-primary/5">{lesson.specialty}</Badge>
            {lesson.is_gold_content && (
              <Badge className="bg-yellow-500 text-black gap-1">Conteúdo Ouro</Badge>
            )}
          </div>
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Calendar className="h-3 w-3" /> Criada em {new Date(lesson.created_at).toLocaleDateString()}
            <span className="text-muted-foreground/30">|</span>
            <Clock className="h-3 w-3" /> {Math.floor(lesson.duration_seconds / 60)} min
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => window.open(`/videoaulas/${lesson.id}`, '_blank')}>
            <ExternalLink className="h-4 w-4" /> Ver como Aluno
          </Button>
          <Button className="gap-2" variant="secondary">
            <ShieldCheck className="h-4 w-4" /> Gerenciar Revisão
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Video className="h-4 w-4 text-primary" />
              Informações do Conteúdo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase font-semibold">Tópico / Subtópico</p>
              <p className="text-sm">{lesson.topic} {lesson.subtopic && `> ${lesson.subtopic}`}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase font-semibold">Resumo Pedagógico (IA)</p>
              <p className="text-xs text-muted-foreground leading-relaxed italic">
                {lesson.tutor_lesson_summary || "Sem resumo disponível."}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase font-semibold">Nível de Dificuldade</p>
              <p className="text-sm flex items-center gap-2">
                <Layers className="h-4 w-4 text-blue-500" />
                {lesson.difficulty_level || "Intermediário"}
              </p>
            </div>
            <div className="pt-4 border-t">
              <Button variant="ghost" className="w-full justify-start gap-2 h-9 text-xs" onClick={() => navigate(`/admin/tutor-memory?lesson=${lesson.tutor_lesson_id}`)}>
                <FileText className="h-3 w-3" /> Ver Memória da Aula (Tutor)
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <VideoAnalyticsDrilldown videoLessonId={lesson.id} />
          <CognitiveHeatmap videoLessonId={lesson.id} />
        </div>
      </div>
    </div>
  );
};

export default VideoLessonDetailsAdmin;
