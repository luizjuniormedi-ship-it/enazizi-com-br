import { useState } from "react";
import { Plus, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function CreateSimuladoDialog({ open, onOpenChange, onCreated }: Props) {
  const { session } = useAuth();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  async function saveDraft() {
    try {
      if (!session?.user?.id) {
        toast({ title: "Erro", description: "Usuário não autenticado.", variant: "destructive" });
        return;
      }

      setCreating(true);

      if (!title.trim()) {
        toast({ title: "Título obrigatório", description: "Informe o título do simulado.", variant: "destructive" });
        return;
      }

      const { data, error } = await supabase
        .from("teacher_simulados")
        .insert({
          title: title.trim(),
          description: description || null,
          professor_id: session.user.id,
          status: "draft",
          total_questions: 10,
          time_limit_minutes: 60,
          difficulty: "intermediario",
        })
        .select()
        .single();

      if (error) throw error;

      toast({ title: "Sucesso", description: "Rascunho criado com sucesso." });
      setTitle("");
      setDescription("");
      onCreated();
      onOpenChange(false);
    } catch (err: any) {
      console.error("[CreateSimulado] erro:", err);
      toast({ title: "Erro ao criar rascunho", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-[#0a0a0e] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" /> Novo Simulado
          </DialogTitle>
          <DialogDescription className="text-white/60">
            Crie um rascunho simples para seu simulado. Você poderá adicionar questões e alunos depois.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Título do Simulado</Label>
            <Input
              id="title"
              placeholder="Ex: Simulado de Cardiologia"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-white/5 border-white/10"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Descrição (Opcional)</Label>
            <Textarea
              id="description"
              placeholder="Breve descrição sobre o conteúdo ou objetivos..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-white/5 border-white/10 min-h-[100px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-white/10 hover:bg-white/5"
          >
            Cancelar
          </Button>
          <Button
            onClick={saveDraft}
            disabled={creating || !title.trim()}
            className="gap-2"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            SALVAR RASCUNHO
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CreateSimuladoDialog;
