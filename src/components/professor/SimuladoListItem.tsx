import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FileText, Clock, Users, CheckCircle, Eye, Trash2, Timer, Pencil, ListTodo } from "lucide-react";

interface Props {
  sim: any;
  onView: (sim: any) => void;
  onEdit: (sim: any) => void;
  onQuestions: (sim: any) => void;
  onDelete: (id: string, title: string) => void;
  onStatusUpdate?: (id: string, status: string) => void;
}

/**
 * Card de um único simulado.
 * Memoizado por referência de `sim` + handlers estáveis no pai.
 * Evita rerender da lista inteira ao expandir/fechar dialogs.
 */
const SimuladoListItem = memo(function SimuladoListItem({ sim, onView, onEdit, onQuestions, onDelete, onStatusUpdate }: Props) {
  const scheduledLabel = (() => {
    if (!sim.scheduled_at || sim.status !== "scheduled") return null;
    const target = new Date(sim.scheduled_at);
    const now = new Date();
    const diff = target.getTime() - now.getTime();
    if (diff <= 0) {
      return <p className="text-[10px] text-emerald-600 font-medium">Publicação iminente...</p>;
    }
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const days = Math.floor(hours / 24);
    return (
      <p className="text-[10px] text-amber-600 flex items-center gap-1">
        <Timer className="h-3 w-3" />
        {days > 0
          ? `${days}d ${hours % 24}h`
          : hours > 0
          ? `${hours}h ${mins}min`
          : `${mins}min`}{" "}
        para publicação — {target.toLocaleDateString("pt-BR")} às{" "}
        {target.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
      </p>
    );
  })();

  return (
    <Card className="hover:border-primary/40 transition-all duration-300 bg-white/5 backdrop-blur-md border-white/10 shadow-glow-sm group rounded-2xl overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-base font-black uppercase tracking-tight text-white group-hover:text-primary transition-colors">{sim.title}</h3>
              <Badge
                variant={
                  sim.status === "published"
                    ? "default"
                    : sim.status === "scheduled"
                    ? "outline"
                    : "secondary"
                }
                className={`text-[10px] ${
                  sim.status === "scheduled" ? "border-amber-400 text-amber-600" : ""
                }`}
              >
                {sim.status === "published"
                  ? "Publicado"
                  : sim.status === "scheduled"
                  ? "⏰ Agendado"
                  : "Rascunho"}
              </Badge>
              {sim.auto_assign && (
                <Badge variant="outline" className="text-[9px] border-blue-300 text-blue-600">
                  Auto-atribuir
                </Badge>
              )}
            </div>
            {scheduledLabel}
            {sim.description && (
              <p className="text-sm text-muted-foreground line-clamp-1 mb-2">{sim.description}</p>
            )}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {Array.isArray(sim?.topics) && sim.topics.slice(0, 3).map((t: string) => (
                <Badge key={t} variant="outline" className="text-[9px] font-black uppercase border-white/20 bg-white/5 py-1 px-2">
                  {t}
                </Badge>
              ))}
              {Array.isArray(sim?.topics) && sim.topics.length > 3 && (
                <Badge variant="outline" className="text-[9px] font-black uppercase border-white/20 bg-white/5 py-1 px-2">
                  +{sim.topics.length - 3}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {sim.total_questions} questões
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {sim.time_limit_minutes}min
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {sim.results_summary?.total || 0} alunos
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                {sim.results_summary?.completed || 0} concluídos
              </span>
              {(sim.faculdade_filter || (Array.isArray(sim.faculdade_filters) && sim.faculdade_filters.length > 0)) && (
                <Badge variant="secondary" className="text-[10px]">
                  {Array.isArray(sim.faculdade_filters) && sim.faculdade_filters.length > 0
                    ? sim.faculdade_filters.join(", ")
                    : sim.faculdade_filter}
                </Badge>
              )}
              {(sim.periodo_filter || (Array.isArray(sim.periodo_filters) && sim.periodo_filters.length > 0)) && (
                <Badge variant="secondary" className="text-[10px]">
                  {Array.isArray(sim.periodo_filters) && sim.periodo_filters.length > 0
                    ? sim.periodo_filters.sort((a, b) => (a || 0) - (b || 0)).join("º, ") + "º"
                    : sim.periodo_filter + "º"}{" "}
                  período
                </Badge>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            <div className="flex gap-1.5">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => onView(sim)} 
                className="h-9 px-4 rounded-xl border-white/10 bg-white/5 font-black uppercase tracking-widest text-[10px] gap-1.5"
              >
                <Eye className="h-3.5 w-3.5" /> RESULTADOS
              </Button>

              {(sim.status === "draft" || sim.status === "scheduled") && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => onEdit(sim)} 
                  className="h-9 px-4 rounded-xl border-white/10 bg-white/5 font-black uppercase tracking-widest text-[10px] gap-1.5 text-primary"
                >
                  <Pencil className="h-3.5 w-3.5" /> EDITAR
                </Button>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(sim.id, sim.title)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            {sim.status === "draft" && (
              <div className="flex gap-1.5 mt-1.5">
                <Button 
                  variant="default" 
                  size="sm" 
                  className="h-8 flex-1 text-[9px] font-black uppercase tracking-widest bg-blue-600 hover:bg-blue-700 gap-1.5"
                  onClick={() => onQuestions(sim)}
                >
                  <ListTodo className="h-3 w-3" /> QUESTÕES
                </Button>
                <Button 
                  variant="default" 
                  size="sm" 
                  className="h-8 flex-1 text-[9px] font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => onStatusUpdate?.(sim.id, "published")}
                >
                  PUBLICAR
                </Button>
              </div>
            )}
          </div>
        </div>
        {Number.isFinite(sim?.results_summary?.completed) && sim.results_summary.completed > 0 && (
          <div className="mt-3 pt-3 border-t border-border">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">Progresso</span>
              <span className="font-medium">
                {sim.results_summary.completed}/{sim.results_summary.total || 0} • Média:{" "}
                {Number.isFinite(sim.results_summary.avgScore) ? sim.results_summary.avgScore : 0}%
              </span>
            </div>
            <Progress
              value={sim.results_summary.total > 0 ? (sim.results_summary.completed / sim.results_summary.total) * 100 : 0}
              className="h-1.5"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
});

export default SimuladoListItem;
