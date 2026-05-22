import { useState, useEffect, useCallback } from "react";
import { BookOpen, Plus, Users, Loader2, CheckCircle, AlertTriangle, Upload, Eye, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { TeacherDialogContent } from "@/components/teacher/TeacherDialogContent";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { FACULDADES } from "@/constants/faculdades";
import { CheckSquare, Square } from "lucide-react";
import StudentInstitutionPicker from "./proficiencia/StudentInstitutionPicker";

import { ALL_SPECIALTIES as SPECIALTIES } from "@/constants/specialties";
import CycleFilter, { getFilteredSpecialties } from "@/components/CycleFilter";

const TeacherStudyAssignments = ({ callAPI: externalCallAPI }: { callAPI?: (body: Record<string, unknown>) => Promise<any> }) => {
  const { session } = useAuth();
  const { toast } = useToast();

  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form
  const [title, setTitle] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [cycleFilter, setCycleFilter] = useState<string | null>(null);
  const [topicsToCover, setTopicsToCover] = useState("");
  const [materialFile, setMaterialFile] = useState<File | null>(null);

  // Students selection
  const [selectedStudents, setSelectedStudents] = useState<{ id: string; name: string }[]>([]);

  // Results dialog
  const [resultsDialog, setResultsDialog] = useState<{ open: boolean; assignment: any; results: any[] }>({ open: false, assignment: null, results: [] });

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
    if (!resp.ok) throw new Error(data.error || "Erro na operação");
    return data;
  }, [session, API_URL, externalCallAPI]);

  const loadAssignments = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const res = await callAPI({ action: "list_study_assignments" });
      setAssignments(res.assignments || []);
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Erro", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [session, callAPI, toast]);

  useEffect(() => { loadAssignments(); }, [loadAssignments]);

  // Selection logic is now handled by StudentInstitutionPicker


  const createAssignment = async () => {
    if (!title.trim() || !specialty || !topicsToCover.trim()) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      // Upload material if present
      let materialUrl: string | null = null;
      let materialFilename: string | null = null;
      if (materialFile && session) {
        const ext = materialFile.name.split(".").pop();
        const fileName = `${Date.now()}-${materialFile.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const path = `professor-materials/${session.user.id}/${fileName}`;
        const { error: upErr } = await supabase.storage.from("user-uploads").upload(path, materialFile, {
          cacheControl: '3600',
          upsert: false
        });
        if (upErr) throw new Error("Erro ao enviar material: " + upErr.message);
        materialUrl = path;
        materialFilename = materialFile.name;
      }

      const res = await callAPI({
        action: "create_study_assignment",
        title: title.trim(),
        specialty,
        topics_to_cover: topicsToCover.trim(),
        material_url: materialUrl,
        material_filename: materialFilename,
        student_ids: selectedStudents.map(s => s.id),
      });

      toast({ title: "Tema atribuído!", description: `Enviado para ${res.students_assigned} aluno(s).` });
      setShowCreate(false);
      resetForm();
      loadAssignments();
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Erro", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const viewResults = async (assignment: any) => {
    try {
      const res = await callAPI({ action: "get_study_assignment_results", assignment_id: assignment.id });
      setResultsDialog({ open: true, assignment, results: res.results || [] });
    } catch {
      setResultsDialog({ open: true, assignment, results: [] });
    }
  };

  const resetForm = () => {
    setTitle("");
    setSpecialty("");
    setTopicsToCover("");
    setMaterialFile(null);
    setSelectedStudents([]);
  };

  return (
    <div className="space-y-4 w-full max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          Temas de Estudo
        </h2>
        <Button onClick={() => setShowCreate(true)} size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> Novo Tema
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></div>
      ) : assignments.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum tema atribuído</h3>
            <p className="text-sm text-muted-foreground mb-4">Crie temas de estudo e envie para seus alunos estudarem no Tutor IA.</p>
            <Button onClick={() => setShowCreate(true)}>Criar Tema</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {assignments.map((a: any) => (
            <Card key={a.id} className="hover:border-primary/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold truncate">{a.title}</h3>
                      <Badge variant="outline" className="text-[10px]">{a.specialty}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{a.topics_to_cover}</p>
                    {a.material_filename && (
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <Upload className="h-3 w-3" /> {a.material_filename}
                      </Badge>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{a.results_summary?.total || 0} alunos</span>
                      <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3" />{a.results_summary?.completed || 0} concluídos</span>
                      <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" />{a.results_summary?.studying || 0} estudando</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => viewResults(a)} className="gap-1.5">
                      <Eye className="h-3.5 w-3.5" /> Status
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Apagar tema de estudo?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Isso removerá o tema "{a.title}" e todos os resultados dos alunos. Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={async () => {
                              try {
                                await callAPI({ action: "delete_study_assignment", assignment_id: a.id });
                                toast({ title: "Tema apagado" });
                                loadAssignments();
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
                {(a.results_summary?.total || 0) > 0 && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Progresso</span>
                      <span className="font-medium">{a.results_summary?.completed || 0}/{a.results_summary?.total || 0}</span>
                    </div>
                    <Progress value={((a.results_summary?.completed || 0) / (a.results_summary?.total || 1)) * 100} className="h-1.5" />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => { if (!open) { setShowCreate(false); resetForm(); } else setShowCreate(true); }}>
        <TeacherDialogContent
          maxWidth="max-w-lg"
          header={
            <>
              <DialogTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-primary" /> Atribuir Tema de Estudo</DialogTitle>
              <DialogDescription>O aluno receberá este tema na Proficiência e poderá estudar diretamente no Tutor IA.</DialogDescription>
            </>
          }
          footer={
            <>
              <Button variant="outline" onClick={() => { setShowCreate(false); resetForm(); }}>Cancelar</Button>
              <Button onClick={createAssignment} disabled={creating || !title.trim() || !specialty || !topicsToCover.trim()} className="gap-2">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
                {creating ? "Atribuindo..." : "Atribuir Tema"}
              </Button>
            </>
          }
        >
            <div className="space-y-2">
              <Label>Título do Tema *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Insuficiência Cardíaca Descompensada" />
            </div>

            <div className="space-y-2">
              <Label>Especialidade *</Label>
              <CycleFilter activeCycle={cycleFilter} onCycleChange={setCycleFilter} className="mb-2" />
              <Select value={specialty} onValueChange={setSpecialty}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {getFilteredSpecialties(cycleFilter).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tópicos que o Tutor IA deve abordar *</Label>
              <Textarea
                value={topicsToCover}
                onChange={(e) => setTopicsToCover(e.target.value)}
                placeholder="Ex: Fisiopatologia da IC com fração de ejeção reduzida, critérios de Framingham, classificação NYHA, manejo com IECA/BRA, betabloqueadores e diuréticos, contraindicações..."
                rows={4}
              />
              <p className="text-[10px] text-muted-foreground">Estas instruções serão enviadas diretamente ao Tutor IA para guiar a sessão de estudo do aluno.</p>
            </div>

            <div className="space-y-2">
              <Label>Material de apoio (opcional)</Label>
              <Input
                type="file"
                accept=".pdf,.txt,.docx,.pptx"
                onChange={(e) => setMaterialFile(e.target.files?.[0] || null)}
                className="text-xs"
              />
              {materialFile && <p className="text-xs text-muted-foreground">📎 {materialFile.name}</p>}
            </div>

            {/* Distribution */}
            <div className="space-y-2 pt-4 border-t border-border">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4" /> Distribuição *
              </Label>
              <StudentInstitutionPicker
                selected={selectedStudents}
                onChange={setSelectedStudents}
              />
            </div>
                      {selectedStudentIds.length === previewStudents.length ? "Desmarcar todos" : "Selecionar todos"}
                    </button>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {previewStudents.map((s: any) => {
                      const isSelected = selectedStudentIds.includes(s.user_id);
                      return (
                        <button
                          key={s.user_id}
                          onClick={() => toggleStudentSelection(s.user_id)}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs transition-colors ${
                            isSelected ? "bg-primary/10 border border-primary/30" : "bg-background/50 border border-border hover:border-primary/20"
                          }`}
                        >
                          {isSelected ? <CheckSquare className="h-3.5 w-3.5 text-primary shrink-0" /> : <Square className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                          <span className="truncate font-medium">{s.display_name || s.email}</span>
                          {s.periodo && <span className="text-muted-foreground ml-auto shrink-0">{s.periodo}º</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
        </TeacherDialogContent>
      </Dialog>

      {/* Results Dialog */}
      <Dialog open={resultsDialog.open} onOpenChange={(open) => !open && setResultsDialog({ open: false, assignment: null, results: [] })}>
        <TeacherDialogContent
          maxWidth="max-w-lg"
          header={
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Status: {resultsDialog.assignment?.title}
            </DialogTitle>
          }
        >
          {resultsDialog.results.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum aluno atribuído.</p>
          ) : (
            <div className="space-y-2">
              {resultsDialog.results.map((r: any) => (
                <Card key={r.id}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{r.student_name}</p>
                      <p className="text-xs text-muted-foreground">{r.student_email}</p>
                    </div>
                    <Badge variant={
                      r.status === "completed" ? "default" :
                      r.status === "studying" ? "secondary" : "outline"
                    } className="text-xs">
                      {r.status === "completed" ? "✅ Concluído" :
                       r.status === "studying" ? "📖 Estudando" : "⏳ Pendente"}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TeacherDialogContent>
      </Dialog>
    </div>
  );
};

export default TeacherStudyAssignments;
