import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ChevronRight, ChevronDown, AlertCircle } from "lucide-react";
import { useCurriculumTree, useProfessorPlanDetail } from "@/hooks/useProfessorPlans";
import { useAddPlanSubtopics } from "@/hooks/useProficiencyReplan";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: string | null;
}

/**
 * Dialog para o PROFESSOR adicionar subtemas a um plano ATIVO durante a jornada.
 * Ao confirmar, dispara replanning incremental (`teacher_update`) para todos
 * os alunos-alvo do plano — preservando histórico e tarefas já concluídas.
 */
const AddSubtopicsDialog = ({ open, onOpenChange, planId }: Props) => {
  const { data: tree, isLoading: loadingTree } = useCurriculumTree();
  const { data: detail } = useProfessorPlanDetail(planId);
  const addMutation = useAddPlanSubtopics();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openSpecs, setOpenSpecs] = useState<Set<string>>(new Set());
  const [openTopics, setOpenTopics] = useState<Set<string>>(new Set());

  const alreadyInPlan = new Set<string>(
    (detail?.subtopics ?? []).map((s: any) => s.subtopic_id),
  );

  const toggle = (set: Set<string>, fn: (s: Set<string>) => void, id: string) => {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    fn(next);
  };

  const submit = async () => {
    if (!planId || selected.size === 0) return;
    await addMutation.mutateAsync({ planId, subtopicIds: Array.from(selected) });
    setSelected(new Set());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl teacher-modal-content">
        <DialogHeader className="p-6 sm:p-8 pb-0 sm:pb-0">
          <DialogTitle>Adicionar subtemas ao plano ativo</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-6">

        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-muted-foreground">
            Histórico e tarefas já concluídas serão preservados. O cronograma
            futuro será automaticamente recalculado para incluir os novos
            subtemas até a data da prova.
          </p>
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-muted-foreground">Currículo</span>
          <Badge variant="outline">
            {selected.size} selecionado{selected.size === 1 ? "" : "s"}
          </Badge>
        </div>

        <ScrollArea className="h-72 rounded-lg border border-border p-2">
          {loadingTree ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-1">
              {tree?.map((spec: any) => {
                const sOpen = openSpecs.has(spec.id);
                return (
                  <div key={spec.id}>
                    <button
                      type="button"
                      onClick={() => toggle(openSpecs, setOpenSpecs, spec.id)}
                      className="w-full flex items-center gap-2 text-sm font-medium py-1.5 px-2 rounded hover:bg-accent"
                    >
                      {sOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      {spec.nome}
                    </button>
                    {sOpen &&
                      spec.curriculum_topics?.map((t: any) => {
                        const tOpen = openTopics.has(t.id);
                        return (
                          <div key={t.id} className="ml-5">
                            <button
                              type="button"
                              onClick={() => toggle(openTopics, setOpenTopics, t.id)}
                              className="w-full flex items-center gap-2 text-sm py-1 px-2 rounded hover:bg-accent text-muted-foreground"
                            >
                              {tOpen ? (
                                <ChevronDown className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5" />
                              )}
                              {t.nome}
                            </button>
                            {tOpen &&
                              t.curriculum_subtopics
                                ?.filter((s: any) => s.ativo)
                                .map((s: any) => {
                                  const inPlan = alreadyInPlan.has(s.id);
                                  return (
                                    <label
                                      key={s.id}
                                      className={`flex items-center gap-2 ml-5 py-1 px-2 rounded text-sm ${
                                        inPlan ? "opacity-50" : "hover:bg-accent cursor-pointer"
                                      }`}
                                    >
                                      <Checkbox
                                        disabled={inPlan}
                                        checked={selected.has(s.id)}
                                        onCheckedChange={() =>
                                          toggle(selected, setSelected, s.id)
                                        }
                                      />
                                      <span className="flex-1">{s.nome}</span>
                                      {inPlan && (
                                        <Badge variant="outline" className="h-4 text-[10px]">
                                          já no plano
                                        </Badge>
                                      )}
                                    </label>
                                  );
                                })}
                          </div>
                        );
                      })}
                  </div>
                );
              })}
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={selected.size === 0 || addMutation.isPending}
            onClick={submit}
          >
            {addMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Adicionar e replanejar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddSubtopicsDialog;
