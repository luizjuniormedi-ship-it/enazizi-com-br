/**
 * CoverageCard
 * ────────────
 * Card de garantia de cobertura curricular dentro do GuidedFlowLayer.
 *
 * Mostra:
 *  - % de cobertura dos temas obrigatórios
 *  - próximo tema crítico não estudado (1 CTA)
 *  - especialidade com pior cobertura
 *
 * Sem novas queries pesadas — usa useCoverageStatus (5 min de cache).
 */
import { useNavigate } from "react-router-dom";
import { ShieldCheck, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useCoverageStatus } from "@/hooks/useCoverageStatus";

export default function CoverageCard() {
  const navigate = useNavigate();
  const { data, isLoading } = useCoverageStatus();

  if (isLoading) {
    return (
      <div className="glass-card p-4 space-y-2 animate-pulse">
        <div className="h-4 w-32 bg-muted rounded" />
        <div className="h-2 w-full bg-muted rounded" />
        <div className="h-3 w-3/4 bg-muted rounded" />
      </div>
    );
  }

  if (!data || data.totalTopics === 0) {
    return (
      <div className="glass-card p-4 space-y-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Cobertura curricular</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Sem mapa curricular disponível agora.
        </p>
      </div>
    );
  }

  const pct = data.requiredCoveragePct;
  const next = data.nextRequiredTopic;
  const worst = data.bySpecialty[0];

  // Estado visual: verde ≥80, âmbar ≥50, vermelho <50
  const tone =
    pct >= 80 ? "text-primary" : pct >= 50 ? "text-accent-foreground" : "text-destructive";

  const handleStudyNext = () => {
    if (!next) return;
    const params = new URLSearchParams({
      topic: next.subtema || next.tema,
      specialty: next.especialidade,
      source: "coverage_gap",
    });
    navigate(`/dashboard/mentor?${params.toString()}`);
  };

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className={`h-4 w-4 ${tone}`} />
          <h3 className="text-sm font-semibold">Cobertura curricular</h3>
        </div>
        <span className={`text-sm font-bold ${tone}`}>{pct}%</span>
      </div>

      <Progress value={pct} className="h-2" />

      <p className="text-xs text-muted-foreground">
        {data.requiredSeen} de {data.requiredTopics} temas obrigatórios estudados
      </p>

      {next ? (
        <div className="rounded-md border border-border/50 bg-muted/40 p-2 space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-destructive mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-medium truncate">
                Próximo crítico: {next.subtema || next.tema}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {next.especialidade}
                {worst && worst.especialidade !== next.especialidade
                  ? ` · pior área: ${worst.especialidade} (${worst.requiredCoveragePct}%)`
                  : ""}
              </p>
            </div>
          </div>
          <Button size="sm" className="w-full text-xs" onClick={handleStudyNext}>
            Estudar isso agora
          </Button>
        </div>
      ) : (
        <p className="text-xs text-primary">
          ✓ Todos os temas obrigatórios já foram cobertos.
        </p>
      )}
    </div>
  );
}
