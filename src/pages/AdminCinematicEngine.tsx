import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  Maximize2,
  Server,
  Layout,
  Gauge,
  Shield,
  Search,
  Plus,
  Upload,
  Info,
  TrendingUp,
  Target,
  Monitor,
  Volume2,
  Globe,
  Camera,
  Scissors,
  Type,
  Palette,
  Eye,
  Thermometer,
  Layers
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { useCinematicEngine } from "@/hooks/useCinematicEngine";

const AdminCinematicEngine = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("pipeline");
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [uploadData, setUploadData] = useState({
    name: "",
    specialty: "",
    goal: "",
    type: "internal_benchmark"
  });

  const { referenceProfiles } = useCinematicEngine();

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file || !uploadData.name) {
      toast.error("Please provide a name and select a video file");
      return;
    }

    setIsUploading(true);
    try {
      const fileName = `${crypto.randomUUID()}-${file.name}`;
      const { data: uploadInfo, error: uploadError } = await supabase.storage
        .from("cme-references")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: profile, error: profileError } = await supabase
        .from("cme_cinematic_reference_profiles")
        .insert({
          reference_name: uploadData.name,
          reference_type: uploadData.type,
        })
        .select()
        .single();

      if (profileError) throw profileError;

      const { error: recordError } = await supabase
        .from("cme_reference_uploads")
        .insert({
          reference_id: profile.id,
          file_path: uploadInfo.path,
          original_filename: file.name,
          specialty: uploadData.specialty,
          pedagogical_goal: uploadData.goal,
          upload_status: "uploaded"
        });

      if (recordError) throw recordError;

      toast.success("Reference benchmark uploaded successfully");
      setIsUploadDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["cme-reference-profiles"] });
    } catch (error: any) {
      toast.error(`Upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const { data: renderJobs, isLoading: jobsLoading } = useQuery({
    queryKey: ["cme-render-jobs"],
    queryFn: async () => {
      let query = supabase
        .from("cme_render_jobs")
        .select(`
          *,
          project:cme_video_projects(title, config),
          events:cme_pipeline_events(*)
        `);
      
      const params = new URLSearchParams(window.location.search);
      const projectId = window.location.pathname.split('/').pop();
      if (projectId && projectId !== 'cinematic-engine') {
        query = query.eq('project_id', projectId);
      }
      
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const { data: tutorOrigins } = useQuery({
    queryKey: ["cme-tutor-origins"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cme_tutor_origins")
        .select("*");
      if (error) throw error;
      return data;
    }
  });

  const { data: gpuWorkers, isLoading: workersLoading } = useQuery({
    queryKey: ["cme-gpu-workers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cme_gpu_workers")
        .select("*")
        .order("worker_name", { ascending: true });
      if (error) throw error;
      return data;
    }
  });

  const stats = {
    active_renders: renderJobs?.filter(j => ['preparing', 'semantic_processing', 'cinematic_rendering', 'processing'].includes(j.status)).length || 0,
    queued_tasks: renderJobs?.filter(j => j.status === 'queued').length || 0,
    gpu_nodes: gpuWorkers?.filter(w => w.status === 'online').length || 0,
    total_vram: gpuWorkers?.reduce((acc, w) => acc + (w.vram_total_mb || 0), 0) || 0,
    avg_quality: "9.2 / 10",
    global_fatigue_index: "0.12",
    director_ai_status: "Autonomous",
    tutor_origins_count: tutorOrigins?.length || 0
  };

  const getJobStatusBadge = (status: string) => {
    const variants: Record<string, { label: string, color: string }> = {
      queued: { label: "Na fila", color: "bg-slate-500/10 text-slate-600 border-slate-200" },
      preparing: { label: "Preparando", color: "bg-blue-500/10 text-blue-600 border-blue-200 animate-pulse" },
      planning: { label: "Planejamento", color: "bg-blue-500/10 text-blue-600 border-blue-200" },
      semantic_processing: { label: "Semântica", color: "bg-purple-500/10 text-purple-600 border-purple-200 animate-pulse" },
      cinematic_rendering: { label: "Renderizando", color: "bg-indigo-500/10 text-indigo-600 border-indigo-200 animate-pulse" },
      rendering: { label: "Renderizando", color: "bg-indigo-500/10 text-indigo-600 border-indigo-200 animate-pulse" },
      processing: { label: "Processando", color: "bg-amber-500/10 text-amber-600 border-amber-200 animate-pulse" },
      completed: { label: "Concluído", color: "bg-green-500/10 text-green-600 border-green-200" },
      ready: { label: "Pronto", color: "bg-green-500/10 text-green-600 border-green-200" },
      failed: { label: "Falhou", color: "bg-red-500/10 text-red-600 border-red-200" }
    };
    const cfg = variants[status] || { label: status, color: "bg-slate-500/10 text-slate-600" };
    return <Badge className={cn("font-bold text-[10px] uppercase", cfg.color)}>{cfg.label}</Badge>;
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      <div className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shadow-inner">
              <Film className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">CME Autonomous Studio</h1>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest opacity-70">Autonomous Multi-GPU Rendering Pipeline</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="gap-2 font-bold" onClick={() => navigate("/admin")}>
              <ChevronLeft className="h-4 w-4" /> Admin
            </Button>
            <Button className="gap-2 shadow-lg shadow-primary/20 font-bold" onClick={() => setIsUploadDialogOpen(true)}>
              <Plus className="h-4 w-4" /> Upload Benchmark
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          {[
            { label: "Active Jobs", value: stats.active_renders, icon: Activity, color: "blue" },
            { label: "Director AI", value: stats.director_ai_status, icon: Camera, color: "purple" },
            { label: "Avg Quality", value: stats.avg_quality, icon: Target, color: "indigo" },
            { label: "Fatigue Index", value: stats.global_fatigue_index, icon: Brain, color: "orange" },
            { label: "GPU Nodes", value: stats.gpu_nodes, icon: Server, color: "emerald" },
            { label: "Total VRAM", value: `${Math.round(stats.total_vram/1024)}GB`, icon: Cpu, color: "orange" }
          ].map((stat, i) => (
            <Card key={i} className="border-none shadow-sm overflow-hidden group hover:shadow-md transition-all">
              <CardContent className="p-5 flex flex-col items-center justify-center text-center space-y-1">
                <div className={cn("p-2 rounded-xl mb-2 group-hover:scale-110 transition-transform", `bg-${stat.color}-500/10 text-${stat.color}-600`)}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <p className="text-2xl font-black text-slate-800 tracking-tighter">{stat.value}</p>
                <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="pipeline" className="space-y-6" onValueChange={setActiveTab}>
          <div className="flex items-center justify-between">
            <TabsList className="bg-slate-200/50 p-1 border shadow-inner rounded-xl">
              <TabsTrigger value="pipeline" className="gap-2 font-bold data-[state=active]:bg-white data-[state=active]:text-primary rounded-lg">
                <Activity className="h-4 w-4" /> Queue
              </TabsTrigger>
              <TabsTrigger value="director" className="gap-2 font-bold data-[state=active]:bg-white data-[state=active]:text-primary rounded-lg">
                <Camera className="h-4 w-4" /> Director AI
              </TabsTrigger>
              <TabsTrigger value="grammar" className="gap-2 font-bold data-[state=active]:bg-white data-[state=active]:text-primary rounded-lg">
                <Scissors className="h-4 w-4" /> Visual Grammar
              </TabsTrigger>
              <TabsTrigger value="factory" className="gap-2 font-bold data-[state=active]:bg-white data-[state=active]:text-primary rounded-lg">
                <Waves className="h-4 w-4" /> Scene Factory
              </TabsTrigger>
              <TabsTrigger value="observability" className="gap-2 font-bold data-[state=active]:bg-white data-[state=active]:text-primary rounded-lg">
                <Monitor className="h-4 w-4" /> Observability
              </TabsTrigger>
              <TabsTrigger value="optimizations" className="gap-2 font-bold data-[state=active]:bg-white data-[state=active]:text-primary rounded-lg">
                <Brain className="h-4 w-4" /> Auto-Optimization
              </TabsTrigger>
              <TabsTrigger value="governance" className="gap-2 font-bold data-[state=active]:bg-white data-[state=active]:text-primary rounded-lg">
                <Shield className="h-4 w-4" /> Governance
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="pipeline" className="space-y-4">
            <Card className="border-none shadow-sm overflow-hidden">
              <CardHeader className="bg-white border-b pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-black tracking-tight">Active Render Queue</CardTitle>
                    <CardDescription className="text-xs font-bold uppercase opacity-60">Autonomous orchestration of cinematic medical content</CardDescription>
                  </div>
                  <Badge variant="outline" className="font-mono text-[10px] bg-slate-50">Live Sync</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-[10px] text-slate-400 uppercase bg-slate-50/50 font-black tracking-widest border-b">
                      <tr>
                        <th className="px-6 py-4">Project / Task</th>
                        <th className="px-6 py-4 text-center">Status</th>
                        <th className="px-6 py-4">Progress</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {renderJobs?.map((job) => (
                        <tr key={job.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-700 text-sm">{job.project?.title || 'Unknown Project'}</span>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <Badge variant="secondary" className="text-[9px] font-black px-1.5 h-4">{job.render_type}</Badge>
                                {(job.project as any)?.config?.tutor_message_id && (
                                  <Badge variant="outline" className="text-[9px] font-black px-1.5 h-4 border-amber-500/30 text-amber-600">ORIGIN: TUTOR IA</Badge>
                                )}
                                <span className="text-[10px] text-slate-400 font-mono">#{job.id.slice(0,8)}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {getJobStatusBadge(job.status)}
                          </td>
                          <td className="px-6 py-4 w-64">
                            <div className="space-y-1.5">
                                <Progress value={job.status === 'completed' || job.status === 'ready' ? 100 : (['processing', 'rendering', 'cinematic_rendering'].includes(job.status) ? 50 : 10)} className="h-1.5" />
                                {job.events && job.events.length > 0 && (
                                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight mt-1 animate-pulse">
                                    {(job.events[job.events.length - 1] as any).stage}: {(job.events[job.events.length - 1] as any).message}
                                  </p>
                                )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Button size="icon" variant="ghost"><Settings className="h-4 w-4" /></Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="factory" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2 border-none shadow-sm overflow-hidden">
                <CardHeader className="bg-white border-b">
                  <CardTitle className="text-lg font-black tracking-tight">Granular Scene Graph Orchestrator</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                   <div className="space-y-4">
                        {[
                          { time: '00:00 - 00:15', type: 'intro', label: 'Cinematic Intro', intensity: 1.2 },
                          { time: '00:15 - 02:30', type: 'clinical_case', label: 'Patient Presentation', intensity: 3.5 },
                          { time: '02:35 - 05:00', type: 'pathophysiology', label: 'EPO Production Mechanism', intensity: 4.8 }
                        ].map((node, i) => (
                          <div key={i} className="flex items-center gap-4 mb-3 p-3 bg-white rounded-xl border shadow-sm group hover:border-primary/50 transition-all cursor-move">
                            <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center font-mono text-[8px] text-slate-400">
                               {node.time.split(' - ')[0]}
                            </div>
                            <div className="flex-1">
                               <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{node.label}</p>
                               <div className="flex gap-2 mt-1">
                                  <Badge variant="secondary" className="text-[8px] h-3.5">{node.type}</Badge>
                                  <div className="flex items-center gap-1">
                                     <div className="h-1 w-12 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-primary" style={{ width: `${(node.intensity/5)*100}%` }} />
                                     </div>
                                  </div>
                               </div>
                            </div>
                          </div>
                        ))}
                   </div>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card className="border-none shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-sm font-black uppercase tracking-tight">Active Variants</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {['Full Lecture', 'Recovery Mode', 'Exam Sprint'].map((type, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-xs font-black">{type}</span>
                        <Badge variant="outline" className="text-[9px] font-black uppercase">ready</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="observability" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="border-none shadow-sm bg-slate-900 text-white">
                <CardHeader>
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-primary flex items-center justify-between">
                    CDN Health
                    <Globe className="h-4 w-4" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xl font-black text-emerald-400">99.99%</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm">
                <CardHeader>
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center justify-between">
                    Cognitive Heatmaps
                    <Brain className="h-4 w-4 text-primary" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-20 w-full bg-slate-50 rounded-lg flex items-end gap-1 p-2 overflow-hidden border">
                    {[40, 60, 20, 90, 80, 50, 30].map((h, i) => (
                      <div key={i} className={cn("flex-1 rounded-t-sm", h > 70 ? "bg-red-400" : "bg-emerald-400")} style={{ height: `${h}%` }} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="optimizations" className="space-y-4">
            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-black tracking-tight">Self-Learning Loop</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    {[
                      { problem: 'Retention drop at 00:45s', action: 'Inject Recovery Variant', gain: '+15%' },
                      { problem: 'High fatigue detected', action: 'Slow down Pacing', gain: '+8%' }
                    ].map((opt, i) => (
                      <div key={i} className="p-4 rounded-2xl border border-primary/10 bg-primary/5">
                        <p className="text-sm font-black text-slate-800">{opt.problem}</p>
                        <p className="text-[10px] font-bold text-primary uppercase mt-1">{opt.action}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="director" className="space-y-4">
            <Card className="border-none shadow-sm overflow-hidden bg-slate-900 text-white">
              <CardHeader className="border-b border-white/10">
                <CardTitle className="text-xl font-black text-primary flex items-center gap-2">
                  <Camera className="h-6 w-6" /> Autonomous Director AI
                </CardTitle>
                <CardDescription className="text-slate-400">Automated cinematography, framing, and cognitive pacing orchestration.</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <h3 className="text-xs font-black uppercase text-primary tracking-widest">Active Director Logs</h3>
                    {[
                      { time: '14:20:05', decision: 'Apply Semantic Zoom', reasoning: 'Focus on mitral valve leaflet detail', goal: 'Visual Clarity' },
                      { time: '14:20:12', decision: 'Reduce Pacing (-15%)', reasoning: 'High cognitive intensity detected', goal: 'Retention' },
                      { time: '14:20:45', decision: 'Inject Diagram Overlay', reasoning: 'Anatomical complexity reinforcement', goal: 'Mental Model' }
                    ].map((dec, i) => (
                      <div key={i} className="flex gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                        <div className="text-[10px] font-mono text-slate-500 mt-1">{dec.time}</div>
                        <div>
                          <p className="text-sm font-black text-emerald-400">{dec.decision}</p>
                          <p className="text-xs text-slate-400 mt-1">{dec.reasoning}</p>
                          <Badge variant="outline" className="mt-2 text-[8px] border-primary/30 text-primary">{dec.goal}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-slate-800/50 rounded-3xl p-8 flex flex-col items-center justify-center text-center border border-white/5">
                    <div className="relative mb-6">
                       <Maximize2 className="h-16 w-16 text-primary animate-pulse" />
                       <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
                    </div>
                    <h4 className="text-lg font-black">Framing Optimizer</h4>
                    <p className="text-xs text-slate-400 mt-2 max-w-xs">Director AI is currently adjusting camera paths for 3 active render jobs.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="grammar" className="space-y-4">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
               {[
                 { specialty: 'Cardiology', color: 'red', rules: 142, motion: 'Pulsative' },
                 { specialty: 'Neurology', color: 'purple', rules: 89, motion: 'Synaptic' },
                 { specialty: 'Emergency', color: 'orange', rules: 215, motion: 'Urgent' },
                 { specialty: 'Anatomy', color: 'emerald', rules: 167, motion: 'Detailed' }
               ].map((gram, i) => (
                 <Card key={i} className="border-none shadow-sm group hover:scale-[1.02] transition-transform">
                   <CardContent className="p-5 space-y-4">
                     <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", `bg-${gram.color}-500/10 text-${gram.color}-600`)}>
                       <Palette className="h-5 w-5" />
                     </div>
                     <div>
                       <p className="text-sm font-black">{gram.specialty}</p>
                       <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{gram.motion} Grammar</p>
                     </div>
                     <div className="pt-2 border-t flex justify-between items-center">
                        <span className="text-[10px] font-black text-slate-500 uppercase">{gram.rules} Rules Active</span>
                        <Button size="icon" variant="ghost" className="h-6 w-6"><Scissors className="h-3 w-3" /></Button>
                     </div>
                   </CardContent>
                 </Card>
               ))}
             </div>
          </TabsContent>

          <TabsContent value="governance" className="space-y-4">
            <Card className="border-none shadow-sm overflow-hidden">
              <CardHeader className="bg-white border-b">
                <CardTitle className="text-lg font-black tracking-tight">CME Governance Workflow</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="p-12">
                   <div className="max-w-4xl mx-auto space-y-2">
                     {['Draft', 'Semantic Review', 'Narrative Review', 'Medical Review'].map((step, idx) => (
                       <div key={idx} className="flex items-center gap-4 p-4 rounded-xl border bg-slate-50/50">
                          <div className="h-6 w-6 rounded-full bg-green-500 text-white flex items-center justify-center text-[10px] font-bold">{idx + 1}</div>
                          <p className="font-bold text-sm">{step}</p>
                       </div>
                     ))}
                   </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">CME Reference Studio</DialogTitle>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            <div className="grid gap-2">
              <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Benchmark Name</Label>
              <Input 
                placeholder="e.g. Masterclass Cardiology v1" 
                value={uploadData.name}
                onChange={(e) => setUploadData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Reference Video File</Label>
              <div 
                className="border-2 border-dashed rounded-2xl p-8 text-center bg-slate-50 cursor-pointer group"
                onClick={() => fileInputRef.current?.click()}
              >
                <input type="file" className="hidden" ref={fileInputRef} accept="video/*" />
                <Upload className="h-8 w-8 mx-auto mb-2 text-slate-400 group-hover:text-primary transition-colors" />
                <p className="text-sm font-bold text-slate-600">Click to upload</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUpload} disabled={isUploading}>
               {isUploading ? 'Processing...' : 'Start Extraction'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCinematicEngine;
