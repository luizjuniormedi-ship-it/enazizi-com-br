import { useEffect, useState, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, TrendingDown, Calendar, FileText } from "lucide-react";

interface Props {
  studentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  callAPI: (body: Record<string, unknown>) => Promise<any>;
}

interface Detail {
  profile: any;
  ranking_snapshot: any;
  summary: {
    total_subtopics: number;
    total_questions: number;
    weak_count: number;
    strong_count: number;
    simulados_completed: number;
    simulados_avg: number;
  };
  by_specialty: Array<{ specialty: string; accuracy: number; total_questions: number; subtopics_count: number }>;
  by_topic: Array<{ specialty: string; topic: string; accuracy: number; total_questions: number }>;
  weak_subtopics: Array<{ specialty: string; topic: string | null; subtopic: string | null; total_questions: number; accuracy: number }>;
  strong_subtopics: Array<{ specialty: string; topic: string | null; subtopic: string | null; total_questions: number; accuracy: number }>;
  recent_simulados: Array<{ simulado_id: string; status: string; score: number | null; completed_at: string | null }>;
}

const accBadge = (acc: number) => {
  if (acc >= 70) return "bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:text-emerald-400";
  if (acc >= 50) return "bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400";
  return "bg-destructive/15 text-destructive border-destructive/30";
};

const StudentProficiencyDrawer = ({ studentId, open, onOpenChange, callAPI }: Props) => {
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await callAPI({ action: "get_student_proficiency_detail", student_id: studentId });
      setData(res as Detail);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar aluno");
    } finally {
      setLoading(false);
    }
  }, [studentId, callAPI]);

  useEffect(() => {
    if (open && studentId) load();
  }, [open, studentId, load]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{data?.profile?.display_name || "Detalhes do aluno"}</SheetTitle>
          <SheetDescription>
            {data?.profile?.faculdade && <span>{data.profile.faculdade}</span>}
            {data?.profile?.periodo ? <span> · {data.profile.periodo}º período</span> : null}
            {data?.profile?.target_specialty ? <span> · Alvo: {data.profile.target_specialty}</span> : null}
          </SheetDescription>
        </SheetHeader>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-md bg-destructive/10 text-destructive text-sm p-3">{error}</div>
        )}

        {data && !loading && (
          <div className="space-y-4 mt-4">
            {/* Resumo */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Card className="border-border/60"><CardContent className="p-3">
                <div className="text-xs text-muted-foreground">Subtemas</div>
                <div className="text-lg font-semibold">{data.summary.total_subtopics}</div>
              </CardContent></Card>
              <Card className="border-border/60"><CardContent className="p-3">
                <div className="text-xs text-muted-foreground">Questões</div>
                <div className="text-lg font-semibold">{data.summary.total_questions}</div>
              </CardContent></Card>
              <Card className="border-border/60"><CardContent className="p-3">
                <div className="text-xs text-muted-foreground">Fracos</div>
                <div className="text-lg font-semibold text-destructive">{data.summary.weak_count}</div>
              </CardContent></Card>
              <Card className="border-border/60"><CardContent className="p-3">
                <div className="text-xs text-muted-foreground">Fortes</div>
                <div className="text-lg font-semibold text-emerald-500">{data.summary.strong_count}</div>
              </CardContent></Card>
            </div>

            {/* Snapshot do ranking */}
            {data.ranking_snapshot && (
              <Card className="border-border/60">
                <CardContent className="p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                  <div><div className="text-xs text-muted-foreground">Performance</div><div className="font-medium">{Math.round(data.ranking_snapshot.performance_score || 0)}</div></div>
                  <div><div className="text-xs text-muted-foreground">Consistência</div><div className="font-medium">{Math.round(data.ranking_snapshot.consistency_score || 0)}</div></div>
                  <div><div className="text-xs text-muted-foreground">Evolução</div><div className="font-medium">{Math.round(data.ranking_snapshot.evolution_score || 0)}</div></div>
                  <div><div className="text-xs text-muted-foreground">Percentil</div><div className="font-medium">{data.ranking_snapshot.percentile ?? "—"}</div></div>
                </CardContent>
              </Card>
            )}

            {/* Por especialidade */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Por especialidade</h3>
              <div className="space-y-1.5">
                {data.by_specialty.length === 0 && <p className="text-xs text-muted-foreground">Sem dados.</p>}
                {data.by_specialty.map((s) => (
                  <div key={s.specialty} className="flex items-center justify-between gap-2 rounded-md border border-border/40 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{s.specialty}</div>
                      <div className="text-xs text-muted-foreground">{s.subtopics_count} subtemas · {s.total_questions} questões</div>
                    </div>
                    <Badge variant="outline" className={accBadge(s.accuracy)}>{s.accuracy}%</Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Temas fracos */}
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><TrendingDown className="h-4 w-4 text-destructive" /> Temas fracos</h3>
              {data.weak_subtopics.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum tema fraco identificado (mín. 3 questões).</p>
              ) : (
                <div className="space-y-1">
                  {data.weak_subtopics.map((s, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 rounded-md border border-border/40 px-3 py-1.5 text-sm">
                      <div className="min-w-0 truncate">
                        <span className="font-medium">{s.subtopic || s.topic || "—"}</span>
                        <span className="text-xs text-muted-foreground"> · {s.specialty}</span>
                      </div>
                      <Badge variant="outline" className={accBadge(s.accuracy)}>{s.accuracy}%</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Temas fortes */}
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><TrendingUp className="h-4 w-4 text-emerald-500" /> Temas fortes</h3>
              {data.strong_subtopics.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sem temas fortes consolidados ainda.</p>
              ) : (
                <div className="space-y-1">
                  {data.strong_subtopics.map((s, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 rounded-md border border-border/40 px-3 py-1.5 text-sm">
                      <div className="min-w-0 truncate">
                        <span className="font-medium">{s.subtopic || s.topic || "—"}</span>
                        <span className="text-xs text-muted-foreground"> · {s.specialty}</span>
                      </div>
                      <Badge variant="outline" className={accBadge(s.accuracy)}>{s.accuracy}%</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Simulados recentes */}
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><FileText className="h-4 w-4" /> Simulados recentes</h3>
              {data.recent_simulados.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sem simulados atribuídos.</p>
              ) : (
                <div className="space-y-1">
                  {data.recent_simulados.map((s, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 rounded-md border border-border/40 px-3 py-1.5 text-sm">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        {s.completed_at ? new Date(s.completed_at).toLocaleDateString("pt-BR") : "Não concluído"}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">{s.status}</Badge>
                        {s.score != null && <span className="font-medium text-sm">{Math.round(s.score)}%</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <p className="text-[11px] text-muted-foreground pt-2">
              Visão somente leitura. Para criar intervenções estruturadas, usaremos a Fase 3 (sem alteração no motor agora).
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default StudentProficiencyDrawer;
