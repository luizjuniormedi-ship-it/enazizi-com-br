import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingDown, Clock, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeatmapData {
  segment_id: string;
  title: string;
  friction_score: number;
  total_replays: number;
  total_abandons: number;
  total_tutor_opens: number;
  ordem: number;
}

const CognitiveHeatmap = ({ videoLessonId }: { videoLessonId: string }) => {
  const { data: heatmap, isLoading } = useQuery({
    queryKey: ["video-cognitive-heatmap", videoLessonId],
    queryFn: async () => {
      // Primeiro garantimos que o heatmap está atualizado
      await supabase.rpc('refresh_video_cognitive_heatmap', { p_video_lesson_id: videoLessonId });

      const { data, error } = await supabase
        .from("video_cognitive_heatmaps")
        .select(`
          friction_score,
          total_replays,
          total_abandons,
          total_tutor_opens,
          segment:segment_id (
            title,
            ordem
          )
        `)
        .eq("video_lesson_id", videoLessonId)
        .order("friction_score", { ascending: false });

      if (error) throw error;

      return (data || []).map((d: any) => ({
        segment_id: d.segment_id,
        title: d.segment?.title || "Sem título",
        ordem: d.segment?.ordem || 0,
        friction_score: Number(d.friction_score),
        total_replays: d.total_replays,
        total_abandons: d.total_abandons,
        total_tutor_opens: d.total_tutor_opens
      })) as HeatmapData[];
    }
  });

  if (isLoading) return <div className="h-48 flex items-center justify-center">Gerando mapa cognitivo...</div>;

  const maxFriction = Math.max(...(heatmap?.map(h => h.friction_score) || [1]));

  return (
    <Card className="border-primary/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingDown className="h-5 w-5 text-red-500" />
          Mapa de Atrito Cognitivo
        </CardTitle>
        <CardDescription>
          Identificação automática de trechos onde os alunos travam, abandonam ou buscam suporte.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {heatmap?.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            Dados insuficientes para gerar o mapa de calor.
          </p>
        )}
        
        {heatmap?.map((item) => (
          <div key={item.segment_id} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] w-6 h-6 p-0 flex items-center justify-center">
                  {item.ordem}
                </Badge>
                <span className="text-sm font-medium truncate max-w-[200px]">{item.title}</span>
                {item.friction_score > maxFriction * 0.7 && (
                  <Badge variant="destructive" className="h-4 text-[9px] px-1 uppercase animate-pulse">
                    Crítico
                  </Badge>
                )}
              </div>
              <span className="text-xs font-mono text-muted-foreground">
                Score: {item.friction_score.toFixed(1)}
              </span>
            </div>
            
            <div className="relative pt-1">
              <Progress 
                value={(item.friction_score / maxFriction) * 100} 
                className={cn(
                  "h-2",
                  item.friction_score > maxFriction * 0.7 ? "bg-red-100 dark:bg-red-900/20" : "bg-muted"
                )}
              />
            </div>

            <div className="flex items-center gap-4 mt-1">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock className="h-3 w-3" /> {item.total_replays} replays
              </div>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <AlertTriangle className="h-3 w-3" /> {item.total_abandons} abandonos
              </div>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <MessageSquare className="h-3 w-3" /> {item.total_tutor_opens} Tutor IA
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default CognitiveHeatmap;
