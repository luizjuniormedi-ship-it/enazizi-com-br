import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  TrendingDown, 
  Users, 
  User, 
  Video, 
  ChevronRight, 
  Filter, 
  Download,
  AlertTriangle,
  Clock,
  MessageSquare,
  FileText
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CognitiveHeatmap from "@/components/admin/CognitiveHeatmap";
import { toast } from "sonner";

const GlobalCognitiveHeatmap = () => {
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"video" | "student">("video");

  // Busca dados agregados de vídeos críticos
  const { data: criticalVideos, isLoading: loadingVideos } = useQuery({
    queryKey: ["admin-critical-videos", selectedSpecialty],
    queryFn: async () => {
      let query = supabase
        .from("video_cognitive_heatmaps")
        .select(`
          friction_score,
          total_replays,
          total_abandons,
          total_tutor_opens,
          video:video_lesson_id (
            id,
            title,
            specialty,
            topic
          )
        `)
        .order("friction_score", { ascending: false });

      if (selectedSpecialty !== "all") {
        // Como o filtro é no relacionamento, precisamos de uma estratégia diferente ou filtrar no JS
        // Para o MVP, filtramos no resultado ou usamos query complexa
      }

      const { data, error } = await query;
      if (error) throw error;

      // Agrega por vídeo (já que o heatmap é por segmento)
      const aggregated = (data || []).reduce((acc: any, curr: any) => {
        const vid = curr.video;
        if (!vid) return acc;
        if (selectedSpecialty !== "all" && vid.specialty !== selectedSpecialty) return acc;

        if (!acc[vid.id]) {
          acc[vid.id] = {
            ...vid,
            friction: 0,
            replays: 0,
            abandons: 0,
            tutor_opens: 0,
            segments: 0
          };
        }
        acc[vid.id].friction += Number(curr.friction_score);
        acc[vid.id].replays += curr.total_replays;
        acc[vid.id].abandons += curr.total_abandons;
        acc[vid.id].tutor_opens += curr.total_tutor_opens;
        acc[vid.id].segments += 1;
        return acc;
      }, {});

      return Object.values(aggregated).sort((a: any, b: any) => b.friction - a.friction);
    }
  });

  // Busca especialidades únicas para filtro
  const { data: specialties } = useQuery({
    queryKey: ["admin-video-specialties"],
    queryFn: async () => {
      const { data } = await supabase.from("ai_video_lessons").select("specialty");
      const unique = Array.from(new Set((data || []).map(d => d.specialty)));
      return unique;
    }
  });

  const handleExportPDF = () => {
    toast.info("Gerando relatório consolidado...", {
      description: "O PDF incluirá mapas de atrito e recomendações shadow."
    });
    // Placeholder para exportação futura
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Heatmap Cognitivo</h1>
          <p className="text-muted-foreground flex items-center gap-2">
            <TrendingDown className="h-4 w-4" /> Inteligência Adaptativa Multimodal — Visão do Professor
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={handleExportPDF}>
            <Download className="h-4 w-4" /> Exportar Relatório
          </Button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-red-500/5 border-red-500/10">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-red-600 uppercase">Vídeos Críticos</p>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </div>
            <p className="text-2xl font-bold mt-2">
              {criticalVideos?.filter((v: any) => v.friction > 5).length || 0}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">Atrito cognitivo acima da média</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Replays Médios</p>
              <Clock className="h-4 w-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold mt-2">
              {criticalVideos && criticalVideos.length > 0
                ? (Number(criticalVideos.reduce((a: any, b: any) => a + (b.replays || 0), 0)) / (criticalVideos.length || 1)).toFixed(1)
                : "0"}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">Por videoaula segmentada</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Aberturas Tutor</p>
              <MessageSquare className="h-4 w-4 text-purple-500" />
            </div>
            <p className="text-2xl font-bold mt-2">
              {criticalVideos && criticalVideos.length > 0 
                ? (criticalVideos.reduce((a: any, b: any) => a + (b.tutor_opens || 0), 0))
                : 0}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">Total de dúvidas contextuais</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Retenção Geral</p>
              <TrendingDown className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-2xl font-bold mt-2">84.2%</p>
            <p className="text-[10px] text-muted-foreground mt-1">Média de conclusão da plataforma</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={viewMode} onValueChange={(v: any) => setViewMode(v)} className="space-y-6">
        <div className="flex items-center justify-between">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="video" className="gap-2">
              <Video className="h-4 w-4" /> Por Conteúdo
            </TabsTrigger>
            <TabsTrigger value="student" className="gap-2">
              <Users className="h-4 w-4" /> Por Aluno
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Especialidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {(specialties as string[] | undefined)?.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabsContent value="video" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Lista de Vídeos */}
            <Card className="lg:col-span-1 border-primary/5">
              <CardHeader>
                <CardTitle className="text-base font-bold">Ranking de Atrito</CardTitle>
                <CardDescription>Videoaulas ordenadas por dificuldade detectada.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[500px]">
                  <div className="divide-y">
                    {loadingVideos ? (
                      <div className="p-8 text-center text-sm">Carregando dados...</div>
                    ) : (
                      criticalVideos?.map((v: any) => (
                        <div 
                          key={v.id} 
                          className="p-4 hover:bg-muted/50 transition-colors cursor-pointer group"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1 min-w-0">
                              <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                                {v.title}
                              </p>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[10px] py-0">{v.specialty}</Badge>
                                <span className="text-[10px] text-muted-foreground">{v.segments} segs</span>
                              </div>
                            </div>
                            <Badge className={cn(
                              "text-[10px]",
                              v.friction > 5 ? "bg-red-500" : v.friction > 2 ? "bg-amber-500" : "bg-green-500"
                            )}>
                              {v.friction.toFixed(1)}
                            </Badge>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Heatmap Detalhado */}
            <div className="lg:col-span-2 space-y-6">
              {criticalVideos && criticalVideos.length > 0 ? (
                <CognitiveHeatmap videoLessonId={(criticalVideos[0] as any).id} />
              ) : (
                <Card className="h-full flex items-center justify-center border-dashed">
                  <p className="text-muted-foreground">Selecione uma videoaula para ver o heatmap detalhado.</p>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="student">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" /> Desempenho Cognitivo Individual
              </CardTitle>
              <CardDescription>Acompanhe como cada aluno interage com os conteúdos multimodais.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Aluno</TableHead>
                    <TableHead>Retenção Média</TableHead>
                    <TableHead>Replays</TableHead>
                    <TableHead>Dúvidas</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Matheus Amorim</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={92} className="h-1.5 w-16" />
                        <span className="text-xs">92%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">14</TableCell>
                    <TableCell className="text-xs">3</TableCell>
                    <TableCell><Badge variant="outline" className="text-green-500 border-green-500/20">Focado</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="h-8 text-xs">Drill-down</Button>
                    </TableCell>
                  </TableRow>
                  {/* Mock data for visualization */}
                  <TableRow>
                    <TableCell className="font-medium">Ronald Henriques</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={45} className="h-1.5 w-16 bg-red-100" />
                        <span className="text-xs">45%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">28</TableCell>
                    <TableCell className="text-xs">12</TableCell>
                    <TableCell><Badge variant="outline" className="text-red-500 border-red-500/20">Em Risco</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="h-8 text-xs">Drill-down</Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default GlobalCognitiveHeatmap;

import { ScrollArea } from "@/components/ui/scroll-area";
