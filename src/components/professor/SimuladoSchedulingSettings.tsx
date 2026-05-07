import { memo } from "react";
import { Clock, Calendar, ShieldAlert, RotateCcw, Info } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  scheduledAt: string;
  onScheduledAtChange: (v: string) => void;
  endAt: string;
  onEndAtChange: (v: string) => void;
  timeLimit: string;
  onTimeLimitChange: (v: string) => void;
  maxAttempts: string;
  onMaxAttemptsChange: (v: string) => void;
  feedbackPolicy: "immediate" | "after_deadline" | "manual";
  onFeedbackPolicyChange: (v: "immediate" | "after_deadline" | "manual") => void;
  allowRetake: boolean;
  onAllowRetakeChange: (v: boolean) => void;
}

const SimuladoSchedulingSettings = memo(function SimuladoSchedulingSettings({
  scheduledAt, onScheduledAtChange,
  endAt, onEndAtChange,
  timeLimit, onTimeLimitChange,
  maxAttempts, onMaxAttemptsChange,
  feedbackPolicy, onFeedbackPolicyChange,
  allowRetake, onAllowRetakeChange,
}: Props) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Agendamento */}
        <div className="space-y-4 p-4 rounded-2xl border border-white/5 bg-white/5">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="h-4 w-4 text-primary" />
            <Label className="text-[10px] font-black uppercase tracking-widest opacity-80">Prazos e Tempo</Label>
          </div>
          
          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Data de Início</Label>
                <span className="text-[10px] text-muted-foreground italic">(opcional)</span>
              </div>
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => onScheduledAtChange(e.target.value)}
                className="h-9 text-xs bg-background/50"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Data Limite (Deadline)</Label>
                <span className="text-[10px] text-muted-foreground italic">(opcional)</span>
              </div>
              <Input
                type="datetime-local"
                value={endAt}
                onChange={(e) => onEndAtChange(e.target.value)}
                className="h-9 text-xs bg-background/50"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Tempo de Prova (minutos)</Label>
              <div className="relative">
                <Input
                  type="number"
                  min="5"
                  max="300"
                  value={timeLimit}
                  onChange={(e) => onTimeLimitChange(e.target.value)}
                  className="h-9 pl-8 text-xs bg-background/50"
                />
                <Clock className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </div>
        </div>

        {/* Políticas */}
        <div className="space-y-4 p-4 rounded-2xl border border-white/5 bg-white/5">
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert className="h-4 w-4 text-primary" />
            <Label className="text-[10px] font-black uppercase tracking-widest opacity-80">Políticas e Acesso</Label>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label className="text-xs">Liberação do Gabarito</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-[10px]">
                      <p><strong>Imediata:</strong> Logo após o envio.</p>
                      <p><strong>Após Prazo:</strong> Somente após a data limite.</p>
                      <p><strong>Manual:</strong> Quando você liberar manualmente.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Select value={feedbackPolicy} onValueChange={(v: any) => onFeedbackPolicyChange(v)}>
                <SelectTrigger className="h-9 text-xs bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="immediate" className="text-xs">Imediata (pós-envio)</SelectItem>
                  <SelectItem value="after_deadline" className="text-xs">Após data limite</SelectItem>
                  <SelectItem value="manual" className="text-xs">Manual (posteriormente)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Máximo de Tentativas</Label>
              <Input
                type="number"
                min="1"
                max="10"
                value={maxAttempts}
                onChange={(e) => onMaxAttemptsChange(e.target.value)}
                className="h-9 text-xs bg-background/50"
              />
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/5 mt-2">
              <div className="flex items-center gap-2">
                <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
                <Label className="text-xs font-medium">Permitir Refazer?</Label>
              </div>
              <Switch 
                checked={allowRetake} 
                onCheckedChange={onAllowRetakeChange}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default SimuladoSchedulingSettings;