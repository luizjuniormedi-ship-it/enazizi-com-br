import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { validateVideoLessonPublication } from "@/lib/multimodal-qa";
import { useTutorCME } from "@/hooks/useTutorCME";
import { 
  Video, 
  Search, 
  Filter, 
  Clock, 
  BookOpen, 
  MoreVertical, 
  Plus, 
  CheckCircle2, 
  AlertCircle,
  BarChart3,
  ExternalLink,
  History,
  ShieldCheck,
  Star,
  BrainCircuit,
  Award,
  Activity,
  ShieldAlert,
  Film,
  Sparkles,
  Play,
  Settings,
  Database
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { EnaflixBackgroundFX } from "@/components/enaflix/EnaflixBackgroundFX";
import { motion } from "framer-motion";

const VideoLessonsAdmin = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [specialtyFilter, setSpecialtyFilter] = useState("all");
  const [mediaFilter, setMediaFilter] = useState("all");
  
  const { state: cmeState, transformToVideo, resetState: resetCme } = useTutorCME();

  const { data: lessons, isLoading, refetch } = useQuery({
    queryKey: ["admin-video-lessons"],

    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_video_lessons")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        toast.error("Erro ao carregar videoaulas: " + error.message);
        throw error;
      }
      return data;
    }
  });

  const { data: analytics } = useQuery({
    queryKey: ["admin-video-lessons-analytics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("video_lesson_usage_logs")
        .select("video_lesson_id, action, completion_rate");
      
      if (error) return [];
      return data;
    }
  });

  const filteredLessons = lessons?.filter(lesson => {
    const matchesSearch = lesson.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         lesson.specialty.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || lesson.status === statusFilter;
    const matchesSpecialty = specialtyFilter === "all" || lesson.specialty === specialtyFilter;
    
    const playbackUrl = lesson.hls_url || lesson.video_url || lesson.playback_url;
    const hasMedia = !!playbackUrl && !playbackUrl.includes('example.com') && !playbackUrl.includes('placeholder');
    
    const matchesMedia = mediaFilter === "all" || 
                         (mediaFilter === "no_media" && !hasMedia) ||
                         (mediaFilter === "has_media" && hasMedia) ||
                         (mediaFilter === "failed" && lesson.media_status === 'failed');

    return matchesSearch && matchesStatus && matchesSpecialty && matchesMedia;
  });

  const getStatusBadge = (lesson: any) => {
    const status = lesson.status;
    const mediaStatus = lesson.media_status;
    const playbackUrl = lesson.hls_url || lesson.video_url || lesson.playback_url;
    const hasRealMedia = playbackUrl && 
                         !playbackUrl.includes('example.com') && 
                         !playbackUrl.includes('placeholder') &&
                         !playbackUrl.includes('dummy');

    const statusMap: Record<string, { label: string, color: string }> = {
      draft: { label: "Rascunho", color: "bg-gray-500" },
      tutor_lesson_saved: { label: "Aula Salva", color: "bg-blue-500" },
      exported_to_notebooklm: { label: "Exportado", color: "bg-purple-500" },
      video_generated: { label: "Vídeo Gerado", color: "bg-indigo-500" },
      video_review: { label: "Em Revisão", color: "bg-orange-500" },
      approved: { label: "Aprovado", color: "bg-green-500" },
      published: { label: "Publicado", color: "bg-emerald-600" },
      archived: { label: "Arquivado", color: "bg-slate-700" },
      failed: { label: "Erro na Renderização", color: "bg-red-600" }
    };

    const config = statusMap[status] || { label: status, color: "bg-gray-500" };
    
    return (
      <div className="flex flex-col gap-1">
        <Badge className={config.color}>{config.label}</Badge>
        {mediaStatus && (
          <Badge variant="outline" className={cn(
            "text-[10px] py-0 h-4",
            mediaStatus === 'ready' || mediaStatus === 'published' ? "border-green-500 text-green-500" :
            mediaStatus === 'failed' ? "border-red-500 text-red-500" :
            mediaStatus === 'rendering' || mediaStatus === 'processing' ? "border-amber-500 text-amber-500 animate-pulse" :
            "border-blue-500 text-blue-500"
          )}>
            Media: {mediaStatus || 'none'}
          </Badge>
        )}
        {lesson.pipeline_last_error && (
          <p className="text-[9px] text-red-400 max-w-[150px] truncate" title={lesson.pipeline_last_error}>
            Err: {lesson.pipeline_last_error}
          </p>
        )}
        {!hasRealMedia && status === 'published' && (
          <Badge variant="destructive" className="text-[10px] py-0 h-4 animate-pulse">
            Placeholder Detectado
          </Badge>
        )}
      </div>
    );
  };

  const toggleGoldContent = async (id: string, current: boolean) => {
    const { error } = await supabase
      .from("ai_video_lessons")
      .update({ is_gold_content: !current })
      .eq("id", id);
    
    if (error) toast.error("Erro ao atualizar destaque.");
    else {
      toast.success("Destaque atualizado!");
      refetch();
    }
  };

  const getEngagementMetrics = (lessonId: string) => {
    if (!analytics) return { views: 0, completion: 0 };
    const lessonLogs = analytics.filter(l => l.video_lesson_id === lessonId);
    const views = lessonLogs.filter(l => l.action === 'heartbeat' || l.action === 'play').length;
    const avgCompletion = lessonLogs.length > 0 
      ? lessonLogs.reduce((acc, curr) => acc + (Number(curr.completion_rate) || 0), 0) / lessonLogs.length 
      : 0;
    return { views, completion: Math.round(avgCompletion) };
  };

  const specialties = Array.from(new Set(lessons?.map(l => l.specialty) || []));

  const stats = {
    total: lessons?.length || 0,
    waitingVideo: lessons?.filter(l => l.status === 'exported_to_notebooklm').length || 0,
    waitingReview: lessons?.filter(l => l.status === 'video_review').length || 0,
    published: lessons?.filter(l => l.status === 'published').length || 0,
    critical: lessons?.filter(l => (l.health_score || 0) < 50).length || 0
  };

  return (
    <div className="pb-32 pt-4 sm:pt-12 relative min-h-screen">
      <EnaflixBackgroundFX intensity="intense" />
      
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
          <div className="space-y-2">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3"
            >
              <div className="h-2 w-10 bg-gradient-to-r from-primary to-accent rounded-full" />
              <span className="text-[11px] font-black uppercase tracking-[0.4em] text-white/50">Gestão de Conteúdo</span>
            </motion.div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter text-white leading-[0.9] drop-shadow-2xl">
              Biblioteca <span className="gradient-text">Studio</span>
            </h1>
            <p className="text-white/50 text-lg max-w-2xl font-medium mt-4">Governança e auditoria de conteúdos multimídia médicos.</p>
          </div>

        <div className="flex flex-wrap gap-3 relative z-10">
          <Button 
            variant="outline" 
            className="h-12 px-6 rounded-2xl bg-white/5 border-white/10 hover:bg-white/10 transition-all font-bold text-sm gap-2" 
            onClick={() => navigate('/admin/cme-status')}
          >
            <Activity className="h-4 w-4 text-primary" /> Status CME {stats.critical > 0 && <Badge variant="destructive" className="h-4 px-1.5 ml-1 rounded-full">{stats.critical}</Badge>}
          </Button>
          <Button 
            className="h-12 px-8 rounded-2xl bg-primary hover:bg-primary/90 transition-all font-black text-sm gap-2 shadow-[0_0_20px_rgba(var(--primary),0.3)]" 
            onClick={() => navigate('/admin/ai-studio')}
          >
            <Plus className="h-4 w-4" /> Novo Conteúdo
          </Button>
        </div>
      </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
          <StatsCard title="Total de Aulas" value={stats.total} icon={<Video className="h-5 w-5" />} />
          <StatsCard title="Aguardando Vídeo" value={stats.waitingVideo} icon={<Clock className="h-5 w-5 text-orange-500" />} />
          <StatsCard title="Em Revisão" value={stats.waitingReview} icon={<ShieldCheck className="h-5 w-5 text-blue-500" />} />
          <StatsCard title="Publicadas" value={stats.published} icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />} />
        </div>

        <Card className="w-full max-w-7xl mx-auto overflow-hidden">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por título ou especialidade..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Especialidade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Especialidades</SelectItem>
                    {specialties.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Status</SelectItem>
                    <SelectItem value="draft">Rascunho</SelectItem>
                    <SelectItem value="video_review">Em Revisão</SelectItem>
                    <SelectItem value="published">Publicado</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={mediaFilter} onValueChange={setMediaFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Mídia" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Mídias</SelectItem>
                    <SelectItem value="has_media">Com Mídia Real</SelectItem>
                    <SelectItem value="no_media">Sem Mídia / Placeholder</SelectItem>
                    <SelectItem value="failed">Falha na Renderização</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8">Carregando videoaulas...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Videoaula</TableHead>
                  <TableHead>Especialidade</TableHead>
                  <TableHead>Status / Visibilidade</TableHead>
                  <TableHead>Engajamento</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLessons?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhuma videoaula encontrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLessons?.map((lesson) => {
                    const metrics = getEngagementMetrics(lesson.id);
                    return (
                      <TableRow key={lesson.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {lesson.is_gold_content && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                            <div className="font-medium">{lesson.title}</div>
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <BrainCircuit className="h-3 w-3" /> {lesson.tutor_lesson_id ? 'Vinculada ao Tutor' : 'Manual'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{lesson.specialty}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {getStatusBadge(lesson)}
                            <div className="text-[10px] text-muted-foreground px-1 uppercase tracking-wider">
                              {lesson.visibility || 'Public'}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs space-y-1">
                            <div className="flex items-center gap-1">
                              <History className="h-3 w-3" /> {metrics.views} views
                            </div>
                            <div className="flex items-center gap-1">
                              <Award className="h-3 w-3 text-primary" /> {metrics.completion}% conclusão
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(lesson.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem className="gap-2" onClick={() => navigate(`/admin/video-lessons/${lesson.id}`)}>
                                <BarChart3 className="h-4 w-4" /> Detalhes & Analytics
                              </DropdownMenuItem>
                              <DropdownMenuItem className="gap-2" onClick={() => navigate('/admin/cme-status')}>
                                <Activity className="h-4 w-4" /> Ver Saúde CDN (CME)
                              </DropdownMenuItem>
                              <DropdownMenuItem className="gap-2" onClick={() => window.open(`/videoaulas/${lesson.id}`, '_blank')}>
                                <ExternalLink className="h-4 w-4" /> Visualizar (Aluno)
                              </DropdownMenuItem>
                              <DropdownMenuItem className="gap-2" onClick={() => toggleGoldContent(lesson.id, lesson.is_gold_content)}>
                                <Star className="h-4 w-4" /> {lesson.is_gold_content ? 'Remover Destaque' : 'Marcar como Ouro'}
                              </DropdownMenuItem>
                              {lesson.status === 'tutor_lesson_saved' && (
                                <DropdownMenuItem 
                                  className="gap-2 text-amber-500 font-bold" 
                                  onClick={() => transformToVideo({
                                    title: lesson.title,
                                    specialty: lesson.specialty,
                                    topic: lesson.topic,
                                    summary: lesson.tutor_lesson_summary || lesson.description || "",
                                    sourceContent: lesson.notebooklm_export_text || lesson.tutor_lesson_summary || "",
                                    blocks: [], 
                                    conversationId: lesson.tutor_session_id || crypto.randomUUID(),
                                    messageId: undefined
                                  })}
                                >
                                  <Film className="h-4 w-4" /> 🎬 Gerar Vídeo (Pipeline)
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal de Status CME */}
      <Dialog open={cmeState.status !== 'idle'} onOpenChange={(open) => !open && resetCme()}>
        <DialogContent className="sm:max-w-md bg-slate-950 border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              Fábrica de Vídeos CME
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Transformando sua aula salva em uma experiência cinematográfica multimodal.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-6 space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
                <span>Fase: {cmeState.message || cmeState.status}</span>
                <span>{cmeState.progress}%</span>
              </div>
              <Progress value={cmeState.progress} className="h-1.5 bg-white/5" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'planning', label: 'Semantic Planning' },
                { id: 'scripting', label: 'Narrative Building' },
                { id: 'graphing', label: 'Scene Graph' },
                { id: 'rendering', label: 'GPU Rendering' }
              ].map((step, idx) => (
                <div key={step.id} className={cn(
                  "flex items-center gap-2 p-2 rounded-lg border text-[10px] font-bold uppercase tracking-tight transition-all duration-300",
                  cmeState.progress > (idx * 25) || cmeState.status === step.id ? "bg-amber-500/10 border-amber-500/20 text-amber-500" : "bg-white/5 border-white/5 text-slate-600"
                )}>
                  <div className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    cmeState.status === step.id ? "bg-amber-500 animate-pulse" : 
                    cmeState.progress > (idx * 25) ? "bg-amber-500" : "bg-slate-700"
                  )} />
                  {step.label}
                </div>
              ))}
            </div>

            {cmeState.isStuck && cmeState.status === 'rendering' && (
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg space-y-1">
                <div className="flex items-center gap-2 text-blue-400 text-[10px] font-bold">
                  <AlertCircle className="h-3 w-3" />
                  WORKER OFFLINE
                </div>
                <p className="text-[9px] text-blue-300/70 italic">
                  A renderização automática requer um worker GPU real. O projeto foi preparado para o Builder.
                </p>
              </div>
            )}

            {cmeState.projectId && (
              <div className="text-[10px] text-slate-500 font-mono flex items-center gap-2">
                <div className={cn("h-1 w-1 rounded-full bg-green-500", !cmeState.isStuck && "animate-ping")} />
                TELEMETRY: {cmeState.isStuck ? 'STANDBY' : 'ACTIVE'} | ID_{cmeState.projectId.slice(0, 8)}
              </div>
            )}

            {cmeState.status === 'failed' && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs italic">
                Erro: {cmeState.error}
              </div>
            )}
          </div>

          <DialogFooter className="sm:justify-start">
            <Button
              type="button"
              variant="secondary"
              onClick={resetCme}
              className="text-xs h-8"
            >
              Fechar
            </Button>
            {cmeState.status === 'rendering' && (
              <Button
                type="button"
                className="bg-amber-600 hover:bg-amber-700 text-xs h-8 gap-2"
                onClick={() => {
                  resetCme();
                  navigate(`/admin/cinematic-engine/${cmeState.projectId}`);
                }}
              >
                <Play className="h-3 w-3" /> Ver no Monitor
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </main>
    </div>
  );
};

const StatsCard = ({ title, value, icon }: { title: string, value: number, icon: React.ReactNode }) => (
  <div className="bg-white/5 border border-white/5 rounded-3xl p-6 backdrop-blur-xl shadow-inner relative overflow-hidden group">
    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-primary">
      {icon}
    </div>
    <div className="space-y-1 relative z-10">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">{title}</p>
      <div className="text-3xl font-black text-white tracking-tighter">{value}</div>
    </div>
  </div>
);

export default VideoLessonsAdmin;