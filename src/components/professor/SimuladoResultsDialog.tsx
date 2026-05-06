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
import SimuladoReportInsights from "./SimuladoReportInsights";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
 * Dialog de resultados com suporte a relatórios pedagógicos e lista de alunos.
 */
const SimuladoResultsDialog = memo(function SimuladoResultsDialog({ state, onClose }: Props) {
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);

  const completedCount = state.results.filter((r) => r.status === "completed").length;
  const avgScore = (() => {
    const completed = state.results.filter((r) => r.status === "completed");
    return completed.length > 0
      ? Math.round(completed.reduce((s, r) => s + (r.score || 0), 0) / completed.length)
      : 0;
  })();

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
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden border-white/10 shadow-2xl">
        <div className="p-6 border-b bg-background/95 backdrop-blur-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <BarChart3 className="h-6 w-6 text-primary" />
              Gestão de Resultados: {state.simulado?.title}
            </DialogTitle>
            <DialogDescription>
              Analise o desempenho da turma e identifique pontos de melhoria com auxílio da IA.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto">
          {state.loading ? (
            <div className="py-24 text-center">
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
              <p className="text-xs text-muted-foreground mt-4 uppercase font-bold tracking-widest animate-pulse">
                Gerando inteligência pedagógica...
              </p>
            </div>
          ) : state.results.length === 0 ? (
            <div className="py-24 text-center space-y-4">
              <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/20" />
              <p className="text-center text-muted-foreground uppercase text-xs font-bold tracking-widest">
                Nenhum resultado disponível até o momento.
              </p>
            </div>
          ) : (
            <Tabs defaultValue="list" className="w-full">
              <div className="px-6 border-b bg-muted/20">
                <TabsList className="bg-transparent h-14 w-full justify-start gap-8 p-0">
                  <TabsTrigger 
                    value="list" 
                    className="bg-transparent border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none h-full px-2 text-[11px] font-black uppercase tracking-widest transition-all"
                  >
                    LISTA DE ALUNOS
                  </TabsTrigger>
                  <TabsTrigger 
                    value="insights" 
                    className="bg-transparent border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none h-full px-2 text-[11px] font-black uppercase tracking-widest transition-all"
                  >
                    RELATÓRIO PEDAGÓGICO
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="p-6">
                <TabsContent value="insights" className="mt-0 outline-none">
                  <SimuladoReportInsights results={state.results} questions_json={state.questions_json} />
                </TabsContent>

                <TabsContent value="list" className="mt-0 outline-none space-y-4">
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <Card className="bg-background/40 border-white/5">
                      <CardContent className="p-4 text-center">
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-1">Inscritos</p>
                        <p className="text-2xl font-black">{state.results.length}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-background/40 border-white/5">
                      <CardContent className="p-4 text-center">
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-1">Concluídos</p>
                        <p className="text-2xl font-black text-emerald-500">{completedCount}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-background/40 border-white/5">
                      <CardContent className="p-4 text-center">
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-1">Média Geral</p>
                        <p className="text-2xl font-black text-primary">{avgScore}%</p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="space-y-3">
                    {state.results.map((r) => {
                      const isExpanded = expandedStudent === r.id;
                      const studentAnswers = (r.answers_json || []) as any[];
                      const questionsData = state.questions_json || [];
                      return (
                        <Card key={r.id} className="bg-background/20 border-white/5 hover:border-white/10 transition-all">
                          <CardContent className="p-4">
                            <div
                              className="flex items-center justify-between cursor-pointer group"
                              onClick={() => setExpandedStudent(isExpanded ? null : r.id)}
                            >
                              <div className="flex items-center gap-4">
                                <div className="p-2 rounded-full bg-white/5 group-hover:bg-primary/20 transition-colors">
                                  {isExpanded ? (
                                    <ChevronUp className="h-4 w-4 text-primary" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </div>
                                <div>
                                  <p className="text-sm font-bold uppercase tracking-tight">{r.student_name}</p>
                                  <p className="text-[10px] text-muted-foreground uppercase font-medium">
                                    {r.student_email}
                                    {r.faculdade ? ` • ${r.faculdade}` : ""}
                                    {r.periodo ? ` • ${r.periodo}º PERÍODO` : ""}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                {r.status === "completed" ? (
                                  <>
                                    <p
                                      className={`text-xl font-black ${
                                        (r.score || 0) >= 70
                                          ? "text-emerald-500"
                                          : (r.score || 0) >= 50
                                          ? "text-amber-500"
                                          : "text-destructive"
                                      }`}
                                    >
                                      {Math.round(r.score || 0)}%
                                    </p>
                                    <p className="text-[10px] text-muted-foreground font-bold">
                                      {r.finished_at
                                        ? new Date(r.finished_at).toLocaleDateString("pt-BR")
                                        : ""}
                                    </p>
                                  </>
                                ) : (
                                  <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-widest bg-white/5 border-white/10">
                                    {r.status === "in_progress" ? "Em andamento" : "Pendente"}
                                  </Badge>
                                )}
                              </div>
                            </div>

                            {isExpanded && r.status === "completed" && studentAnswers.length > 0 && (
                              <div className="mt-4 pt-4 border-t border-white/5 space-y-6 animate-in fade-in slide-in-from-top-2">
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
                                    <div className="space-y-3">
                                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">DESEMPENHO POR TEMA</p>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {Object.entries(topicMap).map(([topic, data]) => {
                                          const pct = Math.round((data.correct / data.total) * 100);
                                          return (
                                            <div key={topic} className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                                              <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-bold uppercase truncate pr-2">{topic}</span>
                                                <span className={`text-xs font-black ${pct >= 70 ? "text-emerald-500" : pct >= 50 ? "text-amber-500" : "text-destructive"}`}>
                                                  {pct}%
                                                </span>
                                              </div>
                                              <Progress value={pct} className="h-1.5" />
                                              <p className="text-[9px] text-muted-foreground mt-1.5 font-bold uppercase">
                                                {data.correct} ACERTOS DE {data.total} QUESTÕES
                                              </p>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })()}

                                {/* Question-by-question */}
                                <div className="space-y-3">
                                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">DETALHAMENTO DE QUESTÕES</p>
                                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                    {studentAnswers.map((a: any, idx: number) => {
                                      const q = questionsData[a.question_index ?? idx];
                                      return (
                                        <div
                                          key={idx}
                                          className={`p-4 rounded-xl text-xs border transition-all ${
                                            a.is_correct
                                              ? "border-emerald-500/20 bg-emerald-500/5"
                                              : "border-destructive/20 bg-destructive/5"
                                          }`}
                                        >
                                          <div className="flex items-start gap-3">
                                            <Badge
                                              variant={a.is_correct ? "default" : "destructive"}
                                              className="text-[10px] font-black shrink-0 h-6 w-14 flex justify-center"
                                            >
                                              {a.is_correct ? "CORRETA" : "ERRADA"}
                                            </Badge>
                                            <div className="space-y-2">
                                              <p className="font-medium text-white/90 leading-relaxed">
                                                <span className="text-primary font-bold mr-2">Q{(a.question_index ?? idx) + 1}</span>
                                                {q?.statement || `Questão ${idx + 1}`}
                                              </p>
                                              
                                              {!a.is_correct && q && (
                                                <div className="mt-4 p-3 rounded-lg bg-black/20 space-y-2 border border-white/5">
                                                  <div className="flex items-start gap-2">
                                                    <span className="text-destructive font-black shrink-0">✗ SUA:</span>
                                                    <span className="text-white/70">{q.options?.[a.selected] || "Não respondida"}</span>
                                                  </div>
                                                  <div className="flex items-start gap-2">
                                                    <span className="text-emerald-500 font-black shrink-0">✓ CERTA:</span>
                                                    <span className="text-white/90 font-bold">{q.options?.[a.correct_index ?? q.correct_index]}</span>
                                                  </div>
                                                  {q.explanation && (
                                                    <div className="mt-3 pt-3 border-t border-white/5">
                                                      <p className="text-muted-foreground text-[11px] leading-relaxed italic">
                                                        {q.explanation}
                                                      </p>
                                                    </div>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
});

export default SimuladoResultsDialog;