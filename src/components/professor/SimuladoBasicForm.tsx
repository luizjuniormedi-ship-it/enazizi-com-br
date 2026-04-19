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
        <Label>Título</Label>
        <Input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Nome do simulado"
        />
      </div>
      <div className="space-y-2 col-span-2">
        <Label>Descrição (opcional)</Label>
        <Textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Instruções para os alunos..."
          rows={2}
        />
      </div>
    </div>
  );
});

export default SimuladoBasicForm;
