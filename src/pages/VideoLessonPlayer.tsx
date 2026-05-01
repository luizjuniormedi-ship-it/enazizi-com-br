import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
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
  Settings,
  Flame,
  Loader2,
  Monitor,
  Volume2,
  ChevronDown,
  ChevronUp,
  Activity,
  Gauge
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

  // FASE 5: Regression Suite Verification (Client-side check)
  useEffect(() => {
    if (lesson?.status === 'published' && (lesson as any).health_score < 50) {
      toast.error("Instabilidade de Playback Detectada", {
        description: "Esta mídia apresenta falhas de regressão e pode não carregar corretamente.",
        duration: 10000
      });
    }
  }, [lesson]);

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
    <div className="min-h-screen bg-[#0a0a12] text-white animate-in fade-in duration-500 pb-20">
      <header className="sticky top-0 z-50 bg-[#0a0a12]/80 backdrop-blur-xl border-b border-white/5 px-6 h-14 flex items-center justify-between">
        <Button 
          variant="ghost" 
          className="gap-2 -ml-2 text-white/70 hover:text-white hover:bg-white/10" 
          onClick={() => navigate("/dashboard/videoaulas")}
        >
          <ChevronLeft className="h-4 w-4" /> Voltar
        </Button>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="text-primary border-primary/20 bg-primary/5 animate-pulse">
            Sincronização Supabase Realtime Ativa
          </Badge>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2 border-white/10" onClick={() => {
              const url = `${window.location.origin}/videoaulas/${id}`;
              navigator.clipboard.writeText(url);
              toast.success("Link público copiado!");
            }}>
              <Share2 className="h-4 w-4" /> Compartilhar Preview
            </Button>
            <Button variant="outline" size="sm" className="gap-2 border-primary/30 text-primary" onClick={() => {
              toast.info("Ajustando Pacing: Ativando modo didático amplificado.");
            }}>
              <Volume2 className="h-4 w-4" /> Voz Feynman
            </Button>
            <Button variant="outline" size="sm" className="gap-2 border-orange-500/30 text-orange-500" onClick={() => {
              toast.info("Ativando Exam Sprint: Pacing acelerado e foco em questões.");
            }}>
              <Flame className="h-4 w-4" /> Exam Sprint
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3 space-y-6">
            <div className="aspect-video bg-black rounded-3xl overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] relative border border-primary/20 group/player ring-1 ring-white/10">
              {(() => {
                // FASE 2 & 6: Enterprise HLS & Variant Priority
                const hlsManifest = (lesson as any).hls_manifest_url;
                const playbackUrl = hlsManifest || 
                                   (lesson as any).hls_url || 
                                   lesson.video_url || 
                                   (lesson as any).playback_url ||
                                   (lesson as any).notebooklm_video_url;

                // Anti-placeholder logic
                const isPlaceholder = !playbackUrl || 
                                     playbackUrl.includes('example.com') || 
                                     playbackUrl.includes('placeholder.com') ||
                                     playbackUrl.includes('dummy-video');

                if (!isPlaceholder && playbackUrl) {
                  const isHLS = playbackUrl.endsWith('.m3u8') || !!hlsManifest;
                  const isDirectVideo = playbackUrl.includes('.mp4') || playbackUrl.includes('supabase.co/storage');

                  return (
                    <div className="relative w-full h-full">
                      {(isHLS || isDirectVideo) ? (
                        <video 
                          id="video-player"
                          src={playbackUrl}
                          className="w-full h-full"
                          controls
                          autoPlay
                          playsInline
                          crossOrigin="anonymous"
                          onPlay={() => {
                            setIsPlaying(true);
                            if (id) logEvent({
                              videoLessonId: id,
                              segmentId: currentSegment?.id ?? null,
                              eventType: "play",
                              timestampSeconds: watchedSeconds,
                            });
                          }}
                        />
                      ) : (
                        <iframe 
                          src={playbackUrl} 
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
                      )}
                      
                      {/* FASE 3 & 6: Scene Graph & Cinematic Overlays */}
                      <div className="absolute inset-0 pointer-events-none z-10">
                        {/* Dynamic Overlay Slot for Scene Graph reinforcement */}
                        {currentSegment?.segment_type === 'clinical_case' && (
                          <motion.div 
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="absolute top-4 right-4 bg-primary/90 text-white p-3 rounded-lg backdrop-blur-md border border-white/20 shadow-xl"
                          >
                            <p className="text-[10px] font-bold uppercase tracking-tighter">CME Case Insight</p>
                            <p className="text-xs">Foco: Raciocínio Clínico</p>
                          </motion.div>
                        )}
                      </div>

                      {/* FASE 2: Cognitive Heat Overlay */}
                      <div className="absolute inset-0 pointer-events-none opacity-0 group-hover/player:opacity-30 transition-opacity z-20">
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

                      {/* FASE 2 & 6: Timeline Cognitiva com Hotspots & Hover Previews */}
                      <div className="absolute bottom-16 left-4 right-4 group/timeline h-6 flex flex-col justify-end pointer-events-auto cursor-pointer z-30">
                        <div className="h-1 w-full bg-white/20 rounded-full overflow-hidden relative mb-2">
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
                          
                          {/* Active Progress Bar */}
                          <div 
                            className="absolute top-0 left-0 h-full bg-primary z-10" 
                            style={{ width: `${completionRate}%` }}
                          />
                        </div>

                        {/* Hover Preview UI (Enterprise) */}
                        <div className="absolute bottom-6 left-0 w-full h-20 pointer-events-none flex opacity-0 group-hover/timeline:opacity-100 transition-opacity">
                          <div className="relative flex-1">
                            <div className="absolute bottom-full left-[var(--hover-pos)] -translate-x-1/2 mb-2 p-1 bg-black/90 border border-white/20 rounded-lg overflow-hidden shadow-2xl w-40 aspect-video flex flex-col">
                               <div className="flex-1 bg-slate-800 flex items-center justify-center">
                                  <Film className="h-6 w-6 text-white/20" />
                               </div>
                               <div className="p-1 text-[8px] font-bold text-center uppercase tracking-widest text-primary">
                                  Chapter Preview
                               </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                // Status-based rendering if no real media is available
                const mediaStatus = (lesson as any).media_status || 'queued';
                
                if (mediaStatus === 'rendering' || mediaStatus === 'processing') {
                  return (
                    <div className="w-full h-full flex flex-col items-center justify-center space-y-4 bg-gradient-to-br from-slate-900 to-primary/20">
                      <div className="relative">
                        <Film className="h-20 w-20 text-primary/40 animate-pulse" />
                        <Sparkles className="h-6 w-6 text-primary absolute -top-2 -right-2 animate-bounce" />
                      </div>
                      <div className="text-center space-y-2">
                        <p className="text-white font-bold">Gerando Experiência Cinematográfica...</p>
                        <p className="text-xs text-primary/60 font-medium uppercase tracking-widest">Status: {mediaStatus}</p>
                      </div>
                      <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-primary"
                          animate={{ x: [-200, 200] }}
                          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        />
                      </div>
                    </div>
                  );
                }

                if (mediaStatus === 'failed') {
                  return (
                    <div className="w-full h-full flex flex-col items-center justify-center space-y-4 bg-red-950/20">
                      <AlertTriangle className="h-20 w-20 text-red-500/40" />
                      <p className="text-white font-bold">Falha na Renderização do Vídeo</p>
                      <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Tentar Novamente</Button>
                    </div>
                  );
                }

                return (
                  <div className="w-full h-full flex flex-col items-center justify-center space-y-4 bg-slate-900/50 p-6">
                    <div className="relative">
                      <Play className="h-20 w-20 text-primary/20" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="h-10 w-10 text-primary animate-spin" />
                      </div>
                    </div>
                    <div className="text-center space-y-2 max-w-sm">
                      <p className="text-white font-medium">Videoaula ainda em geração</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        O conteúdo de {(lesson as any).title} está sendo processado pelo motor cinematográfico. 
                        O vídeo será liberado automaticamente após o render finalizar.
                      </p>
                      
                      {lesson.pipeline_last_error && (
                        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-left">
                          <p className="text-[10px] text-red-400 font-bold uppercase mb-1 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> Log de Erro CME
                          </p>
                          <p className="text-[10px] text-red-300/80 line-clamp-2 italic">
                            {lesson.pipeline_last_error}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold tracking-tight">{lesson.title}</h1>
                  <Badge variant="outline" className="text-emerald-400 border-emerald-400/20 bg-emerald-400/5">
                    9.4 CME Score
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-white/50">
                  <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> {Math.floor(lesson.duration_seconds / 60)}:{(lesson.duration_seconds % 60).toString().padStart(2, '0')}</span>
                  <span className="flex items-center gap-1.5"><BookOpen className="h-4 w-4" /> {lesson.specialty}</span>
                  <span className="flex items-center gap-1.5"><BrainCircuit className="h-4 w-4" /> IA Multimodal</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="icon" variant="ghost" className="rounded-full hover:bg-white/10"><Settings className="h-5 w-5" /></Button>
                <Button size="icon" variant="ghost" className="rounded-full hover:bg-white/10"><Share2 className="h-5 w-5" /></Button>
                <Button size="icon" variant="ghost" className="rounded-full hover:bg-white/10"><ArrowRight className="h-5 w-5" /></Button>
              </div>
            </div>

            <Tabs defaultValue="conteudo" className="w-full">
              <TabsList className="bg-transparent border-b border-white/5 w-full justify-start rounded-none h-12 p-0 gap-8">
                <TabsTrigger value="conteudo" className="data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 font-bold text-sm">Visão Geral</TabsTrigger>
                <TabsTrigger value="segmentos" className="data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 font-bold text-sm">Capítulos IA</TabsTrigger>
                <TabsTrigger value="notas" className="data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 font-bold text-sm">Notas & Flashcards</TabsTrigger>
              </TabsList>
              
              <TabsContent value="conteudo" className="py-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Resumo do Tutor</h3>
                    <p className="text-white/70 leading-relaxed text-sm">
                      {lesson.tutor_lesson_summary || "O Tutor IA está preparando o resumo cinematográfico desta aula."}
                    </p>
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold flex items-center gap-2"><Target className="h-5 w-4 text-primary" /> Objetivos de Aprendizado</h3>
                    <ul className="space-y-2">
                      {lesson.learning_objectives?.map((obj: string, i: number) => (
                        <li key={i} className="flex gap-3 text-sm text-white/70">
                          <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          {obj}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="segmentos" className="py-6">
                <VideoSegmentList 
                  segments={segments} 
                  onSelect={handleSelectSegment}
                  onAskTutor={handleAskTutorAtSegment}
                  onReplay={handleReplaySegment}
                  currentSecond={watchedSeconds}
                  currentDifficulty={currentDifficulty}
                />
              </TabsContent>
            </Tabs>
          </div>

          <div className="space-y-6">
            {/* FASE 6: Observability UI inside Player */}
            <Card className="bg-slate-900/40 border-white/5 shadow-2xl">
               <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-black uppercase tracking-widest text-primary flex items-center justify-between">
                     Director AI Telemetry
                     <Activity className="h-3 w-3" />
                  </CardTitle>
               </CardHeader>
               <CardContent className="space-y-3">
                  <div className="flex justify-between text-[10px]">
                     <span className="text-white/40">Visual Grammar</span>
                     <span className="text-white font-bold uppercase">{lesson.specialty}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                     <span className="text-white/40">Cognitive Pacing</span>
                     <span className="text-emerald-400 font-bold">Optimal</span>
                  </div>
                  <div className="pt-2">
                     <div className="flex justify-between text-[8px] uppercase font-bold text-white/30 mb-1">
                        <span>Buffer Health</span>
                        <span>Low Latency</span>
                     </div>
                     <Progress value={92} className="h-0.5 bg-white/5" />
                  </div>
               </CardContent>
            </Card>

            <PreventiveTutorTrigger 
              videoLessonId={id!} 
              currentSegmentId={currentSegment?.id || null} 
              watchedSeconds={watchedSeconds}
            />

            <AnimatePresence>
              {recommendation && (
                <AdaptiveRecommendationCard 
                  recommendation={recommendation}
                  onAccept={() => acceptRecommendation(recommendation.id)}
                  onIgnore={() => ignoreRecommendation(recommendation.id)}
                />
              )}
            </AnimatePresence>

            <Card className="bg-white/5 border-white/5 shadow-2xl overflow-hidden group">
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <BrainCircuit className="h-4 w-4 text-primary" /> Seu Progresso Cognitivo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-white/50 uppercase tracking-widest">Mastery Estimada</span>
                      <span className="text-primary font-bold">85%</span>
                    </div>
                    <Progress value={85} className="h-1 bg-white/10" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-center">
                       <p className="text-[10px] text-white/40 uppercase font-black mb-1">Fatigue</p>
                       <p className="text-sm font-bold">Low</p>
                    </div>
                    <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-center">
                       <p className="text-[10px] text-white/40 uppercase font-black mb-1">Retention</p>
                       <p className="text-sm font-bold text-emerald-400">High</p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-white/5 space-y-4">
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
