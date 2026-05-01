import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { validateVideoLessonPublication } from "@/lib/multimodal-qa";
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
  ShieldAlert
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
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const VideoLessonsAdmin = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [specialtyFilter, setSpecialtyFilter] = useState("all");
  const [mediaFilter, setMediaFilter] = useState("all");

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

  const handleStatusChange = async (id: string, newStatus: string) => {
    if (newStatus === 'published') {
      const validation = await validateVideoLessonPublication(id);
      if (!validation.valid) {
        toast.error("Publicação bloqueada", {
          description: validation.errors.join(", "),
          duration: 5000
        });
        return;
      }
    }

    const { error } = await supabase
      .from("ai_video_lessons")
      .update({ 
        status: newStatus, 
        updated_at: new Date().toISOString(),
        published_at: newStatus === 'published' ? new Date().toISOString() : undefined,
      } as any)
      .eq("id", id);

    if (error) {
      toast.error("Erro ao atualizar status: " + error.message);
    } else {
      toast.success(`Status atualizado para ${newStatus}!`);
      refetch();
    }
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
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Biblioteca de Videoaulas IA v1.5</h1>
          <p className="text-muted-foreground">Governança e auditoria de conteúdos multimídia médicos.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2 border-red-500/20 text-red-500" onClick={() => navigate('/admin/cme-status')}>
            <Activity className="h-4 w-4" /> CME Status {stats.critical > 0 && <Badge variant="destructive" className="h-4 px-1 ml-1">{stats.critical}</Badge>}
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => navigate('/admin/cme-incidents')}>
            <ShieldAlert className="h-4 w-4 text-orange-500" /> Incidentes
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => navigate('/admin/notebooklm-analytics')}>
            <BarChart3 className="h-4 w-4" /> Analytics
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => navigate('/admin/notebooklm-sync')}>
            <ExternalLink className="h-4 w-4" /> NotebookLM Sync
          </Button>
          <Button className="gap-2" onClick={() => navigate('/admin/ai-studio')}>
            <Plus className="h-4 w-4" /> Nova Videoaula (AI Studio)
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total de Aulas</CardTitle>
            <Video className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Aguardando Vídeo</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.waitingVideo}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Em Revisão</CardTitle>
            <ShieldCheck className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.waitingReview}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Publicadas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.published}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
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
                                <Star className={`h-4 w-4 ${lesson.is_gold_content ? 'fill-yellow-500 text-yellow-500' : ''}`} /> 
                                {lesson.is_gold_content ? 'Remover Destaque' : 'Destacar (Ouro)'}
                              </DropdownMenuItem>
                              {lesson.status === 'video_review' && (
                                <DropdownMenuItem 
                                  className="gap-2 text-green-600"
                                  onClick={() => handleStatusChange(lesson.id, 'approved')}
                                >
                                  <CheckCircle2 className="h-4 w-4" /> Aprovar Vídeo
                                </DropdownMenuItem>
                              )}
                              {(lesson.status === 'approved' || lesson.status === 'draft') && (
                                <DropdownMenuItem 
                                  className="gap-2 text-blue-600"
                                  onClick={() => handleStatusChange(lesson.id, 'published')}
                                >
                                  <ExternalLink className="h-4 w-4" /> Publicar Aula
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem className="gap-2 text-red-600">
                                <AlertCircle className="h-4 w-4" /> Arquivar
                              </DropdownMenuItem>
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
    </div>
  );
};

export default VideoLessonsAdmin;
