import { useState, useCallback, useEffect } from "react";
import { User, Search, Loader2, BarChart3, AlertTriangle, BookOpen, Target, TrendingUp, Clock, CheckCircle2, Circle, Download, Activity, FileText, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
// jsPDF carregado sob demanda (lazy) para reduzir bundle inicial
import { FACULDADES } from "@/constants/faculdades";
import { CinematicEmptyState } from "@/components/cinematic";

interface StudentProfile {
  user_id: string;
  display_name: string;
  email: string;
  faculdade: string | null;
  periodo: number | null;
}

interface WeeklyPoint { week: string; accuracy: number; total: number }

interface ActivityResult {
  title: string;
  score?: number | null;
  status: string;
  finished_at?: string | null;
  completed_at?: string | null;
}

interface StudentDetail {
  profile: StudentProfile;
  domain_scores: { specialty: string; domain_score: number; questions_answered: number; correct_answers: number; errors_count: number }[];
  error_topics: { tema: string; vezes_errado: number; categoria_erro: string | null }[];
  study_performance: { questoes_respondidas: number; taxa_acerto: number } | null;
  gamification: { xp: number; level: number; current_streak: number; last_activity_date?: string } | null;
  simulado_results: ActivityResult[];
  clinical_case_results: ActivityResult[];
  study_assignments: ActivityResult[];
  weekly_evolution: WeeklyPoint[];
  avg_domain_score: number;
  class_avg_score: number | null;
  quotas: { questions_used: number; questions_limit: number } | null;
}

const StudentTracker = ({ callAPI: externalCallAPI }: { callAPI?: (body: Record<string, unknown>) => Promise<any> }) => {
  const { session } = useAuth();
  const { toast } = useToast();
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string>("");
  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [faculdade, setFaculdade] = useState("");
  const [periodo, setPeriodo] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const API_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/professor-simulado`;

  const callAPI = useCallback(async (body: Record<string, unknown>) => {
    if (externalCallAPI) return externalCallAPI(body);
    const resp = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || "Erro");
    return data;
  }, [session, API_URL, externalCallAPI]);

  const loadStudents = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const res = await callAPI({
        action: "get_students",
        faculdade: faculdade && faculdade !== "all" ? faculdade : undefined,
        periodo: periodo && periodo !== "all" ? parseInt(periodo) : undefined,
      });
      setStudents(res.students || []);
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Erro", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [session, callAPI, faculdade, periodo, toast]);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  const loadStudentDetail = useCallback(async (userId: string) => {
    if (!session) return;
    setLoadingDetail(true);
    setSelectedStudent(userId);
    try {
      const res = await callAPI({ action: "student_detail", student_id: userId });
      setDetail(res);
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Erro", variant: "destructive" });
    } finally {
      setLoadingDetail(false);
    }
  }, [session, callAPI, toast]);

  const filteredStudents = students.filter((s) =>
    (s.display_name || s.email || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const avgDomain = detail?.avg_domain_score || (detail?.domain_scores && detail.domain_scores.length > 0
    ? Math.round(detail.domain_scores.reduce((s, d) => s + d.domain_score, 0) / detail.domain_scores.length)
    : 0);

  const exportStudentPDF = async () => {
    if (!detail) return;
    try {
      const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const M = 15;
    const W = doc.internal.pageSize.getWidth() - M * 2;
    let y = 20;
    const checkPage = (n = 15) => { if (y > 280 - n) { doc.addPage(); y = 20; } };

    // Header
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Relatório Individual do Aluno", M, y); y += 7;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(`ENAZIZI — ${new Date().toLocaleDateString("pt-BR")}`, M, y);
    doc.setTextColor(0); y += 10;

    // Student info
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(detail.profile.display_name || detail.profile.email, M, y); y += 6;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`${detail.profile.faculdade || "—"} • ${detail.profile.periodo ? `${detail.profile.periodo}º período` : "—"} • ${detail.profile.email}`, M, y); y += 8;

    // Summary
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Resumo", M, y); y += 6;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const summaryItems = [
      `Score Médio: ${avgDomain}%${detail.class_avg_score != null ? ` (Turma: ${detail.class_avg_score}%)` : ""}`,
      `Questões Respondidas: ${detail.study_performance?.questoes_respondidas || 0}`,
      `Taxa de Acerto: ${detail.study_performance?.taxa_acerto || 0}%`,
      `Streak: ${detail.gamification?.current_streak || 0} dias`,
      `XP: ${detail.gamification?.xp || 0} • Nível: ${detail.gamification?.level || 1}`,
    ];
    summaryItems.forEach(item => { doc.text(`• ${item}`, M, y); y += 5; });
    y += 5;

    // Domain Scores
    if (detail.domain_scores.length > 0) {
      checkPage(20);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Maestria por Especialidade", M, y); y += 6;
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("Especialidade", M, y);
      doc.text("Score", M + 80, y);
      doc.text("Questões", M + 100, y);
      doc.text("Acertos", M + 120, y);
      doc.text("Erros", M + 140, y);
      y += 4;
      doc.setDrawColor(200);
      doc.line(M, y - 1, M + W, y - 1);
      doc.setFont("helvetica", "normal");

      detail.domain_scores.sort((a, b) => b.domain_score - a.domain_score).forEach(d => {
        checkPage(5);
        doc.text(d.specialty.slice(0, 35), M, y);
        if (d.domain_score >= 70) doc.setTextColor(34, 139, 34);
        else if (d.domain_score >= 50) doc.setTextColor(200, 150, 0);
        else doc.setTextColor(200, 50, 50);
        doc.text(`${d.domain_score}%`, M + 80, y);
        doc.setTextColor(0);
        doc.text(`${d.questions_answered}`, M + 100, y);
        doc.text(`${d.correct_answers}`, M + 120, y);
        doc.text(`${d.errors_count}`, M + 140, y);
        y += 4;
      });
      y += 5;
    }

    // Errors
    if (detail.error_topics.length > 0) {
      checkPage(20);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Principais Erros", M, y); y += 6;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      detail.error_topics.slice(0, 10).forEach(e => {
        checkPage(5);
        doc.text(`• ${e.tema}: ${e.vezes_errado}x${e.categoria_erro ? ` (${e.categoria_erro})` : ""}`, M, y); y += 4.5;
      });
      y += 5;
    }

    // Weekly Evolution
    if (detail.weekly_evolution && detail.weekly_evolution.length > 0) {
      checkPage(20);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Evolução Semanal", M, y); y += 6;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      detail.weekly_evolution.forEach(w => {
        checkPage(5);
        const d = new Date(w.week);
        doc.text(`Semana ${d.toLocaleDateString("pt-BR")}: ${w.accuracy}% (${w.total} questões)`, M, y); y += 4.5;
      });
      y += 5;
    }

    // Simulados
    if (detail.simulado_results.length > 0) {
      checkPage(20);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Simulados", M, y); y += 6;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      detail.simulado_results.forEach(r => {
        checkPage(5);
        const status = r.status === "completed" ? "Concluído" : "Pendente";
        const score = r.score != null ? ` — ${r.score}%` : "";
        doc.text(`• ${r.title}: ${status}${score}`, M, y); y += 4.5;
      });
      y += 5;
    }

    // Clinical Cases
    if (detail.clinical_case_results && detail.clinical_case_results.length > 0) {
      checkPage(20);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Casos Clínicos", M, y); y += 6;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      detail.clinical_case_results.forEach(r => {
        checkPage(5);
        const status = r.status === "completed" ? "Concluído" : "Pendente";
        const score = r.score != null ? ` — ${r.score}%` : "";
        doc.text(`• ${r.title}: ${status}${score}`, M, y); y += 4.5;
      });
      y += 5;
    }

    // Study Assignments
    if (detail.study_assignments && detail.study_assignments.length > 0) {
      checkPage(20);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Temas de Estudo Atribuídos", M, y); y += 6;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      detail.study_assignments.forEach(r => {
        checkPage(5);
        const statusMap: Record<string, string> = { completed: "Concluído", studying: "Estudando", pending: "Pendente" };
        doc.text(`• ${r.title}: ${statusMap[r.status] || r.status}`, M, y); y += 4.5;
      });
    }

    doc.save(`Relatorio_${(detail.profile.display_name || "Aluno").replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err: any) {
      toast({ title: "Erro na exportação", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4 w-full max-w-5xl mx-auto">
      {/* Filters + Search */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Faculdade</label>
          <Select value={faculdade} onValueChange={setFaculdade}>
            <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {FACULDADES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Período</label>
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((p) => (
                <SelectItem key={p} value={String(p)}>{p}º período</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={loadStudents} disabled={loading} size="sm" className="gap-1.5">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Buscar Alunos
        </Button>
      </div>

      {students.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Filtrar por nome..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 h-9" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Student list */}
        <div className="space-y-1 max-h-[60vh] overflow-y-auto">
          {students.length > 0 && (
            <p className="text-[11px] text-muted-foreground px-1 pb-1">Clique em um aluno para ver os detalhes.</p>
          )}

          {students.length === 0 && !loading && (
            <CinematicEmptyState
              module="professor"
              title="Nenhum aluno encontrado"
              description="Quando alunos se vincularem ao seu painel, eles aparecerão aqui."
            />
          )}

          {students.length > 0 && filteredStudents.length === 0 && (
            <Card><CardContent className="p-5 text-center">
              <p className="text-sm text-muted-foreground">Nenhum aluno corresponde ao filtro.</p>
            </CardContent></Card>
          )}

          {filteredStudents.map((s) => (
            <button key={s.user_id} onClick={() => loadStudentDetail(s.user_id)}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${selectedStudent === s.user_id ? "border-primary bg-primary/5" : "border-border hover:border-primary/30 hover:bg-muted/30"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{s.display_name || s.email}</p>
                  <p className="text-[11px] text-muted-foreground">{s.faculdade || "Sem faculdade"}{s.periodo ? ` • ${s.periodo}º período` : ""}</p>
                </div>
                <div className="shrink-0 mt-0.5">
                  {selectedStudent === s.user_id ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Student detail */}
        <div className="lg:col-span-2 space-y-4">
          {loadingDetail && (
            <div className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></div>
          )}

          {!loadingDetail && !detail && (
            <Card><CardContent className="p-12 text-center">
              <BarChart3 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">Selecione um aluno para ver os detalhes.</p>
            </CardContent></Card>
          )}

          {!loadingDetail && detail && (
            <>
              {/* Header */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <User className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-lg truncate">{detail.profile.display_name || detail.profile.email}</h3>
                      <p className="text-sm text-muted-foreground">
                        {detail.profile.faculdade || "—"}{detail.profile.periodo ? ` • ${detail.profile.periodo}º período` : ""} • {detail.profile.email}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={exportStudentPDF} className="gap-1.5 shrink-0">
                      <Download className="h-4 w-4" /> PDF
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card>
                  <CardContent className="p-3 text-center">
                    <Target className="h-4 w-4 mx-auto text-primary mb-1" />
                    <p className="text-lg font-bold">{avgDomain}%</p>
                    <p className="text-[10px] text-muted-foreground">Score Médio</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <BookOpen className="h-4 w-4 mx-auto text-emerald-500 mb-1" />
                    <p className="text-lg font-bold">{detail.study_performance?.questoes_respondidas || 0}</p>
                    <p className="text-[10px] text-muted-foreground">Questões</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <TrendingUp className="h-4 w-4 mx-auto text-amber-500 mb-1" />
                    <p className="text-lg font-bold">{detail.gamification?.current_streak || 0}d</p>
                    <p className="text-[10px] text-muted-foreground">Streak</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <Activity className="h-4 w-4 mx-auto text-primary mb-1" />
                    <p className="text-lg font-bold">{detail.gamification?.xp || 0}</p>
                    <p className="text-[10px] text-muted-foreground">XP (Lv.{detail.gamification?.level || 1})</p>
                  </CardContent>
                </Card>
              </div>

              {/* Comparison vs Class */}
              {detail.class_avg_score != null && (
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground mb-2">Aluno vs Turma</p>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium">Aluno: {avgDomain}%</span>
                          <span className="text-muted-foreground">Turma: {detail.class_avg_score}%</span>
                        </div>
                        <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                          <div className="absolute inset-y-0 left-0 bg-primary/30 rounded-full" style={{ width: `${detail.class_avg_score}%` }} />
                          <div className={`absolute inset-y-0 left-0 rounded-full ${avgDomain >= detail.class_avg_score ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${avgDomain}%` }} />
                        </div>
                      </div>
                      <Badge variant={avgDomain >= detail.class_avg_score ? "default" : "secondary"} className="text-[10px]">
                        {avgDomain >= detail.class_avg_score ? "Acima" : "Abaixo"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Weekly Evolution */}
              {detail.weekly_evolution && detail.weekly_evolution.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      Evolução Semanal (últimas 8 semanas)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-end gap-1 h-20">
                      {detail.weekly_evolution.map((w, i) => {
                        const d = new Date(w.week);
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1">
                            <span className="text-[9px] text-muted-foreground">{w.accuracy}%</span>
                            <div className="w-full bg-muted rounded-t" style={{ height: `${Math.max(w.accuracy * 0.6, 4)}px` }}>
                              <div className={`w-full h-full rounded-t ${w.accuracy >= 70 ? "bg-emerald-500" : w.accuracy >= 50 ? "bg-amber-500" : "bg-destructive"}`} />
                            </div>
                            <span className="text-[8px] text-muted-foreground">{d.getDate()}/{d.getMonth() + 1}</span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Quotas */}
              {detail.quotas && (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Uso de Cota</span>
                      <span className="font-medium">{detail.quotas.questions_used}/{detail.quotas.questions_limit} questões</span>
                    </div>
                    <Progress value={(detail.quotas.questions_used / Math.max(detail.quotas.questions_limit, 1)) * 100} className="h-2" />
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Domain scores */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-primary" /> Maestria por Especialidade
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 max-h-60 overflow-y-auto">
                    {detail.domain_scores.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Sem dados</p>
                    ) : (
                      detail.domain_scores.sort((a, b) => b.domain_score - a.domain_score).map((d) => (
                        <div key={d.specialty}>
                          <div className="flex items-center justify-between text-xs mb-0.5">
                            <span className="truncate">{d.specialty}</span>
                            <span className={`font-bold ${d.domain_score >= 70 ? "text-emerald-500" : d.domain_score >= 50 ? "text-amber-500" : "text-destructive"}`}>{d.domain_score}%</span>
                          </div>
                          <Progress value={d.domain_score} className="h-1.5" />
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                {/* Error topics */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive" /> Principais Erros
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 max-h-60 overflow-y-auto">
                    {detail.error_topics.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhum erro registrado</p>
                    ) : (
                      detail.error_topics.slice(0, 10).map((e, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <span className="text-sm truncate flex-1">{e.tema}</span>
                          <Badge variant="destructive" className="text-[10px] ml-2">{e.vezes_errado}x</Badge>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Simulados */}
              {detail.simulado_results.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" /> Simulados ({detail.simulado_results.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {detail.simulado_results.map((r, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{r.title}</p>
                          {r.finished_at && <p className="text-[10px] text-muted-foreground">{new Date(r.finished_at).toLocaleDateString("pt-BR")}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={r.status === "completed" ? "default" : "secondary"} className="text-[10px]">
                            {r.status === "completed" ? "Concluído" : "Pendente"}
                          </Badge>
                          {r.score != null && (
                            <span className={`text-sm font-bold ${r.score >= 70 ? "text-emerald-500" : r.score >= 50 ? "text-amber-500" : "text-destructive"}`}>{r.score}%</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Clinical Cases */}
              {detail.clinical_case_results && detail.clinical_case_results.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Stethoscope className="h-4 w-4 text-primary" /> Casos Clínicos ({detail.clinical_case_results.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {detail.clinical_case_results.map((r, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{r.title}</p>
                          {r.finished_at && <p className="text-[10px] text-muted-foreground">{new Date(r.finished_at).toLocaleDateString("pt-BR")}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={r.status === "completed" ? "default" : "secondary"} className="text-[10px]">
                            {r.status === "completed" ? "Concluído" : "Pendente"}
                          </Badge>
                          {r.score != null && <span className="text-sm font-bold">{r.score}%</span>}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Study Assignments */}
              {detail.study_assignments && detail.study_assignments.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" /> Temas Atribuídos ({detail.study_assignments.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {detail.study_assignments.map((r, i) => {
                      const statusMap: Record<string, string> = { completed: "Concluído", studying: "Estudando", pending: "Pendente" };
                      return (
                        <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                          <p className="text-sm font-medium truncate">{r.title}</p>
                          <Badge variant={r.status === "completed" ? "default" : r.status === "studying" ? "secondary" : "outline"} className="text-[10px]">
                            {statusMap[r.status] || r.status}
                          </Badge>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentTracker;
