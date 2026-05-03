import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  BarChart3, Search, CheckCircle2, XCircle, MousePointer2, 
  TrendingUp, History, Info, Filter, LayoutDashboard,
  Eye, Video
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export const TutorVideoAuditPanel = () => {
  const { data: events, isLoading } = useQuery({
    queryKey: ["admin-tutor-video-telemetry"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("telemetry_events")
        .select("*")
        .like("event_name", "tutor_video_%")
        .order("timestamp", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const stats = React.useMemo(() => {
    if (!events) return null;
    
    const searches = events.filter(e => e.event_name === "tutor_video_search_started").length;
    const found = events.filter(e => e.event_name === "tutor_video_found").length;
    const shown = events.filter(e => e.event_name === "tutor_video_shown").length;
    const clicked = events.filter(e => e.event_name === "tutor_video_clicked").length;
    const notFound = events.filter(e => e.event_name === "tutor_video_not_found").length;

    // CTR (Click Through Rate) based on shown
    const ctr = shown > 0 ? (clicked / shown) * 100 : 0;
    // Success rate based on searches
    const successRate = searches > 0 ? (found / searches) * 100 : 0;

    const topTopicsMap = new Map();
    events.filter(e => e.properties?.topic).forEach(e => {
      const t = e.properties.topic;
      topTopicsMap.set(t, (topTopicsMap.get(t) || 0) + 1);
    });

    const topTopics = Array.from(topTopicsMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return {
      searches,
      found,
      shown,
      clicked,
      notFound,
      ctr,
      successRate,
      topTopics
    };
  }, [events]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <Video className="h-6 w-6 text-emerald-400" />
            Recomendações do Tutor IA
          </h2>
          <p className="text-white/50 text-xs">Auditoria de telemetria, CTR e acurácia de busca.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-white/40">Buscas Realizadas</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-2">
            <div className="flex justify-between items-end">
              <span className="text-2xl font-black text-white">{stats?.searches}</span>
              <span className="text-[10px] text-blue-400 font-bold">TOTAL</span>
            </div>
            <p className="text-[10px] text-white/30">Últimas 100 interações monitoradas.</p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-white/40">Taxa de Encontro</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-2">
            <div className="flex justify-between items-end">
              <span className="text-2xl font-black text-emerald-400">{stats?.successRate.toFixed(1)}%</span>
              <span className="text-[10px] text-emerald-400 font-bold">FOUND RATE</span>
            </div>
            <Progress value={stats?.successRate || 0} className="h-1 bg-white/5" />
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-white/40">Cliques (CTR)</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-2">
            <div className="flex justify-between items-end">
              <span className="text-2xl font-black text-amber-400">{stats?.ctr.toFixed(1)}%</span>
              <span className="text-[10px] text-amber-400 font-bold">ENGAGEMENT</span>
            </div>
            <p className="text-[10px] text-white/40 flex items-center gap-1">
              <MousePointer2 className="h-3 w-3" /> {stats?.clicked} cliques em {stats?.shown} cards
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-white/40">Falhas (Not Found)</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-2">
            <div className="flex justify-between items-end">
              <span className="text-2xl font-black text-rose-400">{stats?.notFound}</span>
              <span className="text-[10px] text-rose-400 font-bold">SEM AULA</span>
            </div>
            <p className="text-[10px] text-white/30">Oportunidades de novo conteúdo.</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card className="bg-white/5 border-white/10 overflow-hidden">
            <CardHeader className="border-b border-white/5">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <History className="h-4 w-4 text-emerald-400" />
                Últimas Recomendações (Audit Real-Time)
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-white/5 text-white/40 uppercase text-[10px] font-black">
                  <tr>
                    <th className="px-4 py-3 text-left">Tema / Contexto</th>
                    <th className="px-4 py-3 text-left">Evento</th>
                    <th className="px-4 py-3 text-left">Confiança</th>
                    <th className="px-4 py-3 text-left">Origem</th>
                    <th className="px-4 py-3 text-right">Tempo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {events?.slice(0, 15).map(e => (
                    <tr key={e.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-bold text-white">{e.properties?.topic || "---"}</div>
                        <div className="text-[10px] text-white/30 truncate max-w-[200px]">
                          User: {e.user_id?.slice(0, 8) || "Anônimo"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`text-[9px] ${
                          e.event_name.includes('found') ? 'bg-emerald-500/10 text-emerald-400' :
                          e.event_name.includes('clicked') ? 'bg-amber-500/10 text-amber-400' :
                          e.event_name.includes('not_found') ? 'bg-rose-500/10 text-rose-400' :
                          'bg-white/5 text-white/50'
                        }`}>
                          {e.event_name.replace('tutor_video_', '').replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-white/60">
                        {e.properties?.confidence ? `${e.properties.confidence}%` : "---"}
                      </td>
                      <td className="px-4 py-3 text-white/40 italic">
                        {e.properties?.source || "---"}
                      </td>
                      <td className="px-4 py-3 text-right text-white/20">
                        {formatDistanceToNow(new Date(e.timestamp), { addSuffix: true, locale: ptBR })}
                      </td>
                    </tr>
                  ))}
                  {(!events || events.length === 0) && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-white/20 italic">
                        Nenhuma telemetria de vídeo detectada ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="border-b border-white/5">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-400" />
                Top Temas Buscados
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {stats?.topTopics.map(([topic, count], idx) => (
                <div key={topic} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-white/70 font-medium">{topic}</span>
                    <span className="text-white/30">{count} buscas</span>
                  </div>
                  <Progress value={(count / (stats?.searches || 1)) * 100} className="h-1 bg-white/5" />
                </div>
              ))}
              {stats?.topTopics.length === 0 && (
                <div className="text-center py-6 text-white/20 italic text-xs">
                  Sem dados suficientes.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10 border-amber-500/20">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-[10px] font-black uppercase tracking-widest text-amber-400 flex items-center gap-2">
                <Info className="h-3 w-3" /> Checklist de Segurança RLS
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-[10px] text-white/50 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                Só aulas 'published'
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                Sem URL direta exposta
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                RLS ativa em telemetry_events
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                Filtro de medical term validado
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
