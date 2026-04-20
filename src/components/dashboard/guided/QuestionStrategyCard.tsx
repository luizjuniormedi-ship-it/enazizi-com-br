import { PieChart, BookOpen, AlertCircle, RotateCcw, Trophy } from "lucide-react";
import { useQuestionDistribution } from "@/hooks/useQuestionDistribution";

/**
 * QuestionStrategyCard — mostra a distribuição estratégica recomendada
 * de questões (coverage / error / revision / incidence) calculada pelo
 * questionDistributionEngine. Reflete fase + ajustes adaptativos.
 */
const QuestionStrategyCard = () => {
  const { data, isLoading } = useQuestionDistribution();

  if (isLoading || !data) return null;

  const { distribution, dailyQuantities, reason, phase } = data;

  const items = [
    {
      key: "coverage" as const,
      label: "Cobertura",
      icon: BookOpen,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      bar: "bg-blue-500",
    },
    {
      key: "error" as const,
      label: "Erros",
      icon: AlertCircle,
      color: "text-destructive",
      bg: "bg-destructive/10",
      bar: "bg-destructive",
    },
    {
      key: "revision" as const,
      label: "Revisão",
      icon: RotateCcw,
      color: "text-primary",
      bg: "bg-primary/10",
      bar: "bg-primary",
    },
    {
      key: "incidence" as const,
      label: "Prova",
      icon: Trophy,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      bar: "bg-amber-500",
    },
  ];

  const phaseBadge =
    phase === "final_stretch" ? "Reta final" :
    phase === "mid_term" ? "Médio prazo" :
    "Longo prazo";

  return (
    <div className="glass-card p-5 border-primary/10">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <PieChart className="h-4 w-4 text-primary flex-shrink-0" />
          <h3 className="font-semibold text-sm truncate">Estratégia de questões</h3>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary flex-shrink-0">
          {phaseBadge}
        </span>
      </div>

      {/* Barra empilhada */}
      <div className="h-2 w-full rounded-full overflow-hidden flex mb-3 bg-muted">
        {items.map((it) => (
          <div
            key={it.key}
            className={it.bar}
            style={{ width: `${distribution[it.key]}%` }}
            title={`${it.label}: ${distribution[it.key]}%`}
          />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        {items.map(({ key, label, icon: Icon, color, bg }) => (
          <div key={key} className={`rounded-md px-2 py-1.5 ${bg}`}>
            <div className="flex items-center gap-1.5">
              <Icon className={`h-3 w-3 ${color}`} />
              <span className="text-xs font-medium text-foreground">{label}</span>
              <span className={`ml-auto text-xs font-bold ${color}`}>
                {distribution[key]}%
              </span>
            </div>
            {dailyQuantities && dailyQuantities[key] > 0 && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                ~{dailyQuantities[key]} questões/dia
              </p>
            )}
          </div>
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground leading-tight">
        🧭 {reason}
      </p>
    </div>
  );
};

export default QuestionStrategyCard;
