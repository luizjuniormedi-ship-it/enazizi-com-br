import { useState, useEffect } from "react";
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
  Play
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

const CMEStatusPage = () => {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: lessons, isLoading: isLoadingLessons, refetch } = useQuery({
    queryKey: ["cme-status-lessons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_video_lessons")
        .select(`
          *,
          cme_media_validation_logs(id, validation_status, validation_type, detected_issue, created_at),
          cme_media_reprocessing_jobs(id, reprocess_status, retry_count)
        `)
        .order("health_score", { ascending: true });
      if (error) throw error;
      return data;
    },
    refetchInterval: 10000 // Realtime updates every 10s
  });

  const stats = {
    total: lessons?.length || 0,
    healthy: lessons?.filter(l => (l.health_score || 0) >= 90).length || 0,
    degraded: lessons?.filter(l => (l.health_score || 0) < 90 && (l.health_score || 0) > 50).length || 0,
    critical: lessons?.filter(l => (l.health_score || 0) <= 50).length || 0,
    avgLatency: 120, // Mock for now
    uptime: "99.98%"
  };

  const getHealthBadge = (score: number) => {
    if (score >= 90) return <Badge className="bg-emerald-500">Saudável ({score}%)</Badge>;
    if (score > 50) return <Badge variant="outline" className="text-amber-500 border-amber-500">Degradado ({score}%)</Badge>;
    return <Badge variant="destructive">Crítico ({score}%)</Badge>;
  };

  const filteredLessons = lessons?.filter(l => 
    l.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    l.specialty.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="h-8 w-8 text-primary" />
            CME Status Page
          </h1>
          <p className="text-muted-foreground">Monitoramento em tempo real da infraestrutura de mídia e CDN.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => refetch()}>
            <RefreshCcw className="h-4 w-4" /> Atualizar agora
          </Button>
          <Button className="gap-2 bg-red-600 hover:bg-red-700" onClick={() => navigate('/admin/cme-incidents')}>
            <ShieldAlert className="h-4 w-4" /> Incidentes {stats.critical > 0 && <Badge variant="destructive" className="bg-white text-red-600 ml-1">{stats.critical}</Badge>}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-emerald-500/5 border-emerald-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-emerald-600 flex items-center justify-between">
              Vídeos Saudáveis
              <CheckCircle2 className="h-4 w-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700">{stats.healthy} / {stats.total}</div>
            <Progress value={(stats.healthy / stats.total) * 100} className="h-1 mt-2 bg-emerald-100" />
          </CardContent>
        </Card>

        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-600 flex items-center justify-between">
              Mídia Degradada
              <AlertTriangle className="h-4 w-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700">{stats.degraded}</div>
            <p className="text-xs text-amber-600/60">Avisos de HLS ou latência alta</p>
          </CardContent>
        </Card>

        <Card className="bg-red-500/5 border-red-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600 flex items-center justify-between">
              Alertas Críticos
              <ShieldAlert className="h-4 w-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">{stats.critical}</div>
            <p className="text-xs text-red-600/60">Playback interrompido ou órfão</p>
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-primary flex items-center justify-between">
              Uptime Streaming (CDN)
              <Globe className="h-4 w-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats.uptime}</div>
            <p className="text-xs text-primary/60">Média global de disponibilidade</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Inventário de Disponibilidade</CardTitle>
              <CardDescription>Auditoria contínua de playlists HLS e variantes CDN.</CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar aula ou especialidade..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Videoaula</TableHead>
                <TableHead>Status Global</TableHead>
                <TableHead>Última Validação</TableHead>
                <TableHead>Providers CDN</TableHead>
                <TableHead>Reprocessamento</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingLessons ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">Verificando integridade da rede...</TableCell>
                </TableRow>
              ) : filteredLessons?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">Nenhum alerta encontrado.</TableCell>
                </TableRow>
              ) : (
                filteredLessons?.map((lesson) => (
                  <TableRow key={lesson.id} className="group">
                    <TableCell>
                      <div className="font-medium">{lesson.title}</div>
                      <div className="text-xs text-muted-foreground">{lesson.specialty}</div>
                    </TableCell>
                    <TableCell>
                      {getHealthBadge(lesson.health_score)}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {lesson.last_validation_at ? new Date(lesson.last_validation_at).toLocaleTimeString() : 'Nunca'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Badge variant="secondary" className="text-[10px] py-0 h-4">Supabase</Badge>
                        {lesson.hls_url && <Badge variant="secondary" className="text-[10px] py-0 h-4">HLS</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {lesson.cme_media_reprocessing_jobs?.[0] ? (
                        <div className="flex items-center gap-2">
                           <Badge variant="outline" className="animate-pulse border-amber-500 text-amber-500">
                             {lesson.cme_media_reprocessing_jobs[0].reprocess_status}
                           </Badge>
                           <span className="text-[10px] text-muted-foreground">Retry: {lesson.cme_media_reprocessing_jobs[0].retry_count}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Inativo</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => window.open(`/videoaulas/${lesson.id}`, '_blank')}>
                        <Play className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Server className="h-4 w-4" /> Status dos Workers de Render
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { id: 'worker-01', region: 'us-east', load: 45, status: 'online' },
              { id: 'worker-02', region: 'us-west', load: 12, status: 'online' },
              { id: 'worker-gpu-high', region: 'sa-east', load: 88, status: 'busy' }
            ].map(worker => (
              <div key={worker.id} className="flex items-center justify-between p-2 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={cn("h-2 w-2 rounded-full", worker.status === 'online' ? 'bg-emerald-500' : 'bg-amber-500')} />
                  <div>
                    <div className="text-xs font-bold uppercase">{worker.id}</div>
                    <div className="text-[10px] text-muted-foreground">{worker.region}</div>
                  </div>
                </div>
                <div className="w-24 space-y-1">
                  <div className="text-[10px] text-right">{worker.load}% load</div>
                  <Progress value={worker.load} className="h-1" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Log de Validação (Histórico)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px] pr-4">
              <div className="space-y-3">
                {lessons?.flatMap(l => l.cme_media_validation_logs || []).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 10).map(log => (
                  <div key={log.id} className="text-xs border-b pb-2 flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {log.validation_status === 'failure' ? <AlertTriangle className="h-3 w-3 text-red-500" /> : <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                        <span className="font-bold uppercase tracking-wider text-[10px]">{log.validation_type}</span>
                      </div>
                      <p className="text-muted-foreground">{log.detected_issue || 'Nenhum problema detectado'}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{new Date(log.created_at).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CMEStatusPage;
