import { Card } from "@/components/ui/card";
import { Radar } from "lucide-react";
import type { CockpitData } from "@/hooks/useCockpitData";

interface Props {
  radar: CockpitData["radar"];
}

const LABELS: Record<string, string> = {
  mnemonicos: "Mnemônicos",
  quizVisual: "Quiz visual",
  questoes: "Questões",
  revisaoFsrs: "Revisão FSRS",
  simulados: "Simulados",
  tutorIa: "Tutor IA V3",
};

export default function CockpitRadar({ radar }: Props) {
  const items = Object.entries(radar);
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Radar className="h-5 w-5 text-accent" />
        <h2 className="text-lg font-semibold">🎯 Radar de modalidades</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-4">Quais ferramentas estão te ajudando mais</p>
      <div className="space-y-3">
        {items.map(([key, value]) => {
          const v = Math.max(0, Math.min(100, Number(value)));
          const tone = v >= 70 ? "success" : v >= 40 ? "primary" : v > 0 ? "warning" : "muted";
          return (
            <div key={key}>
              <div className="flex justify-between items-center text-sm mb-1">
                <span className="font-medium">{LABELS[key] ?? key}</span>
                <span className="text-xs text-muted-foreground">{v === 0 ? "Sem dados" : `${v}%`}</span>
              </div>
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    tone === "success"
                      ? "bg-success"
                      : tone === "primary"
                        ? "bg-primary"
                        : tone === "warning"
                          ? "bg-warning"
                          : "bg-muted"
                  }`}
                  style={{ width: `${v}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
