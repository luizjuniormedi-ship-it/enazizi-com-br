import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  BarChart, 
  Search, 
  CheckCircle2, 
  XCircle, 
  MousePointer2, 
  TrendingUp,
  AlertTriangle,
  History
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const TutorVideoRecommendations = () => {
  const { data: events, isLoading } = useQuery({
    queryKey: ["tutor-video-telemetry"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("telemetry_events")
        .select("*")
        .ilike("event_name", "tutor_video_%")
        .order("timestamp", { ascending: false })
        .limit(200);

      if (error) throw error;
      return data;
    },
  });

  const stats = {
    totalSearches: events?.filter(e => e.event_name === "tutor_video_search_started").length || 0,
    found: events?.filter(e => e.event_name === "tutor_video_found").length || 0,
    notFound: events?.filter(e => e.event_name === "tutor_video_not_found").length || 0,
    clicks: events?.filter(e => e.event_name === "tutor_video_clicked").length || 0,
    skipped: events?.filter(e => e.event_name.startsWith("tutor_video_skipped_")).length || 0,
  };

  const ctr = stats.found > 0 ? (stats.clicks / stats.found) * 100 : 0;
  const foundRate = stats.totalSearches > 0 ? (stats.found / stats.totalSearches) * 100 : 0;

  const topTopics = events
    ?.filter(e => e.event_name === "tutor_video_search_started")
    .reduce((acc: Record<string, number>, curr) => {
      const topic = (curr.properties as any)?.topic || "Desconhecido";
      acc[topic] = (acc[topic] || 0) + 1;
      return acc;
    }, {});

  const sortedTopics = Object.entries(topTopics || {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  return (
    <div className="p-6 space-y-6 bg-slate-50/50 min-h-screen animate-fade-in">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
          <TrendingUp className="h-8 w-8 text-primary" />
          Auditoria de Recomendações
        </h1>
        <p className="text-muted-foreground">Monitoramento em tempo real do sistema de recomendação de videoaulas do Tutor IA.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white shadow-sm border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
              Buscas Totais
              <Search className="h-4 w-4 text-primary/50" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-900">{stats.totalSearches}</div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">Últimas 200 amostras</p>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
              Taxa de Encontro
              <CheckCircle2 className="h-4 w-4 text-green-500/50" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-900">{foundRate.toFixed(1)}%</div>
            <div className="flex items-center gap-1.5 mt-1">
              <Badge variant="secondary" className="bg-green-100 text-green-700 text-[9px] hover:bg-green-100">{stats.found} encontradas</Badge>
              <Badge variant="secondary" className="bg-red-100 text-red-700 text-[9px] hover:bg-red-100">{stats.notFound} não encontradas</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
              Click-Through Rate
              <MousePointer2 className="h-4 w-4 text-amber-500/50" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-900">{ctr.toFixed(1)}%</div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">{stats.clicks} cliques de {stats.found} recomendações</p>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
              Filtros / Skips
              <XCircle className="h-4 w-4 text-slate-500/50" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-900">{stats.skipped}</div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">Aulas puladas por segurança/falta de vídeo</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-white shadow-sm border-slate-200">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-slate-400" />
              Feed de Eventos Recentes
            </CardTitle>
            <CardDescription>Auditoria detalhada de cada interação do Tutor com videoaulas.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              {isLoading ? (
                <div className="p-8 text-center text-muted-foreground">Carregando telemetria...</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {events?.map((event) => (
                    <div key={event.id} className="p-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge className={
                              event.event_name.includes('found') ? "bg-green-100 text-green-700 hover:bg-green-100" :
                              event.event_name.includes('clicked') ? "bg-amber-100 text-amber-700 hover:bg-amber-100" :
                              event.event_name.includes('not_found') ? "bg-red-100 text-red-700 hover:bg-red-100" :
                              "bg-slate-100 text-slate-700 hover:bg-slate-100"
                            }>
                              {event.event_name.replace('tutor_video_', '').toUpperCase()}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {format(new Date(event.timestamp || ""), "HH:mm:ss 'em' dd/MM", { locale: ptBR })}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-slate-900">
                            {(event.properties as any)?.topic || "Tópico desconhecido"}
                          </p>
                          <div className="text-[10px] text-muted-foreground space-y-0.5">
                            {(event.properties as any)?.lessonId && (
                              <p className="font-mono">ID Aula: {(event.properties as any).lessonId.slice(0, 8)}...</p>
                            )}
                            {(event.properties as any)?.source && (
                              <p>Fonte: {(event.properties as any).source}</p>
                            )}
                            {(event.properties as any)?.reason && (
                              <p className="italic">Motivo: {(event.properties as any).reason}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          {(event.properties as any)?.confidence && (
                            <div className="space-y-1">
                              <p className="text-[9px] font-black uppercase text-slate-400">Confiança</p>
                              <div className="h-1.5 w-16 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-primary" 
                                  style={{ width: `${(event.properties as any).confidence}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!events || events.length === 0) && (
                    <div className="p-8 text-center text-muted-foreground italic">Nenhum evento registrado recentemente.</div>
                  )}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm border-slate-200">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="flex items-center gap-2">
              <BarChart className="h-5 w-5 text-slate-400" />
              Tópicos Quentes
            </CardTitle>
            <CardDescription>Temas mais pesquisados pelo Tutor.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {sortedTopics.map(([topic, count], idx) => (
                <div key={topic} className="space-y-1.5">
                  <div className="flex justify-between text-xs items-center">
                    <span className="font-bold text-slate-700 max-w-[150px] truncate">{idx + 1}. {topic}</span>
                    <span className="text-muted-foreground font-mono">{count} busca{count > 1 ? 's' : ''}</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary/40 rounded-full" 
                      style={{ width: `${(count / (sortedTopics[0][1] as number)) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
              {sortedTopics.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-xs italic">Aguardando dados...</div>
              )}
            </div>
            
            <div className="mt-8 p-3 rounded-lg bg-amber-50 border border-amber-100 flex gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-amber-900 uppercase tracking-tight">Investigação de Falsos Positivos</p>
                <p className="text-[10px] text-amber-800 leading-tight">
                  Se um tópico aparece com alta busca mas 0% de Taxa de Encontro, considere criar uma videoaula específica ou revisar os sinônimos.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TutorVideoRecommendations;
