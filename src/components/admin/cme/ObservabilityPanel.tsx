
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  BarChart3, 
  TrendingUp, 
  Target, 
  Zap,
  Activity,
  History,
  ShieldAlert
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export const CMEObservabilityPanel = () => {
  const { data: pipelineStats } = useQuery({
    queryKey: ["cme-pipeline-observability"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cme_pipeline_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    }
  });

  const { data: costStats } = useQuery({
    queryKey: ["cme-cost-metrics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cme_gpu_cost_metrics")
        .select("*, cost_center:cme_cost_centers(*)");
      if (error) throw error;
      return data;
    }
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Pipeline Health", value: "98.5%", icon: Activity, color: "emerald", trend: "+0.2%" },
          { label: "Avg Render Cost", value: "$0.42", icon: Zap, color: "blue", trend: "-5.1%" },
          { label: "SLA Adherence", value: "100%", icon: Target, color: "indigo", trend: "Stable" },
          { label: "System Load", value: "64%", icon: BarChart3, color: "orange", trend: "+12%" }
        ].map((stat, i) => (
          <Card key={i} className="border-none shadow-sm group">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <div className={cn("p-2 rounded-xl", `bg-${stat.color}-500/10 text-${stat.color}-600`)}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <Badge variant="outline" className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border-emerald-100">
                  {stat.trend}
                </Badge>
              </div>
              <p className="text-2xl font-black text-slate-900 tracking-tighter">{stat.value}</p>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-none shadow-sm">
          <CardHeader>
             <CardTitle className="text-xl font-black tracking-tight">Stage Latency Matrix</CardTitle>
             <CardDescription className="text-xs font-bold uppercase text-slate-400">P95 processing time across distributed pipeline stages</CardDescription>
          </CardHeader>
          <CardContent>
             <div className="space-y-6">
                {[
                  { stage: "Ingestion", p95: "12s", limit: "30s", pct: 40 },
                  { stage: "Semantic Planning", p95: "45s", limit: "120s", pct: 37 },
                  { stage: "Scene Graph Gen", p95: "82s", limit: "300s", pct: 27 },
                  { stage: "GPU Render", p95: "412s", limit: "1200s", pct: 34 },
                  { stage: "HLS Packaging", p95: "18s", limit: "60s", pct: 30 }
                ].map((s, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold uppercase tracking-tight">
                       <span className="text-slate-600">{s.stage}</span>
                       <div className="flex gap-4">
                          <span className="text-slate-400">Limit: {s.limit}</span>
                          <span className="text-primary font-black">P95: {s.p95}</span>
                       </div>
                    </div>
                    <Progress value={s.pct} className="h-2" indicatorClassName="bg-indigo-500" />
                  </div>
                ))}
             </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
             <CardTitle className="text-xl font-black tracking-tight">Recent Pipeline Events</CardTitle>
             <CardDescription className="text-xs font-bold uppercase text-slate-400">Distributed tracing log</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
             <div className="max-h-[400px] overflow-y-auto">
                {pipelineStats?.map((event: any) => (
                  <div key={event.id} className="p-4 border-b last:border-0 hover:bg-slate-50 transition-colors">
                     <div className="flex items-center justify-between mb-1">
                        <Badge variant="outline" className="text-[9px] font-black uppercase tracking-tight h-4">
                           {event.stage}
                        </Badge>
                        <span className="text-[10px] font-mono text-slate-400">
                           {new Date(event.created_at).toLocaleTimeString()}
                        </span>
                     </div>
                     <p className="text-xs font-bold text-slate-700 leading-tight">{event.message}</p>
                     <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Job: {event.render_job_id.slice(0, 8)}</span>
                        {event.event_type === 'error' && <ShieldAlert className="h-3 w-3 text-red-500" />}
                     </div>
                  </div>
                ))}
             </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl font-black tracking-tight">Cost Governance & Budget</CardTitle>
          <CardDescription className="text-xs font-bold uppercase text-slate-400">Allocation and utilization across active cost centers</CardDescription>
        </CardHeader>
        <CardContent>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {costStats?.slice(0, 4).map((cost: any) => (
                <div key={cost.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                   <div className="flex items-center gap-2 mb-3">
                      <div className="p-1.5 rounded-lg bg-white shadow-sm text-indigo-600">
                         <TrendingUp className="h-4 w-4" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 truncate">
                         {cost.cost_center?.name || 'Unassigned'}
                      </span>
                   </div>
                   <p className="text-xl font-black text-slate-900">${cost.estimated_cost?.toFixed(2) || '0.00'}</p>
                   <div className="flex items-center justify-between mt-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">VRAM Minutes: {cost.vram_minutes?.toFixed(1)}</span>
                      <span className="text-[9px] font-black text-emerald-600 uppercase">Within Budget</span>
                   </div>
                </div>
              ))}
           </div>
        </CardContent>
      </Card>
    </div>
  );
};
