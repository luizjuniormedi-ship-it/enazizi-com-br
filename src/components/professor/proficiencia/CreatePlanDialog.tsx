import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Search, X, ChevronRight, ChevronDown } from "lucide-react";
import {
  useCreateProfessorPlan,
  useCurriculumTree,
  useStudentsSearch,
  type PlanIntensity,
} from "@/hooks/useProfessorPlans";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CreatePlanDialog = ({ open, onOpenChange }: Props) => {
  const [name, setName] = useState("");
  const [examDate, setExamDate] = useState("");
  const [intensity, setIntensity] = useState<PlanIntensity>("moderado");
  const [notes, setNotes] = useState("");
  const [studentQuery, setStudentQuery] = useState("");
  const [selectedStudents, setSelectedStudents] = useState<{ id: string; name: string }[]>([]);
  const [selectedSubtopics, setSelectedSubtopics] = useState<Set<string>>(new Set());
  const [expandedSpecialties, setExpandedSpecialties] = useState<Set<string>>(new Set());
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());

  const { data: tree, isLoading: loadingTree } = useCurriculumTree();
  const { data: studentResults } = useStudentsSearch(studentQuery);
  const createMutation = useCreateProfessorPlan();

  const canSubmit =
    name.trim().length > 1 &&
    selectedStudents.length > 0 &&
    selectedSubtopics.size > 0;

  const reset = () => {
    setName("");
    setExamDate("");
    setIntensity("moderado");
    setNotes("");
    setStudentQuery("");
    setSelectedStudents([]);
    setSelectedSubtopics(new Set());
    setExpandedSpecialties(new Set());
    setExpandedTopics(new Set());
  };

  const handleSubmit = async () => {
    await createMutation.mutateAsync({
      name: name.trim(),
      exam_date: examDate || null,
      intensity,
      notes: notes.trim() || undefined,
      target_user_ids: selectedStudents.map((s) => s.id),
      target_class_ids: [],
      subtopic_ids: Array.from(selectedSubtopics),
    });
    reset();
    onOpenChange(false);
  };

  const addStudent = (id: string, displayName: string) => {
    if (selectedStudents.find((s) => s.id === id)) return;
    setSelectedStudents([...selectedStudents, { id, name: displayName }]);
    setStudentQuery("");
  };

  const removeStudent = (id: string) => {
    setSelectedStudents(selectedStudents.filter((s) => s.id !== id));
  };

  const toggleSpec = (id: string) => {
    const next = new Set(expandedSpecialties);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpandedSpecialties(next);
  };
  const toggleTopic = (id: string) => {
    const next = new Set(expandedTopics);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpandedTopics(next);
  };
  const toggleSub = (id: string) => {
    const next = new Set(selectedSubtopics);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedSubtopics(next);
  };

  const subCount = selectedSubtopics.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Criar Plano de Proficiência Guiada</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-5 pr-2">
          {/* Identificação */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="plan-name">Nome do plano *</Label>
              <Input
                id="plan-name"
                placeholder="Ex: Reta Final ENARE 2026"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exam-date">Data da prova</Label>
              <Input
                id="exam-date"
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Intensidade</Label>
              <Select value={intensity} onValueChange={(v) => setIntensity(v as PlanIntensity)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="leve">Leve</SelectItem>
                  <SelectItem value="moderado">Moderado</SelectItem>
                  <SelectItem value="intenso">Intenso</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="notes">Observações (opcional)</Label>
              <Textarea
                id="notes"
                rows={2}
                placeholder="Estratégia pedagógica, foco, recomendações..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Alunos */}
          <div className="space-y-2">
            <Label>Alunos *</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar aluno por nome ou email"
                value={studentQuery}
                onChange={(e) => setStudentQuery(e.target.value)}
              />
              {studentResults && studentResults.length > 0 && studentQuery && (
                <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
                  {studentResults.map((s: any) => (
                    <button
                      key={s.user_id}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex flex-col"
                      onClick={() => addStudent(s.user_id, s.display_name || s.email)}
                    >
                      <span className="font-medium">{s.display_name || "Sem nome"}</span>
                      <span className="text-xs text-muted-foreground">{s.email}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedStudents.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {selectedStudents.map((s) => (
                  <Badge key={s.id} variant="secondary" className="gap-1">
                    {s.name}
                    <button onClick={() => removeStudent(s.id)} className="ml-1 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Subtemas */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Subtemas estruturais * <span className="text-xs text-muted-foreground">(usa subtopic_id)</span></Label>
              <Badge variant="outline">{subCount} selecionado{subCount === 1 ? "" : "s"}</Badge>
            </div>
            <ScrollArea className="h-72 rounded-lg border border-border p-2">
              {loadingTree ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-1">
                  {tree?.map((spec: any) => {
                    const specOpen = expandedSpecialties.has(spec.id);
                    return (
                      <div key={spec.id}>
                        <button
                          type="button"
                          onClick={() => toggleSpec(spec.id)}
                          className="w-full flex items-center gap-2 text-sm font-medium py-1.5 px-2 rounded hover:bg-accent"
                        >
                          {specOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          <span>{spec.nome}</span>
                        </button>
                        {specOpen && spec.curriculum_topics?.map((t: any) => {
                          const topicOpen = expandedTopics.has(t.id);
                          return (
                            <div key={t.id} className="ml-5">
                              <button
                                type="button"
                                onClick={() => toggleTopic(t.id)}
                                className="w-full flex items-center gap-2 text-sm py-1 px-2 rounded hover:bg-accent text-muted-foreground"
                              >
                                {topicOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                <span>{t.nome}</span>
                              </button>
                              {topicOpen && t.curriculum_subtopics?.filter((s: any) => s.ativo).map((s: any) => (
                                <label key={s.id} className="flex items-center gap-2 ml-5 py-1 px-2 rounded hover:bg-accent cursor-pointer">
                                  <Checkbox
                                    checked={selectedSubtopics.has(s.id)}
                                    onCheckedChange={() => toggleSub(s.id)}
                                  />
                                  <span className="text-sm">{s.nome}</span>
                                </label>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="ghost" onClick={() => { reset(); onOpenChange(false); }}>
            Cancelar
          </Button>
          <Button disabled={!canSubmit || createMutation.isPending} onClick={handleSubmit}>
            {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Criar plano
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreatePlanDialog;
