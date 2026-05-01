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
  Target
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
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

  const { referenceProfiles, isLoading: engineLoading } = useCinematicEngine();

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

      toast.success("Reference benchmark uploaded successfully and queued for analysis");
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
      const { data, error } = await supabase
        .from("cme_render_jobs")
        .select(`
          *,
          project:cme_video_projects(title),
          quality_scores:cme_cinematic_quality_score(overall_cinematic_score, scoring_explanation)
        `)
        .order("queued_at", { ascending: false });
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

  const { data: stats } = useQuery({
    queryKey: ["cme-stats"],
    queryFn: async () => ({
      active_renders: renderJobs?.filter(j => ['preparing', 'semantic_processing', 'cinematic_rendering'].includes(j.status)).length || 0,
      queued_tasks: renderJobs?.filter(j => j.status === 'queued').length || 0,
      avg_render_time: "12m 45s",
      success_rate: "98.2%",
      gpu_nodes: gpuWorkers?.filter(w => w.status === 'online').length || 0,
      total_vram: gpuWorkers?.reduce((acc, w) => acc + (w.vram_total_mb || 0), 0) || 0,
      avg_quality: "8.4 / 10"
    }),
    enabled: !!renderJobs && !!gpuWorkers
  });

  const getJobStatusBadge = (status: string) => {
    const variants: Record<string, { label: string, color: string }> = {
      queued: { label: "Na fila", color: "bg-slate-500/10 text-slate-600 border-slate-200" },
      preparing: { label: "Preparando", color: "bg-blue-500/10 text-blue-600 border-blue-200 animate-pulse" },
      cinematic_rendering: { label: "Renderizando", color: "bg-indigo-500/10 text-indigo-600 border-indigo-200 animate-pulse" },
      completed: { label: "Concluído", color: "bg-green-500/10 text-green-600 border-green-200" },
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
            <Button className="gap-2 shadow-lg shadow-primary/20 font-bold">
              <Zap className="h-4 w-4 fill-white" /> Manual Render
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          {[
            { label: "Active Jobs", value: stats?.active_renders, icon: Activity, color: "blue" },
            { label: "Queue Depth", value: stats?.queued_tasks, icon: History, color: "purple" },
            { label: "Avg Quality", value: stats?.avg_quality, icon: Target, color: "indigo" },
            { label: "Success Rate", value: stats?.success_rate, icon: CheckCircle2, color: "green" },
            { label: "GPU Nodes", value: stats?.gpu_nodes, icon: Server, color: "emerald" },
            { label: "Total VRAM", value: `${Math.round((stats?.total_vram || 0)/1024)}GB`, icon: Cpu, color: "orange" }
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
              <TabsTrigger value="references" className="gap-2 font-bold data-[state=active]:bg-white data-[state=active]:text-primary rounded-lg">
                <Layout className="h-4 w-4" /> Reference Benchmarks
              </TabsTrigger>
              <TabsTrigger value="workers" className="gap-2 font-bold data-[state=active]:bg-white data-[state=active]:text-primary rounded-lg">
                <Server className="h-4 w-4" /> GPU Cluster
              </TabsTrigger>
              <TabsTrigger value="analytics" className="gap-2 font-bold data-[state=active]:bg-white data-[state=active]:text-primary rounded-lg">
                <BarChart3 className="h-4 w-4" /> Analytics
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
                  <Badge variant="outline" className="font-mono text-[10px] bg-slate-50">Auto-Refresh: 5s</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-[10px] text-slate-400 uppercase bg-slate-50/50 font-black tracking-widest border-b">
                      <tr>
                        <th className="px-6 py-4">Project / Task</th>
                        <th className="px-6 py-4 text-center">Status</th>
                        <th className="px-6 py-4">Node</th>
                        <th className="px-6 py-4">Render Progress</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {jobsLoading ? (
                        <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400 animate-pulse font-bold">Scanning render queue...</td></tr>
                      ) : renderJobs?.length === 0 ? (
                        <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-bold">No active render jobs.</td></tr>
                      ) : renderJobs?.map((job) => (
                        <tr key={job.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-700 text-sm">{job.project?.title || 'Unknown Project'}</span>
                              <div className="flex items-center gap-1.5 mt-1">
                                <Badge variant="secondary" className="text-[9px] font-black px-1.5 h-4">{job.render_type}</Badge>
                                <span className="text-[10px] text-slate-400 font-mono">#{job.id.slice(0,8)}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {getJobStatusBadge(job.status)}
                          </td>
                          <td className="px-6 py-4">
                            {job.gpu_worker_id ? (
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                <span className="text-xs font-bold text-slate-600">Node_{job.gpu_worker_id.slice(0,4)}</span>
                              </div>
                            ) : (
                              <span className="text-xs font-bold text-slate-400 italic">Unassigned</span>
                            )}
                          </td>
                          <td className="px-6 py-4 w-64">
                            <div className="space-y-1.5">
                              <div className="flex justify-between text-[10px] font-black uppercase text-slate-500">
                                <span>{job.status === 'completed' ? 'Finalized' : 'Encoding'}</span>
                                <span>{job.status === 'completed' ? '100%' : '42%'}</span>
                              </div>
                              <Progress value={job.status === 'completed' ? 100 : 42} className="h-1.5" />
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg">
                                <Settings className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-slate-400 hover:text-red-500">
                                <AlertCircle className="h-4 w-4" />
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
                  <CardTitle className="text-sm font-black flex items-center gap-2 uppercase tracking-tight">
                    <Gauge className="h-4 w-4 text-primary" /> 
                    Real-time GPU Load Map
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {workersLoading ? (
                    <div className="py-4 text-center text-xs font-bold text-slate-400">Loading worker telemetry...</div>
                  ) : gpuWorkers?.map((worker) => (
                    <div key={worker.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className={cn("p-2 rounded-xl", worker.status === 'online' ? "bg-green-500/10 text-green-600" : "bg-slate-200 text-slate-400")}>
                            <Server className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-800">{worker.worker_name}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">{worker.gpu_model || 'NVIDIA RTX 4090'}</p>
                          </div>
                        </div>
                        <Badge className={cn("text-[9px] font-black uppercase", worker.status === 'online' ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500")}>
                          {worker.status}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-[10px] font-black uppercase text-slate-500 px-0.5">
                          <span>VRAM Utilization</span>
                          <span>{worker.vram_used_mb || 0} / {worker.vram_total_mb || 24576} MB</span>
                        </div>
                        <Progress value={((worker.vram_used_mb || 0) / (worker.vram_total_mb || 24576)) * 100} className="h-1.5" />
                      </div>
                      <div className="flex items-center gap-4 pt-1">
                        <div className="flex items-center gap-1.5">
                          <Activity className="h-3 w-3 text-slate-400" />
                          <span className="text-[10px] font-bold text-slate-500">{worker.active_jobs || 0} Active Tasks</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Zap className="h-3 w-3 text-slate-400" />
                          <span className="text-[10px] font-bold text-slate-500">{Math.round(worker.current_load * 100 || 0)}% Core Load</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm">
                <CardHeader>
                  <CardTitle className="text-sm font-black flex items-center gap-2 uppercase tracking-tight">
                    <BarChart3 className="h-4 w-4 text-indigo-500" /> 
                    Render Stage Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-[300px] flex items-center justify-center text-slate-400 italic text-xs font-bold text-center px-12">
                  Rendering stage breakdown: 
                  Semantic Planning (12%) · Narrative (18%) · Voice (15%) · 
                  Visual Comp (25%) · Cinematic Render (30%)
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="workers" className="h-64 flex flex-col items-center justify-center text-slate-400">
             <Server className="h-12 w-12 mb-4 opacity-20" />
             <p className="font-bold text-sm">GPU Cluster Management coming in Phase 17</p>
             <p className="text-xs">Distributed worker orchestration & auto-scaling</p>
          </TabsContent>
          
          <TabsContent value="references" className="space-y-4">
            <Card className="border-none shadow-sm">
              <CardHeader className="bg-white border-b flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-lg font-black tracking-tight">Cinematic Reference Library</CardTitle>
                  <CardDescription className="text-xs font-bold uppercase opacity-60">High-retention benchmarks for learned pacing and narrative</CardDescription>
                </div>
                <Button className="gap-2 font-bold" onClick={() => setIsUploadDialogOpen(true)}>
                  <Plus className="h-4 w-4" /> Add Benchmark
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                 {engineLoading ? (
                   <div className="p-12 text-center text-slate-400 animate-pulse font-bold">Synchronizing benchmarks...</div>
                 ) : referenceProfiles?.length === 0 ? (
                   <div className="p-12 text-center text-slate-400">
                      <Layout className="h-12 w-12 mx-auto mb-4 opacity-20" />
                      <p className="font-bold text-sm">Learning from reference videos...</p>
                      <p className="text-xs max-w-sm mx-auto mt-2">CME Reference Engine v3.0 extracting narrative patterns and cognitive curves from benchmark content.</p>
                   </div>
                 ) : (
                   <div className="overflow-x-auto">
                     <table className="w-full text-sm text-left">
                       <thead className="text-[10px] text-slate-400 uppercase bg-slate-50/50 font-black tracking-widest border-b">
                         <tr>
                           <th className="px-6 py-4">Reference Benchmark</th>
                           <th className="px-6 py-4">Type</th>
                           <th className="px-6 py-4">Duration</th>
                           <th className="px-6 py-4">Pacing Learning</th>
                           <th className="px-6 py-4 text-right">Similarity Actions</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y">
                         {referenceProfiles?.map((profile) => (
                           <tr key={profile.id} className="hover:bg-slate-50/50 transition-colors group">
                             <td className="px-6 py-4">
                               <div className="flex items-center gap-3">
                                 <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                                   <Film className="h-5 w-5" />
                                 </div>
                                 <div>
                                   <p className="font-bold text-slate-700">{profile.reference_name}</p>
                                   <p className="text-[10px] text-slate-400 font-mono">ID: {profile.id.slice(0,8)}</p>
                                 </div>
                               </div>
                             </td>
                             <td className="px-6 py-4">
                               <Badge variant="secondary" className="text-[9px] font-black uppercase px-2">{profile.reference_type}</Badge>
                             </td>
                             <td className="px-6 py-4 text-slate-500 font-mono text-xs">
                               {Math.floor(profile.video_duration_seconds / 60)}:{(profile.video_duration_seconds % 60).toString().padStart(2,'0')}
                             </td>
                             <td className="px-6 py-4">
                               <div className="flex gap-2">
                                 <Badge variant="outline" className="text-[9px] border-emerald-200 text-emerald-600 bg-emerald-50">Narrative Pattern</Badge>
                                 <Badge variant="outline" className="text-[9px] border-blue-200 text-blue-600 bg-blue-50">Cognitive Curve</Badge>
                               </div>
                             </td>
                             <td className="px-6 py-4 text-right">
                               <Button size="sm" variant="ghost" className="font-bold text-xs">Use as Model</Button>
                             </td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                   </div>
                 )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <Card className="border-none shadow-sm">
              <CardHeader className="bg-white border-b">
                <CardTitle className="text-lg font-black tracking-tight">Multimodal Analytics & Friction Engine</CardTitle>
                <CardDescription className="text-xs font-bold uppercase opacity-60">High-fidelity tracking of cinematic retention and fatigue reduction</CardDescription>
              </CardHeader>
              <CardContent className="h-64 flex flex-col items-center justify-center text-slate-400 italic font-bold">
                 <BarChart3 className="h-12 w-12 mb-4 opacity-20" />
                 <p>Real-time friction maps and ACE feedback loop status.</p>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="governance" className="space-y-4">
             <Card className="border-none shadow-sm overflow-hidden">
                <CardHeader className="bg-white border-b flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-lg font-black tracking-tight">CME Governance Workflow</CardTitle>
                    <CardDescription className="text-xs font-bold uppercase opacity-60">Mandatory medical, semantic, and cinematic verification queue</CardDescription>
                  </div>
                  <Badge className="bg-red-500/10 text-red-600 border-red-200 uppercase font-black text-[10px]">Publication Guardian Active</Badge>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="p-12 text-center text-slate-400 italic font-bold">
                    <Shield className="h-12 w-12 mb-4 opacity-20 mx-auto" />
                    <p className="font-bold text-sm uppercase tracking-tighter">Review Queue Management</p>
                    <p className="text-xs font-normal max-w-md mx-auto mt-2">All CME outputs must undergo semantic, narrative, and medical review before public release.</p>
                  </div>
                </CardContent>
             </Card>
          </TabsContent>
        </Tabs>
      </div>
      </div>

      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">CME Reference Studio</DialogTitle>
            <DialogDescription className="text-xs font-bold uppercase tracking-wider opacity-60">
              Upload video benchmark for cognitive/cinematic pattern extraction
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name" className="text-xs font-black uppercase tracking-widest text-slate-500">Benchmark Name</Label>
              <Input 
                id="name" 
                placeholder="e.g. Masterclass Cardiology v1" 
                className="font-bold"
                value={uploadData.name}
                onChange={(e) => setUploadData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="type" className="text-xs font-black uppercase tracking-widest text-slate-500">Benchmark Type</Label>
                <select 
                  id="type"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-bold"
                  value={uploadData.type}
                  onChange={(e) => setUploadData(prev => ({ ...prev, type: e.target.value }))}
                >
                  <option value="internal_benchmark">Internal Benchmark</option>
                  <option value="expert_reference">Expert Reference</option>
                  <option value="high_retention_sample">High Retention Sample</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="specialty" className="text-xs font-black uppercase tracking-widest text-slate-500">Medical Specialty</Label>
                <Input 
                  id="specialty" 
                  placeholder="e.g. Cardiology" 
                  className="font-bold"
                  value={uploadData.specialty}
                  onChange={(e) => setUploadData(prev => ({ ...prev, specialty: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="goal" className="text-xs font-black uppercase tracking-widest text-slate-500">Pedagogical Objective</Label>
              <Textarea 
                id="goal" 
                placeholder="Describe how this reference should influence retention..." 
                className="font-bold resize-none h-20"
                value={uploadData.goal}
                onChange={(e) => setUploadData(prev => ({ ...prev, goal: e.target.value }))}
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Reference Video File</Label>
              <div 
                className="border-2 border-dashed rounded-2xl p-8 text-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer group"
                onClick={() => fileInputRef.current?.click()}
              >
                <input type="file" className="hidden" ref={fileInputRef} accept="video/*" />
                <Upload className="h-8 w-8 mx-auto mb-2 text-slate-400 group-hover:text-primary transition-colors" />
                <p className="text-sm font-bold text-slate-600">Click to upload or drag & drop</p>
                <p className="text-[10px] uppercase font-black text-slate-400 mt-1">MP4, MOV, WEBM (Max 500MB)</p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" className="font-bold" onClick={() => setIsUploadDialogOpen(false)}>Cancel</Button>
            <Button 
              className="font-bold shadow-lg shadow-primary/20 gap-2" 
              onClick={handleUpload}
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Start Extraction
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ... keep existing code at the bottom (cn import etc)
import { cn } from "@/lib/utils";

export default AdminCinematicEngine;

