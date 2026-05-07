import { memo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  title: string;
  description: string;
  onTitleChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
}

/**
 * Form básico (título + descrição). Isolado para que digitação
 * não rerenderize o resto do dialog.
 */
const SimuladoBasicForm = memo(function SimuladoBasicForm({
  title,
  description,
  onTitleChange,
  onDescriptionChange,
}: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-2 col-span-2">
        <Label className="text-[10px] font-black uppercase tracking-widest opacity-50">Título do Simulado</Label>
        <Input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Ex: Simulado Mensal de Cardiologia"
          className="h-11 bg-white/5 border-white/10 rounded-xl px-4 font-bold uppercase tracking-tight"
        />
      </div>
      <div className="space-y-2 col-span-2">
        <Label className="text-[10px] font-black uppercase tracking-widest opacity-50">Descrição / Instruções (opcional)</Label>
        <Textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Instruções para os alunos, critérios de avaliação..."
          rows={2}
          className="bg-white/5 border-white/10 rounded-xl px-4 py-3 resize-none"
        />
      </div>
    </div>
  );
});

export default SimuladoBasicForm;
