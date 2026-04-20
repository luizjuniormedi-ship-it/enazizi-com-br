import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useRadarTrajetoria } from "@/hooks/useRadarTrajetoria";
import { useRunTrajectoryEngine } from "@/hooks/useRunTrajectoryEngine";
import { useApplyTrajectoryRecommendation } from "@/hooks/useApplyTrajectoryRecommendation";
import { useTrajectoryExplanation } from "@/hooks/useTrajectoryExplanation";
import RadarHero from "@/components/radar/RadarHero";
import RadarSnapshotCard from "@/components/radar/RadarSnapshotCard";
import RadarScenarioComparator from "@/components/radar/RadarScenarioComparator";
import RadarRecommendations from "@/components/radar/RadarRecommendations";
import RadarRiskList from "@/components/radar/RadarRiskList";
import RadarOpportunityList from "@/components/radar/RadarOpportunityList";
import RadarSnapshotHistory from "@/components/radar/RadarSnapshotHistory";
import RadarLastAppliedCard from "@/components/radar/RadarLastAppliedCard";
import RadarTelemetryCard from "@/components/radar/RadarTelemetryCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Brain, Sparkles } from "lucide-react";
import type { TrajectoryRecommendation } from "@/types/trajectory";

export default function RadarTrajetoriaPage() {
  const { isEnabled, loading: flagsLoading } = useFeatureFlags();
  const enabled = isEnabled("radar_trajetoria_enabled");

  const radar = useRadarTrajetoria();
  const runMut = useRunTrajectoryEngine();
  const applyMut = useApplyTrajectoryRecommendation();
  const explainMut = useTrajectoryExplanation();

  const [explainOpen, setExplainOpen] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const bundle = radar.data;
  const snapshot = bundle?.snapshot ?? null;

  const hasAnyData = useMemo(
    () =>
      !!snapshot ||
      (bundle?.scenarios?.length ?? 0) > 0 ||
      (bundle?.recommendations?.length ?? 0) > 0,
    [bundle, snapshot]
  );

  if (flagsLoading) {
    return (
      <div className="container mx-auto max-w-5xl space-y-4 p-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!enabled) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleApply = async (rec: TrajectoryRecommendation) => {
    setApplyingId(rec.id);
    try {
      await applyMut.mutateAsync({
        snapshotId: snapshot?.id,
        recommendationId: rec.id,
      });
    } finally {
      setApplyingId(null);
    }
  };

  const handleExplain = async () => {
    if (!snapshot) return;
    setExplainOpen(true);
    if (!explainMut.data || explainMut.variables?.snapshotId !== snapshot.id) {
      await explainMut.mutateAsync({ snapshotId: snapshot.id, focus: "general" });
    }
  };

  return (
    <div className="container mx-auto max-w-5xl space-y-4 p-4">
      <RadarHero
        onRefresh={() => runMut.mutate("manual")}
        onExplain={handleExplain}
        isRefreshing={runMut.isPending}
        isExplaining={explainMut.isPending}
        hasSnapshot={!!snapshot}
      />

      {radar.isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      )}

      {radar.isError && !radar.isLoading && (
        <Card>
          <CardContent className="flex items-start gap-3 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
            <div>
              <div className="font-medium">Não foi possível carregar o Radar</div>
              <p className="text-sm text-muted-foreground">
                {(radar.error as Error)?.message ?? "Tente novamente em instantes."}
              </p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => radar.refetch()}>
                Tentar novamente
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!radar.isLoading && !radar.isError && !hasAnyData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              Nenhuma análise gerada ainda
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Clique em <strong>Atualizar análise</strong> para gerar sua primeira projeção
              de trajetória com base nos dados reais de estudo.
            </p>
            <Button onClick={() => runMut.mutate("first_run")} disabled={runMut.isPending}>
              {runMut.isPending ? "Gerando…" : "Gerar primeira análise"}
            </Button>
          </CardContent>
        </Card>
      )}

      {!radar.isLoading && snapshot && (
        <>
          <RadarSnapshotCard snapshot={snapshot} />
          <RadarScenarioComparator scenarios={bundle?.scenarios ?? []} />
          <div className="grid gap-4 md:grid-cols-2">
            <RadarRiskList risks={bundle?.risks ?? []} />
            <RadarOpportunityList opportunities={bundle?.opportunities ?? []} />
          </div>
          <RadarRecommendations
            recommendations={bundle?.recommendations ?? []}
            appliedActions={bundle?.appliedActions ?? []}
            onApply={handleApply}
            applyingId={applyingId}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <RadarLastAppliedCard />
            <RadarTelemetryCard />
          </div>
          <RadarSnapshotHistory />
        </>
      )}

      <Dialog open={explainOpen} onOpenChange={setExplainOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" />
              Explicação da IA
            </DialogTitle>
            <DialogDescription>
              Análise narrativa da sua trajetória atual.
            </DialogDescription>
          </DialogHeader>

          {explainMut.isPending && (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/6" />
            </div>
          )}

          {!explainMut.isPending && explainMut.data && (
            <div className="space-y-3">
              <Badge variant="outline" className="text-xs">
                Confiança: {explainMut.data.confidence}
              </Badge>
              <p className="text-sm leading-relaxed">{explainMut.data.narrative}</p>
              {explainMut.data.bullets?.length > 0 && (
                <ul className="list-disc space-y-1 pl-4 text-sm">
                  {explainMut.data.bullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {!explainMut.isPending && explainMut.isError && (
            <div className="text-sm text-destructive">
              {(explainMut.error as Error)?.message ?? "Erro ao gerar explicação."}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
