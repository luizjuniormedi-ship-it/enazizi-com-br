import { memo, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
} from "@/components/ui/dialog";
import { TeacherDialogContent } from "@/components/teacher/TeacherDialogContent";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
  BarChart3, 
  ChevronDown, 
  ChevronUp, 
  Loader2, 
  MessageSquare, 
  Brain, 
  Send,
  Save,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle
} from "lucide-react";
import SimuladoReportInsights from "./SimuladoReportInsights";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

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
  callAPI?: (body: any) => Promise<any>;
}

const SimuladoResultsDialog = memo(function SimuladoResultsDialog({ state, onClose, callAPI }: Props) {
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [savingReview, setSavingReview] = useState<string | null>(null);
  const { toast } = useToast();

  const safeResults = Array.isArray(state?.results) ? state.results : [];
  const completedCount = safeResults.filter((r) => r?.status === "completed").length;
  const avgScore = (() => {
    const completed = safeResults.filter((r) => r?.status === "completed");
    return completed.length > 0
      ? Math.round(completed.reduce((s, r) => s + (Number.isFinite(r?.score) ? r.score : 0), 0) / completed.length)
      : 0;
  })();

  const safeAction = useCallback(async (name: string, fn: () => Promise<void>) => {
    try {
      console.log(`[SimuladoResults] action_start: ${name}`);
      await fn();
      console.log(`[SimuladoResults] action_success: ${name}`);
    } catch (error) {
      console.error(`[SimuladoResults] action_failed: ${name}`, error);
      toast({
        title: "Erro inesperado",
        description: error instanceof Error ? error.message : "Erro ao executar ação.",
        variant: "destructive"
      });
    }
  }, [toast]);

  const handleSaveReview = useCallback(async (student: any) => {
    if (!callAPI || !student?.student_id) return;
    await safeAction("save_review", async () => {
      setSavingReview(student.student_id);
      const studentAnswers = (student.answers_json || []) as any[];
      const weakTopics = Array.from(new Set(studentAnswers.filter(a => !a.is_correct).map(a => a.topic || "Geral")));
      const wrongQuestions = studentAnswers.filter(a => !a.is_correct).map(a => ({
        index: a.question_index,
        topic: a.topic
      }));

      await callAPI({
        action: "save_review",
        simulado_id: state.simulado?.id,
        student_id: student.student_id,
        professor_comment: comments[student.student_id] || "",
        score: student.score,
        accuracy: student.score,
        time_spent_seconds: student.time_spent_seconds || 0,
        weak_topics: weakTopics,
        wrong_questions: wrongQuestions,
        intervention_status: "reviewed"
      });

      toast({
        title: "Avaliação salva",
        description: "O feedback foi enviado ao aluno com sucesso.",
      });
      setSavingReview(null);
    });
  }, [callAPI, state.simulado?.id, comments, toast, safeAction]);

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
      <TeacherDialogContent
        className="z-[120]"
        maxWidth="max-w-5xl"
        header={
          <>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <BarChart3 className="h-6 w-6 text-primary" />
              Gestão de Resultados: {state.simulado?.title}
            </DialogTitle>
            <DialogDescription>
              Acompanhamento detalhado, correção individual e intervenção pedagógica com IA.
            </DialogDescription>
          </>
        }
      >
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
              <div className="px-6 border-b bg-muted/20 sticky top-0 z-10 bg-[#0a0a0e]/95 backdrop-blur-sm">
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
                  <div className="grid grid-cols-4 gap-4 mb-6">
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
                    <Card className="bg-background/40 border-white/5">
                      <CardContent className="p-4 text-center">
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-1">Status</p>
                        <Badge variant="outline" className="mt-1 uppercase text-[9px] border-primary/30 text-primary">
                          {state.simulado?.status || 'Draft'}
                        </Badge>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="space-y-3">
                    {safeResults.map((r) => {
                      const isExpanded = expandedStudent === r.id;
                      const studentAnswers = (r.answers_json || []) as any[];
                      const questionsData = state.questions_json || [];
                      const correctCount = studentAnswers.filter(a => a.is_correct).length;
                      const wrongCount = studentAnswers.length - correctCount;

                      return (
                        <Card key={r.id} className={`bg-background/20 border-white/5 hover:border-white/10 transition-all ${isExpanded ? 'ring-1 ring-primary/30 border-primary/20 shadow-glow-sm' : ''}`}>
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
                              <div className="flex items-center gap-6">
                                <div className="hidden sm:flex items-center gap-4 text-[10px] font-bold uppercase text-muted-foreground">
                                   <div className="flex items-center gap-1">
                                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                      {correctCount}
                                   </div>
                                   <div className="flex items-center gap-1">
                                      <XCircle className="h-3 w-3 text-destructive" />
                                      {wrongCount}
                                   </div>
                                   <div className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {Math.round((r.time_spent_seconds || 0) / 60)}m
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
                                    </>
                                  ) : (
                                    <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-widest bg-white/5 border-white/10">
                                      {r.status === "in_progress" ? "Em andamento" : "Pendente"}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>

                            {isExpanded && r.status === "completed" && (
                              <div className="mt-6 pt-6 border-t border-white/5 space-y-8 animate-in fade-in slide-in-from-top-2">
                                
                                {/* Correction Header Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                  
                                  {/* Performance Summary */}
                                  <div className="space-y-4">
                                    <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Diagnóstico de Desempenho</p>
                                    
                                    {(() => {
                                      const topicMap: Record<string, { total: number; correct: number }> = {};
                                      studentAnswers.forEach((a: any) => {
                                        const t = a.topic || "Geral";
                                        if (!topicMap[t]) topicMap[t] = { total: 0, correct: 0 };
                                        topicMap[t].total++;
                                        if (a.is_correct) topicMap[t].correct++;
                                      });
                                      return (
                                        <div className="grid grid-cols-1 gap-3">
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
                                                <Progress value={pct} className="h-1 bg-white/5" />
                                                <div className="flex justify-between mt-1.5">
                                                  <p className="text-[9px] text-muted-foreground font-bold uppercase">
                                                    {data.correct}/{data.total} ACERTOS
                                                  </p>
                                                  {pct < 50 && (
                                                    <Badge variant="outline" className="h-4 text-[8px] border-destructive/30 text-destructive bg-destructive/5 font-black uppercase">Reforço necessário</Badge>
                                                  )}
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      );
                                    })()}
                                  </div>

                                  {/* Teacher Intervention */}
                                  <div className="space-y-4">
                                    <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Intervenção do Professor</p>
                                    
                                    <Card className="bg-primary/5 border-primary/10 overflow-hidden">
                                      <CardContent className="p-4 space-y-4">
                                        <div className="flex items-center gap-2 text-primary">
                                          <MessageSquare className="h-4 w-4" />
                                          <span className="text-[10px] font-black uppercase tracking-widest">Feedback Individual</span>
                                        </div>
                                        <Textarea 
                                          placeholder="Escreva seu comentário pedagógico para o aluno..."
                                          className="min-h-[120px] bg-black/20 border-white/5 focus-visible:ring-primary/30 text-xs resize-none"
                                          value={comments[r.student_id] || ""}
                                          onChange={(e) => setComments(prev => ({ ...prev, [r.student_id]: e.target.value }))}
                                        />
                                        
                                        <div className="pt-2 flex gap-2">
                                          <Button 
                                            size="sm" 
                                            className="w-full text-[10px] font-black uppercase tracking-widest gap-2"
                                            onClick={() => safeAction("save_review_click", () => handleSaveReview(r))}
                                            disabled={savingReview === r.student_id}
                                          >
                                            {savingReview === r.student_id ? (
                                              <Loader2 className="h-3 w-3 animate-spin" />
                                            ) : (
                                              <Save className="h-3 w-3" />
                                            )}
                                            SALVAR E ENVIAR
                                          </Button>
                                          <Button 
                                            variant="outline" 
                                            size="sm" 
                                            className="w-full text-[10px] font-black uppercase tracking-widest border-white/10 bg-white/5 gap-2"
                                            onClick={() => safeAction("tutor_ia_mission_click", async () => {
                                              toast({ title: "Tutor IA Mission", description: "Iniciando análise pedagógica..." });
                                            })}
                                          >
                                            <Brain className="h-3 w-3" /> TUTOR IA MISSION
                                          </Button>
                                        </div>
                                      </CardContent>
                                    </Card>

                                    {/* Automatic AI Recommendation */}
                                    <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2">
                                       <div className="flex items-center gap-2 text-amber-500">
                                          <AlertTriangle className="h-4 w-4" />
                                          <span className="text-[10px] font-black uppercase tracking-widest">Alerta Tutor IA</span>
                                       </div>
                                       <p className="text-xs text-white/80 leading-relaxed italic">
                                          "O aluno demonstrou dificuldade crítica em temas de {Array.from(new Set(studentAnswers.filter(a => !a.is_correct).map(a => a.topic || "Geral"))).slice(0, 2).join(" e ")}. 
                                          Sugerimos focar no banco de erros e revisão de condutas."
                                       </p>
                                    </div>
                                  </div>
                                </div>

                                {/* Detailed Question Table */}
                                <div className="space-y-4">
                                  <div className="flex items-center justify-between">
                                    <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Detalhamento por Questão</p>
                                    <Badge variant="outline" className="text-[9px] border-white/10 bg-white/5">
                                      {studentAnswers.length} QUESTÕES RESPONDIDAS
                                    </Badge>
                                  </div>
                                  
                                  <div className="grid grid-cols-1 gap-3">
                                    {studentAnswers.map((a: any, idx: number) => {
                                      const q = questionsData[a.question_index ?? idx];
                                      return (
                                        <div
                                          key={idx}
                                          className={`p-4 rounded-xl text-xs border transition-all ${
                                            a.is_correct
                                              ? "border-emerald-500/10 bg-emerald-500/[0.02]"
                                              : "border-destructive/10 bg-destructive/[0.02]"
                                          }`}
                                        >
                                          <div className="flex items-start gap-4">
                                            <div className={`h-8 w-8 rounded-lg flex items-center justify-center font-black shrink-0 ${
                                              a.is_correct ? 'bg-emerald-500/10 text-emerald-500' : 'bg-destructive/10 text-destructive'
                                            }`}>
                                              {idx + 1}
                                            </div>
                                            <div className="flex-1 space-y-3">
                                              <div className="flex items-center justify-between">
                                                <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-tight bg-white/5">
                                                  {a.topic || "Geral"}
                                                </Badge>
                                                {a.time_spent && (
                                                   <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                      <Clock className="h-3 w-3" /> {a.time_spent}s
                                                   </span>
                                                )}
                                              </div>
                                              
                                              <p className="font-medium text-white/90 leading-relaxed line-clamp-2 italic">
                                                {q?.statement || `Questão ${idx + 1}`}
                                              </p>
                                              
                                              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
                                                <div className="space-y-1">
                                                   <p className="text-[9px] font-black uppercase text-white/40">Sua Resposta</p>
                                                   <p className={`text-[11px] font-bold ${a.is_correct ? 'text-emerald-500' : 'text-destructive'}`}>
                                                      {q?.options?.[a.selected] || "Não respondida"}
                                                   </p>
                                                </div>
                                                <div className="space-y-1 text-right">
                                                   <p className="text-[9px] font-black uppercase text-white/40">Gabarito</p>
                                                   <p className="text-[11px] font-bold text-emerald-500">
                                                      {q?.options?.[q.correct_index] || "N/A"}
                                                   </p>
                                                </div>
                                              </div>
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
        </TeacherDialogContent>
    </Dialog>
  );
});

export default SimuladoResultsDialog;