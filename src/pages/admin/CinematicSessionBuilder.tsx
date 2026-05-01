import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  ChevronLeft, 
  Film, 
  Layers, 
  Settings, 
  Play, 
  Trash2, 
  Split, 
  Combine, 
  Clock, 
  Brain, 
  Activity,
  Shield,
  Zap,
  Layout,
  Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const CinematicSessionBuilder = () => {
  const { aggregationId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("blocks");

  const { data: aggregation, isLoading: aggLoading, error: aggError } = useQuery({
    queryKey: ["cme-aggregation", aggregationId],
    queryFn: async () => {
      console.log(`[CME] Fetching aggregation ${aggregationId}...`);
      const { data, error } = await supabase
        .from("cme_session_aggregations")
        .select(`
          *,
          blocks:cme_lesson_blocks(*)
        `)
        .eq("id", aggregationId)
        .maybeSingle(); // Usar maybeSingle para evitar erro se não existir
      
      if (error) {
        console.error("[CME] Error fetching aggregation:", error);
        throw error;
      }
      
      if (!data) {
        console.warn("[CME] Aggregation not found");
        throw new Error("Agregação não encontrada");
      }
      
      console.log(`[CME] Aggregation loaded with ${data?.blocks?.length || 0} blocks`);
      return data;
    },
    enabled: !!aggregationId,
    retry: 2, // Aumentar retry para dar tempo de inserção assíncrona
    staleTime: 0
  });

  if (aggLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white space-y-4">
        <div className="w-16 h-16 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
        <p className="text-amber-500 font-bold animate-pulse uppercase tracking-widest text-xs">Carregando Orquestrador de Sessão...</p>
      </div>
    );
  }

  if (aggError) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-6 text-center">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
          <Trash2 className="h-8 w-8 text-red-500" />
        </div>
        <h2 className="text-xl font-black mb-2">Erro ao carregar sessão</h2>
        <p className="text-slate-400 text-sm max-w-md mb-6">Não foi possível localizar os dados da agregação cinematográfica.</p>
        <Button onClick={() => navigate(-1)} variant="outline" className="border-white/10">Voltar</Button>
      </div>
    );
  }

  const stats = {
    fatigueScore: 0.15,
    retentionScore: 0.88,
    cognitiveDensity: 0.72,
    pacingStatus: "Optimal"
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      <div className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Film className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 tracking-tight">Cinematic Session Builder</h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Aggregation Orchestrator</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="font-mono text-[10px]">ID: {aggregationId?.slice(0, 8)}</Badge>
            <Button 
              className="gap-2 font-bold shadow-lg shadow-primary/20"
              onClick={async () => {
                if (!aggregationId) return;
                
                // 1. First ensure we have a project for this aggregation
                const { data: project } = await supabase
                  .from('cme_video_projects')
                  .select('id')
                  .eq('aggregation_id', aggregationId)
                  .maybeSingle();
                
                let projectId = project?.id;
                
                if (!projectId) {
                  const { data: newProject, error } = await supabase
                    .from('cme_video_projects')
                    .insert({
                      aggregation_id: aggregationId,
                      user_id: (await supabase.auth.getUser()).data.user?.id,
                      title: aggregation?.title || 'Video Project',
                      status: 'draft'
                    })
                    .select()
                    .single();
                  
                  if (error) {
                    toast.error("Failed to create project");
                    return;
                  }
                  projectId = newProject.id;
                }

                toast.info("Iniciando Pipeline Enterprise CME...");
                
                const { data, error } = await supabase.functions.invoke('cme-orchestrator', {
                  body: { 
                    action: 'start_pipeline', 
                    projectId,
                    payload: { mode: 'enterprise' }
                  }
                });

                if (error) {
                  toast.error("Erro ao iniciar pipeline: " + error.message);
                } else {
                  toast.success("Pipeline CME iniciado com sucesso!");
                  navigate(`/admin/cinematic-engine/${projectId}`);
                }
              }}
            >
              <Play className="h-4 w-4" /> Start Enterprise Pipeline
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: "Fatigue Score", value: stats.fatigueScore, icon: Brain, color: "orange" },
            { label: "Retention", value: `${(stats.retentionScore * 100).toFixed(0)}%`, icon: Zap, color: "emerald" },
            { label: "Cognitive Density", value: stats.cognitiveDensity, icon: Activity, color: "blue" },
            { label: "Pacing", value: stats.pacingStatus, icon: Clock, color: "purple" }
          ].map((stat, i) => (
            <Card key={i} className="border-none shadow-sm">
              <CardContent className="p-4 flex items-center gap-4">
                <div className={cn("p-2 rounded-lg", `bg-${stat.color}-500/10 text-${stat.color}-600`)}>
                  <stat.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">{stat.label}</p>
                  <p className="text-xl font-black text-slate-800 tracking-tighter">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="blocks" className="space-y-6" onValueChange={setActiveTab}>
          <TabsList className="bg-slate-200/50 p-1 border shadow-inner rounded-xl">
            <TabsTrigger value="blocks" className="gap-2 font-bold rounded-lg">
              <Layers className="h-4 w-4" /> Pedagogical Blocks
            </TabsTrigger>
            <TabsTrigger value="variants" className="gap-2 font-bold rounded-lg">
              <Zap className="h-4 w-4" /> Session Variants
            </TabsTrigger>
            <TabsTrigger value="governance" className="gap-2 font-bold rounded-lg">
              <Shield className="h-4 w-4" /> Quality Governance
            </TabsTrigger>
            <TabsTrigger value="config" className="gap-2 font-bold rounded-lg">
              <Settings className="h-4 w-4" /> Engine Config
            </TabsTrigger>
          </TabsList>

          <TabsContent value="blocks" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2 border-none shadow-sm overflow-hidden">
                <CardHeader className="bg-white border-b">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg font-black tracking-tight">Timeline Orchestration</CardTitle>
                      <CardDescription className="text-xs font-bold uppercase opacity-60">Manage chapters and narrative flow</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" className="gap-2 font-bold">
                      <Plus className="h-3 w-3" /> Add Block
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {(!aggregation?.blocks || aggregation.blocks.length === 0) ? (
                      <div className="py-20 text-center space-y-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
                          <Layers className="h-6 w-6 text-slate-300" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-400">Nenhum capítulo detectado</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Aguardando processamento semântico</p>
                        </div>
                        <Button variant="outline" size="sm" className="gap-2 font-bold">
                          <Plus className="h-3.5 w-3.5" /> Gerar Capítulos Padrão
                        </Button>
                      </div>
                    ) : (
                      aggregation.blocks.sort((a: any, b: any) => a.block_order - b.block_order).map((block: any, i: number) => (
                        <div key={block.id} className="flex items-center gap-4 p-4 bg-white rounded-xl border group hover:border-primary/50 transition-all shadow-sm hover:shadow-md">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-xs text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                            {i + 1}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-black text-slate-800">{block.title}</h3>
                              <Badge variant="secondary" className="text-[9px] uppercase font-bold tracking-tighter bg-slate-100 text-slate-600 border-none">
                                {block.block_type || 'capítulo'}
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-500 line-clamp-1 mt-1 font-medium italic opacity-80">
                              {block.content?.slice(0, 100)}...
                            </p>
                          </div>
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-primary/10 hover:text-primary"><Split className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-red-50/80 hover:text-red-500"><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card className="border-none shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-sm font-black uppercase tracking-tight">Narrative Flow AI</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                      <p className="text-xs font-bold text-emerald-800">High Narrative Continuity</p>
                      <p className="text-[10px] text-emerald-600 mt-1">Transitions are smooth between pathophysiology and clinical cases.</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="variants" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {['Full Lecture', 'Feynman Cinematic', 'Exam Sprint', 'Clinical Decision'].map((v) => (
                <Card key={v} className="border-none shadow-sm hover:scale-[1.02] transition-transform cursor-pointer">
                  <CardContent className="p-6 space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <Film className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-800">{v}</h3>
                      <p className="text-xs text-slate-500 mt-1 uppercase font-bold tracking-tight">Automated Variant</p>
                    </div>
                    <Button variant="outline" className="w-full font-bold">Configure</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="governance" className="space-y-4">
            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-black tracking-tight">CME Quality Shield</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {['Quality Score', 'Narrative Score', 'Pacing Health'].map((s) => (
                    <div key={s} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-black uppercase tracking-widest text-slate-500">{s}</span>
                        <span className="text-xs font-bold">92%</span>
                      </div>
                      <Progress value={92} className="h-1.5" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default CinematicSessionBuilder;
