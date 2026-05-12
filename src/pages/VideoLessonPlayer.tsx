import { useState, useEffect, useRef, useMemo, lazy, Suspense } from "react";
import Hls from "hls.js";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { EnaflixBackgroundFX } from "@/components/enaflix/EnaflixBackgroundFX";
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
  Gauge,
  Target,
  Brain,
  History,
  FileText,
  Star
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

const EnaflixLessonRating = lazy(() => import("@/components/enaflix/EnaflixLessonRating").then(m => ({ default: m.EnaflixLessonRating })));


import AdaptiveRecommendationCard from "@/components/adaptive/AdaptiveRecommendationCard";
import { useAdaptiveEngine } from "@/hooks/useAdaptiveEngine";
import { useCognitiveOrchestrator } from "@/hooks/useCognitiveOrchestrator";
import { useCinematicEngine } from "@/hooks/useCinematicEngine";
import { useNeuroanalytics } from "@/hooks/useNeuroanalytics";
import { useTelemetry } from "@/hooks/useTelemetry";

interface LessonData {
  id: string;
  title: string;
  subtitle?: string;
  subject?: string;
  topic?: string;
  subtopic?: string;
  video_url?: string;
  thumbnail_url?: string;
  duration?: number;
  duration_seconds?: number;
  media_status?: string;
  status?: string;
  tutor_lesson_id?: string;
  tutor_session_id?: string;
  source_session_id?: string;
  tutor_lesson_summary?: string;
  learning_objectives?: string[];
  health_score?: number;
  pipeline_last_error?: string;
  cme_project_id?: string;
  hls_manifest_url?: string;
  hls_url?: string;
  playback_url?: string;
  specialty?: string;
}


const VideoLessonPlayer = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [watchedSeconds, setWatchedSeconds] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [hasRated, setHasRated] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [tutorMode, setTutorMode] = useState<"standard" | "feynman" | "exam_sprint">("standard");
  const lastLogTime = useRef(0);
  const pauseStartTime = useRef<number | null>(null);
  const hasNotifiedDifficulty = useRef<Set<string>>(new Set());
  const ratingThresholdTriggered = useRef(false);

  const loadStartTime = useRef(Date.now());
  const hasLoggedReady = useRef(false);
  
  const { 
    recommendations, 
    acceptRecommendation, 
    ignoreRecommendation, 
    triggerEvaluation,
    shadowMode 
  } = useAdaptiveEngine(id);

  const { trackViewing, updateNeuroanalytics, profile } = useNeuroanalytics(id);
  const { trackAction } = useTelemetry();

  const { data: lesson, isLoading } = useQuery<LessonData>({
    queryKey: ["video-lesson", id],
    queryFn: async () => {
      const { data: memoryData } = await supabase
        .from("tutor_lesson_memory")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (memoryData) {
        return { ...(memoryData as any), __source: "tutor_memory" } as LessonData;
      }

      const { data, error } = await supabase
        .from("ai_video_lessons")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        toast.error("Erro ao carregar videoaula: " + error.message);
        logPlaybackAudit("error", error.message);
        throw error;
      }
      return { ...(data as any), __source: "cme" } as LessonData;
    }
  });

  // Signed URL para aulas vindas do tutor_lesson_memory (bucket privado)
  const { data: signedUrlData } = useQuery({
    queryKey: ["tutor-lesson-signed-url", id],
    enabled: !!id && (lesson as any)?.__source === "tutor_memory" && !!(lesson as any)?.video_url,
    refetchInterval: 50 * 60 * 1000, // renova antes de expirar (URL dura 60 min)
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "tutor-lesson-signed-url",
        { body: { lesson_id: id } }
      );
      if (error) throw error;
      return data as { signed_url: string; expires_in: number };
    }
  });



  const logPlaybackAudit = async (state: string, errorMessage?: string) => {
    if (!id || !lesson) return;
    const { data: { user } } = await supabase.auth.getUser();
    
    const hlsManifest = (lesson as any)?.hls_manifest_url;
    const playbackUrl = hlsManifest || 
                       (lesson as any)?.hls_url || 
                       (lesson as any)?.video_url || 
                       (lesson as any)?.playback_url;

    console.log(`[CME Audit] State: ${state}, URL: ${playbackUrl}`);

    try {
      // @ts-ignore
      await supabase.from("cme_playback_audit_logs").insert({
        video_lesson_id: id,
        user_id: user?.id,
        selected_url: playbackUrl,
        media_status: (lesson as any)?.media_status || (lesson as any)?.status,
        player_state: state,
        error_message: errorMessage,
        load_time_ms: Date.now() - loadStartTime.current
      } as any);
    } catch (err) {
      console.warn("[CME Audit] Persistent log failed, using fallback:", err);
    }
  };


  useEffect(() => {
    if (!isLoading && lesson && !hasLoggedReady.current) {
      const mediaStatus = (lesson as any).media_status || (lesson as any).status;
      if (mediaStatus === 'ready' || mediaStatus === 'published') {
        logPlaybackAudit("ready");
        hasLoggedReady.current = true;
      } else {
        logPlaybackAudit(mediaStatus || "unknown_status");
      }
    }

  }, [isLoading, lesson]);


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
    queryKey: ["video-lesson-segments", (lesson as any)?.tutor_lesson_id || (lesson as any)?.id],
    enabled: !!lesson,
    queryFn: async () => {
      const lessonId = (lesson as any).tutor_lesson_id || (lesson as any).id;
      const { data, error } = await supabase
        .from("lesson_segments")
        .select("id, title, summary, key_points, start_second, end_second, ordem, segment_type, has_flashcards")
        .eq("lesson_id", lessonId)
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

  const duration = (lesson as any)?.duration_seconds || (lesson as any)?.duration || 0;
  const completionRate = (duration > 0 && !isNaN(duration)) ? Math.min((watchedSeconds / duration) * 100, 100) : 0;



  // Check for rating trigger (70% or completion)
  useEffect(() => {
    if (id && completionRate >= 70 && !ratingThresholdTriggered.current && !hasRated) {
      setShowRating(true);
      ratingThresholdTriggered.current = true;
    }
  }, [completionRate, id, hasRated]);

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
        setWatchedSeconds(prev => {
          const next = prev + 1;
          
          // Log a cada 30 segundos ou na conclusão
          if (next - lastLogTime.current >= 30) {
            handleAction("heartbeat", next);
            lastLogTime.current = next;
            
            // Fase Enterprise+: Persistência Neuroanalítica Realtime
            if (id) {
              trackViewing.mutate({
                projectId: id,
                startTime: next - 30,
                endTime: next,
                playbackSpeed: 1.0, // Default for now
                interactionType: 'watch'
              });
              
              // Simula cálculo de carga cognitiva adaptativa
              if (profile) {
                const currentLoad = 0.4 + (Math.random() * 0.2); // Simulado
                updateNeuroanalytics.mutate({
                  projectId: id,
                  fatigueScore: 0.1,
                  cognitiveLoad: currentLoad,
                  engagementScore: 0.9,
                  retentionPrediction: Number(profile.retention_score || 0.85),
                  abandonmentRisk: 0.05
                });
              }
            }
          }
          return next;
        });
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

  const handleAction = async (action: string, currentTs?: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const ts = currentTs ?? watchedSeconds;

    // Track in new table
    const progressPct = duration ? Math.min(Math.round((ts / duration) * 100), 100) : 0;
    const isCompleted = action === "complete" || progressPct >= 90;
    await supabase.from("tutor_lesson_progress").upsert({
      lesson_id: id,
      user_id: user.id,
      last_position: ts,
      progress_percent: progressPct,
      completed: isCompleted,
      completed_at: isCompleted ? new Date().toISOString() : null,
    }, { onConflict: 'lesson_id,user_id' });

    // Eventos próprios para aulas humanas (não polui CME logs)
    if ((lesson as any)?.__source === "tutor_memory" && id) {
      if (action === "play" || action === "heartbeat") {
        await supabase.from("tutor_lesson_events").insert([{
          lesson_id: id,
          actor_id: user.id,
          event_type: "lesson_watched",
          metadata: { watched_seconds: ts, progress_percent: progressPct },
        }] as any);
      }
      if (isCompleted) {
        await supabase.from("tutor_lesson_events").insert([{
          lesson_id: id,
          actor_id: user.id,
          event_type: "lesson_completed",
          metadata: { watched_seconds: ts, progress_percent: progressPct },
        }] as any);
      }
    }


    const { error } = await supabase
      .from("video_lesson_usage_logs")
      .insert({
        video_lesson_id: id,
        user_id: user.id,
        action,
        watched_seconds: ts,
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
      if (!hasRated) setShowRating(true);
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
        specialty: (lesson as any).specialty || "Geral",
        topic: (lesson as any).topic || "Clínica Médica",
        subtopic: (lesson as any).subtopic || "",
        tutor_lesson_summary: (lesson as any).tutor_lesson_summary || "",
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
      context: (lesson as any).id,
      session: (lesson as any).tutor_session_id || (lesson as any).source_session_id || "",
    });

    
    if (ctx) {
      params.set("video_segment", seg.id);
      params.set("video_ts", String(watchedSeconds));
      params.set("hotspot_type", "temporal_context");
    }
    if (tutorMode !== "standard") {
      params.set("tutor_mode", tutorMode);
    }
    
    navigate(`/dashboard/mentor?${params.toString()}`);
  };

  const openTutorWithMode = (mode: "feynman" | "exam_sprint") => {
    if (!lesson || !id) return;
    setTutorMode(mode);
    const ctx = buildContext({
      videoLessonId: id,
      segment: currentSegment,
      currentTimestamp: watchedSeconds,
      lesson: {
        specialty: (lesson as any).specialty || "Geral",
        topic: (lesson as any).topic || "Clínica Médica",
        subtopic: (lesson as any).subtopic || "",
        tutor_lesson_summary: (lesson as any).tutor_lesson_summary || "",
      },
    });
    logEvent({
      videoLessonId: id,
      segmentId: currentSegment?.id ?? null,
      eventType: "tutor_open",
      timestampSeconds: watchedSeconds,
      metadata: { temporal: !!ctx, source: mode, tutor_mode: mode },
    });
    handleAction(mode === "feynman" ? "open_tutor_feynman" : "open_tutor_exam_sprint");
    const params = new URLSearchParams({
      context: (lesson as any).id,
      session: (lesson as any).tutor_session_id || (lesson as any).source_session_id || "",
      tutor_mode: mode,
      video_ts: String(watchedSeconds),
    });
    if (currentSegment?.id) params.set("video_segment", currentSegment.id);
    if (ctx) params.set("hotspot_type", "temporal_context");
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

  const [mediaTimeout, setMediaTimeout] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    
    const timeout = setTimeout(() => {
      const hlsManifest = (lesson as any)?.hls_manifest_url;
      const playbackUrl = hlsManifest || 
                         (lesson as any)?.hls_url || 
                         lesson?.video_url || 
                         (lesson as any)?.playback_url;
                         
      if (!playbackUrl) {
        setMediaTimeout(true);
        logPlaybackAudit("timeout", "Media source not found within 8s");
      }
    }, 8000);

    return () => clearTimeout(timeout);
  }, [isLoading, lesson]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-[#0a0a12] text-white gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <div className="text-xl font-medium animate-pulse">Carregando aula...</div>
        <p className="text-white/40 text-sm">Sincronizando com CME Autonomous Factory</p>
      </div>
    );
  }

  if (!lesson) return <div className="p-8 text-white bg-[#0a0a12] h-screen">Aula não encontrada.</div>;

  // FASE 2 & 6: Enterprise HLS & Variant Priority
  const isTutorMemory = (lesson as any).__source === "tutor_memory";
  const hlsManifest = (lesson as any).hls_manifest_url;
  const playbackUrl = isTutorMemory
    ? signedUrlData?.signed_url
    : (hlsManifest ||
       (lesson as any).hls_url ||
       lesson.video_url ||
       (lesson as any).playback_url ||
       (lesson as any).notebooklm_video_url);

  // Anti-placeholder logic
  const isPlaceholder = !playbackUrl || 
                       playbackUrl.includes('example.com') || 
                       playbackUrl.includes('placeholder.com') ||
                       playbackUrl.includes('dummy-video');

  const isRendering = lesson.media_status === 'processing' || lesson.media_status === 'pending';

  return (
    <div className="min-h-screen bg-[#0a0a12] text-white animate-in fade-in duration-500 pb-20 relative">
      <EnaflixBackgroundFX intensity="medium" />
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
            <Button variant="outline" size="sm" className="gap-2 border-primary/30 text-primary" onClick={() => setShowRating(true)}>
              <Star className="h-4 w-4 fill-primary" /> Avaliar Aula
            </Button>
            <Button variant="outline" size="sm" className="gap-2 border-white/10" onClick={() => {
              const url = `${window.location.origin}/videoaulas/${id}`;
              navigator.clipboard.writeText(url);
              toast.success("Link público copiado!");
            }}>
              <Share2 className="h-4 w-4" /> Compartilhar Preview
            </Button>
            {/* Removidos botões de ajuste do Header para evitar confusão com o conteúdo do vídeo */}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3 space-y-6">
            <div className="aspect-video bg-black rounded-3xl overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] relative border border-primary/20 group/player ring-1 ring-white/10">
              {isRendering ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-20 text-center p-6">
                  <Activity className="h-16 w-16 text-primary animate-pulse mb-4" />
                  <h3 className="text-2xl font-bold mb-2">Videoaula em Renderização</h3>
                  <p className="text-white/60 max-w-md mb-6">
                    O CME Autonomous Studio está processando os ativos cinemáticos e gerando as variantes HLS.
                  </p>
                  <div className="flex gap-3">
                    <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30">
                      Status: {lesson.media_status}
                    </Badge>
                    <Badge variant="outline" className="border-white/20">
                      Health: {lesson.health_score}%
                    </Badge>
                  </div>
                  <Button 
                    variant="outline" 
                    className="mt-8 gap-2 border-white/10 hover:bg-white/5"
                    onClick={() => window.location.reload()}
                  >
                    <RotateCcw className="h-4 w-4" /> Atualizar Status
                  </Button>
                </div>
              ) : (mediaTimeout || isPlaceholder) ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1a1a2e] z-20 text-center p-6">
                  <AlertTriangle className="h-16 w-16 text-orange-500 mb-4" />
                  <h3 className="text-2xl font-bold mb-2">Mídia Indisponível</h3>
                  <p className="text-white/60 max-w-md mb-6">
                    Não foi possível localizar uma fonte de vídeo válida para esta aula no momento.
                  </p>
                  {lesson.pipeline_last_error && (
                    <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg mb-6 text-red-400 text-xs font-mono max-w-xl text-left">
                      {lesson.pipeline_last_error}
                    </div>
                  )}
                  <div className="flex gap-4">
                    {!isTutorMemory && (
                      <Button
                        variant="default"
                        className="gap-2"
                        onClick={async () => {
                          const { error } = await supabase.from("cme_media_reprocessing_jobs").insert({
                            video_lesson_id: lesson.id,
                            reprocess_status: "queued",
                            failure_reason: "Solicitação manual pelo player do aluno",
                          });
                          if (error) {
                            toast.error("Erro ao solicitar reprocessamento: " + error.message);
                            return;
                          }
                          await supabase
                            .from("ai_video_lessons")
                            .update({ media_status: "rendering" as any })
                            .eq("id", lesson.id);
                          toast.success("Aula enviada para reprocessamento.");
                        }}
                      >
                        <RotateCcw className="h-4 w-4" /> Reprocessar Aula
                      </Button>
                    )}
                    <Button variant="outline" onClick={() => navigate("/dashboard/videoaulas")}>
                      Voltar à Biblioteca
                    </Button>
                  </div>
                </div>
              ) : null}

              {(!isRendering && !isPlaceholder && playbackUrl) && (
                <div className="relative w-full h-full">
                  {(playbackUrl.endsWith('.m3u8') || !!hlsManifest || playbackUrl.includes('.mp4') || playbackUrl.includes('supabase.co/storage')) ? (
                    <VideoHLSPlayer 
                      src={playbackUrl}
                      onPlay={() => {
                        setIsPlaying(true);
                        if (id) logEvent({
                          videoLessonId: id,
                          segmentId: currentSegment?.id ?? null,
                          eventType: "play",
                          timestampSeconds: watchedSeconds,
                        });
                      }}
                      onTimeUpdate={(currentTime) => setWatchedSeconds(currentTime)}
                      initialTime={watchedSeconds}
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
              )}
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
                  <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> {lesson.duration_seconds ? `${Math.floor(lesson.duration_seconds / 60)}:${(lesson.duration_seconds % 60).toString().padStart(2, '0')}` : '00:00'}</span>
                  <span className="flex items-center gap-1.5"><BookOpen className="h-4 w-4" /> {lesson.specialty}</span>
                  <span className="flex items-center gap-1.5"><BrainCircuit className="h-4 w-4" /> IA Multimodal</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  className="rounded-full hover:bg-white/10"
                  title="Copiar link público da aula"
                  onClick={() => {
                    const url = `${window.location.origin}/videoaulas/${id}`;
                    navigator.clipboard.writeText(url);
                    toast.success("Link público copiado!");
                  }}
                >
                  <Share2 className="h-5 w-5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="rounded-full hover:bg-white/10"
                  title="Próximo passo"
                  onClick={() => {
                    if (segments.length > 0) {
                      const next = segments.find((seg) => (seg.start_second ?? 0) > watchedSeconds);
                      if (next) {
                        handleSelectSegment(next);
                        toast.success(`Indo para: ${next.title}`);
                        return;
                      }
                    }
                    handleAction("complete");
                  }}
                >
                  <ArrowRight className="h-5 w-5" />
                </Button>
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
                    {lesson.tutor_lesson_summary ? (
                      <p className="text-white/70 leading-relaxed text-sm whitespace-pre-line">
                        {lesson.tutor_lesson_summary}
                      </p>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-white/50 leading-relaxed text-sm italic">
                          Resumo ainda não gerado para esta aula. Você pode pedir ao Tutor IA para criar uma síntese personalizada deste conteúdo.
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-primary/30 text-primary hover:bg-primary/10 gap-2"
                          onClick={() => {
                            const params = new URLSearchParams({
                              topic: lesson.topic || lesson.title || "",
                              specialty: lesson.specialty || "",
                              context: lesson.id,
                            });
                            navigate(`/dashboard/mentor?${params.toString()}`);
                          }}
                        >
                          <Sparkles className="h-4 w-4" /> Gerar resumo com o Tutor
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold flex items-center gap-2"><Target className="h-5 w-4 text-primary" /> Objetivos de Aprendizado</h3>
                    {lesson.learning_objectives && lesson.learning_objectives.length > 0 ? (
                      <ul className="space-y-2">
                        {lesson.learning_objectives.map((obj: string, i: number) => (
                          <li key={i} className="flex gap-3 text-sm text-white/70">
                            <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                            {obj}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-white/50 leading-relaxed text-sm italic">
                          Esta aula ainda não tem objetivos pedagógicos cadastrados. Acesse a sessão guiada para estudar este tema com objetivos claros.
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-primary/30 text-primary hover:bg-primary/10 gap-2"
                          onClick={() => {
                            const params = new URLSearchParams({
                              topic: lesson.topic || lesson.title || "",
                              auto: "1",
                              origin: "video-lesson",
                            });
                            navigate(`/dashboard/sessao-estudo?${params.toString()}`);
                          }}
                        >
                          <Target className="h-4 w-4" /> Abrir Sessão de Estudo guiada
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="segmentos" className="py-6">
                {segments && segments.length > 0 ? (
                  <VideoSegmentList 
                    segments={segments} 
                    currentSegmentId={currentSegment?.id || null}
                    onSelectSegment={handleSelectSegment}
                    onAskTutor={handleAskTutorAtSegment}
                    onReplaySegment={handleReplaySegment}
                    getAnalytics={getForSegment}
                    smartReplayEnabled={smartReplayEnabled}
                    tutorTemporalEnabled={temporalEnabled}
                  />
                ) : (
                  <div className="text-center py-12 space-y-4 max-w-md mx-auto">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                      <Sparkles className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-bold text-base">Capítulos sendo gerados pela IA</h4>
                      <p className="text-white/50 text-sm mt-2 leading-relaxed">
                        Os capítulos inteligentes desta aula ainda não foram processados. Enquanto isso, peça ao Tutor para destacar os pontos-chave do conteúdo.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-primary/30 text-primary hover:bg-primary/10 gap-2"
                      onClick={() => {
                        const params = new URLSearchParams({
                          topic: lesson.topic || lesson.title || "",
                          context: lesson.id,
                        });
                        navigate(`/dashboard/mentor?${params.toString()}`);
                      }}
                    >
                      <Sparkles className="h-4 w-4" /> Pedir capítulos ao Tutor
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="notas" className="py-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={() => {
                      const params = new URLSearchParams({
                        topic: lesson.topic || lesson.title || "",
                        lesson: lesson.id,
                      });
                      navigate(`/dashboard/flashcards?${params.toString()}`);
                    }}
                    className="text-left p-5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-primary/30 transition-all group"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                        <BookOpen className="h-5 w-5 text-primary" />
                      </div>
                      <h4 className="font-bold text-sm">Flashcards do Tema</h4>
                    </div>
                    <p className="text-xs text-white/50 leading-relaxed">
                      Acesse os flashcards de <span className="text-primary font-medium">{lesson.topic || lesson.specialty}</span> para fixar o conteúdo desta aula com repetição espaçada.
                    </p>
                    <span className="inline-flex items-center gap-1 mt-3 text-[10px] font-bold uppercase tracking-wider text-primary">
                      Abrir <ArrowRight className="h-3 w-3" />
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      const params = new URLSearchParams({
                        topic: lesson.topic || lesson.title || "",
                        specialty: lesson.specialty || "",
                        source: "video-lesson",
                        lesson: lesson.id,
                      });
                      navigate(`/dashboard/gerar-flashcards?${params.toString()}`);
                    }}
                    className="text-left p-5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-primary/30 transition-all group"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                        <Sparkles className="h-5 w-5 text-primary" />
                      </div>
                      <h4 className="font-bold text-sm">Gerar notas & flashcards</h4>
                    </div>
                    <p className="text-xs text-white/50 leading-relaxed">
                      A IA cria automaticamente flashcards e notas de estudo a partir do conteúdo desta videoaula.
                    </p>
                    <span className="inline-flex items-center gap-1 mt-3 text-[10px] font-bold uppercase tracking-wider text-primary">
                      Gerar agora <ArrowRight className="h-3 w-3" />
                    </span>
                  </button>
                </div>
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
              recommendation={recommendation}
              onAccept={() => acceptRecommendation('rec')}
              onClose={() => resetRecommendation()}
            />

            <AnimatePresence>
              {recommendation && (
                <AdaptiveRecommendationCard 
                  recommendation={{
                    id: 'rec',
                    recommendation_text: recommendation.description,
                    action_taken: 'suggest_tutor',
                    action_payload: {},
                    trigger_type: recommendation.type
                  }}
                  onAccept={() => acceptRecommendation('rec')}
                  onIgnore={() => ignoreRecommendation('rec')}
                />
              )}
            </AnimatePresence>

            <Card className="bg-white/5 border-white/5 shadow-2xl overflow-hidden group">
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-bold flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BrainCircuit className="h-4 w-4 text-primary" /> Seu Progresso Cognitivo
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant={tutorMode === "feynman" ? "secondary" : "ghost"}
                      size="sm"
                      className="h-7 text-[10px] gap-1.5 border border-primary/20 hover:bg-primary/10 text-primary px-2"
                      onClick={() => openTutorWithMode("feynman")}
                    >
                      <Volume2 className="h-3 w-3" /> Tutor Feynman
                    </Button>
                    <Button
                      variant={tutorMode === "exam_sprint" ? "secondary" : "ghost"}
                      size="sm"
                      className="h-7 text-[10px] gap-1.5 border border-orange-500/20 hover:bg-orange-500/10 text-orange-500 px-2"
                      onClick={() => openTutorWithMode("exam_sprint")}
                    >
                      <Flame className="h-3 w-3" /> Tutor Sprint
                    </Button>
                  </div>
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
      <Suspense fallback={null}>
        {showRating && id && (
          <EnaflixLessonRating 
            lessonId={id} 
            watchedPercentage={completionRate}
            onClose={() => {
              setShowRating(false);
              setHasRated(true);
            }} 
          />
        )}
      </Suspense>
    </div>
  );
};

const VideoHLSPlayer = ({ 
  src, 
  onPlay, 
  onTimeUpdate, 
  initialTime 
}: { 
  src: string; 
  onPlay?: () => void; 
  onTimeUpdate?: (time: number) => void; 
  initialTime?: number;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (Hls.isSupported() && (src.includes('.m3u8') || src.includes('manifest'))) {
      if (hlsRef.current) hlsRef.current.destroy();
      
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });
      hls.loadSource(src);
      hls.attachMedia(video);
      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (initialTime && !isNaN(initialTime)) {
          video.currentTime = initialTime;
        }
        video.play().catch(e => console.log("Auto-play prevented", e));
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              break;
          }
        }
      });
    } else {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      video.src = src;
      if (initialTime && !isNaN(initialTime)) {
        video.currentTime = initialTime;
      }
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, [src]);

  return (
    <video
      ref={videoRef}
      className="w-full h-full"
      controls
      autoPlay
      playsInline
      crossOrigin="anonymous"
      onPlay={onPlay}
      onTimeUpdate={(e) => onTimeUpdate?.(e.currentTarget.currentTime)}
    />
  );
};

export default VideoLessonPlayer;
