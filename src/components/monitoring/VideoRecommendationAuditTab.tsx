import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Film, CheckCircle2, XCircle, Clock, MousePointer2, AlertTriangle, Eye, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const VideoRecommendationAuditTab = () => {
  const { data: telemetry, isLoading: loadingTelemetry } = useQuery({
    queryKey: ["tutor-video-telemetry"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutor_video_recommendation_telemetry")
        .select(`
          *,
          lesson:tutor_lesson_memory(title, topic, subject)
        `)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["tutor-video-stats"],
    queryFn: async () => {
      const { data: events, error } = await supabase
        .from("tutor_video_recommendation_telemetry")
        .select("event_type");
      
      if (error) throw error;

      const counts = events.reduce((acc: any, curr: any) => {
        acc[curr.event_type] = (acc[curr.event_type] || 0) + 1;
        return acc;
      }, {});

      const totalSearches = counts.search_started || 0;
      const totalFound = counts.found || 0;
      const totalClicked = counts.clicked || 0;
      const totalShown = counts.shown || 0;

      return {
        totalSearches,
        successRate: totalSearches ? (totalFound / totalSearches * 100).toFixed(1) : 0,
        ctr: totalShown ? (totalClicked / totalShown * 100).toFixed(1) : 0,
        counts
      };
    },
  });

  // Healthcheck de RLS Simulado (Verifica inconsistências no banco)
  const { data: healthCheck } = useQuery({
    queryKey: ["tutor-video-rls-health"],
    queryFn: async () => {
      // 1. Aulas que deveriam estar ocultas mas apareceram em telemetry (falso positivo de RLS/Filtro)
      const { data: leakyLessons } = await supabase
        .from("tutor_lesson_memory")
        .select("id, title, status, hidden_from_student, deleted_at")
        .or("status.neq.published,hidden_from_student.eq.true,deleted_at.not.is.null");

      const leakyIds = leakyLessons?.map(l => l.id) || [];
      
      const { data: violations } = await supabase
        .from("tutor_video_recommendation_telemetry")
        .select("id, lesson_id, event_type")
        .in("lesson_id", leakyIds)
        .in("event_type", ["found", "shown", "clicked"]);

      return {
        violationsCount: violations?.length || 0,
        violations: violations || [],
        isHealthy: (violations?.length || 0) === 0
      };
    }
  });

  if (loadingTelemetry) return <div className="p-8 text-center">Carregando auditoria...</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white/5 border-white/10">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Buscas Totais</p>
                <h3 className="text-2xl font-black mt-1">{stats?.totalSearches}</h3>
              </div>
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Clock className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Taxa de Encontro</p>
                <h3 className="text-2xl font-black mt-1">{stats?.successRate}%</h3>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-500">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">CTR (Clique/Exibição)</p>
                <h3 className="text-2xl font-black mt-1">{stats?.ctr}%</h3>
              </div>
              <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                <MousePointer2 className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`border-2 ${healthCheck?.isHealthy ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Saúde RLS & Filtros</p>
                <h3 className={`text-2xl font-black mt-1 ${healthCheck?.isHealthy ? 'text-green-500' : 'text-red-500'}`}>
                  {healthCheck?.isHealthy ? 'IMPECÁVEL' : 'VULNERÁVEL'}
                </h3>
              </div>
              <div className={`h-10 w-10 rounded-full flex items-center justify-center ${healthCheck?.isHealthy ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                <ShieldCheck className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {!healthCheck?.isHealthy && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
          <div>
            <h4 className="text-sm font-bold text-red-500">Violação de Integridade Detectada</h4>
            <p className="text-xs text-red-400">Existem {healthCheck?.violationsCount} eventos de recomendação para aulas que deveriam estar ocultas ou não publicadas.</p>
          </div>
        </div>
      )}

      <Card className="bg-white/5 border-white/10 overflow-hidden">
        <CardHeader className="border-b border-white/5 bg-white/[0.02]">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Film className="h-4 w-4 text-primary" />
            Logs de Recomendação (Tempo Real)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-white/5">
                <TableHead className="text-[10px] font-bold uppercase">Data</TableHead>
                <TableHead className="text-[10px] font-bold uppercase">Evento</TableHead>
                <TableHead className="text-[10px] font-bold uppercase">Tema/Aula</TableHead>
                <TableHead className="text-[10px] font-bold uppercase">Confiança</TableHead>
                <TableHead className="text-[10px] font-bold uppercase">Origem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {telemetry?.map((log) => (
                <TableRow key={log.id} className="border-white/5 hover:bg-white/[0.02]">
                  <TableCell className="text-[10px] text-muted-foreground font-mono">
                    {format(new Date(log.created_at), "HH:mm:ss", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[9px] font-black uppercase ${
                      log.event_type === 'found' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                      log.event_type === 'clicked' ? 'bg-primary/10 text-primary border-primary/20' :
                      log.event_type === 'not_found' ? 'bg-muted text-muted-foreground border-transparent' :
                      log.event_type === 'shown' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                      'bg-red-500/10 text-red-500 border-red-500/20'
                    }`}>
                      {log.event_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold">{log.lesson?.title || log.topic}</span>
                      <span className="text-[10px] text-muted-foreground italic">{log.topic}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-1 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${log.confidence}%` }} />
                      </div>
                      <span className="text-[10px] font-mono">{log.confidence}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-[10px] font-mono text-muted-foreground">
                    {log.source_table || "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
