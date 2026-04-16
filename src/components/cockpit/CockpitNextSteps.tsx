import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Zap } from "lucide-react";
import type { CockpitNextStep } from "@/hooks/useCockpitData";

interface Props {
  steps: CockpitNextStep[];
}

const PRIORITY_LABEL: Record<CockpitNextStep["priority"], { label: string; cls: string }> = {
  primary: { label: "Prioridade", cls: "bg-destructive/15 text-destructive border-destructive/30" },
  secondary: { label: "Complementar", cls: "bg-primary/15 text-primary border-primary/30" },
  quick: { label: "Rápida", cls: "bg-warning/15 text-warning border-warning/30" },
};

export default function CockpitNextSteps({ steps }: Props) {
  const navigate = useNavigate();
  if (!steps?.length) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="h-5 w-5 text-warning" />
          <h2 className="text-lg font-semibold">➡️ Próximos passos</h2>
        </div>
        <p className="text-sm text-muted-foreground">Nada pendente — explore o quiz ou crie um novo mnemônico.</p>
      </Card>
    );
  }
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="h-5 w-5 text-warning" />
        <h2 className="text-lg font-semibold">➡️ Próximos passos</h2>
      </div>
      <div className="space-y-2">
        {steps.map((s) => {
          const meta = PRIORITY_LABEL[s.priority];
          return (
            <button
              key={s.id}
              onClick={() => navigate(s.route)}
              className="w-full text-left rounded-lg border border-border bg-card/40 p-3 hover:border-primary/40 hover:bg-card/70 transition-colors flex items-center gap-3 group"
            >
              <Badge variant="outline" className={meta.cls}>
                {meta.label}
              </Badge>
              <span className="flex-1 text-sm font-medium truncate">{s.title}</span>
              <Button size="sm" variant="ghost" className="gap-1 text-xs">
                {s.cta} <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
              </Button>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
