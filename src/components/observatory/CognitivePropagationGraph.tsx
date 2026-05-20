import React from "react";
import { useObservatoryData } from "@/hooks/useObservatoryData";
import { Card } from "@/components/ui/card";
import { 
  GitBranch, 
  ArrowDown, 
  Activity,
  AlertTriangle,
  BrainCircuit,
  Workflow
} from "lucide-react";
import { motion } from "framer-motion";

export default function CognitivePropagationGraph() {
  const { data: events } = useObservatoryData(10);

  // Group events by correlation_id to show propagation trees
  const correlationGroups = React.useMemo(() => {
    if (!events) return {};
    const groups: Record<string, typeof events> = {};
    events.forEach(e => {
      if (!e.correlation_id) return;
      if (!groups[e.correlation_id]) groups[e.correlation_id] = [];
      groups[e.correlation_id].push(e);
    });
    return groups;
  }, [events]);

  const activeCorrelation = Object.keys(correlationGroups)[0];
  const lineage = activeCorrelation ? correlationGroups[activeCorrelation].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  ) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Workflow className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Cognitive Propagation</h3>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Activity className="h-3 w-3 text-success animate-pulse" />
          Real-time Engine Active
        </div>
      </div>

      <div className="flex flex-col items-center gap-4 relative">
        {lineage.length === 0 ? (
          <div className="h-40 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-xl w-full">
            <BrainCircuit className="h-8 w-8 mb-2 opacity-20" />
            <p className="text-sm">Aguardando eventos pedagógicos...</p>
          </div>
        ) : (
          lineage.map((node, index) => (
            <React.Fragment key={node.event_id}>
              {index > 0 && (
                <motion.div 
                  initial={{ height: 0 }}
                  animate={{ height: 32 }}
                  className="w-0.5 bg-gradient-to-b from-primary/50 to-primary/10 flex items-center justify-center"
                >
                  <ArrowDown className="h-4 w-4 text-primary mt-4" />
                </motion.div>
              )}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`p-4 rounded-xl border w-full max-w-md ${
                  node.status === 'failed' ? 'border-destructive/50 bg-destructive/5' : 'border-primary/20 bg-primary/5'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${node.status === 'failed' ? 'bg-destructive/20 text-destructive' : 'bg-primary/20 text-primary'}`}>
                    <GitBranch className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono font-bold truncate uppercase">{node.event_type}</p>
                    <p className="text-[10px] text-muted-foreground">{node.module} · {node.propagation_latency}</p>
                  </div>
                  {node.retry_count > 0 && (
                    <div className="flex items-center gap-1 text-[10px] text-warning bg-warning/10 px-1.5 py-0.5 rounded">
                      <AlertTriangle className="h-3 w-3" />
                      Retry: {node.retry_count}
                    </div>
                  )}
                </div>
                {node.resulting_cognitive_state && (
                  <div className="mt-2 flex items-center gap-1.5 pt-2 border-t border-primary/10">
                    <span className="text-[9px] uppercase font-bold text-muted-foreground">Effect:</span>
                    <Badge variant="secondary" className="bg-primary/10 text-primary text-[9px] py-0">
                      STATE → {node.resulting_cognitive_state}
                    </Badge>
                  </div>
                )}
              </motion.div>
            </React.Fragment>
          ))
        )}
      </div>
    </div>
  );
}

function Badge({ children, variant, className }: any) {
  return (
    <span className={`px-2 py-0.5 rounded-full font-semibold ${className} ${
      variant === 'secondary' ? 'bg-secondary text-secondary-foreground' : ''
    }`}>
      {children}
    </span>
  );
}