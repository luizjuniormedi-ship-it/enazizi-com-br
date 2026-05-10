import { 
  BookOpen, 
  Sparkles, 
  Music, 
  ExternalLink, 
  ChevronRight, 
  FileText, 
  Brain, 
  HelpCircle, 
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Clock,
  History
} from "lucide-react";
import AgentChat from "@/components/agents/AgentChat";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const quickActions = [
  { label: "📋 Resumo completo", prompt: "Faça um resumo completo e estruturado de todo o meu material, com pontos de prova, mnemônicos e tabelas comparativas.", icon: "📋" },
  { label: "🧠 Mnemônicos", prompt: "Crie mnemônicos e técnicas de memorização para os temas mais importantes do meu material.", icon: "🧠" },
  { label: "⚠️ Pegadinhas de prova", prompt: "Liste as principais pegadinhas de prova e pontos de atenção baseados no meu material.", icon: "⚠️" },
  { label: "📊 Tabela comparativa", prompt: "Crie tabelas comparativas dos diagnósticos diferenciais presentes no meu material.", icon: "📊" },
  { label: "🔬 Artigos PubMed", prompt: "Busque artigos científicos do PubMed/NLM sobre os temas do meu material e inclua referências com links.", icon: "🔬" },
];

const ContentSummarizer = () => {
  const { user } = useAuth();
  const [selectedContentId, setSelectedContentId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackLogged, setPlaybackLogged] = useState(false);

  const { data: libraryContent, isLoading } = useQuery({
    queryKey: ["master-content-library-published"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("master_content_library")
        .select("*, notebooklm_notebooks(*)")
        .or("status.eq.published,media_status.eq.published_to_students")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const logUsageMutation = useMutation({
    mutationFn: async (payload: { action: string, media_type?: string, playback_time?: number, completion_rate?: number }) => {
      if (!user || !selectedContentId) return;
      await supabase.from("notebooklm_usage_logs").insert([{
        content_id: selectedContentId,
        user_id: user.id,
        ...payload
      }]);
    }
  });

  const selectedContent = libraryContent?.find(c => c.id === selectedContentId);
  const notebookData = selectedContent?.notebooklm_notebooks?.[0];

  useEffect(() => {
    if (audioRef.current) {
      const audio = audioRef.current;
      const updateProgress = () => setCurrentTime(audio.currentTime);
      const onLoadedMetadata = () => setDuration(audio.duration);
      const onEnded = () => {
        setIsPlaying(false);
        logUsageMutation.mutate({ action: 'audio_complete', media_type: 'audio', completion_rate: 100 });
      };

      audio.addEventListener('timeupdate', updateProgress);
      audio.addEventListener('loadedmetadata', onLoadedMetadata);
      audio.addEventListener('ended', onEnded);
      
      return () => {
        audio.removeEventListener('timeupdate', updateProgress);
        audio.removeEventListener('loadedmetadata', onLoadedMetadata);
        audio.removeEventListener('ended', onEnded);
      };
    }
  }, [selectedContentId, notebookData?.audio_url]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        logUsageMutation.mutate({ action: 'audio_pause', media_type: 'audio', playback_time: Math.round(audioRef.current.currentTime) });
      } else {
        audioRef.current.play();
        if (!playbackLogged) {
          logUsageMutation.mutate({ action: 'audio_play', media_type: 'audio' });
          setPlaybackLogged(true);
        } else {
          logUsageMutation.mutate({ action: 'audio_resume', media_type: 'audio' });
        }
      }
      setIsPlaying(!isPlaying);
    }
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-140px)]">
      <div className={`${selectedContentId ? 'lg:col-span-1' : 'lg:col-span-3'} flex flex-col h-full transition-all duration-300`}>
        {!selectedContentId ? (
          <AgentChat
            title="Resumidor de Conteúdo"
            subtitle="Resumos estruturados com mnemônicos e pontos de prova."
            icon={<BookOpen className="h-6 w-6 text-primary" />}
            welcomeMessage="Olá! Sou o Resumidor especializado em Residência Médica. Crio resumos com tabelas comparativas, mnemônicos 🧠, pegadinhas de prova ⚠️, condutas 💊 e pontos de alta incidência 📌. Cole um texto ou me diga o tema! 📚"
            welcomeMessageWithUploads="📚 Encontrei {count} material(is): {materiais}. Posso resumir tudo! Escolha o tipo de resumo que deseja abaixo. 👇"
            placeholder="Ex: Resuma Insuficiência Cardíaca com diagnóstico diferencial..."
            functionName="content-summarizer"
            quickActions={quickActions}
            showUploadButton
            autoPromptAfterUpload="Faça um resumo completo e estruturado do material '{filename}' com pontos de prova, mnemônicos e tabelas comparativas."
            linkToAgent={{
              label: "Pedir explicação ao Tutor",
              path: "/dashboard/mentor",
              stateKey: "fromSummary",
            }}
          />
        ) : (
          <div className="flex flex-col h-full space-y-4">
            <Button 
              variant="ghost" 
              className="w-fit gap-2 -ml-2 text-muted-foreground hover:text-primary"
              onClick={() => setSelectedContentId(null)}
            >
              <ArrowLeft className="h-4 w-4" /> Voltar para o Chat
            </Button>
            
            <Card className="flex-1 overflow-hidden flex flex-col border-primary/10 bg-card/50">
              <CardHeader className="pb-4 border-b">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <Badge variant="outline" className="text-[10px] text-primary border-primary/20 uppercase mb-1">Conteúdo Oficial</Badge>
                    <CardTitle className="text-xl">{selectedContent?.title}</CardTitle>
                    <CardDescription>{selectedContent?.discipline} • {selectedContent?.topic}</CardDescription>
                  </div>
                  {notebookData?.audio_url && (
                    <Badge className="bg-purple-500/10 text-purple-500 border-purple-500/20 gap-1">
                      <Music className="h-3 w-3" /> Áudio Disponível
                    </Badge>
                  )}
                </div>
              </CardHeader>
              
              <Tabs defaultValue="summary" className="flex-1 flex flex-col overflow-hidden">
                <TabsList className="px-6 bg-transparent border-b rounded-none h-12 gap-4">
                  <TabsTrigger value="summary" className="gap-2"><FileText className="h-4 w-4" /> Resumo</TabsTrigger>
                  <TabsTrigger value="study" className="gap-2"><Brain className="h-4 w-4" /> Flashcards / Quiz</TabsTrigger>
                  {notebookData && <TabsTrigger value="notebooklm" className="gap-2 text-indigo-500"><Sparkles className="h-4 w-4" /> Multimídia</TabsTrigger>}
                </TabsList>

                <ScrollArea className="flex-1 p-6">
                  <TabsContent value="summary" className="mt-0 space-y-6">
                    {notebookData?.audio_url && (
                      <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-500/10 to-indigo-500/5 border border-purple-500/20 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-purple-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                              <Music className="h-5 w-5 text-white" />
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-purple-700">Audio Overview</h4>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Podcast Educacional v1.5</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[10px] bg-white/50 border-purple-200 text-purple-600">
                            {formatTime(currentTime)} / {formatTime(duration)}
                          </Badge>
                        </div>
                        
                        <div className="space-y-2">
                          <Progress value={(currentTime / duration) * 100 || 0} className="h-1.5 bg-purple-200/50" />
                          <div className="flex items-center justify-center gap-4">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-purple-600 hover:bg-purple-500/10"
                              onClick={() => { if(audioRef.current) audioRef.current.currentTime -= 10; }}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="icon" 
                              className="h-12 w-12 rounded-full bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-600/30"
                              onClick={togglePlay}
                            >
                              {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-1" />}
                            </Button>
                            <div className="w-8" /> {/* Placeholder to balance layout */}
                          </div>
                        </div>
                        
                        <audio ref={audioRef} className="hidden">
                          <source src={notebookData.audio_url} type="audio/mpeg" />
                        </audio>
                      </div>
                    )}

                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <h3 className="text-lg font-bold">Resumo Técnico</h3>
                      <div className="whitespace-pre-wrap leading-relaxed text-sm opacity-90">
                        {selectedContent?.generated_summary}
                      </div>
                      
                      <Separator className="my-6 opacity-10" />
                      
                      <h3 className="text-lg font-bold">Explicação Feynman</h3>
                      <div className="p-4 rounded-lg bg-primary/5 border italic text-sm">
                        {selectedContent?.generated_feynman}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="study" className="mt-0 space-y-6">
                    <div className="space-y-4">
                      <h4 className="font-bold flex items-center gap-2"><Brain className="h-4 w-4" /> Flashcards Sugeridos</h4>
                      <div className="grid grid-cols-1 gap-3">
                        {Array.isArray(selectedContent?.generated_flashcards) && selectedContent?.generated_flashcards?.map((card: any, i: number) => (
                          <div key={i} className="p-4 rounded-lg bg-muted/50 border text-sm">
                            <p className="font-bold mb-2">Q: {card.front || card.pergunta}</p>
                            <p className="opacity-70">A: {card.back || card.resposta}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Separator className="opacity-10" />

                    <div className="space-y-4">
                      <h4 className="font-bold flex items-center gap-2"><HelpCircle className="h-4 w-4" /> Quiz de Fixação</h4>
                      <div className="space-y-4">
                        {Array.isArray(selectedContent?.generated_quiz) && selectedContent?.generated_quiz?.map((q: any, i: number) => (
                          <div key={i} className="space-y-2">
                            <p className="text-sm font-medium">{i+1}. {q.question || q.pergunta}</p>
                            <div className="grid grid-cols-1 gap-2">
                              {Array.isArray(q.options || q.alternativas) && (q.options || q.alternativas).map((opt: string, idx: number) => (
                                <div key={idx} className="p-2 border rounded text-xs hover:bg-primary/5 cursor-pointer transition-colors">
                                  {opt}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="notebooklm" className="mt-0 space-y-6">
                    <div className="grid grid-cols-1 gap-4">
                      <Card className="bg-indigo-500/5 border-indigo-500/20">
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2 text-indigo-600">
                            <Sparkles className="h-4 w-4" /> Guia Multimídia NotebookLM
                          </CardTitle>
                          <CardDescription>Acesse o ambiente interativo oficial para esta aula.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <p className="text-sm">
                            O NotebookLM permite que você faça perguntas sobre este conteúdo em linguagem natural, gere insights adicionais e ouça versões explicativas personalizadas.
                          </p>
                          <div className="flex flex-wrap gap-3">
                            {notebookData?.notebook_url && (
                              <Button asChild className="bg-indigo-600 hover:bg-indigo-700" onClick={() => logUsageMutation.mutate({ action: 'guide_open', media_type: 'guide' })}>
                                <a href={notebookData.notebook_url} target="_blank" rel="noreferrer">
                                  <ExternalLink className="h-4 w-4 mr-2" /> Abrir Workspace
                                </a>
                              </Button>
                            )}
                            {notebookData?.notes_url && (
                              <Button variant="outline" asChild>
                                <a href={notebookData.notes_url} target="_blank" rel="noreferrer">
                                  <FileText className="h-4 w-4 mr-2" /> Guia de Estudo
                                </a>
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>
                </ScrollArea>
              </Tabs>
            </Card>
          </div>
        )}
      </div>
      
      <div className={`${selectedContentId ? 'lg:col-span-3' : 'hidden lg:block'} space-y-4 h-full overflow-hidden transition-all duration-300`}>
        <Card className="h-full border-primary/5 bg-card/30 flex flex-col">
          <CardHeader className="pb-2 border-b border-primary/5">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Biblioteca de Resumos Oficiais
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">Conteúdo gerado por IA e revisado pela equipe pedagógica.</p>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-full p-4">
              {isLoading ? (
                <div className="flex justify-center py-10">
                   <div className="h-6 w-6 animate-spin border-2 border-primary border-t-transparent rounded-full" />
                </div>
              ) : libraryContent?.length === 0 ? (
                <div className="text-center py-10 opacity-30">
                  <BookOpen className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-xs">Nenhum resumo oficial publicado.</p>
                </div>
              ) : (
                <div className={selectedContentId ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-3"}>
                  {libraryContent?.map((item) => (
                    <div 
                      key={item.id} 
                      onClick={() => setSelectedContentId(item.id)}
                      className={`p-3 rounded-lg border transition-all cursor-pointer group ${
                        selectedContentId === item.id 
                          ? 'bg-primary/10 border-primary shadow-sm' 
                          : 'bg-background/50 border-primary/5 hover:border-primary/20'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors ${selectedContentId === item.id ? 'text-primary' : ''}`}>
                            {item.title}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-[9px] uppercase tracking-widest h-4 px-1">OFICIAL</Badge>
                            {item.notebooklm_notebooks?.[0]?.audio_url && <Music className="h-3 w-3 text-purple-500" />}
                            <span className="text-[10px] text-muted-foreground ml-auto">
                              {item.discipline}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ContentSummarizer;
