import { memo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BarChart3, ChevronDown, ChevronUp, Loader2 } from "lucide-react";

export interface ResultsDialogState {
  open: boolean;
  simulado: any;
  results: any[];
  loading: boolean;
  questions_json: any[];
}

interface Props {
  state: ResultsDialogState;
  onClose: () => void;
}

/**
 * Dialog de resultados isolado.
 * Estado de aluno expandido vive aqui dentro — não polui o dashboard.
 */
const SimuladoResultsDialog = memo(function SimuladoResultsDialog({ state, onClose }: Props) {
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);

  return (
    <Dialog
      open={state.open}
      onOpenChange={(open) => {
        if (!open) {
          setExpandedStudent(null);
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Resultados: {state.simulado?.title}
          </DialogTitle>
          <DialogDescription>Veja o desempenho dos alunos neste simulado.</DialogDescription>
        </DialogHeader>

        {state.loading ? (
          <div className="py-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          </div>
        ) : state.results.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhum resultado ainda.</p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3 mb-4">
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-lg font-bold">{state.results.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Concluídos</p>
                  <p className="text-lg font-bold text-emerald-500">
                    {state.results.filter((r) => r.status === "completed").length}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Média</p>
                  <p className="text-lg font-bold text-primary">
                    {(() => {
                      const completed = state.results.filter((r) => r.status === "completed");
                      return completed.length > 0
                        ? Math.round(
                            completed.reduce((s, r) => s + (r.score || 0), 0) / completed.length
                          )
                        : 0;
                    })()}
                    %
                  </p>
                </CardContent>
              </Card>
            </div>

            {state.results.map((r) => {
              const isExpanded = expandedStudent === r.id;
              const studentAnswers = (r.answers_json || []) as any[];
              const questionsData = state.questions_json || [];
              return (
                <Card key={r.id}>
                  <CardContent className="p-3">
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => setExpandedStudent(isExpanded ? null : r.id)}
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                        <div>
                          <p className="text-sm font-medium">{r.student_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {r.student_email}
                            {r.faculdade ? ` • ${r.faculdade}` : ""}
                            {r.periodo ? ` • ${r.periodo}º` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        {r.status === "completed" ? (
                          <>
                            <p
                              className={`text-lg font-bold ${
                                (r.score || 0) >= 70
                                  ? "text-emerald-500"
                                  : (r.score || 0) >= 50
                                  ? "text-amber-500"
                                  : "text-destructive"
                              }`}
                            >
                              {Math.round(r.score || 0)}%
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {r.finished_at
                                ? new Date(r.finished_at).toLocaleDateString("pt-BR")
                                : ""}
                            </p>
                          </>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            {r.status === "in_progress" ? "Em andamento" : "Pendente"}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {isExpanded && r.status === "completed" && studentAnswers.length > 0 && (
                      <div className="mt-3 pt-3 border-t space-y-3">
                        {/* Topic summary */}
                        {(() => {
                          const topicMap: Record<string, { total: number; correct: number }> = {};
                          studentAnswers.forEach((a: any) => {
                            const t = a.topic || "Geral";
                            if (!topicMap[t]) topicMap[t] = { total: 0, correct: 0 };
                            topicMap[t].total++;
                            if (a.is_correct) topicMap[t].correct++;
                          });
                          return (
                            <div className="space-y-1.5">
                              <p className="text-xs font-semibold text-muted-foreground">Por Tema:</p>
                              {Object.entries(topicMap).map(([topic, data]) => {
                                const pct = Math.round((data.correct / data.total) * 100);
                                return (
                                  <div key={topic} className="flex items-center gap-2 text-xs">
                                    <span className="w-28 truncate font-medium">{topic}</span>
                                    <Progress value={pct} className="h-1.5 flex-1" />
                                    <span
                                      className={`w-16 text-right font-bold ${
                                        pct >= 70
                                          ? "text-emerald-500"
                                          : pct >= 50
                                          ? "text-amber-500"
                                          : "text-destructive"
                                      }`}
                                    >
                                      {data.correct}/{data.total} ({pct}%)
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}

                        {/* Question-by-question */}
                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                          <p className="text-xs font-semibold text-muted-foreground">Questões:</p>
                          {studentAnswers.map((a: any, idx: number) => {
                            const q = questionsData[a.question_index ?? idx];
                            return (
                              <div
                                key={idx}
                                className={`p-2 rounded text-xs border ${
                                  a.is_correct
                                    ? "border-emerald-500/20 bg-emerald-500/5"
                                    : "border-destructive/20 bg-destructive/5"
                                }`}
                              >
                                <div className="flex items-start gap-1.5">
                                  <Badge
                                    variant={a.is_correct ? "default" : "destructive"}
                                    className="text-[9px] shrink-0 mt-0.5"
                                  >
                                    {a.is_correct ? "✓" : "✗"} Q{(a.question_index ?? idx) + 1}
                                  </Badge>
                                  <p className="line-clamp-2">{q?.statement || `Questão ${idx + 1}`}</p>
                                </div>
                                {!a.is_correct && q && (
                                  <div className="ml-6 mt-1 space-y-0.5 text-[11px]">
                                    <p className="text-destructive">
                                      Resposta: {q.options?.[a.selected] || "Não respondida"}
                                    </p>
                                    <p className="text-emerald-600">
                                      Correta: {q.options?.[a.correct_index ?? q.correct_index]}
                                    </p>
                                    {q.explanation && (
                                      <p className="text-muted-foreground italic mt-1">
                                        {q.explanation}
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
});

export default SimuladoResultsDialog;
