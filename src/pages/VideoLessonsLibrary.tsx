import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Search, 
  Filter, 
  Clock, 
  Play, 
  BookOpen, 
  Award,
  ChevronRight,
  TrendingUp,
  History,
  CheckCircle2,
  Stethoscope,
  GraduationCap,
  Video,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EnaflixBackgroundFX } from "@/components/enaflix/EnaflixBackgroundFX";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
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

const VideoLessonsLibrary = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [specialtyFilter, setSpecialtyFilter] = useState("all");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const navigate = useNavigate();

  const { data: lessons, isLoading } = useQuery({
    queryKey: ["student-video-lessons"],
    queryFn: async () => {
      const { data: memoryData } = await supabase
        .from("tutor_lesson_memory")
        .select("*")
        .eq("status", "published")
        .eq("hidden_from_student", false);

      const { data, error } = await supabase
        .from("ai_video_lessons")
        .select("*")
        .eq("status", "published")
        .order("published_at", { ascending: false });

      if (error) {
        toast.error("Erro ao carregar biblioteca: " + error.message);
        throw error;
      }

      // Merge and standardize
      const standardLessons = (data || []).map(l => ({ ...l, duration: l.duration_seconds }));
      const memoryLessons = (memoryData || []).map(l => ({ ...l, specialty: l.subject }));
      
      return [...standardLessons, ...memoryLessons].sort((a, b) => 
        new Date(b.published_at || b.created_at).getTime() - new Date(a.published_at || a.created_at).getTime()
      );
    }

  });

  const { data: usageLogs } = useQuery({
    queryKey: ["video-lessons-usage"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      const { data: progressData } = await supabase
        .from("tutor_lesson_progress")
        .select("lesson_id, progress_percent")
        .eq("user_id", user.id);

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

  const filteredLessons = lessons?.filter(lesson => {
    const title = lesson.title || "";
    const specialty = (lesson as any).specialty || "";
    const topic = lesson.topic || "";
    const difficulty = (lesson as any).difficulty_level || "intermediate";
    const isGold = (lesson as any).is_gold_content || false;

    const matchesSearch = title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         specialty.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         topic.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSpecialty = specialtyFilter === "all" || specialty === specialtyFilter;
    const matchesDifficulty = difficultyFilter === "all" || difficulty === difficultyFilter;
    
    if (activeTab === "all") return matchesSearch && matchesSpecialty && matchesDifficulty;
    if (activeTab === "gold") return matchesSearch && matchesSpecialty && matchesDifficulty && isGold;
    
    return matchesSearch && matchesSpecialty && matchesDifficulty;
  });


  const specialties = Array.from(new Set(lessons?.map(l => (l as any).specialty) || []));

  return (
    <div className="pb-32 pt-12 space-y-12 relative min-h-screen overflow-x-hidden">
      <EnaflixBackgroundFX intensity="medium" />
      
      <div className="px-4 sm:px-8 lg:px-14 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-2">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <div className="h-2 w-10 bg-gradient-to-r from-primary to-accent rounded-full" />
            <span className="text-[11px] font-black uppercase tracking-[0.4em] text-white/50">Minha Biblioteca</span>
          </motion.div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tighter text-white leading-none">
            Minhas <span className="gradient-text">Videoaulas</span>
          </h1>
          <p className="text-white/50 text-lg max-w-2xl font-medium">Conteúdo médico multimodal com Tutor IA e FSRS integrado.</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="secondary" className="px-3 py-1 gap-1 cursor-pointer" onClick={() => navigate("/dashboard/mission")}>
            <History className="h-3 w-3" /> Revisões FSRS
          </Badge>
          <Badge variant="secondary" className="px-3 py-1 gap-1">
            <CheckCircle2 className="h-3 w-3" /> {lessons?.length || 0} Aulas Disponíveis
          </Badge>
        </div>
      </div>

      <div className="px-4 sm:px-8 lg:px-14 grid grid-cols-1 md:grid-cols-3 gap-12 relative z-10">
        <div className="md:col-span-2 space-y-6">
          <div className="flex flex-col gap-4">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="O que você quer aprender hoje? (ex: Cardiologia, Diabetes...)"
                  className="pl-10 h-12 text-lg shadow-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button size="lg" className="h-12 px-6 gap-2" variant="outline" onClick={() => navigate("/dashboard/videoaulas/explorar")}>
                <Filter className="h-5 w-5" /> Filtros Avançados
              </Button>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
                <SelectTrigger className="w-[160px]">
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
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Dificuldade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Níveis</SelectItem>
                  <SelectItem value="beginner">Iniciante</SelectItem>
                  <SelectItem value="intermediate">Intermediário</SelectItem>
                  <SelectItem value="advanced">Avançado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-3 h-12">
              <TabsTrigger value="all" className="text-base">Todas</TabsTrigger>
              <TabsTrigger value="trending" className="text-base">Em Alta</TabsTrigger>
              <TabsTrigger value="gold" className="text-base gap-2">
                <Award className="h-4 w-4 text-yellow-500" /> Conteúdo Ouro
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-[300px] rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredLessons?.length === 0 ? (
                <div className="col-span-full py-20 text-center">
                  <Video className="h-16 w-16 mx-auto text-muted mb-4" />
                  <h3 className="text-xl font-medium">Nenhuma aula encontrada</h3>
                  <p className="text-muted-foreground">Tente ajustar seus filtros ou busca.</p>
                </div>
              ) : (
                filteredLessons?.map((lesson) => {
                  const progress = getLessonProgress(lesson.id);
                  const isGold = (lesson as any).is_gold_content;
                  const duration = lesson.duration || (lesson as any).duration_seconds || 900;
                  const specialty = (lesson as any).specialty;

                  return (
                    <Card 
                      key={lesson.id} 
                      className={`group overflow-hidden hover:shadow-xl transition-all duration-300 border-primary/10 cursor-pointer ${isGold ? 'ring-1 ring-yellow-400/50' : ''}`} 
                      onClick={() => navigate(`/dashboard/videoaulas/${lesson.id}`)}
                    >
                      <div className="relative aspect-video bg-muted overflow-hidden">
                        {lesson.thumbnail_url ? (
                          <img 
                            src={lesson.thumbnail_url} 
                            alt={lesson.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-primary/5">
                            <Stethoscope className="h-12 w-12 text-primary/20" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="h-14 w-14 rounded-full bg-primary flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                            <Play className="h-6 w-6 text-white fill-white ml-1" />
                          </div>
                        </div>
                        <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                          {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}
                        </div>
                        <Badge className="absolute top-2 left-2 bg-primary/90">
                          {specialty}
                        </Badge>
                        {isGold && (
                          <Badge className="absolute top-2 right-2 bg-yellow-500 text-black gap-1">
                            <Sparkles className="h-3 w-3" /> Conteúdo Ouro
                          </Badge>
                        )}
                      </div>
                      <CardHeader className="p-4 space-y-1">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-lg line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                            {lesson.title}
                          </CardTitle>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {lesson.topic} • {lesson.subtopic || 'Geral'}
                        </p>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Progresso</span>
                            <span>{Math.floor(progress)}%</span>
                          </div>
                          <Progress value={progress} className="h-1.5" />
                        </div>
                      </CardContent>
                      <CardFooter className="p-4 pt-0 flex justify-between items-center">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <GraduationCap className="h-3 w-3" />
                          <span>Tutor IA</span>
                        </div>
                        <Button variant="ghost" size="sm" className="gap-1 px-0 hover:bg-transparent hover:text-primary">
                          {progress > 0 ? 'Continuar Aula' : 'Assistir Agora'} <ChevronRight className="h-4 w-4" />
                        </Button>
                      </CardFooter>
                    </Card>
                  );
                })

              )}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Destaques da Semana
              </CardTitle>
              <CardDescription>Videoaulas mais assistidas pela comunidade ENAZIZI.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {lessons?.slice(0, 3).map(lesson => (
                <div 
                  key={lesson.id} 
                  className="flex gap-3 items-center group cursor-pointer"
                  onClick={() => navigate(`/dashboard/videoaulas/${lesson.id}`)}
                >
                  <div className="w-16 h-10 rounded bg-muted flex-shrink-0 overflow-hidden">
                    {lesson.thumbnail_url && <img src={lesson.thumbnail_url} className="w-full h-full object-cover" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium line-clamp-1 group-hover:text-primary transition-colors">{lesson.title}</p>
                    <p className="text-xs text-muted-foreground">{(lesson as any).specialty} • {Math.floor((lesson.duration || (lesson as any).duration_seconds || 900) / 60)}min</p>
                  </div>
                </div>
              ))}
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full">Ver todos os destaques</Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="h-5 w-5 text-primary" />
                Minhas Categorias
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {specialties.map(s => (
                <Badge 
                  key={s} 
                  variant={specialtyFilter === s ? "default" : "outline"} 
                  className="cursor-pointer transition-colors"
                  onClick={() => setSpecialtyFilter(s)}
                >
                  {s}
                </Badge>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default VideoLessonsLibrary;
