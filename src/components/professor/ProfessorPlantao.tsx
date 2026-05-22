import { useState, useEffect, useCallback } from "react";
import {
  Activity, Plus, Loader2, Eye, Users, CheckCircle, Clock,
  Sparkles, FileText, BarChart3, Trophy, XCircle, Target,
  Stethoscope, AlertTriangle, Award, Syringe, ShieldAlert, PenLine, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { TeacherDialogContent } from "@/components/teacher/TeacherDialogContent";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { CheckSquare, Square } from "lucide-react";

const SCENARIOS = ["Pronto-Socorro", "UTI", "Enfermaria", "UBS"];
const TRIAGE_COLORS = [
  { value: "vermelho", label: "🔴 Vermelho (Emergência)" },
  { value: "amarelo", label: "🟡 Amarelo (Urgência)" },
  { value: "verde", label: "🟢 Verde (Pouco Urgente)" },
];

const SPECIALTIES = [
  "Clínica Médica", "Cardiologia", "Pneumologia", "Gastroenterologia", "Neurologia",
  "Nefrologia", "Infectologia", "Pediatria", "Cirurgia", "Ginecologia e Obstetrícia",
  "Ortopedia", "Psiquiatria", "Emergência", "Dermatologia", "Angiologia",
  "Oftalmologia", "Oncologia", "Otorrinolaringologia", "Terapia Intensiva", "Urologia",
];

import { FACULDADES } from "@/constants/faculdades";

const EVAL_LABELS: Record<string, string> = {
  anamnesis: "Anamnese", physical_exam: "Exame Físico",
  complementary_exams: "Exames Complementares", diagnosis: "Diagnóstico",
  prescription: "Prescrição", management: "Conduta", referral: "Parecer/Encaminhamento",
};

const EVAL_MAX_SCORES: Record<string, number> = {
  anamnesis: 15, physical_exam: 15, complementary_exams: 15,
  diagnosis: 15, prescription: 15, management: 15, referral: 10,
};

const ProfessorPlantao = ({ callAPI: externalCallAPI }: { callAPI?: (body: Record<string, unknown>) => Promise<any> }) => {
  const { session } = useAuth();
  const { toast } = useToast();

  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form
  const [createMode, setCreateMode] = useState<"ia" | "manual">("ia");
  const [specialty, setSpecialty] = useState("Clínica Médica");
  const [difficulty, setDifficulty] = useState("intermediário");
  const [title, setTitle] = useState("");
  const [timeLimit, setTimeLimit] = useState("20");
  const [faculdadeFilter, setFaculdadeFilter] = useState("");
  const [periodoFilter, setPeriodoFilter] = useState("");
  const [generatedCase, setGeneratedCase] = useState<any>(null);

  // Manual form
  const [manualPresentation, setManualPresentation] = useState("");
  const [manualVitals, setManualVitals] = useState({ PA: "", FC: "", FR: "", Temp: "", SpO2: "" });
  const [manualScenario, setManualScenario] = useState("Pronto-Socorro");
  const [manualTriageColor, setManualTriageColor] = useState("amarelo");
  const [manualDiagnosis, setManualDiagnosis] = useState("");
  const [manualFindings, setManualFindings] = useState<string[]>([""]);
  const [manualDifficultyScore, setManualDifficultyScore] = useState(3);

  // Students
  const [previewStudents, setPreviewStudents] = useState<any[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Results dialog
  const [resultsDialog, setResultsDialog] = useState<{ open: boolean; caseData: any; results: any[]; loading: boolean }>({ open: false, caseData: null, results: [], loading: false });
  const [selectedResult, setSelectedResult] = useState<any>(null);

  const API_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/professor-simulado`;

  const callAPI = useCallback(async (body: Record<string, unknown>) => {
    if (externalCallAPI) return externalCallAPI(body);
    const resp = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || "Erro");
    return data;
  }, [session, API_URL, externalCallAPI]);

  const loadCases = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const res = await callAPI({ action: "list_clinical_cases" });
      setCases(res.cases || []);
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Erro", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [session, callAPI, toast]);

  useEffect(() => { loadCases(); }, [loadCases]);

  const generateCase = async () => {
    setGenerating(true);
    try {
      const res = await callAPI({ action: "generate_clinical_case", specialty, difficulty });
      setGeneratedCase(res.case_data || res.case_prompt);
      if (res.case_data?.patient_presentation) {
         setManualPresentation(res.case_data.patient_presentation);
         setManualDiagnosis(res.case_data.hidden_diagnosis || "");
      }
      toast({ title: "Caso gerado!", description: `${specialty} - ${difficulty}` });
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Erro ao gerar", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const previewMatchingStudents = async () => {
    setPreviewLoading(true);
    try {
      const res = await callAPI({
        action: "get_students",
        faculdade: faculdadeFilter && faculdadeFilter !== "all" ? faculdadeFilter : undefined,
        periodo: periodoFilter && periodoFilter !== "all" ? parseInt(periodoFilter) : undefined,
      });
      const students = res.students || [];
      setPreviewStudents(students);
      setSelectedStudentIds(students.map((s: any) => s.user_id));
    } catch {
      setPreviewStudents([]);
    } finally {
      setPreviewLoading(false);
    }
  };

  const buildManualCase = () => {
    return {
      patient_presentation: manualPresentation,
      vitals: manualVitals,
      setting: manualScenario,
      triage_color: manualTriageColor,
      hidden_diagnosis: manualDiagnosis,
      key_findings: manualFindings.filter(f => f.trim()),
      difficulty_score: manualDifficultyScore,
    };
  };

  const canSubmitManual = manualPresentation.trim().length > 10 && manualDiagnosis.trim().length > 2;

  const createCase = async () => {
    const caseData = createMode === "manual" ? buildManualCase() : generatedCase;
    if (!caseData) return;
    setCreating(true);
    try {
      const res = await callAPI({
        action: "create_clinical_case",
        title: title || `Plantão - ${specialty}`,
        specialty,
        difficulty,
        time_limit_minutes: parseInt(timeLimit),
        case_prompt: caseData,
        faculdade_filter: faculdadeFilter && faculdadeFilter !== "all" ? faculdadeFilter : null,
        periodo_filter: periodoFilter && periodoFilter !== "all" ? parseInt(periodoFilter) : null,
        student_ids: selectedStudentIds.length > 0 ? selectedStudentIds : undefined,
      });
      toast({ title: "Caso criado!", description: `Atribuído a ${res.students_assigned} aluno(s).` });
      setShowCreate(false);
      resetForm();
      loadCases();
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Erro", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const viewResults = async (caseData: any) => {
    setResultsDialog({ open: true, caseData, results: [], loading: true });
    try {
      const res = await callAPI({ action: "get_clinical_case_results", case_id: caseData.id });
      setResultsDialog((prev) => ({ ...prev, results: res.results || [], loading: false }));
    } catch {
      setResultsDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  const resetForm = () => {
    setCreateMode("ia");
    setSpecialty("Clínica Médica");
    setDifficulty("intermediário");
    setTitle("");
    setTimeLimit("20");
    setFaculdadeFilter("");
    setPeriodoFilter("");
    setGeneratedCase(null);
    setPreviewStudents([]);
    setSelectedStudentIds([]);
    setManualPresentation("");
    setManualVitals({ PA: "", FC: "", FR: "", Temp: "", SpO2: "" });
    setManualScenario("Pronto-Socorro");
    setManualTriageColor("amarelo");
    setManualDiagnosis("");
    setManualFindings([""]);
    setManualDifficultyScore(3);
  };

  const totalAssigned = cases.reduce((s, c) => s + (c.results_summary?.total || 0), 0);
  const totalCompleted = cases.reduce((s, c) => s + (c.results_summary?.completed || 0), 0);

  return (
    <div className="space-y-4 w-full max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Crie casos de plantão médico interativos e atribua aos alunos.</p>
        <Button onClick={() => setShowCreate(true)} className="gap-2" size="sm">
          <Plus className="h-4 w-4" /> Novo Caso Plantão
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
            <Activity className="h-5 w-5 text-red-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Casos Criados</p>
            <p className="text-lg font-bold">{cases.length}</p>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <Users className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Atribuídos</p>
            <p className="text-lg font-bold">{totalAssigned}</p>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <CheckCircle className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Concluídos</p>
            <p className="text-lg font-bold">{totalCompleted}</p>
          </div>
        </CardContent></Card>
      </div>

      {/* Cases List */}
      {loading ? (
        <div className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></div>
      ) : cases.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Activity className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum caso criado</h3>
            <p className="text-sm text-muted-foreground mb-4">Crie seu primeiro caso de plantão médico interativo.</p>
            <Button onClick={() => setShowCreate(true)}>Criar Caso</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {cases.map((c) => (
            <Card key={c.id} className="hover:border-primary/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold truncate">{c.title}</h3>
                      <Badge variant="outline" className="text-[10px]">{c.specialty}</Badge>
                      <Badge variant="secondary" className="text-[10px] capitalize">{c.difficulty}</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{c.time_limit_minutes}min</span>
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{c.results_summary?.total || 0} alunos</span>
                      <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3" />{c.results_summary?.completed || 0} concluídos</span>
                      {c.results_summary?.completed > 0 && (
                        <span className="flex items-center gap-1"><Trophy className="h-3 w-3" />Média: {c.results_summary.avgScore}pts</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => viewResults(c)} className="gap-1.5">
                      <Eye className="h-3.5 w-3.5" /> Resultados
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Apagar caso clínico?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Isso removerá o caso "{c.title}" e todos os resultados dos alunos. Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={async () => {
                              try {
                                await callAPI({ action: "delete_clinical_case", case_id: c.id });
                                toast({ title: "Caso apagado" });
                                loadCases();
                              } catch (e) {
                                toast({ title: "Erro", description: e instanceof Error ? e.message : "Erro", variant: "destructive" });
                              }
                            }}
                          >
                            Apagar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                {c.results_summary?.total > 0 && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <Progress value={c.results_summary.total > 0 ? (c.results_summary.completed / c.results_summary.total) * 100 : 0} className="h-1.5" />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Case Dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => { if (!open) { setShowCreate(false); resetForm(); } else setShowCreate(true); }}>
        <TeacherDialogContent
          maxWidth="max-w-2xl"
          header={
            <>
              <DialogTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-destructive" /> Criar Caso de Plantão</DialogTitle>
              <DialogDescription>Crie um caso clínico via IA ou manualmente.</DialogDescription>
            </>
          }
          footer={
            <>
              <Button variant="outline" onClick={() => { setShowCreate(false); resetForm(); }}>Cancelar</Button>
              <Button
                onClick={createCase}
                disabled={(createMode === "ia" ? !generatedCase : !canSubmitManual) || creating}
                className="gap-2"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                {creating ? "Criando..." : "Criar e Atribuir"}
              </Button>
            </>
          }
        >
            {/* Common Config */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2 col-span-2">
                <Label>Título (opcional)</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`Plantão - ${specialty}`} />
              </div>
              <div className="space-y-2">
                <Label>Especialidade</Label>
                <Select value={specialty} onValueChange={setSpecialty}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SPECIALTIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Dificuldade</Label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="básico">Básico</SelectItem>
                    <SelectItem value="intermediário">Intermediário</SelectItem>
                    <SelectItem value="avançado">Avançado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tempo Limite (min)</Label>
                <Input type="number" value={timeLimit} onChange={(e) => setTimeLimit(e.target.value)} min="5" max="60" />
              </div>
            </div>

            {/* Mode Tabs */}
            <Tabs value={createMode} onValueChange={(v) => setCreateMode(v as "ia" | "manual")}>
              <TabsList className="w-full">
                <TabsTrigger value="ia" className="flex-1 gap-2"><Sparkles className="h-4 w-4" /> Gerar via IA</TabsTrigger>
                <TabsTrigger value="manual" className="flex-1 gap-2"><PenLine className="h-4 w-4" /> Criar Manual</TabsTrigger>
              </TabsList>

              {/* IA Tab */}
              <TabsContent value="ia" className="space-y-4 mt-4">
                <Button onClick={generateCase} disabled={generating} className="w-full gap-2">
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {generating ? "Gerando caso..." : "🤖 Gerar Caso via IA"}
                </Button>

                {generatedCase && (
                  <Card className="border-primary/30">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold flex items-center gap-1.5">
                          <Stethoscope className="h-4 w-4 text-primary" /> Preview do Caso
                        </h4>
                        <Badge variant="outline" className="text-xs">{generatedCase.triage_color}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{generatedCase.patient_presentation}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {generatedCase.vitals && Object.entries(generatedCase.vitals).map(([k, v]) => (
                          <Badge key={k} variant="outline" className="text-xs font-mono">{k}: {v as string}</Badge>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">📍 {generatedCase.setting}</p>
                      <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20">
                        <p className="text-xs font-semibold text-amber-600">🔒 Diagnóstico (oculto ao aluno): {generatedCase.hidden_diagnosis}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Manual Tab */}
              <TabsContent value="manual" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Apresentação do Paciente <span className="text-destructive">*</span></Label>
                  <Textarea
                    value={manualPresentation}
                    onChange={(e) => setManualPresentation(e.target.value)}
                    placeholder='Ex: "Doutor, estou com uma dor forte no peito há 2 horas, parece que está apertando..."'
                    className="min-h-[80px]"
                  />
                  <p className="text-[11px] text-muted-foreground">Queixa em 1ª pessoa do paciente.</p>
                </div>

                <div className="space-y-2">
                  <Label>Sinais Vitais</Label>
                  <div className="grid grid-cols-5 gap-2">
                    {(["PA", "FC", "FR", "Temp", "SpO2"] as const).map((key) => (
                      <div key={key} className="space-y-1">
                        <span className="text-[11px] font-medium text-muted-foreground">{key}</span>
                        <Input
                          value={manualVitals[key]}
                          onChange={(e) => setManualVitals(prev => ({ ...prev, [key]: e.target.value }))}
                          placeholder={key === "PA" ? "120/80" : key === "FC" ? "88" : key === "FR" ? "18" : key === "Temp" ? "37.2" : "97%"}
                          className="h-8 text-xs"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Cenário</Label>
                    <Select value={manualScenario} onValueChange={setManualScenario}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SCENARIOS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Cor de Triagem</Label>
                    <Select value={manualTriageColor} onValueChange={setManualTriageColor}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TRIAGE_COLORS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Diagnóstico Correto <span className="text-destructive">*</span></Label>
                  <Input
                    value={manualDiagnosis}
                    onChange={(e) => setManualDiagnosis(e.target.value)}
                    placeholder="Ex: Infarto Agudo do Miocárdio com supra de ST"
                  />
                  <p className="text-[11px] text-muted-foreground">Oculto ao aluno — usado para avaliação.</p>
                </div>

                <div className="space-y-2">
                  <Label>Achados-chave (até 5)</Label>
                  {manualFindings.map((f, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        value={f}
                        onChange={(e) => {
                          const updated = [...manualFindings];
                          updated[i] = e.target.value;
                          setManualFindings(updated);
                        }}
                        placeholder={`Achado ${i + 1}`}
                        className="h-8 text-sm"
                      />
                      {manualFindings.length > 1 && (
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0" onClick={() => setManualFindings(prev => prev.filter((_, j) => j !== i))}>
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {manualFindings.length < 5 && (
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => setManualFindings(prev => [...prev, ""])}>
                      + Adicionar achado
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Dificuldade do Caso: <span className="font-bold">{manualDifficultyScore}/5</span></Label>
                  <Slider
                    value={[manualDifficultyScore]}
                    onValueChange={(v) => setManualDifficultyScore(v[0])}
                    min={1}
                    max={5}
                    step={1}
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Fácil</span><span>Difícil</span>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {/* Student selection — show when case is ready */}
            {(generatedCase || (createMode === "manual" && canSubmitManual)) && (
              <div className="space-y-3">
                <Label className="font-semibold">Atribuir a Alunos</Label>
                <div className="grid grid-cols-2 gap-3">
                  <Select value={faculdadeFilter} onValueChange={setFaculdadeFilter}>
                    <SelectTrigger><SelectValue placeholder="Faculdade (todos)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {FACULDADES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={periodoFilter} onValueChange={setPeriodoFilter}>
                    <SelectTrigger><SelectValue placeholder="Período (todos)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((p) => <SelectItem key={p} value={String(p)}>{p}º período</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" onClick={previewMatchingStudents} disabled={previewLoading} className="gap-2 w-full" size="sm">
                  {previewLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Users className="h-3.5 w-3.5" />}
                  Buscar Alunos
                </Button>
                {previewStudents.length > 0 && (
                  <div className="border rounded-lg max-h-48 overflow-y-auto">
                    <div className="p-2 border-b bg-muted/30 flex items-center justify-between">
                      <span className="text-xs font-medium">{selectedStudentIds.length}/{previewStudents.length} selecionados</span>
                      <Button variant="ghost" size="sm" className="text-xs h-6" onClick={() => {
                        if (selectedStudentIds.length === previewStudents.length) setSelectedStudentIds([]);
                        else setSelectedStudentIds(previewStudents.map((s: any) => s.user_id));
                      }}>
                        {selectedStudentIds.length === previewStudents.length ? "Desmarcar" : "Selecionar"} todos
                      </Button>
                    </div>
                    {previewStudents.map((s: any) => (
                      <div
                        key={s.user_id}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-muted/30 cursor-pointer border-b border-border/30 last:border-0"
                        onClick={() => setSelectedStudentIds(prev =>
                          prev.includes(s.user_id) ? prev.filter(id => id !== s.user_id) : [...prev, s.user_id]
                        )}
                      >
                        {selectedStudentIds.includes(s.user_id)
                          ? <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                          : <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                        }
                        <span className="text-sm truncate">{s.display_name || s.email}</span>
                        {s.faculdade && <Badge variant="secondary" className="text-[10px] ml-auto">{s.faculdade}</Badge>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
        </TeacherDialogContent>
      </Dialog>


      {/* Results Dialog */}
      <Dialog open={resultsDialog.open} onOpenChange={(open) => { if (!open) { setResultsDialog({ open: false, caseData: null, results: [], loading: false }); setSelectedResult(null); } }}>
        <TeacherDialogContent
          maxWidth="max-w-2xl"
          header={
            <>
              <DialogTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Resultados — {resultsDialog.caseData?.title}
              </DialogTitle>
              <DialogDescription>
                {resultsDialog.caseData?.specialty} • {resultsDialog.caseData?.difficulty}
              </DialogDescription>
            </>
          }
        >

          {resultsDialog.loading ? (
            <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
          ) : selectedResult ? (
            // Detailed result view
            <div className="space-y-4">
              <Button variant="ghost" size="sm" onClick={() => setSelectedResult(null)} className="gap-1 text-xs">← Voltar à lista</Button>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{selectedResult.student_name}</h3>
                  <p className="text-xs text-muted-foreground">{selectedResult.student_email}</p>
                </div>
                <div className="text-right">
                  <p className={`text-2xl font-black ${selectedResult.grade === "A" ? "text-green-500" : selectedResult.grade === "B" ? "text-blue-500" : selectedResult.grade === "C" ? "text-amber-500" : "text-red-500"}`}>
                    {selectedResult.grade}
                  </p>
                  <p className="text-lg font-bold">{selectedResult.final_score}/100</p>
                </div>
              </div>

              <div className={`p-3 rounded-lg border ${selectedResult.student_got_diagnosis ? "bg-green-500/10 border-green-500/20" : "bg-red-500/10 border-red-500/20"}`}>
                <p className="text-xs font-semibold">Diagnóstico Correto: {selectedResult.correct_diagnosis || resultsDialog.caseData?.case_prompt?.hidden_diagnosis}</p>
                <p className="text-xs mt-1">{selectedResult.student_got_diagnosis ? "✅ Acertou" : "❌ Não acertou"}</p>
              </div>

              {selectedResult.final_evaluation && Object.keys(selectedResult.final_evaluation).length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold">📊 Avaliação por Categoria</p>
                  {Object.entries(selectedResult.final_evaluation).map(([key, val]: [string, any]) => {
                    const maxScore = EVAL_MAX_SCORES[key] || 15;
                    return (
                      <div key={key} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium">{EVAL_LABELS[key] || key}</span>
                          <span className={`font-bold ${val.score >= maxScore * 0.7 ? "text-green-500" : val.score >= maxScore * 0.5 ? "text-amber-500" : "text-red-500"}`}>
                            {val.score}/{maxScore}
                          </span>
                        </div>
                        <Progress value={(val.score / maxScore) * 100} className="h-1" />
                        <p className="text-[10px] text-muted-foreground">{val.feedback}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            // Results list
            <div className="space-y-2">
              {resultsDialog.results.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum resultado ainda.</p>
              ) : (
                resultsDialog.results.map((r: any) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => r.status === "completed" && setSelectedResult(r)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex flex-col items-center min-w-[40px]">
                        {r.status === "completed" ? (
                          <>
                            <span className={`text-lg font-black ${r.grade === "A" ? "text-green-500" : r.grade === "B" ? "text-blue-500" : r.grade === "C" ? "text-amber-500" : "text-red-500"}`}>
                              {r.grade}
                            </span>
                            <span className="text-[10px] text-muted-foreground">{r.final_score}pts</span>
                          </>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">{r.status === "in_progress" ? "Em andamento" : "Pendente"}</Badge>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{r.student_name}</p>
                        <p className="text-xs text-muted-foreground">{r.student_email}</p>
                      </div>
                    </div>
                    {r.status === "completed" && (
                      <div className="flex items-center gap-2 shrink-0">
                        {r.student_got_diagnosis ? (
                          <Badge className="bg-green-500/20 text-green-500 text-[10px]">✓ Dx</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px]">✗ Dx</Badge>
                        )}
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </TeacherDialogContent>
      </Dialog>
    </div>
  );
};

export default ProfessorPlantao;
