import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Target, BookOpen, Brain, RefreshCw } from "lucide-react";
import type { CockpitWeakness } from "@/hooks/useCockpitData";

interface Props {
  weaknesses: CockpitWeakness[];
}

export default function CockpitWeaknesses({ weaknesses }: Props) {
  const navigate = useNavigate();

  if (!weaknesses?.length) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-2">
          <Target className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">🎯 Temas que mais precisam de atenção</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Nenhuma fraqueza detectada ainda. Faça questões para o sistema mapear seus pontos críticos.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Target className="h-5 w-5 text-destructive" />
        <h2 className="text-lg font-semibold">🎯 Temas que mais precisam de atenção</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {weaknesses.map((w, i) => {
          const severity = w.erros >= 5 ? "destructive" : w.erros >= 3 ? "warning" : "secondary";
          return (
            <div
              key={`${w.tema}-${i}`}
              className="rounded-lg border border-border bg-card/40 p-4 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-sm truncate">{w.tema}</h3>
                  {w.subtema && <p className="text-xs text-muted-foreground truncate">{w.subtema}</p>}
                </div>
                <Badge
                  variant={severity === "destructive" ? "destructive" : "secondary"}
                  className={severity === "warning" ? "bg-warning/20 text-warning border-warning/30" : ""}
                >
                  {w.erros} erro{w.erros > 1 ? "s" : ""}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                <Button
                  size="sm"
                  variant="default"
                  className="h-7 text-xs gap-1"
                  title="Aprendizado guiado com ciclo completo (ensinar, testar, corrigir, reforçar)"
                  onClick={() =>
                    navigate(
                      `/dashboard/sessao-estudo?topic=${encodeURIComponent(w.tema)}&focus=errors&origin=cockpit&auto=1`,
                    )
                  }
                >
                  <BookOpen className="h-3 w-3" /> Estudar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  title="Treinar 10 questões deste tema"
                  onClick={() => {
                    const params = new URLSearchParams({
                      sc_source: "weak-topics",
                      sc_taskType: "practice",
                      sc_objective: "practice",
                      sc_topic: w.tema,
                      sc_specialty: w.tema,
                      sc_difficulty: "misto",
                      sc_count: "10",
                    });
                    if (w.subtema) params.set("sc_subtopic", w.subtema);
                    navigate(`/dashboard/simulados?${params.toString()}`);
                  }}
                >
                  <RefreshCw className="h-3 w-3" /> Treinar 10Q
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs gap-1"
                  title="Tirar dúvida rápida com o Tutor IA"
                  onClick={() => {
                    const params = new URLSearchParams({
                      tutor_mode: "mission",
                      sc_topic: w.tema,
                      sc_objective: "correction",
                      tutor_origin: "cockpit-weakness",
                    });
                    if (w.subtema) params.set("sc_subtopic", w.subtema);
                    navigate(`/dashboard/mentor?${params.toString()}`);
                  }}
                >
                  <Brain className="h-3 w-3" /> Perguntar ao Tutor
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
