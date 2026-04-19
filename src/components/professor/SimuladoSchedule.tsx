import { memo } from "react";
import { CalendarClock, Timer } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface Props {
  scheduledAt: string;
  autoAssign: boolean;
  onScheduledAtChange: (v: string) => void;
  onAutoAssignChange: (v: boolean) => void;
}

/**
 * Bloco de agendamento + auto-atribuição.
 * Isolado para que mudar data/hora não rerenderize alunos, temas ou questões.
 */
const SimuladoSchedule = memo(function SimuladoSchedule({
  scheduledAt, autoAssign, onScheduledAtChange, onAutoAssignChange,
}: Props) {
  return (
    <div className="space-y-3 border border-border rounded-lg p-3 bg-muted/20">
      <div className="flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-primary" />
        <Label className="text-sm font-semibold">Agendamento</Label>
      </div>
      <div className="space-y-2">
        <Label className="text-xs">
          Data e hora de publicação (deixe vazio para publicar agora)
        </Label>
        <Input
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => onScheduledAtChange(e.target.value)}
          className="h-9"
        />
        {scheduledAt && (
          <p className="text-[11px] text-amber-600 flex items-center gap-1">
            <Timer className="h-3 w-3" />O simulado ficará disponível em{" "}
            {new Date(scheduledAt).toLocaleDateString("pt-BR")} às{" "}
            {new Date(scheduledAt).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}
      </div>
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className="text-xs font-medium">Auto-atribuir novos alunos</Label>
          <p className="text-[10px] text-muted-foreground">
            Alunos que se cadastrarem depois serão incluídos automaticamente
          </p>
        </div>
        <Switch checked={autoAssign} onCheckedChange={onAutoAssignChange} />
      </div>
    </div>
  );
});

export default SimuladoSchedule;
