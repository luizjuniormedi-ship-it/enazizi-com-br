
import { useAlertOrchestrator } from "@/hooks/useAlertOrchestrator";
import { Bell, X, Info, AlertTriangle, Flame, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { trackAlertEvent } from "@/lib/alertTelemetry";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface Props {
  onClose: () => void;
}

export function NotificationsPanel({ onClose }: Props) {
  const { structuralAlerts, contextualAlerts } = useAlertOrchestrator();
  const allNotifs = [...structuralAlerts, ...contextualAlerts];

  const iconFor = (source: string) => {
    switch (source) {
      case "approval-risk": return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case "approval-trend": return <TrendingDown className="h-4 w-4 text-amber-500" />;
      case "coverage-risk": return <Flame className="h-4 w-4 text-amber-500" />;
      case "fsrs-backlog": return <Flame className="h-4 w-4 text-amber-500" />;
      default: return <Info className="h-4 w-4 text-primary" />;
    }
  };

  return (
    <div className="absolute bottom-16 left-6 w-80 bg-[#0a0a0e]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl z-[60] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-black uppercase tracking-widest text-white">Notificações</h3>
          {allNotifs.length > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-primary/20 text-primary border-primary/30">
              {allNotifs.length}
            </Badge>
          )}
        </div>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      <ScrollArea className="h-[300px]">
        {allNotifs.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
              <Bell className="h-6 w-6 text-white/10" />
            </div>
            <p className="text-sm text-white/40">Tudo em ordem!</p>
            <p className="text-[10px] text-white/20 uppercase font-bold tracking-tighter">Nenhuma notificação nova</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {allNotifs.map((n) => (
              <div key={n.id} className="p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all group">
                <div className="flex gap-3">
                  <div className="mt-0.5 shrink-0">
                    {iconFor(n.source)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white/80 leading-snug font-medium mb-2">{n.message}</p>
                    {n.actionHref && (
                      <Link
                        to={n.actionHref}
                        onClick={() => {
                          trackAlertEvent({ alert: n, eventType: "clicked" });
                          onClose();
                        }}
                        className="text-[10px] font-black uppercase tracking-widest text-primary hover:text-primary/80 flex items-center gap-1"
                      >
                        {n.actionLabel || "Ver Detalhes"}
                        <TrendingDown className="h-3 w-3 rotate-[-90deg]" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
      
      <div className="p-3 bg-white/5 border-t border-white/5">
        <Button variant="ghost" className="w-full h-8 text-[10px] font-black uppercase tracking-widest text-white/40" onClick={onClose}>
          Fechar Painel
        </Button>
      </div>
    </div>
  );
}
