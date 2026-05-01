
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Layers, 
  Clock, 
  Zap, 
  Pause, 
  Play, 
  Settings,
  AlertCircle,
  Activity
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { CMERenderQueue } from "./types";

export const RenderQueuesPanel = () => {
  const { data: queues, refetch } = useQuery({
    queryKey: ["cme-render-queues"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cme_render_queues")
        .select("*, priority:cme_queue_priorities(*)");
      if (error) throw error;
      return data;
    }
  });

  const { data: queueStats } = useQuery({
    queryKey: ["cme-queue-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cme_render_jobs")
        .select("queue_id, status");
      if (error) throw error;
      
      const stats: Record<string, { queued: number, running: number }> = {};
      data.forEach(job => {
        if (!job.queue_id) return;
        if (!stats[job.queue_id]) stats[job.queue_id] = { queued: 0, running: 0 };
        if (job.status === 'queued') stats[job.queue_id].queued++;
        if (['preparing', 'rendering', 'processing'].includes(job.status)) stats[job.queue_id].running++;
      });
      return stats;
    }
  });

  const toggleQueue = async (id: string, isPaused: boolean) => {
    try {
      const { error } = await supabase
        .from("cme_render_queues")
        .update({ is_paused: !isPaused })
        .eq("id", id);
      if (error) throw error;
      toast.success(isPaused ? "Queue resumed" : "Queue paused");
      refetch();
    } catch (err) {
      toast.error("Failed to update queue status");
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {queues?.map((queue: any) => (
          <Card key={queue.id} className="border-none shadow-sm overflow-hidden group">
            <CardHeader className="bg-white border-b pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-slate-100 text-slate-600">
                    <Layers className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-sm font-black tracking-tight uppercase">{queue.name}</CardTitle>
                </div>
                <Badge variant={queue.is_paused ? "destructive" : "default"} className="text-[9px]">
                  {queue.is_paused ? "PAUSED" : "ACTIVE"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-[10px] font-black text-slate-400 uppercase">Priority</p>
                  <p className="text-sm font-bold text-primary">{queue.priority?.name || 'Standard'}</p>
                </div>
                <div className="space-y-0.5 text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase">Concurrency</p>
                  <p className="text-sm font-bold text-slate-700">{queue.max_concurrency} Jobs</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-50 p-2 rounded-lg text-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase">Queued</p>
                  <p className="text-lg font-black text-slate-900">{queueStats?.[queue.id]?.queued || 0}</p>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg text-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase">Running</p>
                  <p className="text-lg font-black text-slate-900">{queueStats?.[queue.id]?.running || 0}</p>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full font-bold gap-2 text-xs"
                  onClick={() => toggleQueue(queue.id, queue.is_paused)}
                >
                  {queue.is_paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                  {queue.is_paused ? "Resume" : "Pause"}
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400">
                  <Settings className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl font-black tracking-tight">Render Orchestrator Policies</CardTitle>
          <CardDescription className="text-xs font-bold uppercase text-slate-400">SLA and throughput management for multi-tenant workloads</CardDescription>
        </CardHeader>
        <CardContent>
           <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                 <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                 <div>
                    <p className="text-sm font-black text-amber-900 uppercase tracking-tight">Auto-Throttling Active</p>
                    <p className="text-xs text-amber-700 font-medium">System is currently prioritizing Emergency SLA jobs due to high VRAM utilization across Cluster-Alpha.</p>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                 <div className="space-y-2">
                    <p className="text-xs font-black uppercase text-slate-400 flex items-center gap-1.5">
                       <Zap className="h-3.5 w-3.5" /> Global Throughput
                    </p>
                    <div className="flex items-end gap-2">
                       <span className="text-3xl font-black text-slate-900">14.2</span>
                       <span className="text-xs font-bold text-slate-400 mb-1.5">Renders/Hour</span>
                    </div>
                    <Progress value={71} className="h-1.5" />
                 </div>
                 
                 <div className="space-y-2">
                    <p className="text-xs font-black uppercase text-slate-400 flex items-center gap-1.5">
                       <Clock className="h-3.5 w-3.5" /> Avg Queue Time
                    </p>
                    <div className="flex items-end gap-2">
                       <span className="text-3xl font-black text-slate-900">4.5</span>
                       <span className="text-xs font-bold text-slate-400 mb-1.5">Minutes</span>
                    </div>
                    <Progress value={25} className="h-1.5" />
                 </div>

                 <div className="space-y-2">
                    <p className="text-xs font-black uppercase text-slate-400 flex items-center gap-1.5">
                       <Activity className="h-3.5 w-3.5" /> Success Rate
                    </p>
                    <div className="flex items-end gap-2">
                       <span className="text-3xl font-black text-slate-900">99.2</span>
                       <span className="text-xs font-bold text-slate-400 mb-1.5">%</span>
                    </div>
                    <Progress value={99} className="h-1.5" indicatorClassName="bg-emerald-500" />
                 </div>
              </div>
           </div>
        </CardContent>
      </Card>
    </div>
  );
};
