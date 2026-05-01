import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { 
  Play, 
  ChevronLeft, 
  Settings, 
  Activity, 
  Cpu, 
  Waves, 
  Sparkles, 
  Brain, 
  Zap, 
  Clock, 
  BarChart3, 
  History,
  CheckCircle2,
  AlertCircle,
  Film,
  Mic2,
  Maximize2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";

const AdminCinematicEngine = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("pipeline");

  const { data: projects, isLoading } = useQuery({
    queryKey: ["cme-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cme_video_projects")
        .select(`
          *,
          topic:knowledge_nodes(title, code)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const { data: stats } = useQuery({
    queryKey: ["cme-stats"],
    queryFn: async () => {
      // Simulation of stats until background workers are fully reporting
      return {
        active_renders: 3,
        queued_tasks: 12,
        avg_render_time: "14m 20s",
        total_content_generated: "142h",
        avg_retention_lift: "+22%",
        cost_savings: "R$ 4.200"
      };
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published': return <Badge className="bg-green-500/10 text-green-600 border-green-200">Publicado</Badge>;
      case 'rendering': return <Badge className="bg-blue-500/10 text-blue-600 border-blue-200 animate-pulse">Renderizando</Badge>;
      case 'planning': return <Badge className="bg-purple-500/10 text-purple-600 border-purple-200">Planejamento</Badge>;
      case 'failed': return <Badge className="bg-red-500/10 text-red-600 border-red-200">Falhou</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Film className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Cinematic Medical Engine (CME)</h1>
              <p className="text-xs text-slate-500 font-medium">Orquestrador Multimodal Proprietário do ENAZIZI</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="gap-2" onClick={() => navigate("/admin")}>
              <ChevronLeft className="h-4 w-4" /> Admin Home
            </Button>
            <Button className="gap-2 shadow-lg shadow-primary/20">
              <Zap className="h-4 w-4 fill-white" /> Nova Videoaula CME
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: "Renders Ativos", value: stats?.active_renders, icon: Activity, color: "blue" },
            { label: "Fila Multimodal", value: stats?.queued_tasks, icon: History, color: "purple" },
            { label: "Tempo Render", value: stats?.avg_render_time, icon: Clock, color: "orange" },
            { label: "Total Gerado", value: stats?.total_content_generated, icon: Film, color: "green" },
            { label: "Lift Retenção", value: stats?.avg_retention_lift, icon: Sparkles, color: "indigo" },
            { label: "Economia Ops", value: stats?.cost_savings, icon: Zap, color: "yellow" }
          ].map((stat, i) => (
            <Card key={i} className="border-none shadow-sm overflow-hidden group">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center space-y-1">
                <div className={`p-2 rounded-lg bg-${stat.color}-500/10 text-${stat.color}-600 mb-2 group-hover:scale-110 transition-transform`}>
                  <stat.icon className="h-4 w-4" />
                </div>
                <p className="text-2xl font-black text-slate-800 tracking-tight">{stat.value}</p>
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="pipeline" className="space-y-6" onValueChange={setActiveTab}>
          <div className="flex items-center justify-between">
            <TabsList className="bg-white p-1 border shadow-sm">
              <TabsTrigger value="pipeline" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-white">
                <Activity className="h-4 w-4" /> Pipeline
              </TabsTrigger>
              <TabsTrigger value="analytics" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-white">
                <BarChart3 className="h-4 w-4" /> Analytics Multimodal
              </TabsTrigger>
              <TabsTrigger value="infrastructure" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-white">
                <Cpu className="h-4 w-4" /> Infra & Workers
              </TabsTrigger>
              <TabsTrigger value="governance" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-white">
                <Waves className="h-4 w-4" /> Governança
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1.5 py-1.5 px-3 bg-white">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Render Clusters: Online
              </Badge>
            </div>
          </div>

          <TabsContent value="pipeline" className="space-y-4">
            <Card className="border-none shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-lg">Fila de Produção Cinematográfica</CardTitle>
                  <CardDescription>Acompanhe o status de geração de cada projeto multimodal.</CardDescription>
                </div>
                <Settings className="h-5 w-5 text-slate-400" />
              </CardHeader>
              <CardContent>
                <div className="relative overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50/50">
                      <tr>
                        <th className="px-6 py-4 font-bold">Projeto / Tópico</th>
                        <th className="px-6 py-4 font-bold">Status Pipeline</th>
                        <th className="px-6 py-4 font-bold">Configuração</th>
                        <th className="px-6 py-4 font-bold">Progresso Render</th>
                        <th className="px-6 py-4 font-bold">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {isLoading ? (
                        <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400">Escaneando pipeline CME...</td></tr>
                      ) : projects?.length === 0 ? (
                        <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400">Nenhum projeto CME iniciado.</td></tr>
                      ) : projects?.map((project) => (
                        <tr key={project.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-700">{project.title}</span>
                              <span className="text-[10px] text-slate-400 font-mono">{(project as any).topic?.code} • {(project as any).topic?.title}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {getStatusBadge(project.status)}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-1">
                              <Badge variant="outline" className="text-[9px] bg-slate-100">
                                <Mic2 className="h-3 w-3 mr-1" /> ElevenLabs
                              </Badge>
                              <Badge variant="outline" className="text-[9px] bg-slate-100">
                                <Film className="h-3 w-3 mr-1" /> Remotion
                              </Badge>
                            </div>
                          </td>
                          <td className="px-6 py-4 w-64">
                            <div className="space-y-1">
                              <div className="flex justify-between text-[10px] font-bold">
                                <span>{project.status === 'published' ? 'Concluído' : 'Processando...'}</span>
                                <span>{project.status === 'published' ? '100%' : '45%'}</span>
                              </div>
                              <Progress value={project.status === 'published' ? 100 : 45} className="h-1.5" />
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-primary">
                                <Settings className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-primary">
                                <Maximize2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-none shadow-sm">
                <CardHeader>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Brain className="h-4 w-4 text-purple-500" /> 
                    Top Replay Hotspots (Cognitive Drag)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { topic: "Fisiopatologia da ICC", timestamp: "04:20", count: 142, alert: "high" },
                    { topic: "Mecanismo IECA", timestamp: "12:15", count: 98, alert: "medium" },
                    { topic: "Indicações Transplante", timestamp: "18:45", count: 45, alert: "low" }
                  ].map((hotspot, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-700">{hotspot.topic}</span>
                        <span className="text-[10px] text-slate-400">Timestamp: {hotspot.timestamp}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-black text-slate-800">{hotspot.count} replays</span>
                        <div className={`text-[9px] font-bold uppercase ${hotspot.alert === 'high' ? 'text-red-500' : 'text-slate-400'}`}>
                          {hotspot.alert === 'high' ? 'Fadiga Crítica' : 'Normal'}
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm">
                <CardHeader>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Activity className="h-4 w-4 text-blue-500" /> 
                    Pacing Effectiveness Index
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-32 flex items-end justify-between gap-2">
                    {[65, 80, 45, 90, 70, 85, 95].map((val, i) => (
                      <div key={i} className="flex-1 space-y-2 group cursor-pointer">
                        <div 
                          className="w-full bg-primary/20 rounded-t-md group-hover:bg-primary transition-colors relative" 
                          style={{ height: `${val}%` }}
                        >
                          <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                            {val}%
                          </div>
                        </div>
                        <div className="text-[8px] text-center font-bold text-slate-400">V{i+1}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 text-center mt-4">Eficiência do ritmo adaptativo por versão do engine</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="analytics" className="h-64 flex items-center justify-center text-slate-400 italic">
            Visualizando métricas de retenção multimodal e drift cognitivo...
          </TabsContent>
          
          <TabsContent value="infrastructure" className="h-64 flex items-center justify-center text-slate-400 italic">
            Monitorando clusters de renderização e workers FFmpeg/Remotion...
          </TabsContent>
          
          <TabsContent value="governance" className="h-64 flex items-center justify-center text-slate-400 italic">
            Audit logs de produção e validação médica de scripts...
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminCinematicEngine;
