import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, LineChart, Line, CartesianGrid, ScatterChart, Scatter, ZAxis } from "recharts";
import { Loader2, TrendingDown, TrendingUp, Sparkles, AlertTriangle, CheckCircle, Users, FileText, Target, Brain, Download, ShieldAlert, Info, BarChart3, GraduationCap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { exportProfessorBIReport } from "@/lib/exportPdf";

interface Props {
  callAPI: (body: Record<string, unknown>) => Promise<any>;
}

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const ProfessorBIPanel = ({ callAPI }: Props) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [studentFilter, setStudentFilter] = useState<string>("all");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const loadBI = async (sid?: string) => {
    setLoading(true);
    try {
      const res = await callAPI({ action: "professor_bi", student_id: sid && sid !== "all" ? sid : undefined });
      setData(res);
    } catch (e) {
      toast({ title: "Erro ao carregar BI", description: e instanceof Error ? e.message : "Erro", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadBI(); }, []);

  const handleStudentChange = (val: string) => {
    setStudentFilter(val);
    loadBI(val);
  };

  const generateSuggestions = async () => {
    if (!data) return;
    setLoadingSuggestions(true);
    try {
      const res = await callAPI({
        action: "professor_bi_suggestion",
        summary: {
          deficient_topics: data.proficiency?.deficient_topics?.slice(0, 10),
          mastered_topics: data.proficiency?.mastered_topics?.slice(0, 5),
          kpis: data.proficiency?.kpis,
          platform_kpis: data.platform?.kpis,
          top_errors: data.platform?.top_errors?.slice(0, 5),
          at_risk_students: data.at_risk_students?.slice(0, 5),
        },
      });
      setSuggestions(res.suggestions || []);
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Erro ao gerar sugestões", variant: "destructive" });
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleExportPDF = async () => {
    if (!data) return;
    try {
      const prof = data.proficiency || {};
      const plat = data.platform || {};
      const selectedStudent = studentFilter !== "all"
        ? data.students?.find((s: any) => s.user_id === studentFilter)?.display_name
        : null;
        
      await exportProfessorBIReport({
        kpis: {
          "Atividades Criadas": prof.kpis?.total_activities ?? 0,
          "Taxa de Conclusão": `${prof.kpis?.completion_rate ?? 0}%`,
          "Média Geral": `${prof.kpis?.avg_score ?? 0}%`,
          "Pendentes": prof.kpis?.pending ?? 0,
          ...(plat?.kpis ? {
            "Questões Respondidas": plat.kpis.total_questions,
            "Acurácia Média": `${plat.kpis.avg_accuracy}%`,
            "Streak Médio": `${plat.kpis.avg_streak} dias`,
            "Inativos (>7d)": plat.kpis.inactive_count,
          } : {}),
        },
        topicBreakdown: prof.topic_breakdown,
        deficientTopics: prof.deficient_topics,
        masteredTopics: prof.mastered_topics,
        atRiskStudents: data.at_risk_students,
        studentEngagement: plat?.student_engagement,
        studentPercentile: data.student_percentile,
      }, selectedStudent ? `BI_Aluno_${selectedStudent}` : "BI_Turma_Professor");
      
      toast({ title: "PDF exportado com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro na exportação", description: err.message, variant: "destructive" });
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!data) return <p className="text-center text-muted-foreground py-8">Sem dados disponíveis.</p>;

  const prof = data.proficiency || {};
  const plat = data.platform || {};
  const students = data.students || [];
  const atRisk = data.at_risk_students || [];
  const weeklyEvo = data.weekly_evolution || [];
  const percentile = data.student_percentile;
  const studentMatrix = data.student_matrix || [];
  const studentRanking = data.student_ranking || [];
  const topicStudentCross = data.topic_student_cross || [];
  const profVsPlat = data.proficiency_vs_platform || [];
  const activityHeatmap = data.activity_heatmap || [];

  // Executive summary
  const execSummary = (() => {
    const parts: string[] = [];
    const avg = prof.kpis?.avg_score ?? 0;
    const total = prof.kpis?.total_activities ?? 0;
    const completion = prof.kpis?.completion_rate ?? 0;
    const defCount = prof.deficient_topics?.length ?? 0;
    const masteredCount = prof.mastered_topics?.length ?? 0;
    const riskCount = atRisk.length;

    if (total === 0) return "Nenhuma atividade criada ainda. Crie simulados, casos clínicos ou temas de estudo para começar a ver os dados.";
    
    parts.push(`${total} atividades criadas com ${completion}% de conclusão e média geral de ${avg}%.`);
    if (riskCount > 0) parts.push(`⚠️ ${riskCount} aluno(s) em risco requerem atenção.`);
    if (defCount > 0) parts.push(`${defCount} tema(s) deficitário(s) (< 50%).`);
    if (masteredCount > 0) parts.push(`${masteredCount} tema(s) dominado(s) (≥ 80%).`);
    
    const platKpis = plat?.kpis;
    if (platKpis) {
      parts.push(`Na plataforma geral: ${platKpis.avg_accuracy}% de acurácia média, ${platKpis.inactive_count} inativos.`);
    }
    return parts.join(" ");
  })();

  return (
    <div className="space-y-6 w-full max-w-5xl mx-auto">
      {/* Filter + Export */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={studentFilter} onValueChange={handleStudentChange}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Todos os alunos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os alunos</SelectItem>
            {students.map((s: any) => (
              <SelectItem key={s.user_id} value={s.user_id}>{s.display_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-2">
          <Download className="h-4 w-4" /> Exportar PDF
        </Button>
      </div>

      {/* Executive Summary */}
      <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold mb-1">Resumo Executivo</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{execSummary}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* At-Risk Students — more prominent */}
      {atRisk.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5 shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive animate-pulse" /> 🚨 Alunos em Risco ({atRisk.length})
            </CardTitle>
            <p className="text-xs text-muted-foreground">Score médio &lt; 50% ou inatividade &gt; 7 dias — requerem intervenção imediata</p>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-3">
              {atRisk.map((s: any, i: number) => (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${s.criticality === "critico" ? "border-destructive/40 bg-destructive/10" : "border-amber-500/40 bg-amber-500/10"}`}>
                  <AlertTriangle className={`h-5 w-5 mt-0.5 shrink-0 ${s.criticality === "critico" ? "text-destructive" : "text-amber-500"}`} />
                  <div>
                    <p className="text-sm font-semibold">{s.display_name}</p>
                    <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                      {s.reasons.map((r: string, j: number) => <li key={j}>• {r}</li>)}
                    </ul>
                    <Badge variant={s.criticality === "critico" ? "destructive" : "secondary"} className="text-[10px] mt-1">
                      {s.criticality === "critico" ? "Crítico" : "Atenção"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Percentile */}
      {percentile && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-xl font-bold text-primary">P{percentile.percentile}</span>
            </div>
            <div>
              <p className="text-sm font-semibold">{percentile.display_name}</p>
              <p className="text-xs text-muted-foreground">
                Percentil {percentile.percentile} da turma • Acurácia {percentile.accuracy}% • Posição {percentile.rank}/{percentile.total_students}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="proficiency">
        <TabsList>
          <TabsTrigger value="proficiency" className="gap-1.5">
            <Target className="h-3.5 w-3.5" /> Proficiência (Atividades)
          </TabsTrigger>
          <TabsTrigger value="platform" className="gap-1.5">
            <Brain className="h-3.5 w-3.5" /> Plataforma (Jornada Global)
          </TabsTrigger>
          <TabsTrigger value="suggestions" className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Sugestões IA
          </TabsTrigger>
        </TabsList>

        {/* ===== PROFICIENCY TAB ===== */}
        <TabsContent value="proficiency" className="space-y-6 mt-4">
          {/* Banner */}
          <div className="flex items-start gap-3 p-4 rounded-lg border border-primary/30 bg-primary/5">
            <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-primary">📋 Desempenho em Atividades do Professor</p>
              <p className="text-xs text-muted-foreground">
                Dados exclusivos das atividades que <strong>você criou e atribuiu</strong>: simulados, casos clínicos e temas de estudo. Não inclui atividades gerais da plataforma.
              </p>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPICard icon={<FileText className="h-5 w-5 text-primary" />} label="Atividades Criadas" value={prof.kpis?.total_activities ?? 0} borderColor="border-primary/30" bgColor="bg-primary/5" />
            <KPICard icon={<Target className="h-5 w-5 text-emerald-500" />} label="Taxa de Conclusão" value={`${prof.kpis?.completion_rate ?? 0}%`} borderColor="border-emerald-500/30" bgColor="bg-emerald-500/5" />
            <KPICard icon={<TrendingUp className="h-5 w-5 text-blue-500" />} label="Média Geral" value={`${prof.kpis?.avg_score ?? 0}%`} borderColor="border-blue-500/30" bgColor="bg-blue-500/5" />
            <KPICard icon={<AlertTriangle className="h-5 w-5 text-amber-500" />} label="Pendentes" value={prof.kpis?.pending ?? 0} borderColor="border-amber-500/30" bgColor="bg-amber-500/5" />
          </div>

          {/* Student Ranking */}
          {studentRanking.length > 0 && (
            <Card className="border-primary/20">
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><GraduationCap className="h-4 w-4 text-primary" /> Ranking de Alunos (Proficiência)</CardTitle></CardHeader>
              <CardContent>
                <div className="max-h-[300px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Aluno</TableHead>
                        <TableHead>Média</TableHead>
                        <TableHead>Conclusão</TableHead>
                        <TableHead>Feitas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {studentRanking.map((s: any, i: number) => (
                        <TableRow key={s.user_id}>
                          <TableCell className="text-sm font-bold">{i + 1}º</TableCell>
                          <TableCell className="text-sm">{s.display_name}</TableCell>
                          <TableCell>
                            <Badge variant={s.avg_score >= 70 ? "default" : s.avg_score >= 50 ? "secondary" : "destructive"} className="text-xs">
                              {s.avg_score}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{s.completion_rate}%</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{s.total_done}/{s.total_assigned}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Student × Activity Matrix */}
          {studentMatrix.length > 0 && studentMatrix[0]?.activities?.length > 0 && (
            <Card className="border-primary/20">
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /> Matriz Aluno × Atividade</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-auto max-h-[400px]">
                  <table className="text-xs w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="sticky left-0 bg-background p-2 text-left border-b min-w-[120px]">Aluno</th>
                        {studentMatrix[0].activities.map((a: any, i: number) => (
                          <th key={i} className="p-1 border-b text-center min-w-[60px]" title={`${a.type}: ${a.title}`}>
                            <div className="truncate max-w-[60px]">{a.title?.slice(0, 8)}</div>
                            <div className="text-[9px] text-muted-foreground">{a.type}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {studentMatrix.map((s: any) => (
                        <tr key={s.student_id}>
                          <td className="sticky left-0 bg-background p-2 border-b font-medium">{s.display_name}</td>
                          {s.activities.map((a: any, i: number) => {
                            let bg = "bg-muted";
                            let text = "—";
                            if (a.status === "completed") {
                              if (a.score != null) {
                                text = `${a.score}%`;
                                bg = a.score >= 70 ? "bg-emerald-500/20 text-emerald-700" : a.score >= 50 ? "bg-amber-500/20 text-amber-700" : "bg-destructive/20 text-destructive";
                              } else {
                                text = "✓";
                                bg = "bg-emerald-500/20 text-emerald-700";
                              }
                            } else if (a.status === "pending") {
                              text = "⏳";
                              bg = "bg-amber-500/10 text-amber-600";
                            } else if (a.status === "studying") {
                              text = "📖";
                              bg = "bg-blue-500/10 text-blue-600";
                            }
                            return <td key={i} className={`p-1 border-b text-center rounded ${bg}`}>{text}</td>;
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex gap-3 mt-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500/20" /> ≥70%</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500/20" /> 50-69%</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-destructive/20" /> &lt;50%</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500/10" /> Pendente</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-muted" /> Não atribuído</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Topic × Student Cross */}
          {topicStudentCross.length > 0 && (
            <Card className="border-primary/20">
              <CardHeader><CardTitle className="text-base">Cruzamento Tema × Aluno</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-[400px] overflow-auto">
                  {topicStudentCross.slice(0, 10).map((t: any) => (
                    <div key={t.topic}>
                      <p className="text-sm font-semibold mb-1">{t.topic}</p>
                      <div className="flex flex-wrap gap-2">
                        {t.students.map((s: any) => (
                          <Badge key={s.name} variant={s.accuracy >= 70 ? "default" : s.accuracy >= 50 ? "secondary" : "destructive"} className="text-[10px]">
                            {s.name}: {s.accuracy}% ({s.correct}/{s.total})
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Weekly Evolution */}
          {weeklyEvo.length > 1 && (
            <Card className="border-primary/20">
              <CardHeader><CardTitle className="text-base">Evolução Semanal da Acurácia</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={weeklyEvo}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="week" tick={{ fontSize: 10 }} tickFormatter={(v) => { const d = new Date(v); return `${d.getDate()}/${d.getMonth() + 1}`; }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                    <Tooltip formatter={(v: number) => `${v}%`} />
                    <Line type="monotone" dataKey="accuracy" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Topic Performance */}
          {prof.topic_breakdown?.length > 0 && (
            <Card className="border-primary/20">
              <CardHeader><CardTitle className="text-base">Desempenho por Tópico (Atividades do Professor)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={Math.max(200, prof.topic_breakdown.length * 32)}>
                  <BarChart data={prof.topic_breakdown.slice(0, 15)} layout="vertical" margin={{ left: 120 }}>
                    <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                    <YAxis type="category" dataKey="topic" width={110} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => `${v}%`} />
                    <Bar dataKey="accuracy" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Deficient + Mastered */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="border-destructive/30">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-destructive" /> Assuntos Deficitários
                </CardTitle>
              </CardHeader>
              <CardContent>
                {prof.deficient_topics?.length > 0 ? (
                  <div className="space-y-2">
                    {prof.deficient_topics.map((t: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded bg-destructive/5">
                        <span className="text-sm font-medium">{t.topic}</span>
                        <Badge variant="destructive">{t.accuracy}% ({t.total} q)</Badge>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-muted-foreground">Nenhum tópico com acerto &lt; 50%</p>}
              </CardContent>
            </Card>

            <Card className="border-emerald-500/30">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-500" /> Assuntos Dominados
                </CardTitle>
              </CardHeader>
              <CardContent>
                {prof.mastered_topics?.length > 0 ? (
                  <div className="space-y-2">
                    {prof.mastered_topics.map((t: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded bg-emerald-500/5">
                        <span className="text-sm font-medium">{t.topic}</span>
                        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">{t.accuracy}% ({t.total} q)</Badge>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-muted-foreground">Nenhum tópico com acerto ≥ 80%</p>}
              </CardContent>
            </Card>
          </div>

          {/* Activity Table */}
          {prof.activity_table?.length > 0 && (
            <Card className="border-primary/20">
              <CardHeader><CardTitle className="text-base">Resultados por Atividade</CardTitle></CardHeader>
              <CardContent>
                <div className="max-h-[400px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Atividade</TableHead>
                        <TableHead>Aluno</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {prof.activity_table.slice(0, 50).map((r: any, i: number) => (
                        <TableRow key={i} className={r.status === "pending" ? "bg-amber-500/5" : ""}>
                          <TableCell><Badge variant="outline" className="text-[10px]">{r.type}</Badge></TableCell>
                          <TableCell className="text-sm">{r.title}</TableCell>
                          <TableCell className="text-sm">{r.student_name}</TableCell>
                          <TableCell className="text-sm font-medium">{r.score != null ? `${r.score}%` : "—"}</TableCell>
                          <TableCell>
                            <Badge variant={r.status === "completed" ? "default" : "secondary"} className={`text-[10px] ${r.status === "pending" ? "bg-amber-500/20 text-amber-700 border-amber-500/30" : ""}`}>
                              {r.status === "completed" ? "Concluído" : r.status === "pending" ? "Pendente" : r.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ===== PLATFORM / JORNADA GLOBAL ===== */}
        <TabsContent value="platform" className="space-y-6 mt-4">
          {/* Banner */}
          <div className="flex items-start gap-3 p-4 rounded-lg border border-violet-500/30 bg-violet-500/5">
            <Info className="h-5 w-5 text-violet-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-violet-600">Jornada Global na Plataforma</p>
              <p className="text-xs text-muted-foreground">
                Desempenho dos alunos em todas as funcionalidades: banco de questões, flashcards, simulados gerais, streaks e engajamento geral.
              </p>
            </div>
          </div>

          {plat?.kpis ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KPICard icon={<Brain className="h-5 w-5 text-violet-500" />} label="Questões Respondidas" value={plat.kpis.total_questions} borderColor="border-violet-500/20" />
                <KPICard icon={<CheckCircle className="h-5 w-5 text-emerald-500" />} label="Acurácia Média" value={`${plat.kpis.avg_accuracy}%`} borderColor="border-violet-500/20" />
                <KPICard icon={<TrendingUp className="h-5 w-5 text-amber-500" />} label="Streak Médio" value={`${plat.kpis.avg_streak} dias`} borderColor="border-violet-500/20" />
                <KPICard icon={<Users className="h-5 w-5 text-destructive" />} label="Inativos (>7d)" value={plat.kpis.inactive_count} borderColor="border-violet-500/20" />
              </div>

              {/* Proficiency vs Platform Correlation */}
              {profVsPlat.length > 0 && profVsPlat.some((s: any) => s.gap != null) && (
                <Card className="border-violet-500/20">
                  <CardHeader><CardTitle className="text-base">Correlação: Proficiência × Plataforma</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground mb-3">Compara o desempenho nas atividades do professor vs. acurácia geral na plataforma. Gap positivo = melhor nas atividades do professor.</p>
                    <div className="max-h-[300px] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Aluno</TableHead>
                            <TableHead>Prof. (%)</TableHead>
                            <TableHead>Plataforma (%)</TableHead>
                            <TableHead>Gap</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {profVsPlat.filter((s: any) => s.gap != null).map((s: any, i: number) => (
                            <TableRow key={i}>
                              <TableCell className="text-sm">{s.name}</TableCell>
                              <TableCell className="text-sm font-medium">{s.prof_accuracy ?? "—"}%</TableCell>
                              <TableCell className="text-sm font-medium">{s.platform_accuracy ?? "—"}%</TableCell>
                              <TableCell>
                                <Badge variant={s.gap > 10 ? "default" : s.gap < -10 ? "destructive" : "secondary"} className="text-xs">
                                  {s.gap > 0 ? "+" : ""}{s.gap}%
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Activity Heatmap */}
              {activityHeatmap.length > 0 && (
                <Card className="border-violet-500/20">
                  <CardHeader><CardTitle className="text-base">Heatmap de Atividade (Últimas 2 Semanas)</CardTitle></CardHeader>
                  <CardContent>
                    <div className="overflow-auto">
                      <table className="text-[10px] border-collapse">
                        <thead>
                          <tr>
                            <th className="p-1" />
                            {Array.from({ length: 24 }, (_, h) => (
                              <th key={h} className="p-1 text-muted-foreground">{h}h</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {DAY_LABELS.map((label, dayIdx) => {
                            const maxCount = Math.max(...activityHeatmap.map((h: any) => h.count), 1);
                            return (
                              <tr key={dayIdx}>
                                <td className="p-1 text-muted-foreground font-medium pr-2">{label}</td>
                                {Array.from({ length: 24 }, (_, h) => {
                                  const cell = activityHeatmap.find((c: any) => c.day === dayIdx && c.hour === h);
                                  const count = cell?.count || 0;
                                  const intensity = count / maxCount;
                                  return (
                                    <td key={h} className="p-0.5" title={`${label} ${h}h: ${count} atividades`}>
                                      <div
                                        className="w-4 h-4 rounded-sm"
                                        style={{
                                          backgroundColor: count === 0
                                            ? "hsl(var(--muted))"
                                            : `hsl(270, 70%, ${Math.max(30, 80 - intensity * 50)}%)`,
                                        }}
                                      />
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                      <span>Menos</span>
                      {[0, 0.25, 0.5, 0.75, 1].map((v, i) => (
                        <div key={i} className="w-4 h-4 rounded-sm" style={{ backgroundColor: v === 0 ? "hsl(var(--muted))" : `hsl(270, 70%, ${80 - v * 50}%)` }} />
                      ))}
                      <span>Mais</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Top Errors */}
              {plat.top_errors?.length > 0 && (
                <Card className="border-violet-500/20">
                  <CardHeader><CardTitle className="text-base">Temas com Mais Erros (Uso Geral da Plataforma)</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={Math.max(200, plat.top_errors.length * 32)}>
                      <BarChart data={plat.top_errors} layout="vertical" margin={{ left: 120 }}>
                        <XAxis type="number" />
                        <YAxis type="category" dataKey="tema" width={110} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="count" fill="hsl(270, 70%, 55%)" radius={[0, 4, 4, 0]} name="Erros" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Specialty Radar */}
              {plat.specialty_accuracy?.length >= 3 && (
                <Card className="border-violet-500/20">
                  <CardHeader><CardTitle className="text-base">Acurácia por Especialidade (Plataforma)</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={320}>
                      <RadarChart data={plat.specialty_accuracy.map((s: any) => ({
                        ...s, label: s.specialty.length > 12 ? s.specialty.slice(0, 11) + "…" : s.specialty,
                      }))}>
                        <PolarGrid className="stroke-border" />
                        <PolarAngleAxis dataKey="label" tick={{ fontSize: 10 }} />
                        <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                        <Radar name="Acurácia" dataKey="accuracy" stroke="hsl(270, 70%, 55%)" fill="hsl(270, 70%, 55%)" fillOpacity={0.2} strokeWidth={2} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Student Engagement */}
              {plat.student_engagement?.length > 0 && (
                <Card className="border-violet-500/20">
                  <CardHeader><CardTitle className="text-base">Engajamento dos Alunos (Plataforma)</CardTitle></CardHeader>
                  <CardContent>
                    <div className="max-h-[400px] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Aluno</TableHead>
                            <TableHead>XP</TableHead>
                            <TableHead>Streak</TableHead>
                            <TableHead>Questões</TableHead>
                            <TableHead>Acurácia</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {plat.student_engagement.map((s: any, i: number) => (
                            <TableRow key={i}>
                              <TableCell className="text-sm font-medium">{s.display_name}</TableCell>
                              <TableCell className="text-sm">{s.xp}</TableCell>
                              <TableCell className="text-sm">{s.streak} dias</TableCell>
                              <TableCell className="text-sm">{s.questions_answered}</TableCell>
                              <TableCell className="text-sm">{s.accuracy}%</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <p className="text-center text-muted-foreground py-8">Sem dados de plataforma disponíveis. Crie atividades primeiro.</p>
          )}
        </TabsContent>

        {/* ===== SUGGESTIONS ===== */}
        <TabsContent value="suggestions" className="space-y-6 mt-4">
          <div className="flex justify-center">
            <Button onClick={generateSuggestions} disabled={loadingSuggestions} className="gap-2">
              {loadingSuggestions ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Gerar Sugestões Pedagógicas
            </Button>
          </div>

          {suggestions.length > 0 && (
            <div className="grid md:grid-cols-2 gap-4">
              {suggestions.map((s: any, i: number) => (
                <Card key={i} className={`border-l-4 ${s.priority === "alta" ? "border-l-destructive" : s.priority === "media" ? "border-l-amber-500" : "border-l-emerald-500"}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">{s.title}</CardTitle>
                      <div className="flex gap-1">
                        <Badge variant={s.priority === "alta" ? "destructive" : "secondary"} className="text-[10px]">{s.priority}</Badge>
                        <Badge variant="outline" className="text-[10px]">{s.target}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{s.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

const KPICard = ({ icon, label, value, borderColor, bgColor }: { icon: React.ReactNode; label: string; value: React.ReactNode; borderColor?: string; bgColor?: string }) => (
  <Card className={`${borderColor} bg-white/5 border-white/5 overflow-hidden transition-all hover:scale-[1.02] shadow-glow-sm`}>
    <CardContent className={`p-5 flex items-center gap-4 ${bgColor || ""}`}>
      <div className="h-11 w-11 rounded-xl bg-white/5 flex items-center justify-center shrink-0 border border-white/5">
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60 mb-0.5">{label}</p>
        <p className="text-xl font-black text-white">{value}</p>
      </div>
    </CardContent>
  </Card>
);

export default ProfessorBIPanel;
