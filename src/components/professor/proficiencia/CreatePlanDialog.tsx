import { useState } from "react";
import {
  Dialog,
  DialogTitle,
} from "@/components/ui/dialog";
import { TeacherDialogContent } from "@/components/teacher/TeacherDialogContent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Target } from "lucide-react";
import {
  useCreateProfessorPlan,
  type PlanIntensity,
} from "@/hooks/useProfessorPlans";
import StudentInstitutionPicker from "./StudentInstitutionPicker";
import SubtopicTreePicker from "./SubtopicTreePicker";
import SubtopicFreeTextResolver from "./SubtopicFreeTextResolver";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CreatePlanDialog = ({ open, onOpenChange }: Props) => {
  const [name, setName] = useState("");
  const [examDate, setExamDate] = useState("");
  const [intensity, setIntensity] = useState<PlanIntensity>("moderado");
  const [notes, setNotes] = useState("");
  const [selectedStudents, setSelectedStudents] = useState<
    { id: string; name: string }[]
  >([]);
  const [selectedSubtopics, setSelectedSubtopics] = useState<Set<string>>(
    new Set()
  );

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
    setSelectedStudents([]);
    setSelectedSubtopics(new Set());
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

  const toggleSub = (id: string) => {
    const next = new Set(selectedSubtopics);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedSubtopics(next);
  };

  const addSubs = (ids: string[]) => {
    const next = new Set(selectedSubtopics);
    ids.forEach((id) => next.add(id));
    setSelectedSubtopics(next);
  };

  const subCount = selectedSubtopics.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <TeacherDialogContent
        className="z-[120]"
        maxWidth="sm:max-w-3xl"
        header={
          <>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Criar Plano de Proficiência Guiada
            </DialogTitle>
          </>
        }
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
            >
              Cancelar
            </Button>
            <Button
              disabled={!canSubmit || createMutation.isPending}
              onClick={handleSubmit}
            >
              {createMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Criar plano
            </Button>
          </>
        }
      >
        <div className="space-y-5">
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
              <Select
                value={intensity}
                onValueChange={(v) => setIntensity(v as PlanIntensity)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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
            <StudentInstitutionPicker
              selected={selectedStudents}
              onChange={setSelectedStudents}
            />
          </div>

          {/* Subtemas */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>
                Subtemas estruturais *{" "}
                <span className="text-xs text-muted-foreground">
                  (vincula a `subtopic_id` real do currículo)
                </span>
              </Label>
              <Badge variant="outline">
                {subCount} selecionado{subCount === 1 ? "" : "s"}
              </Badge>
            </div>
            <Tabs defaultValue="tree">
              <TabsList>
                <TabsTrigger value="tree">Árvore do currículo</TabsTrigger>
                <TabsTrigger value="free">Digitar / Upload</TabsTrigger>
              </TabsList>
              <TabsContent value="tree" className="mt-3">
                <SubtopicTreePicker
                  selectedIds={selectedSubtopics}
                  onToggle={toggleSub}
                />
              </TabsContent>
              <TabsContent value="free" className="mt-3">
                <SubtopicFreeTextResolver
                  selectedIds={selectedSubtopics}
                  onAddIds={addSubs}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </TeacherDialogContent>
    </Dialog>
  );
};

export default CreatePlanDialog;
