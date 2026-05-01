import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { 
  Play, 
  ChevronLeft, 
  MessageSquare, 
  Layers, 
  HelpCircle,
  Clock,
  CheckCircle,
  ShieldCheck,
  Share2,
  ExternalLink,
  BookOpen,
  ArrowRight,
  BrainCircuit,
  Award,
  Sparkles,
  Zap,
  AlertTriangle,
  RotateCcw,
  Film,
  Settings
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useVideoSegmentEvents } from "@/hooks/useVideoSegmentEvents";
import { useVideoSegmentAnalytics } from "@/hooks/useVideoSegmentAnalytics";
import { useTutorTemporalContext } from "@/hooks/useTutorTemporalContext";
import { useVideoAdaptiveIntelligence } from "@/hooks/useVideoAdaptiveIntelligence";
import { VideoSegmentList, type VideoSegment } from "@/components/video-library/VideoSegmentList";
import PreventiveTutorTrigger from "@/components/video-library/PreventiveTutorTrigger";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";

import AdaptiveRecommendationCard from "@/components/adaptive/AdaptiveRecommendationCard";
import { useAdaptiveEngine } from "@/hooks/useAdaptiveEngine";
import { useCognitiveOrchestrator } from "@/hooks/useCognitiveOrchestrator";
import { useCinematicEngine } from "@/hooks/useCinematicEngine";

