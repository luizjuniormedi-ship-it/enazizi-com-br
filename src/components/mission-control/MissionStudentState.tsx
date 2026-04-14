import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame, BookOpen, ClipboardCheck, Shield, AlertTriangle, Zap } from "lucide-react";
import type { AnalyticsSnapshot } from "@/hooks/useAnalyticsSnapshot";
import type { AdaptiveState } from "@/hooks/useStudyNext";

interface Props {
  snapshot?: AnalyticsSnapshot | null;
  adaptiveState?: AdaptiveState;
  streak: number;
}

export default function MissionStudentState({ snapshot, adaptiveState, streak }: Props) {
  const score = snapshot?.approvalScore ?? adaptiveState?.approvalScore ?? 0;
  const reviews = snapshot?.pendingReviews ?? adaptiveState?.pendingReviews ?? 0;
  const recovery = snapshot?.recoveryActive ?? adaptiveState?.recoveryActive ?? false;
  const locked = snapshot?.contentLocked ?? adaptiveState?.contentLocked ?? false;

  const items = [
    {
      label: "Approval Score",
      value: `${Math.round(score)}%`,
      icon: <Zap className="h-4 w-4 text-primary" />,
      accent: score < 40 ? "text-destructive" : score < 70 ? "text-warning" : "text-primary",
    },
    {
      label: "Revisões Pendentes",
      value: String(reviews),
      icon: <BookOpen className="h-4 w-4 text-accent" />,
      accent: reviews > 10 ? "text-destructive" : "text-foreground",
    },
    {
      label: "Streak",
      value: `${streak} dias`,
      icon: <Flame className="h-4 w-4 text-warning" />,
      accent: streak > 0 ? "text-warning" : "text-muted-foreground",
    },
    {
      label: "Status",
      value: recovery ? "Recuperação" : locked ? "Bloqueado" : "Normal",
      icon: recovery ? <AlertTriangle className="h-4 w-4 text-destructive" /> : <Shield className="h-4 w-4 text-success" />,
      accent: recovery ? "text-destructive" : locked ? "text-warning" : "text-success",
    },
  ];

  return (
    <Card className="border-border/50">
      <CardContent className="p-4 sm:p-5 space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          Estado do aluno hoje
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {items.map((item) => (
            <div key={item.label} className="rounded-lg bg-secondary/50 p-3 space-y-1">
              <div className="flex items-center gap-1.5">
                {item.icon}
                <span className="text-[11px] text-muted-foreground">{item.label}</span>
              </div>
              <p className={`text-lg font-bold ${item.accent}`}>{item.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
