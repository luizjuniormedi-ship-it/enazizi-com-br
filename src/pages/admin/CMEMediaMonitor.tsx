import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Activity, 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  Database, 
  Globe, 
  Server, 
  AlertTriangle,
  RefreshCcw,
  BarChart3,
  Search,
  Filter,
  Play,
  History,
  AlertOctagon,
  Settings2,
  Zap
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";

const CMEMediaMonitor = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: lessons, isLoading: isLoadingLessons, refetch } = useQuery({
    queryKey: ["cme-media-monitor-lessons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_video_lessons")
        .select(`
          id, title, specialty, media_status, status, video_url, hls_url, health_score, 
          pipeline_last_error, last_validation_at, cme_project_id
        `)
        .order("health_score", { ascending: true });
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000 
  });

  const { data: auditLogs } = useQuery({
    queryKey: ["cme-playback-audit-summary"],
    queryFn: async () => {
      // @ts-ignore
      const { data, error } = await supabase
        .from("cme_playback_audit_logs" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) return [];
      return data;
    }
  });

  const handleReprocess = async (lesson: any) => {
    toast.loading(`Iniciando re-renderização de ${lesson.title}...`);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Ação permitida apenas para administradores autenticados.");

      const newProjectId = crypto.randomUUID();
      
      // 1. Criar novo projeto cinematográfico
      const { error: projectError } = await supabase
        .from("cme_video_projects" as any)
        .insert({
          id: newProjectId,
          title: `Reprocessamento: ${lesson.title}`,
          status: 'active',
          target_audience: 'medical_students',
          user_id: user.id
        } as any);

      if (projectError) throw projectError;

      // 2. Atualizar aula
      const { error: lessonError } = await supabase
        .from("ai_video_lessons")
        .update({
          media_status: 'rendering',
          video_url: null,
          hls_url: null,
          playback_url: null,
          cme_project_id: newProjectId,
          health_score: 0,
          pipeline_last_error: null
        } as any)
        .eq("id", lesson.id);

      if (lessonError) throw lessonError;

      // 3. Criar job de render
      const { error: jobError } = await supabase
        .from("cme_render_jobs" as any)
        .insert({
          project_id: newProjectId,
          render_type: 'cinematic_v2',
          render_mode: 'autonomous_director',
          status: 'processing',
          render_stage: 'scene_generation',
          priority: 20,
          gpu_required: true,
          user_id: user.id
        } as any);

      if (jobError) throw jobError;

      // 4. Registrar pedido de reprocessamento
      // @ts-ignore
      await supabase.from("cme_media_reprocessing_jobs").insert({
        video_lesson_id: lesson.id,
        previous_media_status: lesson.media_status,
        previous_error: lesson.pipeline_last_error,
        status: 'processing'
      } as any);

      toast.dismiss();
      toast.success("Reprocessamento enviado ao cluster GPU!");
      refetch();
    } catch (err: any) {
      toast.dismiss();
      toast.error("Falha ao reprocessar: " + err.message);
    }
  };

  const filteredLessons = lessons?.filter(l => 
    l.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    l.specialty.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    noMedia: lessons?.filter(l => !l.video_url && !l.hls_url && l.status === 'published').length || 0,
    placeholders: lessons?.filter(l => l.video_url?.includes('example.com') || l.video_url?.includes('gtv-videos-bucket')).length || 0,
    critical: lessons?.filter(l => (l.health_score || 0) <= 50).length || 0,
    rendering: lessons?.filter(l => l.media_status === 'rendering' || l.media_status === 'processing').length || 0
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Zap className="h-8 w-8 text-amber-500" />
            CME Media Monitor
          </h1>
          <p className="text-muted-foreground">Auditoria de playback, monitoramento de CDN e controle de renderização GPU.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => refetch()}>
            <RefreshCcw className="h-4 w-4" /> Refresh
          </Button>
          <Button variant="outline" onClick={() => navigate('/admin/video-lessons')}>
            Biblioteca Admin
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-red-500/20 bg-red-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600 flex items-center justify-between">
              Sem Mídia (Publicadas)
              <AlertOctagon className="h-4 w-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">{stats.noMedia}</div>
          </CardContent>
        </Card>

        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-600 flex items-center justify-between">
              Mídia Placeholder
              <AlertTriangle className="h-4 w-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700">{stats.placeholders}</div>
          </CardContent>
        </Card>

        <Card className="border-orange-500/20 bg-orange-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-600 flex items-center justify-between">
              Health Score Crítico
              <ShieldAlert className="h-4 w-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700">{stats.critical}</div>
          </CardContent>
        </Card>

        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-600 flex items-center justify-between">
              Em Renderização (Cluster)
              <Activity className="h-4 w-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">{stats.rendering}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="inventory" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="inventory">Inventário de Mídia</TabsTrigger>
          <TabsTrigger value="audit">Logs de Playback</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Audit de Mídia em Tempo Real</CardTitle>
                  <CardDescription>Status das videoaulas e integridade dos arquivos.</CardDescription>
                </div>
                <div className="relative w-72">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Filtrar aulas..."
                    className="pl-8"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Videoaula</TableHead>
                    <TableHead>Mídia</TableHead>
                    <TableHead>Saúde</TableHead>
                    <TableHead>Status Render</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingLessons ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10">Sincronizando infraestrutura...</TableCell>
                    </TableRow>
                  ) : filteredLessons?.map((lesson) => {
                    const isPlaceholder = lesson.video_url?.includes('gtv-videos-bucket') || lesson.video_url?.includes('example.com');
                    return (
                      <TableRow key={lesson.id}>
                        <TableCell>
                          <div className="font-bold text-sm">{lesson.title}</div>
                          <div className="text-[10px] text-muted-foreground uppercase">{lesson.specialty}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {lesson.video_url || lesson.hls_url ? (
                              <Badge variant={isPlaceholder ? "outline" : "secondary"} className={cn("text-[10px]", isPlaceholder && "text-amber-500 border-amber-500/30")}>
                                {isPlaceholder ? "Placeholder" : "Real Media"}
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="text-[10px]">Sem Mídia</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={lesson.health_score} className={cn("h-1 w-12", lesson.health_score < 50 ? "bg-red-200" : "bg-emerald-100")} />
                            <span className={cn("text-xs font-bold", lesson.health_score < 50 ? "text-red-500" : "text-emerald-600")}>
                              {lesson.health_score}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(
                            "text-[10px] uppercase",
                            lesson.media_status === 'rendering' ? "text-blue-500 border-blue-500 animate-pulse" :
                            lesson.media_status === 'ready' ? "text-emerald-500 border-emerald-500" : ""
                          )}>
                            {lesson.media_status || 'draft'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" className="h-8 gap-2" onClick={() => handleReprocess(lesson)}>
                              <RefreshCcw className="h-3 w-3" /> Reprocessar
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open(`/videoaulas/${lesson.id}`, '_blank')}>
                              <Play className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Auditoria Global de Playback</CardTitle>
              <CardDescription>Últimos 20 eventos de inicialização do player capturados via telemetria.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {auditLogs?.map((log: any) => (
                  <div key={log.id} className="flex items-start justify-between p-3 border rounded-lg bg-slate-900/10">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={log.player_state === 'ready' || log.player_state === 'playback_started' ? "default" : "destructive"} className="text-[10px]">
                          {log.player_state}
                        </Badge>
                        <span className="text-xs font-bold truncate max-w-[200px]">
                          Lesson ID: {log.video_lesson_id}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[400px]">
                        URL: {log.selected_url || 'N/A'}
                      </p>
                      {log.error_message && (
                        <p className="text-[10px] text-red-500 italic bg-red-500/5 p-1 rounded">
                          Err: {log.error_message}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-bold">{log.load_time_ms}ms load</div>
                      <div className="text-[10px] text-muted-foreground">{new Date(log.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CMEMediaMonitor;
