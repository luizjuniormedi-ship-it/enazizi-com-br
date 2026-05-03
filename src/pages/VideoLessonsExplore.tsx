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

  const { data: lessons, isLoading } = useQuery({
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

      const { data: memoryData } = await supabase
        .from("tutor_lesson_memory")
        .select("*")
        .eq("status", "published")
        .eq("hidden_from_student", false);

      const memoryLessons = (memoryData || []).map((l: any) => ({
        ...l,
        specialty: l.subject,
        duration_seconds: l.duration || 900,
        difficulty_level: "intermediate",
      }));

      return [...(data || []), ...memoryLessons].sort(
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

  const specialties = Array.from(new Set(lessons?.map(l => l.specialty) || []));

  return (
    <div className="pb-32 pt-12 space-y-12 relative min-h-screen overflow-x-hidden">
      <EnaflixBackgroundFX intensity="high" />
      
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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Filtros Lateral */}
        <aside className="lg:col-span-1 space-y-8">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-white/40 uppercase tracking-widest flex items-center gap-2">
              <SearchCode className="h-4 w-4" /> Busca Global
            </h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              <Input
                placeholder="Título, tema, especialidade..."
                className="pl-10 bg-white/5 border-white/10 h-11 focus:ring-primary"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-white/40 uppercase tracking-widest flex items-center gap-2">
              <Filter className="h-4 w-4" /> Filtros Acadêmicos
            </h3>
            <div className="space-y-3">
              <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
                <SelectTrigger className="bg-white/5 border-white/10 h-11">
                  <SelectValue placeholder="Especialidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas Especialidades</SelectItem>
                  {specialties.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
                <SelectTrigger className="bg-white/5 border-white/10 h-11">
                  <SelectValue placeholder="Dificuldade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Níveis</SelectItem>
                  <SelectItem value="beginner">Iniciante</SelectItem>
                  <SelectItem value="intermediate">Intermediário</SelectItem>
                  <SelectItem value="advanced">Avançado</SelectItem>
                </SelectContent>
              </Select>

              <Select value={durationFilter} onValueChange={setDurationFilter}>
                <SelectTrigger className="bg-white/5 border-white/10 h-11">
                  <SelectValue placeholder="Duração" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Qualquer Duração</SelectItem>
                  <SelectItem value="short">{"Curto (< 10min)"}</SelectItem>
                  <SelectItem value="medium">{"Médio (10-30min)"}</SelectItem>
                  <SelectItem value="long">{"Longo (> 30min)"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-white/40 uppercase tracking-widest flex items-center gap-2">
              <Zap className="h-4 w-4" /> Modos de Entrega
            </h3>
            <div className="grid grid-cols-1 gap-2">
              <Button 
                variant={examSprintOnly ? "default" : "outline"} 
                className={cn("justify-start gap-3 h-11 border-white/10", examSprintOnly && "bg-orange-500 hover:bg-orange-600")}
                onClick={() => setExamSprintOnly(!examSprintOnly)}
              >
                <Flame className="h-4 w-4" /> Exam Sprint
              </Button>
              <Button 
                variant={recoveryOnly ? "default" : "outline"} 
                className={cn("justify-start gap-3 h-11 border-white/10", recoveryOnly && "bg-blue-600 hover:bg-blue-700")}
                onClick={() => setRecoveryOnly(!recoveryOnly)}
              >
                <RotateCcw className="h-4 w-4" /> Recovery Mode
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-white/40 uppercase tracking-widest flex items-center gap-2">
              <Activity className="h-4 w-4" /> Filtros Cognitivos (ACE)
            </h3>
            <div className="grid grid-cols-1 gap-2">
              <Button 
                variant={activeCategory === "recommended" ? "default" : "outline"} 
                className="justify-start gap-3 h-11 border-white/10"
                onClick={() => setActiveCategory("recommended")}
              >
                <Sparkles className="h-4 w-4 text-yellow-500" /> Recomendado pelo ACE
              </Button>
              <Button 
                variant={activeCategory === "fsrs" ? "default" : "outline"} 
                className="justify-start gap-3 h-11 border-white/10"
                onClick={() => setActiveCategory("fsrs")}
              >
                <History className="h-4 w-4 text-blue-500" /> Revisão FSRS Pendente
              </Button>
              <Button 
                variant={activeCategory === "friction" ? "default" : "outline"} 
                className="justify-start gap-3 h-11 border-white/10"
                onClick={() => setActiveCategory("friction")}
              >
                <Zap className="h-4 w-4 text-red-500" /> Alto Atrito Cognitivo
              </Button>
            </div>
          </div>

          <div className="pt-6 border-t border-white/5">
             <Card className="bg-primary/5 border-primary/20">
               <CardHeader className="p-4">
                 <CardTitle className="text-sm font-bold flex items-center gap-2">
                   <Flame className="h-4 w-4 text-orange-500" /> Exam Sprint
                 </CardTitle>
               </CardHeader>
               <CardContent className="p-4 pt-0">
                 <p className="text-xs text-white/50 mb-3">Revisões ultrarrápidas de véspera com foco em alto rendimento.</p>
                 <Button size="sm" className="w-full bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30" onClick={() => setActiveCategory("exam_sprint")}>
                   Ver Sprints
                 </Button>
               </CardContent>
             </Card>
          </div>
        </aside>

        {/* Grid de Resultados */}
        <main className="lg:col-span-3 space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/10">
            <Tabs value={activeCategory} onValueChange={setActiveCategory} className="w-full md:w-auto">
              <TabsList className="bg-black/40 border border-white/10">
                <TabsTrigger value="all">Todas</TabsTrigger>
                <TabsTrigger value="gold">Conteúdo Ouro</TabsTrigger>
                <TabsTrigger value="exam_sprint">Exam Sprint</TabsTrigger>
                <TabsTrigger value="recovery">Recovery Mode</TabsTrigger>
                <TabsTrigger value="low_mastery">Baixa Maestria</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-3 self-end md:self-auto">
              <span className="text-xs text-white/40 flex items-center gap-1">
                <ArrowUpDown className="h-3 w-3" /> Ordenar por:
              </span>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[160px] bg-transparent border-white/10 h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Mais Recentes</SelectItem>
                  <SelectItem value="watched">Mais Assistidas</SelectItem>
                  <SelectItem value="retention">Maior Retenção</SelectItem>
                  <SelectItem value="score">Maior Score CME</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-video rounded-2xl bg-white/5 animate-pulse" />
              ))
            ) : filteredLessons.length === 0 ? (
              <div className="col-span-full py-20 text-center space-y-4">
                <div className="h-20 w-20 bg-white/5 rounded-full flex items-center justify-center mx-auto text-white/20">
                  <Video className="h-10 w-10" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Nenhum resultado</h3>
                  <p className="text-white/40">Tente ajustar seus filtros para encontrar o que procura.</p>
                </div>
              </div>
            ) : (
              filteredLessons.map((lesson) => (
                <ExploreLessonCard 
                  key={lesson.id} 
                  lesson={lesson} 
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

const ExploreLessonCard = ({ lesson, progress, onClick }: { lesson: any, progress: number, onClick: () => void }) => {
  return (
    <Card 
      className="group bg-white/5 border-white/10 overflow-hidden hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500 cursor-pointer"
      onClick={onClick}
    >
      <div className="relative aspect-video overflow-hidden">
        {lesson.thumbnail_url ? (
          <img 
            src={lesson.thumbnail_url} 
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
            alt={lesson.title} 
          />
        ) : (
          <div className="w-full h-full bg-primary/5 flex items-center justify-center">
            <Stethoscope className="h-10 w-10 text-primary/20" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
        
        <div className="absolute top-2 left-2 flex gap-1">
          <Badge className="bg-primary/80 backdrop-blur-md text-[10px] h-5">{lesson.specialty}</Badge>
          {lesson.is_gold_content && (
            <Badge className="bg-yellow-500 text-black text-[10px] h-5 gap-1">
              <Sparkles className="h-2 w-2" /> OURO
            </Badge>
          )}
        </div>

        <div className="absolute bottom-2 right-2 text-[10px] bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-white/80">
          {Math.floor(lesson.duration_seconds / 60)}:{(lesson.duration_seconds % 60).toString().padStart(2, '0')}
        </div>
        
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-[2px]">
           <div className="h-12 w-12 bg-primary rounded-full flex items-center justify-center scale-90 group-hover:scale-100 transition-transform shadow-xl">
             <Play className="h-5 w-5 fill-white ml-0.5" />
           </div>
        </div>
      </div>

      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base line-clamp-1 group-hover:text-primary transition-colors">{lesson.title}</CardTitle>
        <p className="text-xs text-white/40 line-clamp-1">{lesson.topic}</p>
      </CardHeader>

      <CardContent className="p-4 pt-0 space-y-3">
        <div className="flex justify-between items-center text-[10px] text-white/30">
          <span className="flex items-center gap-1"><BarChart3 className="h-3 w-3" /> CME: {lesson.cme_score || '8.5'}</span>
          <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> Retenção: {lesson.avg_retention || '92'}%</span>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-white/40">
            <span>Progresso</span>
            <span>{Math.floor(progress)}%</span>
          </div>
          <Progress value={progress} className="h-1 bg-white/5" />
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0 flex justify-between">
         <div className="flex gap-1">
           {(lesson as any).cme_profile === 'exam_sprint' && <Badge variant="outline" className="text-[9px] border-orange-500/30 text-orange-500">Sprint</Badge>}
           {(lesson as any).has_feynman && <Badge variant="outline" className="text-[9px] border-blue-500/30 text-blue-500">Feynman</Badge>}
         </div>
         <Button variant="ghost" size="sm" className="h-7 text-[10px] px-0 hover:bg-transparent hover:text-primary gap-1">
           {progress > 0 ? 'Continuar' : 'Assistir'} <ChevronRight className="h-3 w-3" />
         </Button>
      </CardFooter>
    </Card>
  );
};

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
