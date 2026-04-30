import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  BarChart3, 
  RotateCcw, 
  MessageSquare, 
  AlertTriangle, 
  CheckCircle2, 
  Users,
  FileText,
  Download
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  videoLessonId: string;
}

export function VideoAnalyticsDrilldown({ videoLessonId }: Props) {
  const { data: lesson } = useQuery({
    queryKey: ["admin-video-lesson-details", videoLessonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_video_lessons")
        .select("*, tutor_lesson_id")
        .eq("id", videoLessonId)
        .single();
      if (error) throw error;
      return data;
    }
  });

  const { data: segments } = useQuery({
    queryKey: ["admin-video-lesson-segments", lesson?.tutor_lesson_id],
    enabled: !!lesson?.tutor_lesson_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lesson_segments")
        .select("*")
        .eq("lesson_id", lesson!.tutor_lesson_id!)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return data;
    }
  });

  const { data: segmentEvents } = useQuery({
    queryKey: ["admin-video-segment-events", videoLessonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("video_segment_events")
        .select("*")
        .eq("video_lesson_id", videoLessonId);
      if (error) throw error;
      return data;
    }
  });

  const getSegmentStats = (segmentId: string | null) => {
    const events = segmentEvents?.filter(e => e.segment_id === segmentId) || [];
    const replays = events.filter(e => e.event_type === "replay").length;
    const abandons = events.filter(e => e.event_type === "abandon").length;
    const tutorOpens = events.filter(e => e.event_type === "tutor_open").length;
    const quizErrors = events.filter(e => e.event_type === "quiz_error").length;
    const completions = events.filter(e => e.event_type === "complete").length;
    const uniqueUsers = new Set(events.map(e => e.user_id)).size;
    
    // Heurística de dificuldade (simplificada para admin)
    const score = (replays * 2) + (tutorOpens * 1.5) + (quizErrors * 3);
    let level: "baixa" | "média" | "alta" = "baixa";
    if (score >= 10 || abandons > 0) level = "alta";
    else if (score >= 4) level = "média";

    return { replays, abandons, tutorOpens, quizErrors, completions, uniqueUsers, level };
  };

  const handleExportPDF = () => {
    toast.info("Gerando relatório PDF...", { description: "Isso pode levar alguns segundos." });
    // Em produção, isso chamaria uma Edge Function ou usaria jspdf
    setTimeout(() => {
      window.print();
    }, 500);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          Drill-down por Segmento
        </h2>
        <Button variant="outline" className="gap-2" onClick={handleExportPDF}>
          <Download className="h-4 w-4" /> Exportar Relatório PDF
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase text-muted-foreground">Engajamento Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{segmentEvents?.length || 0} eventos</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase text-muted-foreground">Alunos Únicos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{new Set(segmentEvents?.map(e => e.user_id)).size}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase text-muted-foreground">Uso do Tutor IA</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{segmentEvents?.filter(e => e.event_type === "tutor_open").length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase text-muted-foreground">Replays Acumulados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{segmentEvents?.filter(e => e.event_type === "replay").length || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[300px]">Segmento</TableHead>
                <TableHead className="text-center">Replays</TableHead>
                <TableHead className="text-center">Abandono</TableHead>
                <TableHead className="text-center">Tutor Open</TableHead>
                <TableHead className="text-center">Quiz Erros</TableHead>
                <TableHead className="text-center">Dificuldade</TableHead>
                <TableHead className="text-right">Completude</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {segments?.map((seg) => {
                const stats = getSegmentStats(seg.id);
                return (
                  <TableRow key={seg.id}>
                    <TableCell>
                      <div className="font-medium text-sm">{seg.title}</div>
                      <div className="text-[10px] text-muted-foreground">Ordem: {seg.ordem} | Tipo: {seg.segment_type}</div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <RotateCcw className="h-3 w-3 text-muted-foreground" />
                        {stats.replays}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <AlertTriangle className={cn("h-3 w-3", stats.abandons > 0 ? "text-red-500" : "text-muted-foreground")} />
                        {stats.abandons}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <MessageSquare className="h-3 w-3 text-muted-foreground" />
                        {stats.tutorOpens}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <FileText className={cn("h-3 w-3", stats.quizErrors > 0 ? "text-orange-500" : "text-muted-foreground")} />
                        {stats.quizErrors}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          stats.level === "alta" ? "border-red-500 text-red-600 bg-red-50" :
                          stats.level === "média" ? "border-amber-500 text-amber-600 bg-amber-50" :
                          "border-green-500 text-green-600 bg-green-50"
                        )}
                      >
                        {stats.level.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xs">{stats.completions} concluintes</span>
                        <Progress value={stats.uniqueUsers > 0 ? (stats.completions / stats.uniqueUsers) * 100 : 0} className="h-1 w-20" />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!segments || segments.length === 0) && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground italic">
                    Nenhum segmento detectado para esta aula.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:hidden">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Sugestões FSRS (Baseadas em Dificuldade)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {segments?.filter(s => getSegmentStats(s.id).level !== "baixa").map(s => (
              <div key={s.id} className="flex items-center justify-between p-2 rounded-lg border border-amber-100 bg-amber-50/50">
                <span className="text-xs font-medium">{s.title}</span>
                <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-none text-[10px]">
                  +3 Flashcards Recomendados
                </Badge>
              </div>
            ))}
            {(!segments || segments.every(s => getSegmentStats(s.id).level === "baixa")) && (
              <p className="text-xs text-muted-foreground italic">Nenhuma recomendação pendente.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-primary">Recomendações Pedagógicas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
              <div className="space-y-1">
                <p className="text-xs font-semibold">Reforço Multimodal</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Os trechos com nível "ALTA" devem receber um resumo em áudio dedicado e revisão via Tutor IA prioritária.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <RotateCcw className="h-5 w-5 text-blue-500 shrink-0" />
              <div className="space-y-1">
                <p className="text-xs font-semibold">Otimização de Retenção</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Identificamos {segments?.filter(s => getSegmentStats(s.id).replays > 5).length || 0} segmentos com alta taxa de replay. Considere desmembrar estes temas em aulas curtas.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