const VideoLessonPlayer = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [watchedSeconds, setWatchedSeconds] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const lastLogTime = useRef(0);
  const pauseStartTime = useRef<number | null>(null);
  const hasNotifiedDifficulty = useRef<Set<string>>(new Set());
  
  const { 
    recommendations, 
    acceptRecommendation, 
    ignoreRecommendation, 
    triggerEvaluation,
    shadowMode 
  } = useAdaptiveEngine(id);

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

  const { data: quiz } = useQuery({
    queryKey: ["video-lesson-quiz", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("video_lesson_quizzes")
        .select("*")
        .eq("video_lesson_id", id)
        .maybeSingle();
      
      if (error) return null;
      if (!data) return null;
      
      // Type casting safely
      const questions = (data.questions as any[]) || [];
      return { ...data, questions };
    },
    enabled: !!lesson
  });

  const { data: progress } = useQuery({
    queryKey: ["video-lesson-progress", id],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data, error } = await supabase
        .from("video_lesson_usage_logs")
        .select("*")
        .eq("video_lesson_id", id)
        .eq("user_id", user.id)
        .order("watched_seconds", { ascending: false })
        .limit(1);
      
      if (error) return null;
      return data[0];
    },
    enabled: !!lesson
  });

  // ───────────────── FASE 2: Adaptive Video ─────────────────
  // Carrega segmentos da videoaula (se houver). Compatível com vídeos sem segmentação.
  const { data: segments = [] } = useQuery<VideoSegment[]>({
    queryKey: ["video-lesson-segments", lesson?.tutor_lesson_id],
    enabled: !!lesson?.tutor_lesson_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lesson_segments")
        .select("id, title, summary, key_points, start_second, end_second, ordem, segment_type, has_flashcards")
        .eq("lesson_id", lesson!.tutor_lesson_id!)
        .order("ordem", { ascending: true });
      if (error) {
        console.warn("[VideoLessonPlayer] segments fetch:", error.message);
        return [];
      }
      return (data ?? []) as VideoSegment[];
    },
  });

  const { logEvent } = useVideoSegmentEvents();
  const { getForSegment, smartReplayEnabled, analyticsEnabled } = useVideoSegmentAnalytics(id);
  const { temporalEnabled, buildContext } = useTutorTemporalContext();
  
  // Determina o segmento "atual" baseado em watchedSeconds (fallback p/ primeiro)
  const currentSegment = useMemo<VideoSegment | null>(() => {
    if (!segments || segments.length === 0) return null;
    const found = segments.find(s => {
      const start = s.start_second ?? 0;
      const end = s.end_second ?? Number.MAX_SAFE_INTEGER;
      return watchedSeconds >= start && watchedSeconds < end;
    });
    return found ?? segments[0];
  }, [segments, watchedSeconds]);

  // ───────────────── FASE 3: Adaptive Intelligence ─────────────────
  const { recommendation, resetRecommendation } = useVideoAdaptiveIntelligence(id!, currentSegment?.id || null);
  const { data: cognitiveState } = useCognitiveOrchestrator();
  const { updateStudentAnalytics } = useCinematicEngine((lesson as any)?.cme_project_id);

  // Determina se é um vídeo CME proprietário
  const isCMEVideo = !!(lesson as any)?.cme_project_id;

  const currentSegmentAnalytics = currentSegment ? getForSegment(currentSegment.id) : null;
  const currentDifficulty = smartReplayEnabled && currentSegmentAnalytics?.difficultyLikely;
  const difficultyLevel = currentSegmentAnalytics?.difficultyLevel || "baixa";

  // Notificação de dificuldade (Fase 2.1)
  useEffect(() => {
    if (difficultyLevel === "alta" && currentSegment && !hasNotifiedDifficulty.current.has(currentSegment.id)) {
      toast("Dificuldade detectada", {
        description: "Você teve dificuldade neste trecho. Deseja revisar com o Tutor IA?",
        action: {
          label: "Abrir Tutor",
          onClick: () => handleAskTutorAtSegment(currentSegment)
        },
        duration: 8000
      });
      hasNotifiedDifficulty.current.add(currentSegment.id);
    }
  }, [difficultyLevel, currentSegment]);

  useEffect(() => {
    if (progress?.watched_seconds) {
      setWatchedSeconds(progress.watched_seconds);
    }
  }, [progress]);

  const completionRate = lesson?.duration_seconds ? Math.min((watchedSeconds / lesson.duration_seconds) * 100, 100) : 0;

  // Simulação de log de progresso e detecção de pausa longa / abandono
  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      // Se estava pausado, verifica se foi uma pausa longa (> 60s)
      if (pauseStartTime.current) {
        const pauseDuration = (Date.now() - pauseStartTime.current) / 1000;
        if (pauseDuration > 60 && id) {
          logEvent({
            videoLessonId: id,
            segmentId: currentSegment?.id,
            eventType: "long_pause",
            timestampSeconds: watchedSeconds,
            durationMs: Math.floor(pauseDuration * 1000),
          });
        }
        pauseStartTime.current = null;
      }

      interval = setInterval(() => {
        setWatchedSeconds(prev => prev + 1);
        
        // Log a cada 30 segundos ou na conclusão
        if (watchedSeconds - lastLogTime.current >= 30) {
          handleAction("heartbeat");
          lastLogTime.current = watchedSeconds;
        }
      }, 1000);
    } else {
      // Quando pausa, registra o início
      if (!pauseStartTime.current) {
        pauseStartTime.current = Date.now();
      }
    }
    return () => {
      clearInterval(interval);
      // Detecção básica de abandono (cleanup do componente)
      if (id && completionRate > 5 && completionRate < 90 && !quizFinished) {
        logEvent({
          videoLessonId: id,
          segmentId: currentSegment?.id,
          eventType: "abandon",
          timestampSeconds: watchedSeconds,
          metadata: { completion_at_abandon: completionRate }
        });
      }
    };
  }, [isPlaying, watchedSeconds, id, currentSegment?.id, completionRate, quizFinished]);

  const handleAction = async (action: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("video_lesson_usage_logs")
      .insert({
        video_lesson_id: id,
        user_id: user.id,
        action,
        watched_seconds: watchedSeconds,
        completion_rate: completionRate
      });

    if (error) console.error("Erro ao logar ação:", error);
    
    // Sincronização com CME Analytics
    if (isCMEVideo && (lesson as any).cme_project_id) {
      updateStudentAnalytics((lesson as any).cme_project_id, {
        watch_time_seconds: action === "heartbeat" ? 30 : 0,
        replay_count: action === "replay" ? 1 : 0,
        completion_rate: completionRate
      });
    }
    
    if (action === "complete") {
      toast.success("Aula concluída! Sugerimos revisar os flashcards agora.");
      const hasFlashcardsInSegments = segments.some(s => s.has_flashcards);
      if (hasFlashcardsInSegments) {
        toast("Revisão Recomendada", {
          description: "Você concluiu a aula. Deseja revisar os flashcards FSRS deste conteúdo agora?",
          action: {
            label: "Revisar",
            onClick: () => navigate(`/dashboard/flashcards?lesson=${id}`)
          }
        });
      }
    }
  };

  // ───── FASE 2: handlers Adaptive Video ─────
  const handleSelectSegment = (seg: VideoSegment) => {
    const target = seg.start_second ?? 0;
    setWatchedSeconds(target);
    if (id) {
      logEvent({
        videoLessonId: id,
        segmentId: seg.id,
        eventType: "seek",
        timestampSeconds: target,
        metadata: { source: "segment_list" },
      });
    }
  };

  const handleAskTutorAtSegment = (seg: VideoSegment) => {
    if (!lesson || !id) return;
    const ctx = buildContext({
      videoLessonId: id,
      segment: seg,
      currentTimestamp: watchedSeconds,
      lesson: {
        specialty: lesson.specialty,
        topic: lesson.topic,
        subtopic: lesson.subtopic,
        tutor_lesson_summary: lesson.tutor_lesson_summary,
      },
    });
    
    logEvent({
      videoLessonId: id,
      segmentId: seg.id,
      eventType: "tutor_open",
      timestampSeconds: watchedSeconds,
      metadata: { temporal: !!ctx, source: "segment_button" },
    });
    
    handleAction("open_tutor");
    
    const params = new URLSearchParams({
      context: lesson.id,
      session: lesson.tutor_session_id || "",
    });
    
    if (ctx) {
      params.set("video_segment", seg.id);
      params.set("video_ts", String(watchedSeconds));
      params.set("hotspot_type", "temporal_context");
    }
    
    navigate(`/dashboard/mentor?${params.toString()}`);
  };

  const handleReplaySegment = (seg: VideoSegment) => {
    const target = seg.start_second ?? 0;
    setWatchedSeconds(target);
    setIsPlaying(true);
    if (id) {
      logEvent({
        videoLessonId: id,
        segmentId: seg.id,
        eventType: "replay",
        timestampSeconds: target,
        metadata: { source: "smart_replay" },
      });
    }
    toast.success("Revisando este trecho do início.");
  };

  const handleQuizSubmit = async () => {
    if (selectedOption === null || !quiz) return;
    
    const questions = quiz.questions;
    const currentQuestion = questions[currentQuizIndex];
    if (selectedOption === currentQuestion.correct_index) {
      setQuizScore(prev => prev + 1);
      toast.success("Resposta correta!");
    } else {
      toast.error("Resposta incorreta. Veja a explicação.");
      if (id) {
        logEvent({
          videoLessonId: id,
          segmentId: currentSegment?.id,
          eventType: "quiz_error",
          timestampSeconds: watchedSeconds,
          metadata: { question_index: currentQuizIndex }
        });
      }
    }

    if (currentQuizIndex + 1 < questions.length) {
      setCurrentQuizIndex(prev => prev + 1);
      setSelectedOption(null);
    } else {
      setQuizFinished(true);
      await saveQuizAttempt();
    }
  };

  const saveQuizAttempt = async () => {
    if (!quiz) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const questions = quiz.questions;
    const currentQuestion = questions[currentQuizIndex];

    const { error } = await supabase
      .from("video_lesson_quiz_attempts")
      .insert({
        user_id: user.id,
        video_lesson_id: id,
        quiz_id: quiz.id,
        score: quizScore + (selectedOption === currentQuestion.correct_index ? 1 : 0),
        total_questions: questions.length,
        answers: [] // Placeholder
      });


    if (error) console.error("Erro ao salvar tentativa de quiz:", error);
    handleAction("quiz_completed");
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
              {lesson.video_url || (lesson as any).notebooklm_video_url ? (
                <div className="relative w-full h-full group">
                  <iframe 
                    src={lesson.video_url || (lesson as any).notebooklm_video_url} 
                    className="w-full h-full"
                    allowFullScreen
                    onLoad={() => {
                      setIsPlaying(true);
                      if (id) logEvent({
                        videoLessonId: id,
                        segmentId: currentSegment?.id ?? null,
                        eventType: "play",
                        timestampSeconds: watchedSeconds,
                      });
                    }}
                  />
                  
                  {/* FASE 2: Cognitive Heat Overlay visual no player */}
                  <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-30 transition-opacity">
                    <div className="w-full h-full flex flex-col justify-end">
                      <div className="h-4 w-full flex">
                        {segments.map((seg) => {
                          const analytics = getForSegment(seg.id);
                          const friction = analytics?.difficultyLevel === 'alta' ? 'bg-red-500' : 
                                          analytics?.difficultyLevel === 'média' ? 'bg-amber-500' : 'bg-green-500';
                          return (
                            <div 
                              key={seg.id} 
                              className={cn("h-full border-r border-black/20 flex-1 transition-all", friction)}
                              title={`${seg.title}: Fricção ${analytics?.difficultyLevel || 'baixa'}`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* FASE 2: Timeline Cognitiva com Hotspots */}
                  <div className="absolute bottom-16 left-4 right-4 h-1 bg-white/20 rounded-full overflow-hidden pointer-events-none">
                    {segments.map((seg) => {
                      const analytics = getForSegment(seg.id);
                      if (!analytics?.difficultyLikely) return null;
                      
                      const startPercent = ((seg.start_second || 0) / (lesson.duration_seconds || 1)) * 100;
                      const widthPercent = (((seg.end_second || lesson.duration_seconds) - (seg.start_second || 0)) / (lesson.duration_seconds || 1)) * 100;
                      
                      return (
                        <div 
                          key={`hotspot-${seg.id}`}
                          className="absolute h-full bg-red-500/60 animate-pulse"
                          style={{ left: `${startPercent}%`, width: `${widthPercent}%` }}
                        />
                      );
                    })}
                  </div>
                </div>
              ) : isCMEVideo ? (
                <div className="w-full h-full flex flex-col items-center justify-center space-y-4 bg-gradient-to-br from-slate-900 to-primary/20">
                  <div className="relative">
                    <Film className="h-20 w-20 text-primary/40 animate-pulse" />
                    <Sparkles className="h-6 w-6 text-primary absolute -top-2 -right-2 animate-bounce" />
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-white font-bold">Gerando Experiência Cinematográfica...</p>
                    <p className="text-xs text-primary/60 font-medium uppercase tracking-widest">ENAZIZI Cinematic Medical Engine</p>
                  </div>
                  <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-primary"
                      animate={{ x: [-200, 200] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    />
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center space-y-4">
                  <Play className="h-20 w-20 text-primary/40" />
                  <p className="text-muted-foreground">Vídeo em processamento pelo NotebookLM...</p>
                </div>
              )}
              {completionRate >= 95 && (
                <div className="absolute top-4 right-4 animate-bounce">
                  <Badge className="bg-green-500 gap-1">
                    <CheckCircle className="h-3 w-3" /> Concluído
                  </Badge>
                </div>
              )}

              {/* FASE 4: Recomendações Adaptativas ACE */}
              {!shadowMode && recommendations.length > 0 && (
                <div className="absolute bottom-4 right-4 z-50 w-80">
                  <AdaptiveRecommendationCard 
                    recommendation={recommendations[0]}
                    onAccept={acceptRecommendation}
                    onIgnore={ignoreRecommendation}
                  />
                </div>
              )}

              {/* FASE 3: Trigger Preventivo */}
              <PreventiveTutorTrigger 
                recommendation={recommendation}
                onAccept={() => currentSegment && handleAskTutorAtSegment(currentSegment)}
                onClose={resetRecommendation}
              />
            </div>

            {/* Alerta de Orquestração Cognitiva */}
            {cognitiveState?.current_session_mode === 'recovery' && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center gap-3"
              >
                <div className="p-2 rounded-lg bg-blue-500/20 text-blue-600">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-blue-700">Foco Zen Ativado</p>
                  <p className="text-[10px] text-blue-600/80 italic">
                    Detectamos aumento de fadiga cognitiva. O ENAZIZI reduziu a intensidade da sessão para preservar sua retenção.
                  </p>
                </div>
              </motion.div>
            )}
            
            {/* CME Personalization Banner */}
            {isCMEVideo && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-3 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold">Otimização Multimodal CME Ativa</p>
                    <p className="text-[10px] text-muted-foreground italic">Ritmo e narrativa adaptados ao seu perfil de retenção.</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1">
                  <Settings className="h-3 w-3" /> Ajustar Pacing
                </Button>
              </motion.div>
            )}

            {/* FASE 2: Indicador de dificuldade + segmento atual */}
            {currentSegment && (
              <div className="rounded-xl border border-primary/10 bg-muted/30 p-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 text-sm min-w-0">
                  <Badge variant="secondary" className="text-[10px]">
                    Trecho {String(currentSegment.ordem).padStart(2, "0")}
                  </Badge>
                  <span className="font-medium truncate">
                    {currentSegment.title || `Segmento ${currentSegment.ordem}`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {currentDifficulty && (
                    <Badge 
                      className={cn(
                        "gap-1",
                        difficultyLevel === "alta" ? "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30" :
                        difficultyLevel === "média" ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30" :
                        "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30"
                      )}
                    >
                      <AlertTriangle className="h-3 w-3" /> 
                      Dificuldade {difficultyLevel}
                    </Badge>
                  )}
                  {temporalEnabled && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 h-8"
                      onClick={() => handleAskTutorAtSegment(currentSegment)}
                    >
                      <MessageSquare className="h-3 w-3" /> Perguntar ao Tutor neste trecho
                    </Button>
                  )}
                  {smartReplayEnabled && currentDifficulty && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 h-8"
                      onClick={() => handleReplaySegment(currentSegment)}
                    >
                      <RotateCcw className="h-3 w-3" /> Revisar trecho
                    </Button>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{lesson.specialty}</Badge>
                    <Badge variant="secondary">{lesson.topic}</Badge>
                    {lesson.is_gold_content && (
                      <Badge className="bg-yellow-500 text-black gap-1">
                        <Sparkles className="h-3 w-3" /> Ouro
                      </Badge>
                    )}
                  </div>
                  <h1 className="text-3xl font-bold">{lesson.title}</h1>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon"><Share2 className="h-4 w-4" /></Button>
                  <Button 
                    className="gap-2" 
                    onClick={() => {
                      handleAction("complete");
                      if (id) logEvent({
                        videoLessonId: id,
                        segmentId: currentSegment?.id ?? null,
                        eventType: "complete",
                        timestampSeconds: watchedSeconds,
                      });
                    }}
                    disabled={completionRate < 90}
                  >
                    <CheckCircle className="h-4 w-4" /> Finalizar Aula
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground bg-muted/30 p-4 rounded-xl border border-primary/5">
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
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  <span>FSRS Pronto</span>
                </div>
              </div>

              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="w-full justify-start border-b rounded-none bg-transparent h-auto p-0 mb-6">
                  <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3">Resumo</TabsTrigger>
                  <TabsTrigger value="objectives" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3">Objetivos</TabsTrigger>
                  <TabsTrigger value="resources" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3">Materiais & Quiz</TabsTrigger>
                </TabsList>
                
                <TabsContent value="overview" className="mt-0 space-y-4">
                  <div className="prose prose-sm max-w-none text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {lesson.description || lesson.tutor_lesson_summary}
                  </div>
                  {lesson.notebooklm_notebook_url && (
                    <Button variant="outline" className="w-full mt-4 gap-2" onClick={() => {
                      handleAction("open_notebooklm");
                      window.open(lesson.notebooklm_notebook_url, '_blank');
                    }}>
                      <ExternalLink className="h-4 w-4" /> Abrir Workspace NotebookLM
                    </Button>
                  )}
                </TabsContent>

                <TabsContent value="objectives" className="mt-0">
                  <ul className="space-y-3">
                    {lesson.learning_objectives?.map((obj: string, i: number) => (
                      <li key={i} className="flex gap-3 items-start">
                        <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">{obj}</span>
                      </li>
                    ))}
                  </ul>
                </TabsContent>

                <TabsContent value="resources" className="mt-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card 
                      className="cursor-pointer hover:border-primary/50 transition-colors bg-gradient-to-br from-background to-primary/5"
                      onClick={() => navigate("/dashboard/mission")}
                    >
                      <CardHeader className="p-4">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Layers className="h-4 w-4 text-primary" /> Flashcards & FSRS
                        </CardTitle>
                        <CardDescription>Revise o conteúdo usando repetição espaçada.</CardDescription>
                      </CardHeader>
                    </Card>
                    <Card 
                      className={`cursor-pointer hover:border-primary/50 transition-colors ${quiz ? 'bg-gradient-to-br from-background to-orange-500/5' : 'opacity-50 cursor-not-allowed'}`}
                      onClick={() => quiz && setShowQuiz(true)}
                    >
                      <CardHeader className="p-4">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <HelpCircle className="h-4 w-4 text-orange-500" /> Quiz Rápido
                        </CardTitle>
                        <CardDescription>
                          {quiz ? `${quiz.questions?.length || 0} questões sobre esta aula.` : 'Nenhum quiz disponível.'}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>

          <div className="space-y-6">
            <Card className="border-primary/20 shadow-lg relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                <BrainCircuit className="h-20 w-20" />
              </div>
              <CardHeader className="bg-primary/5">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  Perguntar ao Tutor IA
                </CardTitle>
                <CardDescription>Tire dúvidas em tempo real.</CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="bg-muted/50 rounded-lg p-3 text-xs italic border-l-2 border-primary">
                  "O Tutor analisou esta aula e a memória original para te ajudar agora."
                </div>
                <Button className="w-full gap-2 py-6 text-lg shadow-md" onClick={() => {
                  handleAction("open_tutor");
                  navigate(`/dashboard/mentor?context=${lesson.id}&session=${lesson.tutor_session_id || ''}`);
                }}>
                  Conversar com Tutor <ArrowRight className="h-5 w-5" />
                </Button>
              </CardContent>
            </Card>

            {/* FASE 2: Lista de segmentos (oculta se vídeo não for segmentado) */}
            {segments.length > 0 && (
              <VideoSegmentList
                segments={segments}
                currentSegmentId={currentSegment?.id ?? null}
                onSelectSegment={handleSelectSegment}
                onAskTutor={handleAskTutorAtSegment}
                onReplaySegment={handleReplaySegment}
                getAnalytics={getForSegment}
                smartReplayEnabled={smartReplayEnabled}
                tutorTemporalEnabled={temporalEnabled}
              />
            )}

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Progresso Educacional</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Vídeo Assistido</span>
                  <span className="font-medium text-primary">{Math.floor(completionRate)}%</span>
                </div>
                <Progress value={completionRate} className="h-2" />
                
                <div className="pt-4 border-t space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                      <span>Resumo da Aula</span>
                    </div>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                      <span>Quiz Concluído</span>
                    </div>
                    {quizFinished ? <CheckCircle className="h-4 w-4 text-green-500" /> : <div className="w-4 h-4 rounded-full border border-muted-foreground" />}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-muted-foreground" />
                      <span>Sincronização FSRS</span>
                    </div>
                    {completionRate >= 90 ? <CheckCircle className="h-4 w-4 text-green-500" /> : <div className="w-4 h-4 rounded-full border border-muted-foreground" />}
                  </div>
                </div>
              </CardContent>
              {completionRate >= 90 && (
                <CardFooter className="pt-0">
                  <Button variant="outline" className="w-full text-xs gap-1 border-primary/20 text-primary hover:bg-primary/5" onClick={() => navigate("/dashboard/mission")}>
                    <Award className="h-3 w-3" /> Ver Flashcards Relacionados
                  </Button>
                </CardFooter>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* Quiz Dialog */}
      <Dialog open={showQuiz} onOpenChange={setShowQuiz}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Quiz Rápido: {lesson.title}</DialogTitle>
            <DialogDescription>
              {quizFinished 
                ? "Avaliação concluída!" 
                : `Questão ${currentQuizIndex + 1} de ${quiz?.questions?.length || 0}`}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            {!quizFinished ? (
              <div className="space-y-4">
                <p className="font-medium text-lg leading-tight">
                  {quiz?.questions[currentQuizIndex]?.question}
                </p>
                <div className="space-y-2">
                  {quiz?.questions[currentQuizIndex]?.options.map((option: string, i: number) => (
                    <div 
                      key={i}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedOption === i ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}
                      onClick={() => setSelectedOption(i)}
                    >
                      {option}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center space-y-4 py-6">
                <div className="h-20 w-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Award className="h-10 w-10" />
                </div>
                <h3 className="text-2xl font-bold">Parabéns!</h3>
                <p className="text-muted-foreground">Você acertou {quizScore} de {quiz?.questions?.length} questões.</p>
                <div className="bg-primary/5 p-4 rounded-lg">
                  <p className="text-sm font-medium">O seu progresso foi registrado e enviado para o Banco de Erros/FSRS.</p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            {!quizFinished ? (
              <Button 
                onClick={handleQuizSubmit} 
                className="w-full"
                disabled={selectedOption === null}
              >
                Próxima Questão
              </Button>
            ) : (
              <Button onClick={() => setShowQuiz(false)} className="w-full">
                Fechar e Voltar à Aula
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VideoLessonPlayer;
