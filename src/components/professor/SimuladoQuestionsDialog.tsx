import { memo, useState, useEffect, useCallback } from "react";
import { ListTodo, ArrowLeft, Loader2, Save, Trash2, Plus, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import SimuladoManualForm from "./SimuladoManualForm";
import SimuladoQuestionsPreview from "./SimuladoQuestionsPreview";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  simuladoId: string;
  simuladoTitle: string;
}

export function SimuladoQuestionsDialog({ open, onOpenChange, simuladoId, simuladoTitle }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [questions, setQuestions] = useState<any[]>([]);
  
  // Estado para nova questão manual
  const [manualStatement, setManualStatement] = useState("");
  const [manualOptions, setManualOptions] = useState(["", "", "", "", ""]);
  const [manualCorrect, setManualCorrect] = useState("0");
  const [manualTopic, setManualTopic] = useState("");
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);

  const loadQuestions = useCallback(async () => {
    if (!simuladoId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("teacher_simulado_questions")
        .select("*")
        .eq("simulado_id", simuladoId)
        .order("order_index", { ascending: true });

      if (error) throw error;
      setQuestions(data || []);
    } catch (err: any) {
      console.error("[SimuladoQuestions] erro ao carregar:", err);
      toast({ title: "Erro ao carregar questões", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [simuladoId, toast]);

  useEffect(() => {
    if (open && simuladoId) {
      loadQuestions();
    }
  }, [open, simuladoId, loadQuestions]);

  const addManualQuestion = async () => {
    if (saving) return;
    try {
      setSaving(true);
      const { error } = await supabase
        .from("teacher_simulado_questions")
        .insert([{
          simulado_id: simuladoId,
          statement: manualStatement,
          options: manualOptions.filter(o => o.trim()),
          correct_index: parseInt(manualCorrect),
          topic: manualTopic || "Geral",
          order_index: questions.length
        }]);

      if (error) throw error;
      
      toast({ title: "Questão adicionada" });
      setManualStatement("");
      setManualOptions(["", "", "", "", ""]);
      setManualTopic("");
      loadQuestions();
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const removeQuestion = async (idx: number) => {
    const q = questions[idx];
    if (!q?.id) return;
    
    try {
      const { error } = await supabase
        .from("teacher_simulado_questions")
        .delete()
        .eq("id", q.id);

      if (error) throw error;
      toast({ title: "Questão removida" });
      loadQuestions();
    } catch (err: any) {
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] bg-[#0a0a0e] border-white/10 text-white overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-6 pb-2 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => onOpenChange(false)}
                className="h-8 w-8 rounded-full hover:bg-white/5"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <DialogTitle className="text-lg font-black uppercase tracking-tight">
                  Questões do Simulado
                </DialogTitle>
                <p className="text-xs text-primary font-bold uppercase tracking-widest mt-0.5">
                  {simuladoTitle}
                </p>
              </div>
            </div>
            <div className="bg-primary/20 border border-primary/30 px-3 py-1 rounded-full flex items-center gap-2">
              <ListChecks className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                {questions.length} Questões
              </span>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          {/* Adicionar Nova Questão */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Plus className="h-4 w-4 text-primary" />
              <h4 className="text-xs font-black uppercase tracking-widest opacity-70">Nova Questão Manual</h4>
            </div>
            <SimuladoManualForm
              manualStatement={manualStatement}
              manualOptions={manualOptions}
              manualCorrect={manualCorrect}
              manualTopic={manualTopic}
              onStatementChange={setManualStatement}
              onOptionChange={(i, v) => {
                const newOpts = [...manualOptions];
                newOpts[i] = v;
                setManualOptions(newOpts);
              }}
              onCorrectChange={setManualCorrect}
              onTopicChange={setManualTopic}
              onAddManualQuestion={addManualQuestion}
            />
          </section>

          {/* Lista de Questões */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <ListTodo className="h-4 w-4 text-primary" />
              <h4 className="text-xs font-black uppercase tracking-widest opacity-70">Questões do Simulado</h4>
            </div>
            
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 opacity-50">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Carregando banco de questões...</span>
              </div>
            ) : questions.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-white/10 rounded-2xl bg-white/5">
                <p className="text-xs text-white/40 uppercase font-bold tracking-widest">
                  Nenhuma questão adicionada ainda.
                </p>
              </div>
            ) : (
              <SimuladoQuestionsPreview
                allQs={questions}
                groupedBlocks={[["Geral", questions]]}
                target={questions.length}
                deficit={0}
                questionMode="manual"
                expandedQuestion={expandedQuestion}
                generating={false}
                onSetExpanded={setExpandedQuestion}
                onRegenerateMissing={() => {}}
                onRemoveGenerated={() => {}}
                onRemoveManual={removeQuestion}
              />
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
