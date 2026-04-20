/**
 * ReviewCard (Guided)
 * ───────────────────
 * Mostra contagem de revisões FSRS vencidas. Só renderiza se totalDue > 0.
 *
 * Reusa useFsrsDueCount (sem nova query).
 */
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, ArrowRight } from "lucide-react";
import { useFsrsDueCount } from "@/hooks/useFsrsDueCount";

export default function ReviewCard() {
  const { totalDue, isLoading } = useFsrsDueCount();
  const navigate = useNavigate();

  if (isLoading || totalDue <= 0) return null;

  return (
    <Card className="overflow-hidden border-blue-500/30 bg-blue-500/5">
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="rounded-lg bg-blue-500/15 p-2 text-blue-600 dark:text-blue-400 shrink-0">
            <RefreshCw className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">Revisões pendentes</p>
              <Badge variant="secondary" className="text-[10px]">
                {totalDue}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Cards prontos para revisar agora (FSRS).
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="default"
          onClick={() => navigate("/dashboard/revisoes?source=guided_review")}
          className="shrink-0"
        >
          Revisar
          <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </CardContent>
    </Card>
  );
}
