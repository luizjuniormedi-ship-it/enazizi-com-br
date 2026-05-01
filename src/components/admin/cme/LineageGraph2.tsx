
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Network, 
  Database, 
  Film, 
  History, 
  ArrowRight,
  Brain,
  Zap,
  CheckCircle2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const LineageGraph2 = ({ jobId }: { jobId?: string }) => {
  const { data: nodes } = useQuery({
    queryKey: ["cme-lineage-nodes", jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cme_lineage_nodes")
        .select("*");
      if (error) throw error;
      return data;
    }
  });

  const { data: edges } = useQuery({
    queryKey: ["cme-lineage-edges", jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cme_lineage_edges")
        .select("*");
      if (error) throw error;
      return data;
    }
  });

  const getIcon = (type: string) => {
    switch (type) {
      case 'tutor_session': return <Brain className="h-4 w-4" />;
      case 'aggregated_content': return <Database className="h-4 w-4" />;
      case 'scene_graph': return <Network className="h-4 w-4" />;
      case 'render_artifact': return <Film className="h-4 w-4" />;
      default: return <Zap className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-none shadow-sm overflow-hidden bg-slate-50/50">
        <CardHeader className="bg-white border-b">
           <div className="flex items-center justify-between">
              <div>
                 <CardTitle className="text-xl font-black tracking-tight">Enterprise Knowledge Lineage</CardTitle>
                 <CardDescription className="text-xs font-bold uppercase text-slate-400">Audit trail from raw medical session to cinematic artifact</CardDescription>
              </div>
              <Badge variant="outline" className="gap-1.5 font-bold bg-white shadow-sm border-primary/20 text-primary">
                 <History className="h-3.5 w-3.5" /> Temporal Audit Active
              </Badge>
           </div>
        </CardHeader>
        <CardContent className="p-8">
           <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-4 lg:gap-8">
              {/* Sequential Lineage Flow */}
              {[
                { type: 'tutor_session', label: 'Tutor IA Session', color: 'bg-blue-500', icon: Brain, status: 'completed' },
                { type: 'aggregated_content', label: 'Semantic Aggregator', color: 'bg-purple-500', icon: Database, status: 'completed' },
                { type: 'scene_graph', label: 'CME Scene Graph', color: 'bg-indigo-500', icon: Network, status: 'running' },
                { type: 'render_artifact', label: 'Enaflix Asset', color: 'bg-emerald-500', icon: Film, status: 'queued' }
              ].map((step, i, arr) => (
                <div key={i} className="flex flex-col md:flex-row items-center gap-4">
                   <div className="relative group">
                      <div className={`w-20 h-20 rounded-3xl ${step.color} flex items-center justify-center text-white shadow-xl transform transition-transform group-hover:scale-105 group-hover:rotate-3`}>
                         <step.icon className="h-8 w-8" />
                         {step.status === 'completed' && (
                           <div className="absolute -top-1 -right-1 bg-emerald-500 rounded-full p-1 border-2 border-white">
                              <CheckCircle2 className="h-3 w-3" />
                           </div>
                         )}
                      </div>
                      <div className="absolute top-full mt-3 left-1/2 -translate-x-1/2 text-center w-32">
                         <p className="text-[10px] font-black uppercase tracking-wider text-slate-800">{step.label}</p>
                         <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">{step.status}</p>
                      </div>
                   </div>
                   {i < arr.length - 1 && (
                     <div className="hidden md:flex items-center text-slate-200">
                        <ArrowRight className="h-8 w-8" />
                     </div>
                   )}
                </div>
              ))}
           </div>

           <div className="mt-20 pt-10 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="border shadow-none bg-white">
                 <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">Latest Transformation</CardTitle>
                 </CardHeader>
                 <CardContent className="space-y-3">
                    <div className="flex justify-between items-center text-xs">
                       <span className="font-bold text-slate-600">Type:</span>
                       <Badge variant="secondary" className="text-[9px] font-black">AI_SCENE_PARSING</Badge>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                       <span className="font-bold text-slate-600">Model:</span>
                       <span className="font-mono text-[10px]">CME-Vision-Pro-v4</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                       <span className="font-bold text-slate-600">Input Hash:</span>
                       <span className="font-mono text-[9px] text-slate-400">0x7f3...a12</span>
                    </div>
                 </CardContent>
              </Card>

              <Card className="border shadow-none bg-white">
                 <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">Pedagogical Lineage</CardTitle>
                 </CardHeader>
                 <CardContent className="space-y-3">
                    <div className="flex justify-between items-center text-xs">
                       <span className="font-bold text-slate-600">Root Concept:</span>
                       <span className="text-primary font-bold uppercase">Heart Failure</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                       <span className="font-bold text-slate-600">Derived Quiz:</span>
                       <Badge variant="outline" className="text-[9px] text-emerald-600 border-emerald-200">READY</Badge>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                       <span className="font-bold text-slate-600">FSRS Anchors:</span>
                       <span className="font-bold text-slate-900">12 Nodes</span>
                    </div>
                 </CardContent>
              </Card>

              <Card className="border shadow-none bg-white">
                 <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">Compliance & Trust</CardTitle>
                 </CardHeader>
                 <CardContent className="space-y-3">
                    <div className="flex justify-between items-center text-xs">
                       <span className="font-bold text-slate-600">Signed Artifact:</span>
                       <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div className="flex justify-between items-center text-xs">
                       <span className="font-bold text-slate-600">Editor Review:</span>
                       <Badge variant="outline" className="text-[9px] text-amber-600 border-amber-200">PENDING</Badge>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                       <span className="font-bold text-slate-600">Trace ID:</span>
                       <span className="font-mono text-[9px] text-slate-400">CME-TR-2024-X91</span>
                    </div>
                 </CardContent>
              </Card>
           </div>
        </CardContent>
      </Card>
    </div>
  );
};
