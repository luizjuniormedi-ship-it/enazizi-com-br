import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Play, 
  ChevronLeft, 
  MessageSquare, 
  Layers, 
  HelpCircle,
  Clock,
  CheckCircle,
  Share2,
  ExternalLink,
  BookOpen,
  ArrowRight,
  BrainCircuit
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

const VideoLessonPlayer = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [watchedSeconds, setWatchedSeconds] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const { data: lesson, isLoading } = useQuery({
    queryKey: ["video-lesson", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_video_lessons")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        toast.error("Erro ao carregar videoaula: " + error.message);
        throw error;
      }
      return data;
    }
  });

  // Simulação de log de progresso
  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        setWatchedSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  const completionRate = lesson?.duration_seconds ? (watchedSeconds / lesson.duration_seconds) * 100 : 0;

  const handleAction = async (action: string) => {
    const { error } = await supabase
      .from("video_lesson_usage_logs")
      .insert({
        video_lesson_id: id,
        user_id: (await supabase.auth.getUser()).data.user?.id,
        action,
        watched_seconds: watchedSeconds,
        completion_rate: completionRate
      });

    if (error) console.error("Erro ao logar ação:", error);
  };

  if (isLoading) return <div className="flex h-screen items-center justify-center">Carregando aula...</div>;
  if (!lesson) return <div className="p-8">Aula não encontrada.</div>;

  return (
    <div className="min-h-screen bg-background animate-in fade-in duration-500 pb-20">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <Button 
          variant="ghost" 
          className="gap-2 -ml-2 mb-2" 
          onClick={() => navigate("/videoaulas")}
        >
          <ChevronLeft className="h-4 w-4" /> Voltar para Biblioteca
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl relative border border-primary/10">
              {lesson.video_url ? (
                <iframe 
                  src={lesson.video_url} 
                  className="w-full h-full"
                  allowFullScreen
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center space-y-4">
                  <Play className="h-20 w-20 text-primary/40" />
                  <p className="text-muted-foreground">Vídeo em processamento pelo NotebookLM...</p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{lesson.specialty}</Badge>
                    <Badge variant="secondary">{lesson.topic}</Badge>
                  </div>
                  <h1 className="text-3xl font-bold">{lesson.title}</h1>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon"><Share2 className="h-4 w-4" /></Button>
                  <Button className="gap-2">
                    <CheckCircle className="h-4 w-4" /> Concluir Aula
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-6 text-sm text-muted-foreground bg-muted/30 p-4 rounded-xl">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <span>Duração: {Math.floor(lesson.duration_seconds / 60)}min</span>
                </div>
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  <span>Nível: {lesson.difficulty_level || 'Intermediário'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <BrainCircuit className="h-4 w-4 text-primary" />
                  <span>Gerada por Tutor IA</span>
                </div>
              </div>

              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="w-full justify-start border-b rounded-none bg-transparent h-auto p-0 mb-6">
                  <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3">Resumo</TabsTrigger>
                  <TabsTrigger value="objectives" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3">Objetivos</TabsTrigger>
                  <TabsTrigger value="resources" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3">Materiais</TabsTrigger>
                </TabsList>
                
                <TabsContent value="overview" className="mt-0 space-y-4">
                  <div className="prose prose-sm max-w-none text-muted-foreground leading-relaxed">
                    {lesson.description || lesson.tutor_lesson_summary}
                  </div>
                  {lesson.notebooklm_notebook_url && (
                    <Button variant="outline" className="w-full mt-4 gap-2" onClick={() => window.open(lesson.notebooklm_notebook_url, '_blank')}>
                      <ExternalLink className="h-4 w-4" /> Abrir Workspace NotebookLM
                    </Button>
                  )}
                </TabsContent>

                <TabsContent value="objectives" className="mt-0">
                  <ul className="space-y-3">
                    {lesson.learning_objectives?.map((obj, i) => (
                      <li key={i} className="flex gap-3 items-start">
                        <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">{obj}</span>
                      </li>
                    ))}
                  </ul>
                </TabsContent>

                <TabsContent value="resources" className="mt-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="cursor-pointer hover:border-primary/50 transition-colors">
                      <CardHeader className="p-4">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Layers className="h-4 w-4 text-primary" /> Flashcards
                        </CardTitle>
                        <CardDescription>24 cards sobre este tema.</CardDescription>
                      </CardHeader>
                    </Card>
                    <Card className="cursor-pointer hover:border-primary/50 transition-colors">
                      <CardHeader className="p-4">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <HelpCircle className="h-4 w-4 text-primary" /> Quiz Rápido
                        </CardTitle>
                        <CardDescription>10 questões comentadas.</CardDescription>
                      </CardHeader>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>

          <div className="space-y-6">
            <Card className="border-primary/20 shadow-lg">
              <CardHeader className="bg-primary/5">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  Perguntar ao Tutor
                </CardTitle>
                <CardDescription>Tire dúvidas sobre esta aula agora.</CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="bg-muted/50 rounded-lg p-3 text-xs italic">
                  "O Tutor possui acesso ao contexto completo desta aula para responder com precisão científica."
                </div>
                <Button className="w-full gap-2 py-6 text-lg" onClick={() => navigate(`/dashboard/mentor?context=${lesson.id}`)}>
                  Conversar com Tutor <ArrowRight className="h-5 w-5" />
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Seu Progresso</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Vídeo</span>
                  <span className="font-medium">{Math.floor(completionRate)}%</span>
                </div>
                <Progress value={completionRate} className="h-2" />
                
                <div className="pt-4 border-t space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                      <span>Leitura do Resumo</span>
                    </div>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                      <span>Quiz Concluído</span>
                    </div>
                    <div className="w-4 h-4 rounded-full border border-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoLessonPlayer;