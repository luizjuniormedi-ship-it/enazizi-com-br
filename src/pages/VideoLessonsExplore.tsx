import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Search, 
  Filter, 
  Clock, 
  Play, 
  Award,
  ChevronRight,
  TrendingUp,
  History,
  CheckCircle2,
  Stethoscope,
  GraduationCap,
  Sparkles,
  Zap,
  Activity,
  Flame,
  ArrowUpDown,
  BarChart3,
  SearchCode,
  Video,
  RotateCcw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { EnaflixBackgroundFX } from "@/components/enaflix/EnaflixBackgroundFX";
import { EnaflixSectionTitle } from "@/components/enaflix/EnaflixSectionTitle";
import { EnaflixCard } from "@/components/enaflix/EnaflixCard";
import { motion } from "framer-motion";

const VideoLessonsExplore = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [specialtyFilter, setSpecialtyFilter] = useState("all");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  // Fase 1: Novos filtros
  const [durationFilter, setDurationFilter] = useState("all");
  const [examSprintOnly, setExamSprintOnly] = useState(false);
  const [recoveryOnly, setRecoveryOnly] = useState(false);
  
  const navigate = useNavigate();

  const { data: lessons = [], isLoading } = useQuery({
    queryKey: ["student-video-lessons-explore"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_video_lessons")
        .select(`
          *,
          cme_exam_sprint_profiles(id, sprint_score, sprint_duration)
        `)
        .eq("status", "published")
        .order("published_at", { ascending: false });

      if (error) {
        toast.error("Erro ao carregar explorador: " + error.message);
        throw error;
      }

      const { data: memoryData, error: memoryError } = await supabase
        .from("tutor_lesson_memory")
        .select("*")
        .eq("status", "published")
        .eq("hidden_from_student", false);

      if (memoryError) {
        console.warn("[VideoLessonsExplore] tutor_lesson_memory indisponível:", memoryError.message);
      }

      const memoryLessons = (memoryData || []).map((l: any) => ({
        ...l,
        specialty: (l.subject || "Geral").trim?.() || "Geral",
        duration_seconds: l.duration || 900,
        difficulty_level: "intermediate",
      }));

      const standardLessons = (data || []).map((l: any) => ({
        ...l,
        specialty: (l.specialty || "Geral").trim?.() || "Geral",
      }));

      return [...standardLessons, ...memoryLessons].sort(
        (a: any, b: any) =>
          new Date(b.published_at || b.created_at).getTime() -
          new Date(a.published_at || a.created_at).getTime()
      );
    }
  });

  const { data: usageLogs } = useQuery({
    queryKey: ["video-lessons-usage-explore"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("video_lesson_usage_logs")
        .select("video_lesson_id, action, completion_rate")
        .eq("user_id", user.id);
      
      if (error) return [];
      return data;
    }
  });

  const getLessonProgress = (lessonId: string) => {
    if (!usageLogs) return 0;
    const logs = usageLogs.filter(log => log.video_lesson_id === lessonId);
    if (logs.length === 0) return 0;
    return Math.max(...logs.map(log => Number(log.completion_rate) || 0));
  };

  const filteredLessons = useMemo(() => {
    if (!lessons) return [];
    
    let result = lessons.filter(lesson => {
      const searchStr = `${lesson.title} ${lesson.specialty} ${lesson.topic} ${lesson.subtopic || ""} ${(lesson as any).professor || ""}`.toLowerCase();
      const matchesSearch = searchStr.includes(searchTerm.toLowerCase());
      
      const matchesSpecialty = specialtyFilter === "all" || lesson.specialty === specialtyFilter;
      const matchesDifficulty = difficultyFilter === "all" || lesson.difficulty_level === difficultyFilter;
      
      const duration = lesson.duration_seconds || 0;
      let matchesDuration = true;
      if (durationFilter === "short") matchesDuration = duration <= 600; // 10 min
      if (durationFilter === "medium") matchesDuration = duration > 600 && duration <= 1800; // 10-30 min
      if (durationFilter === "long") matchesDuration = duration > 1800; // > 30 min

      let matchesCategory = true;
      if (activeCategory === "gold") matchesCategory = !!lesson.is_gold_content;
      if (activeCategory === "exam_sprint" || examSprintOnly) {
        const hasSprint = (lesson as any).cme_exam_sprint_profiles?.length > 0 || lesson.title.toLowerCase().includes("sprint");
        if (activeCategory === "exam_sprint" || examSprintOnly) matchesCategory = hasSprint;
      }
      if (activeCategory === "recovery" || recoveryOnly) {
        const isRecovery = (lesson as any).adaptive_mode === "recovery" || (lesson as any).cme_profile === "recovery";
        if (activeCategory === "recovery" || recoveryOnly) matchesCategory = isRecovery;
      }
      
      // Filtros Cognitivos (ACE)
      if (activeCategory === "recommended") matchesCategory = !!(lesson as any).recommended_by_ace;
      if (activeCategory === "fsrs") matchesCategory = !!(lesson as any).fsrs_review_pending;
      if (activeCategory === "friction") matchesCategory = (Number((lesson as any).friction_score) || 0) > 70;
      if (activeCategory === "low_mastery") matchesCategory = (Number((lesson as any).mastery_score) || 0) < 50;
      
      return matchesSearch && matchesSpecialty && matchesDifficulty && matchesDuration && matchesCategory;
    });

    // Sorting logic
    if (sortBy === "retention") result.sort((a, b) => (Number((b as any).avg_retention) || 0) - (Number((a as any).avg_retention) || 0));
    if (sortBy === "watched") result.sort((a, b) => (Number((b as any).view_count) || 0) - (Number((a as any).view_count) || 0));
    if (sortBy === "score") result.sort((a, b) => (Number((b as any).cme_score) || 0) - (Number((a as any).cme_score) || 0));
    if (sortBy === "recent") result.sort((a, b) => new Date(b.published_at || "").getTime() - new Date(a.published_at || "").getTime());
    if (sortBy === "replay") result.sort((a, b) => (Number((b as any).replay_rate) || 0) - (Number((a as any).replay_rate) || 0));
    if (sortBy === "abandon") result.sort((a, b) => (Number((b as any).abandon_rate) || 0) - (Number((a as any).abandon_rate) || 0));

    return result;
  }, [lessons, searchTerm, specialtyFilter, difficultyFilter, activeCategory, sortBy, durationFilter, examSprintOnly, recoveryOnly]);

  const specialties = Array.from(
    new Set(
      lessons
        .map(l => ((l as any).specialty || "").trim?.() || "")
        .filter((s): s is string => Boolean(s))
    )
  );

  return (
    <div className="pb-32 pt-12 space-y-12 relative min-h-screen overflow-x-hidden">
      <EnaflixBackgroundFX intensity="intense" />
      
      <div className="px-4 sm:px-8 lg:px-14 space-y-2">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
          <div className="h-2 w-10 bg-gradient-to-r from-primary to-accent rounded-full" />
          <span className="text-[11px] font-black uppercase tracking-[0.4em] text-white/50">Explorador de Conteúdo</span>
        </motion.div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter text-white leading-[0.9] drop-shadow-2xl">
          Videoaulas <span className="gradient-text">ENAFLIX</span>
        </h1>
        <p className="text-white/50 text-lg max-w-2xl font-medium mt-4">
          Filtros avançados e inteligência adaptativa para encontrar o conteúdo perfeito para sua jornada médica.
        </p>
      </div>

      <div className="px-4 sm:px-8 lg:px-14 grid grid-cols-1 lg:grid-cols-4 gap-12 relative z-10">
        {/* Filtros Lateral */}
        <aside className="lg:col-span-1 space-y-10">
          <div className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 flex items-center gap-2">
              <SearchCode className="h-4 w-4 text-primary" /> Busca Global
            </h3>
            <div className="relative group">
              <div className="absolute -inset-1 bg-primary/10 rounded-2xl blur opacity-0 group-hover:opacity-100 transition duration-500"></div>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                <Input
                  placeholder="Título, tema, especialidade..."
                  className="pl-12 bg-white/5 border-white/10 h-12 rounded-2xl focus:ring-primary focus:border-primary transition-all text-sm font-medium"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 flex items-center gap-2">
              <Filter className="h-4 w-4 text-primary" /> Filtros Acadêmicos
            </h3>
            <div className="space-y-3">
              <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
                <SelectTrigger className="bg-white/5 border-white/10 h-12 rounded-2xl font-bold">
                  <SelectValue placeholder="Especialidade" />
                </SelectTrigger>
                <SelectContent className="bg-[#0a0a0e] border-white/10 rounded-2xl">
                  <SelectItem value="all">Todas Especialidades</SelectItem>
                  {specialties.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
                <SelectTrigger className="bg-white/5 border-white/10 h-12 rounded-2xl font-bold">
                  <SelectValue placeholder="Dificuldade" />
                </SelectTrigger>
                <SelectContent className="bg-[#0a0a0e] border-white/10 rounded-2xl">
                  <SelectItem value="all">Todos os Níveis</SelectItem>
                  <SelectItem value="beginner">Iniciante</SelectItem>
                  <SelectItem value="intermediate">Intermediário</SelectItem>
                  <SelectItem value="advanced">Avançado</SelectItem>
                </SelectContent>
              </Select>

              <Select value={durationFilter} onValueChange={setDurationFilter}>
                <SelectTrigger className="bg-white/5 border-white/10 h-12 rounded-2xl font-bold">
                  <SelectValue placeholder="Duração" />
                </SelectTrigger>
                <SelectContent className="bg-[#0a0a0e] border-white/10 rounded-2xl">
                  <SelectItem value="all">Qualquer Duração</SelectItem>
                  <SelectItem value="short">{"Curto (< 10min)"}</SelectItem>
                  <SelectItem value="medium">{"Médio (10-30min)"}</SelectItem>
                  <SelectItem value="long">{"Longo (> 30min)"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" /> Modos de Entrega
            </h3>
            <div className="grid grid-cols-1 gap-2">
              <Button 
                variant={examSprintOnly ? "default" : "outline"} 
                className={cn(
                  "justify-start gap-3 h-12 rounded-2xl border-white/10 font-bold transition-all", 
                  examSprintOnly ? "bg-orange-500 hover:bg-orange-600 shadow-[0_0_20px_rgba(249,115,22,0.3)]" : "bg-white/5 hover:bg-white/10"
                )}
                onClick={() => setExamSprintOnly(!examSprintOnly)}
              >
                <Flame className={cn("h-4 w-4", examSprintOnly ? "text-white" : "text-orange-500")} /> Exam Sprint
              </Button>
              <Button 
                variant={recoveryOnly ? "default" : "outline"} 
                className={cn(
                  "justify-start gap-3 h-12 rounded-2xl border-white/10 font-bold transition-all", 
                  recoveryOnly ? "bg-blue-600 hover:bg-blue-700 shadow-[0_0_20px_rgba(37,99,235,0.3)]" : "bg-white/5 hover:bg-white/10"
                )}
                onClick={() => setRecoveryOnly(!recoveryOnly)}
              >
                <RotateCcw className={cn("h-4 w-4", recoveryOnly ? "text-white" : "text-blue-500")} /> Recovery Mode
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Filtros ACE
            </h3>
            <div className="grid grid-cols-1 gap-2">
              <Button 
                variant={activeCategory === "recommended" ? "default" : "outline"} 
                className={cn("justify-start gap-3 h-12 rounded-2xl border-white/10 font-bold transition-all", activeCategory === "recommended" ? "bg-primary" : "bg-white/5 hover:bg-white/10")}
                onClick={() => setActiveCategory("recommended")}
              >
                <Sparkles className="h-4 w-4 text-yellow-500" /> Recomendado IA
              </Button>
              <Button 
                variant={activeCategory === "fsrs" ? "default" : "outline"} 
                className={cn("justify-start gap-3 h-12 rounded-2xl border-white/10 font-bold transition-all", activeCategory === "fsrs" ? "bg-primary" : "bg-white/5 hover:bg-white/10")}
                onClick={() => setActiveCategory("fsrs")}
              >
                <History className="h-4 w-4 text-blue-500" /> Revisão Pendente
              </Button>
            </div>
          </div>
        </aside>

        <main className="lg:col-span-3 space-y-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white/5 p-5 rounded-3xl border border-white/5 backdrop-blur-xl shadow-inner">
            <Tabs value={activeCategory} onValueChange={setActiveCategory} className="w-full md:w-auto">
              <TabsList className="bg-black/40 border border-white/5 p-1 h-11 rounded-2xl">
                <TabsTrigger value="all" className="rounded-xl px-4 font-bold data-[state=active]:bg-primary">Todas</TabsTrigger>
                <TabsTrigger value="gold" className="rounded-xl px-4 font-bold data-[state=active]:bg-yellow-500 data-[state=active]:text-black">Ouro</TabsTrigger>
                <TabsTrigger value="exam_sprint" className="rounded-xl px-4 font-bold data-[state=active]:bg-orange-500">Sprint</TabsTrigger>
                <TabsTrigger value="recovery" className="rounded-xl px-4 font-bold data-[state=active]:bg-blue-600">Recovery</TabsTrigger>
                <TabsTrigger value="low_mastery" className="rounded-xl px-4 font-bold data-[state=active]:bg-primary">Baixa Maestria</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-3 self-end md:self-auto">
              <span className="text-[10px] font-black uppercase tracking-wider text-white/40 flex items-center gap-1.5">
                <ArrowUpDown className="h-3.5 w-3.5 text-primary" /> Ordenar:
              </span>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[180px] bg-white/5 border-white/10 h-10 rounded-xl text-xs font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0a0a0e] border-white/10 rounded-2xl">
                  <SelectItem value="recent">Mais Recentes</SelectItem>
                  <SelectItem value="watched">Mais Assistidas</SelectItem>
                  <SelectItem value="retention">Maior Retenção</SelectItem>
                  <SelectItem value="score">Maior Score CME</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-video rounded-3xl bg-white/5 animate-pulse" />
              ))
            ) : filteredLessons.length === 0 ? (
              <div className="col-span-full py-32 text-center space-y-6">
                <div className="h-24 w-24 bg-white/5 rounded-full flex items-center justify-center mx-auto text-white/10 shadow-inner">
                  <Video className="h-12 w-12" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white tracking-tight">Nenhum resultado</h3>
                  <p className="text-white/40 font-medium">IA não localizou conteúdos para estes critérios.</p>
                </div>
              </div>
            ) : (
              filteredLessons.map((lesson) => (
                <EnaflixCard
                  key={lesson.id}
                  title={lesson.title}
                  subtitle={lesson.topic}
                  image={lesson.thumbnail_url}
                  badge={lesson.is_gold_content ? "Ouro" : (lesson as any).cme_profile === 'exam_sprint' ? "Sprint" : undefined}
                  progress={getLessonProgress(lesson.id)}
                  onClick={() => navigate(`/dashboard/videoaulas/${lesson.id}`)}
                />
              ))
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

// ExploreLessonCard removed as EnaflixCard is now used directly.

// Placeholder for missing icons
const BrainCircuit = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="24" 
    height="24" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .52 8.245 4 4 0 0 0 7.837 1.86" />
    <path d="M9 13a4.5 4.5 0 0 0 3-4" />
    <path d="M6.003 5.125A3 3 0 0 0 12 5" />
    <path d="M12 16a5 5 0 0 1 10-5" />
    <path d="M15 13a2 2 0 1 0 2 2" />
    <path d="M19 7a2 2 0 1 0 2 2" />
    <circle cx="12" cy="12" r="2" />
    <path d="M12 14v4" />
    <circle cx="12" cy="19" r="1" />
    <path d="M16 12h4" />
    <circle cx="21" cy="12" r="1" />
    <path d="M12 10V6" />
    <circle cx="12" cy="5" r="1" />
    <path d="M8 12H4" />
    <circle cx="3" cy="12" r="1" />
  </svg>
);

export default VideoLessonsExplore;
