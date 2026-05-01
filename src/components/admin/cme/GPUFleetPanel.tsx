
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Server, 
  Cpu, 
  Thermometer, 
  Activity, 
  RefreshCcw,
  Power,
  TrendingUp,
  AlertCircle,
  Zap,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import { useAutoScaling } from "@/hooks/useAutoScaling";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CMEGPUCluster, CMEWorkerNode } from "./types";

export const GPUFleetPanel = () => {
  const [realtimeWorkers, setRealtimeWorkers] = useState<CMEWorkerNode[]>([]);

  const { data: clusters } = useQuery({
    queryKey: ["cme-gpu-clusters"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cme_gpu_clusters")
        .select("*");
      if (error) throw error;
      return data as unknown as CMEGPUCluster[];
    }
  });

  const { data: initialWorkers, refetch: refetchWorkers } = useQuery({
    queryKey: ["cme-worker-nodes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cme_worker_nodes")
        .select("*")
        .order("hostname");
      if (error) throw error;
      return data as unknown as CMEWorkerNode[];
    }
  });

  useEffect(() => {
    if (initialWorkers) {
      setRealtimeWorkers(initialWorkers);
    }
  }, [initialWorkers]);

  useEffect(() => {
    const channel = supabase
      .channel('cme-worker-updates')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'cme_worker_nodes' }, 
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setRealtimeWorkers(current => 
              current.map(w => w.id === payload.new.id ? { ...w, ...payload.new } : w)
            );
          } else if (payload.eventType === 'INSERT') {
            setRealtimeWorkers(current => [...current, payload.new as unknown as CMEWorkerNode]);
          } else if (payload.eventType === 'DELETE') {
            setRealtimeWorkers(current => current.filter(w => w.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleDrain = async (workerId: string, isDraining: boolean) => {
    try {
      const { error } = await supabase
        .from("cme_worker_nodes")
        .update({ is_draining: !isDraining })
        .eq("id", workerId);
      
      if (error) throw error;
      toast.success(isDraining ? "Worker resume requested" : "Worker draining initiated");
    } catch (err) {
      toast.error("Failed to update worker state");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'online': return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200">ONLINE</Badge>;
      case 'offline': return <Badge className="bg-red-500/10 text-red-600 border-red-200">OFFLINE</Badge>;
      case 'busy': return <Badge className="bg-amber-500/10 text-amber-600 border-amber-200">BUSY</Badge>;
      case 'maintenance': return <Badge className="bg-slate-500/10 text-slate-600 border-slate-200">MAINTENANCE</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {clusters?.map(cluster => (
          <Card key={cluster.id} className="border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-white border-b pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-black tracking-tight">{cluster.name}</CardTitle>
                  <CardDescription className="text-[10px] uppercase font-bold text-slate-400">
                    {cluster.region} • {cluster.provider}
                  </CardDescription>
                </div>
                <Badge variant={cluster.is_active ? "default" : "secondary"}>
                  {cluster.is_active ? "ACTIVE" : "INACTIVE"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-3 rounded-xl">
                  <p className="text-[10px] font-black text-slate-400 uppercase">Workers</p>
                  <p className="text-xl font-black text-slate-900">
                    {realtimeWorkers.filter(w => w.cluster_id === cluster.id).length} / {cluster.max_workers}
                  </p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl">
                  <p className="text-[10px] font-black text-slate-400 uppercase">Avg VRAM</p>
                  <p className="text-xl font-black text-slate-900">
                    {Math.round(realtimeWorkers
                      .filter(w => w.cluster_id === cluster.id && w.gpu_utilization_pct !== undefined)
                      .reduce((acc, w) => acc + (w.gpu_utilization_pct || 0), 0) / 
                      (realtimeWorkers.filter(w => w.cluster_id === cluster.id).length || 1))}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl font-black tracking-tight">Worker Fleet Operations</CardTitle>
            <CardDescription className="text-xs font-bold uppercase text-slate-400">Real-time GPU node telemetry and orchestration</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetchWorkers()} className="gap-2 font-bold">
            <RefreshCcw className="h-4 w-4" /> Refresh Fleet
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {realtimeWorkers.map(worker => (
              <Card key={worker.id} className={cn(
                "border shadow-sm hover:shadow-md transition-all group",
                worker.is_draining && "opacity-70 bg-slate-50"
              )}>
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-xl",
                        worker.status === 'online' ? "bg-emerald-500/10 text-emerald-600" : "bg-slate-100 text-slate-400"
                      )}>
                        <Server className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-black text-slate-800 tracking-tight">{worker.hostname}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {getStatusBadge(worker.status)}
                          {worker.is_draining && <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50 text-[9px]">DRAINING</Badge>}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-orange-600" onClick={() => handleDrain(worker.id, worker.is_draining)}>
                        <Power className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-primary">
                        <Activity className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">
                        <span className="flex items-center gap-1"><Cpu className="h-3 w-3" /> VRAM</span>
                        <span>{worker.vram_used_mb || 0} / {worker.vram_total_mb || 0} MB</span>
                      </div>
                      <Progress value={((worker.vram_used_mb || 0) / (worker.vram_total_mb || 1)) * 100} className="h-1.5" />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">
                        <span className="flex items-center gap-1"><Thermometer className="h-3 w-3" /> TEMP</span>
                        <span>{worker.temperature_c || 0}°C</span>
                      </div>
                      <Progress 
                        value={(worker.temperature_c || 0)} 
                        className="h-1.5" 
                        indicatorClassName={cn(
                          (worker.temperature_c || 0) > 80 ? "bg-red-500" : (worker.temperature_c || 0) > 70 ? "bg-orange-500" : "bg-emerald-500"
                        )}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t text-[10px] font-bold text-slate-400">
                    <span className="flex items-center gap-1 uppercase tracking-tight">
                      <Activity className="h-3 w-3" /> Load: {worker.gpu_utilization_pct || 0}%
                    </span>
                    <span className="font-mono">
                      Last: {worker.last_heartbeat ? new Date(worker.last_heartbeat).toLocaleTimeString() : 'N/A'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
