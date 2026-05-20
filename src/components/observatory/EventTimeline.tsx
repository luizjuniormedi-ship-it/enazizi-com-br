import React from "react";
import { useObservatoryData } from "@/hooks/useObservatoryData";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Zap, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ArrowRight,
  Database,
  Brain,
  Layers
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function EventTimeline() {
  const { data: events, isLoading } = useObservatoryData(20);

  if (isLoading) return <div className="h-64 flex items-center justify-center">Carregando timeline...</div>;

  return (
    <ScrollArea className="h-[500px] pr-4">
      <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-primary/20 before:via-primary/50 before:to-transparent">
        {events?.map((event) => (
          <div key={event.event_id} className="relative flex items-start group">
            {/* Timeline Dot */}
            <div className="absolute left-0 mt-1.5 h-10 w-10 flex items-center justify-center rounded-full bg-background border-2 border-primary/20 group-hover:border-primary transition-colors z-10">
              {event.status === 'consumed' ? (
                <CheckCircle2 className="h-5 w-5 text-success" />
              ) : event.status === 'failed' ? (
                <XCircle className="h-5 w-5 text-destructive" />
              ) : (
                <Clock className="h-5 w-5 text-warning animate-pulse" />
              )}
            </div>

            <div className="ml-12 w-full p-4 rounded-lg border bg-card/50 hover:bg-card transition-all">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-primary/10 text-primary uppercase text-[10px]">
                    {event.module}
                  </Badge>
                  <span className="font-mono text-sm font-bold text-foreground">
                    {event.event_type}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {format(new Date(event.timestamp), "HH:mm:ss", { locale: ptBR })}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-[10px] text-muted-foreground mb-3">
                <div className="flex items-center gap-1">
                  <Zap className="h-3 w-3 text-warning" />
                  Latency: {event.propagation_latency}
                </div>
                <div className="flex items-center gap-1">
                  <Layers className="h-3 w-3" />
                  Recursion: {event.recursion_depth}
                </div>
                <div className="truncate flex items-center gap-1" title={event.correlation_id}>
                  <Database className="h-3 w-3" />
                  CorrID: {event.correlation_id?.slice(0, 8)}...
                </div>
                {event.resulting_cognitive_state && (
                  <div className="flex items-center gap-1 font-semibold text-primary">
                    <Brain className="h-3 w-3" />
                    State: {event.resulting_cognitive_state}
                  </div>
                )}
              </div>

              {event.consumed_by && Array.isArray(event.consumed_by) && event.consumed_by.length > 0 && (
                <div className="mt-2 pt-2 border-t flex items-center gap-2">
                  <span className="text-[9px] font-semibold uppercase opacity-50">Propagated to:</span>
                  <div className="flex flex-wrap gap-1">
                    {event.consumed_by.map((c: any, i: number) => (
                      <Badge key={i} variant="secondary" className="text-[8px] py-0 h-4">
                        {c.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}