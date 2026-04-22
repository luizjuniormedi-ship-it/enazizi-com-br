import { useState } from "react";
import { Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCurriculumTree } from "@/hooks/useProfessorPlans";

interface Props {
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
}

/**
 * Picker hierárquico do currículo (modo "Árvore").
 * Componente extraído do CreatePlanDialog original — comportamento preservado.
 */
const SubtopicTreePicker = ({ selectedIds, onToggle }: Props) => {
  const { data: tree, isLoading } = useCurriculumTree();
  const [expandedSpec, setExpandedSpec] = useState<Set<string>>(new Set());
  const [expandedTopic, setExpandedTopic] = useState<Set<string>>(new Set());

  const toggleSpec = (id: string) => {
    const n = new Set(expandedSpec);
    n.has(id) ? n.delete(id) : n.add(id);
    setExpandedSpec(n);
  };
  const toggleTopic = (id: string) => {
    const n = new Set(expandedTopic);
    n.has(id) ? n.delete(id) : n.add(id);
    setExpandedTopic(n);
  };

  return (
    <ScrollArea className="h-72 rounded-lg border border-border p-2">
      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-1">
          {tree?.map((spec: any) => {
            const specOpen = expandedSpec.has(spec.id);
            return (
              <div key={spec.id}>
                <button
                  type="button"
                  onClick={() => toggleSpec(spec.id)}
                  className="w-full flex items-center gap-2 text-sm font-medium py-1.5 px-2 rounded hover:bg-accent"
                >
                  {specOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <span>{spec.nome}</span>
                </button>
                {specOpen &&
                  spec.curriculum_topics?.map((t: any) => {
                    const topicOpen = expandedTopic.has(t.id);
                    return (
                      <div key={t.id} className="ml-5">
                        <button
                          type="button"
                          onClick={() => toggleTopic(t.id)}
                          className="w-full flex items-center gap-2 text-sm py-1 px-2 rounded hover:bg-accent text-muted-foreground"
                        >
                          {topicOpen ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                          <span>{t.nome}</span>
                        </button>
                        {topicOpen &&
                          t.curriculum_subtopics
                            ?.filter((s: any) => s.ativo)
                            .map((s: any) => (
                              <label
                                key={s.id}
                                className="flex items-center gap-2 ml-5 py-1 px-2 rounded hover:bg-accent cursor-pointer"
                              >
                                <Checkbox
                                  checked={selectedIds.has(s.id)}
                                  onCheckedChange={() => onToggle(s.id)}
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
  );
};

export default SubtopicTreePicker;
