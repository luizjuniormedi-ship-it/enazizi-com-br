import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  groupScenariosByHorizon,
  HORIZON_LABEL,
  SCENARIO_LABEL,
  formatScore,
  formatDelta,
  deltaTone,
} from "@/services/trajectory/trajectoryMappers";
import type { TrajectoryScenario, Horizon } from "@/types/trajectory";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Props {
  scenarios: TrajectoryScenario[];
}

const HORIZONS: Horizon[] = [14, 28, 56];

function DeltaBadge({ value }: { value: number }) {
  const tone = deltaTone(value);
  const Icon = tone === "positive" ? TrendingUp : tone === "negative" ? TrendingDown : Minus;
  const cls =
    tone === "positive"
      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
      : tone === "negative"
        ? "bg-destructive/15 text-destructive"
        : "bg-muted text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      <Icon className="h-3 w-3" />
      {formatDelta(value)}
    </span>
  );
}

export default function RadarScenarioComparator({ scenarios }: Props) {
  const [horizon, setHorizon] = useState<Horizon>(28);
  const grouped = groupScenariosByHorizon(scenarios);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Comparador de cenários</CardTitle>
          <Badge variant="outline" className="text-xs">
            Projeções determinísticas
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={String(horizon)} onValueChange={(v) => setHorizon(Number(v) as Horizon)}>
          <TabsList className="grid w-full grid-cols-3">
            {HORIZONS.map((h) => (
              <TabsTrigger key={h} value={String(h)}>
                {HORIZON_LABEL[h]}
              </TabsTrigger>
            ))}
          </TabsList>

          {HORIZONS.map((h) => (
            <TabsContent key={h} value={String(h)} className="mt-4 space-y-3">
              {grouped[h].length === 0 && (
                <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  Sem cenários disponíveis para este horizonte.
                </div>
              )}
              {grouped[h].map((s) => {
                const isRecommended = s.scenarioType === "recommended";
                return (
                  <div
                    key={s.id}
                    className={`rounded-lg border p-3 ${
                      isRecommended
                        ? "border-primary/40 bg-primary/5"
                        : "border-border bg-card"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {SCENARIO_LABEL[s.scenarioType]}
                          </span>
                          {isRecommended && (
                            <Badge className="text-[10px]">Recomendado</Badge>
                          )}
                        </div>
                        {s.rationale && (
                          <p className="mt-1 text-xs text-muted-foreground">{s.rationale}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold">
                          {formatScore(s.projectedOverall)}
                        </div>
                        <DeltaBadge value={s.deltaOverall} />
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-4 gap-2 text-[11px]">
                      <Mini label="Cons." value={s.projectedConsistency} />
                      <Mini label="Reten." value={s.projectedRetention} />
                      <Mini label="Exec." value={s.projectedExecution} />
                      <Mini label="Backlog" value={s.projectedBacklog} />
                    </div>
                  </div>
                );
              })}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-muted/40 px-2 py-1 text-center">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-semibold">{formatScore(value)}</div>
    </div>
  );
}
