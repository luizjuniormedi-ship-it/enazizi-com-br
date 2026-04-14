import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, ArrowRight } from "lucide-react";
import type { StudyNextRecommendation } from "@/hooks/useStudyNext";

const TYPE_LABELS: Record<string, string> = {
  review: "Revisão",
  error_review: "Correção",
  daily_task: "Missão",
  free_study: "Livre",
  image_quiz: "Quiz Visual",
  mnemonic: "Mnemônico",
};

interface Props {
  alternatives: StudyNextRecommendation[];
  onSelect: (alt: StudyNextRecommendation) => void;
  activeType: string;
}

export default function MissionAlternatives({ alternatives, onSelect, activeType }: Props) {
  const safeAlts = Array.isArray(alternatives) ? alternatives.slice(0, 3) : [];
  if (safeAlts.length === 0) return null;

  return (
    <Card className="border-border/50">
      <CardContent className="p-4 sm:p-5 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Alternativas inteligentes</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {safeAlts.map((alt, i) => (
            <div
              key={alt.targetId ?? i}
              className="rounded-lg border border-border/50 bg-secondary/30 p-3 space-y-2 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">
                  {TYPE_LABELS[alt.type] ?? alt.type}
                </Badge>
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {alt.estimatedMinutes} min
                </span>
              </div>
              <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug">{alt.title}</p>
              <Button variant="ghost" size="sm" className="w-full text-xs gap-1" onClick={() => onSelect(alt)}>
                Escolher esta <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
