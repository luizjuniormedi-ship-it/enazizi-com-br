import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
  Maximize2,
  Server,
  Layout,
  Gauge
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";

const AdminCinematicEngine = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("pipeline");

  const { data: renderJobs, isLoading: jobsLoading } = useQuery({
    queryKey: ["cme-render-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cme_render_jobs")
        .select(`
          *,
          project:cme_video_projects(title)
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
      total_vram: gpuWorkers?.reduce((acc, w) => acc + (w.vram_total_mb || 0), 0) || 0
    })
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
            { label: "GPU Nodes", value: stats?.gpu_nodes, icon: Server, color: "emerald" },
            { label: "Success Rate", value: stats?.success_rate, icon: CheckCircle2, color: "green" },
            { label: "Avg Render", value: stats?.avg_render_time, icon: Clock, color: "orange" },
            { label: "Total VRAM", value: `${Math.round((stats?.total_vram || 0)/1024)}GB`, icon: Cpu, color: "indigo" }
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
              <TabsTrigger value="workers" className="gap-2 font-bold data-[state=active]:bg-white data-[state=active]:text-primary rounded-lg">
                <Server className="h-4 w-4" /> GPU Cluster
              </TabsTrigger>
              <TabsTrigger value="analytics" className="gap-2 font-bold data-[state=active]:bg-white data-[state=active]:text-primary rounded-lg">
                <BarChart3 className="h-4 w-4" /> Analytics
              </TabsTrigger>
              <TabsTrigger value="infrastructure" className="gap-2 font-bold data-[state=active]:bg-white data-[state=active]:text-primary rounded-lg">
                <Settings className="h-4 w-4" /> Orchestration
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
          
          <TabsContent value="analytics" className="h-64 flex flex-col items-center justify-center text-slate-400 italic font-bold">
            Multimodal Retention Scores & Fatigue-Aware Analytics Layer
          </TabsContent>
          
          <TabsContent value="infrastructure" className="h-64 flex flex-col items-center justify-center text-slate-400 italic font-bold">
            Distributed Rendering Logic & Manual Fix/Override Panel
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

// ... keep existing code at the bottom (cn import etc)
import { cn } from "@/lib/utils";

export default AdminCinematicEngine;

