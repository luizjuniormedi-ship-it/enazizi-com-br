import { useState, useEffect } from "react";
import { Plus, Loader2, Save, FileText, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { TeacherDialogContent } from "@/components/teacher/TeacherDialogContent";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  editingSimulado?: any; // Simulado para editar
}

export function CreateSimuladoDialog({ open, onOpenChange, onCreated, editingSimulado }: Props) {
  const { session } = useAuth();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // Efeito para preencher o formulário ao editar ou resetar ao criar novo
  useEffect(() => {
    if (open) {
      if (editingSimulado) {
        setTitle(editingSimulado.title || "");
        setDescription(editingSimulado.description || "");
      } else {
        setTitle("");
        setDescription("");
      }
    }
  }, [open, editingSimulado]);

  // Limpar ao fechar (garantia extra)
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setTitle("");
      setDescription("");
      setCreating(false);
    }
    onOpenChange(isOpen);
  };

  async function saveDraft() {
    if (creating) return; // Proteção contra duplo clique

    try {
      if (!session?.user?.id) {
        toast({ title: "Erro", description: "Usuário não autenticado.", variant: "destructive" });
        return;
      }

      const trimmedTitle = title.trim();
      if (!trimmedTitle) {
        toast({ title: "Título obrigatório", description: "Informe o título do simulado.", variant: "destructive" });
        return;
      }

      setCreating(true);

      if (editingSimulado?.id) {
        // Atualizar rascunho existente
        const { error } = await supabase
          .from("teacher_simulados")
          .update({
            title: trimmedTitle,
            description: description || null,
          })
          .eq("id", editingSimulado.id);

        if (error) throw error;
        toast({ title: "Sucesso", description: "Simulado atualizado com sucesso." });
      } else {
        // Criar novo rascunho
        const { error } = await supabase
          .from("teacher_simulados")
          .insert([
            {
              title: trimmedTitle,
              description: description || null,
              professor_id: session.user.id,
              status: "draft",
              total_questions: 10,
              time_limit_minutes: 60,
            },
          ]);

        if (error) throw error;
        toast({ title: "Sucesso", description: "Rascunho criado com sucesso." });
      }

      onCreated();
      handleOpenChange(false);
    } catch (err: any) {
      console.error("[CreateSimulado] erro:", err);
      toast({ title: "Erro ao salvar simulado", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <TeacherDialogContent
        className="z-[120]"
        maxWidth="sm:max-w-[425px]"
        header={
          <>
            <DialogTitle className="flex items-center gap-2">
              {editingSimulado ? <Pencil className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />}
              {editingSimulado ? "Editar Simulado" : "Novo Simulado"}
            </DialogTitle>
            <DialogDescription className="text-white/60">
              {editingSimulado 
                ? "Atualize as informações básicas do seu simulado." 
                : "Crie um rascunho simples para seu simulado. Você poderá adicionar questões depois."}
            </DialogDescription>
          </>
        }
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={creating}
              className="border-white/10 hover:bg-white/5 text-white/70"
            >
              Cancelar
            </Button>
            <Button
              onClick={saveDraft}
              disabled={creating || !title.trim()}
              className="gap-2 bg-primary hover:bg-primary/90 shadow-glow-sm"
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {editingSimulado ? "SALVAR ALTERAÇÕES" : "SALVAR RASCUNHO"}
            </Button>
          </>
        }
      >
        <div className="grid gap-6">
          <div className="grid gap-2">
            <Label htmlFor="title">Título do Simulado</Label>
            <Input
              id="title"
              placeholder="Ex: Simulado de Cardiologia"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={creating}
              className="bg-white/5 border-white/10 focus:border-primary/50 transition-colors"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Descrição (Opcional)</Label>
            <Textarea
              id="description"
              placeholder="Breve descrição sobre o conteúdo ou objetivos..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={creating}
              className="bg-white/5 border-white/10 min-h-[120px] focus:border-primary/50 transition-colors"
            />
          </div>
        </div>
      </TeacherDialogContent>
    </Dialog>
  );
}

export default CreateSimuladoDialog;