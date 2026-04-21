import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface HeatmapRow {
  specialty: string;
  topic: string | null;
  subtopic: string | null;
  avg_accuracy: number; // 0-100
  students_count: number;
  critical_students: number;
  total_questions: number;
  semaforo: "green" | "yellow" | "red" | "gray";
}

interface Props {
  rows: HeatmapRow[];
  loading?: boolean;
}

const semaforoCls = (s: HeatmapRow["semaforo"]) => {
  switch (s) {
    case "red": return "bg-destructive/15 text-destructive border-destructive/30";
    case "yellow": return "bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400";
    case "green": return "bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:text-emerald-400";
    default: return "bg-muted text-muted-foreground border-border";
  }
};

const ProficiencyHeatmap = ({ rows, loading }: Props) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [openTopics, setOpenTopics] = useState<Record<string, boolean>>({});

  const grouped = useMemo(() => {
    const bySpec = new Map<string, Map<string, HeatmapRow[]>>();
    for (const r of rows) {
      const sp = r.specialty || "—";
      if (!bySpec.has(sp)) bySpec.set(sp, new Map());
      const tpMap = bySpec.get(sp)!;
      const tp = r.topic || "—";
      if (!tpMap.has(tp)) tpMap.set(tp, []);
      tpMap.get(tp)!.push(r);
    }
    return bySpec;
  }, [rows]);

  if (loading) {
    return <div className="h-48 animate-pulse rounded-md bg-muted/30" />;
  }
  if (!rows.length) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          Sem dados de proficiência ainda. Conforme os alunos respondem questões, o heatmap se popula.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Heatmap de Proficiência</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {Array.from(grouped.entries()).map(([specialty, topics]) => {
          const allRows = Array.from(topics.values()).flat();
          const reds = allRows.filter((r) => r.semaforo === "red").length;
          const yellows = allRows.filter((r) => r.semaforo === "yellow").length;
          const isOpen = expanded[specialty] ?? false;
          return (
            <div key={specialty} className="rounded-lg border border-border/60">
              <button
                onClick={() => setExpanded((p) => ({ ...p, [specialty]: !isOpen }))}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-muted/40 rounded-lg"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                  <span className="font-medium truncate">{specialty}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {reds > 0 && <Badge variant="outline" className={semaforoCls("red")}>{reds} críticos</Badge>}
                  {yellows > 0 && <Badge variant="outline" className={semaforoCls("yellow")}>{yellows} atenção</Badge>}
                  <Badge variant="secondary">{allRows.length} subtemas</Badge>
                </div>
              </button>
              {isOpen && (
                <div className="px-2 pb-2 space-y-1.5">
                  {Array.from(topics.entries()).map(([topic, subs]) => {
                    const tkey = `${specialty}::${topic}`;
                    const tOpen = openTopics[tkey] ?? true;
                    const tReds = subs.filter((s) => s.semaforo === "red").length;
                    return (
                      <div key={tkey} className="rounded-md border border-border/40 bg-muted/20">
                        <button
                          onClick={() => setOpenTopics((p) => ({ ...p, [tkey]: !tOpen }))}
                          className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted/40 rounded-md"
                        >
                          <div className="flex items-center gap-2 text-sm min-w-0">
                            {tOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                            <span className="truncate">{topic}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {tReds > 0 && <Badge variant="outline" className={semaforoCls("red")}>{tReds}</Badge>}
                            <span className="text-xs text-muted-foreground">{subs.length} sub</span>
                          </div>
                        </button>
                        {tOpen && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 p-2">
                            {subs.map((s, i) => (
                              <div key={i} className={`rounded-md border px-3 py-2 ${semaforoCls(s.semaforo)}`}>
                                <div className="flex items-center justify-between gap-2 text-sm">
                                  <span className="truncate font-medium">{s.subtopic || "—"}</span>
                                  <span className="font-semibold">{s.total_questions > 0 ? `${s.avg_accuracy}%` : "—"}</span>
                                </div>
                                <div className="text-[11px] opacity-80 mt-0.5">
                                  {s.students_count} aluno(s) · {s.total_questions} questões
                                  {s.critical_students > 0 ? ` · ${s.critical_students} crítico(s)` : ""}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
          <span>Legenda:</span>
          <Badge variant="outline" className={semaforoCls("green")}>≥ 70%</Badge>
          <Badge variant="outline" className={semaforoCls("yellow")}>50–70%</Badge>
          <Badge variant="outline" className={semaforoCls("red")}>&lt; 50%</Badge>
          <Badge variant="outline" className={semaforoCls("gray")}>sem dados</Badge>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProficiencyHeatmap;
