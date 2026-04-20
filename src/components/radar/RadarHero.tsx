import { Button } from "@/components/ui/button";
import { Sparkles, RefreshCw, Brain } from "lucide-react";

interface RadarHeroProps {
  onRefresh: () => void;
  onExplain: () => void;
  isRefreshing: boolean;
  isExplaining: boolean;
  hasSnapshot: boolean;
}

export default function RadarHero({
  onRefresh,
  onExplain,
  isRefreshing,
  isExplaining,
  hasSnapshot,
}: RadarHeroProps) {
  return (
    <div className="rounded-xl border border-border bg-gradient-to-br from-primary/10 via-background to-background p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/15 p-2 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Radar de Trajetória IA</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Projeta cenários comparativos de evolução em 14, 28 e 56 dias com base nos seus
            dados reais de estudo. Não promete aprovação — entrega decisões acionáveis.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={onRefresh} disabled={isRefreshing} size="sm">
          <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          {isRefreshing ? "Atualizando…" : "Atualizar análise"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onExplain}
          disabled={isExplaining || !hasSnapshot}
        >
          <Brain className="mr-2 h-4 w-4" />
          {isExplaining ? "Gerando…" : "Explicação da IA"}
        </Button>
      </div>
    </div>
  );
}
