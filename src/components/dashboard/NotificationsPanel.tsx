
import { useAlertOrchestrator } from "@/hooks/useAlertOrchestrator";
import { useNotifications, type Notification } from "@/hooks/useNotifications";
import { Bell, X, Info, AlertTriangle, Flame, TrendingDown, CheckCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { trackAlertEvent } from "@/lib/alertTelemetry";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Props {
  onClose: () => void;
}

export function NotificationsPanel({ onClose }: Props) {
  const { structuralAlerts, contextualAlerts } = useAlertOrchestrator();
  const { notifications, isLoading, markAsRead, markAllAsRead, unreadCount } = useNotifications();
  
  const dbNotifs = notifications.map(n => ({
    id: n.id,
    message: n.message,
    title: n.title,
    source: n.source,
    type: n.type,
    actionHref: n.action_href,
    actionLabel: n.action_label,
    read: n.read,
    isReal: true,
    created_at: n.created_at
  }));

  const memAlerts = [...structuralAlerts, ...contextualAlerts].map(a => ({
    id: a.id,
    message: a.message,
    title: a.title,
    source: a.source as string,
    type: a.priority === 'critical' ? 'error' : 'info',
    actionHref: a.actionHref,
    actionLabel: a.actionLabel,
    read: false,
    isReal: false,
    created_at: undefined as string | undefined
  }));

  const allNotifs = [...dbNotifs, ...memAlerts].sort((a, b) => {
    if (a.read !== b.read) return a.read ? 1 : -1;
    if (a.created_at && b.created_at) {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
    return 0;
  });


  const iconFor = (source: string, type?: string) => {
    if (type === 'error' || source === "approval-risk") return <AlertTriangle className="h-4 w-4 text-destructive" />;
    if (type === 'warning' || source === "approval-trend" || source === "coverage-risk" || source === "fsrs-backlog") 
      return <Flame className="h-4 w-4 text-amber-500" />;
    return <Info className="h-4 w-4 text-primary" />;
  };


  return (
    <div className="absolute bottom-16 left-6 w-85 bg-[#0a0a0e]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl z-[60] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-black uppercase tracking-widest text-white">Notificações</h3>
          {unreadCount > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-primary/20 text-primary border-primary/30">
              {unreadCount}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-white/40 hover:text-primary transition-colors"
              onClick={() => markAllAsRead.mutate()}
              title="Marcar todas como lidas"
            >
              <CheckCheck className="h-4 w-4" />
            </Button>
          )}
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <ScrollArea className="h-[350px]">
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
            <p className="text-[10px] text-white/20 uppercase font-black tracking-widest">Sincronizando...</p>
          </div>
        ) : allNotifs.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="mx-auto w-16 h-16 rounded-full bg-white/5 flex items-center justify-center border border-white/5">
              <Bell className="h-8 w-8 text-white/10" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-white/60">Silêncio produtivo</p>
              <p className="text-[10px] text-white/20 uppercase font-black tracking-widest">Nenhuma novidade por aqui</p>
            </div>
          </div>
        ) : (
          <div className="p-2 space-y-1.5">
            {allNotifs.map((n) => (
              <div 
                key={n.id} 
                className={cn(
                  "p-4 rounded-xl border transition-all group relative overflow-hidden",
                  n.read 
                    ? "bg-transparent border-white/5 opacity-60" 
                    : "bg-white/[0.03] border-white/10 hover:bg-white/[0.05] hover:border-white/20"
                )}
                onClick={() => {
                  if (n.isReal && !n.read) markAsRead.mutate(n.id);
                }}
              >
                {!n.read && n.isReal && (
                  <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                )}
                <div className="flex gap-3">
                  <div className="mt-0.5 shrink-0">
                    {iconFor(n.source, n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    {n.title && (
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">
                        {n.title}
                      </p>
                    )}
                    <p className="text-xs text-white/90 leading-snug font-medium mb-2 line-clamp-3">
                      {n.message}
                    </p>
                    {n.actionHref && (
                      <Link
                        to={n.actionHref}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!n.isReal) {
                            trackAlertEvent({ alert: n as any, eventType: "clicked" });
                          } else if (!n.read) {
                            markAsRead.mutate(n.id);
                          }
                          onClose();
                        }}
                        className="text-[10px] font-black uppercase tracking-widest text-primary hover:text-primary/80 flex items-center gap-1.5 transition-colors"
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
      
      <div className="p-3 bg-white/[0.02] border-t border-white/5">
        <Button variant="ghost" className="w-full h-9 text-[10px] font-black uppercase tracking-widest text-white/30 hover:text-white transition-colors" onClick={onClose}>
          Fechar Notificações
        </Button>
      </div>
    </div>
  );
}

