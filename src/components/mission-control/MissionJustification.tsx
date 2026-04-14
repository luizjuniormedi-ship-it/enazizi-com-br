import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, Target, BookOpen, AlertTriangle } from "lucide-react";
import type { AdaptiveState } from "@/hooks/useStudyNext";

interface Props {
  justification: string;
  adaptiveState?: AdaptiveState;
}

const ZONE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  critical: { label: "Crítico", color: "text-destructive", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  attention: { label: "Atenção", color: "text-warning", icon: <Target className="h-3.5 w-3.5" /> },
  competitive: { label: "Competitivo", color: "text-primary", icon: <BookOpen className="h-3.5 w-3.5" /> },
  ready: { label: "Pronto", color: "text-success", icon: <Lightbulb className="h-3.5 w-3.5" /> },
};

export default function MissionJustification({ justification, adaptiveState }: Props) {
  if (!justification) return null;

  const zone = adaptiveState?.approvalZone ?? "";
  const zoneCfg = ZONE_CONFIG[zone];

  return (
    <Card className="border-border/50">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-primary/10 p-2 shrink-0 mt-0.5">
            <Lightbulb className="h-4 w-4 text-primary" />
          </div>
          <div className="space-y-2 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">Por que isso agora?</h3>
              {zoneCfg && (
                <Badge variant="outline" className={`text-[10px] ${zoneCfg.color} border-current/30`}>
                  {zoneCfg.icon}
                  <span className="ml-1">Zona {zoneCfg.label}</span>
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{justification}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
