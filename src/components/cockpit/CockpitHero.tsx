import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Rocket, Sparkles, AlertTriangle } from "lucide-react";
import type { CockpitData } from "@/hooks/useCockpitData";
import type { StudyNextRecommendation } from "@/hooks/useStudyNext";

interface Props {
  cockpit: CockpitData | undefined;
  recommendation: StudyNextRecommendation | undefined;
  justification: string;
  userName?: string;
  onPrimaryAction?: () => void;
}

export default function CockpitHero({ cockpit, recommendation, justification, userName, onPrimaryAction }: Props) {
  const navigate = useNavigate();
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  })();

  const primaryStep = cockpit?.nextSteps?.find((s) => s.priority === "primary") ?? cockpit?.nextSteps?.[0];
  const headline =
    recommendation?.title ??
    primaryStep?.title ??
    (cockpit?.topWeaknesses?.[0]
      ? `Foque em ${cockpit.topWeaknesses[0].tema} agora`
      : "Comece sua sessão de hoje");
  const reason =
    justification ||
    (cockpit?.alerts?.[0]?.message ??
      "Vamos transformar suas fraquezas em pontos fortes com sessões guiadas.");

  const handleStart = () => {
    if (onPrimaryAction) return onPrimaryAction();
    if (primaryStep) navigate(primaryStep.route);
    else navigate("/dashboard/quiz");
  };

  return (
    <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-card via-card to-secondary/40 p-6 md:p-8 shadow-[var(--shadow-glow)]">
      <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ background: "var(--gradient-primary)", maskImage: "radial-gradient(ellipse at top right, black 0%, transparent 60%)" }} />
      <div className="relative z-10 flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
              Cockpit Cognitivo
            </Badge>
            {cockpit?.alerts?.find((a) => a.severity === "high") && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" /> Atenção
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mb-1">
            {greeting}{userName ? `, ${userName}` : ""} 👋
          </p>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold leading-tight tracking-tight mb-3">
            {headline}
          </h1>
          <p className="text-sm md:text-base text-muted-foreground max-w-2xl leading-relaxed">
            {reason}
          </p>
        </div>
        <div className="flex flex-col gap-2 w-full lg:w-auto">
          <Button size="lg" onClick={handleStart} className="gap-2 shadow-lg">
            <Rocket className="h-4 w-4" /> Começar agora
          </Button>
          {primaryStep && (
            <p className="text-xs text-muted-foreground text-center max-w-[220px]">
              Próximo passo automático selecionado pela IA
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
