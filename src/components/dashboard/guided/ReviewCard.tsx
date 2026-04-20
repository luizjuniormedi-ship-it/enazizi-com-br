/**
 * ReviewCard (Guided) — Nível 2
 * ─────────────────────────────
 * Sempre renderiza, com 3 estados:
 *   - 0 due           → "Tudo em dia"
 *   - 1..9 due        → "Poucas pendentes"
 *   - 10+ due         → "Urgente"
 *
 * Reusa useFsrsDueCount (sem nova query).
 */
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, ArrowRight, CheckCircle2 } from "lucide-react";
import { useFsrsDueCount } from "@/hooks/useFsrsDueCount";

export default function ReviewCard() {
  const { totalDue, isLoading } = useFsrsDueCount();
  const navigate = useNavigate();

  // Ajuste 3: esconder quando não há revisões pendentes (remove ruído verde decorativo)
  if (!isLoading && totalDue === 0) return null;

  const isUrgent = totalDue >= 10;
  const isEmpty = totalDue === 0;

  const tone = isEmpty
    ? "border-emerald-500/30 bg-emerald-500/5"
    : isUrgent
    ? "border-destructive/30 bg-destructive/5"
    : "border-blue-500/30 bg-blue-500/5";

  const iconTone = isEmpty
    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
    : isUrgent
    ? "bg-destructive/15 text-destructive"
    : "bg-blue-500/15 text-blue-600 dark:text-blue-400";

  const title = isEmpty
    ? "Revisões em dia"
    : isUrgent
    ? "Revisões urgentes"
    : "Revisões pendentes";

  const description = isLoading
    ? "Verificando…"
    : isEmpty
    ? "Nada para revisar agora — bom trabalho."
    : isUrgent
    ? "Acúmulo alto. Recomendado revisar hoje."
    : "Cards prontos para revisar agora (FSRS).";

  return (
    <Card className={`overflow-hidden ${tone}`}>
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`rounded-lg p-2 shrink-0 ${iconTone}`}>
            {isEmpty ? <CheckCircle2 className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">{title}</p>
              {!isEmpty && (
                <Badge variant="secondary" className="text-[10px]">
                  {totalDue}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        {!isEmpty && (
          <Button
            size="sm"
            variant={isUrgent ? "destructive" : "outline"}
            onClick={() => navigate("/dashboard/revisoes?source=guided_review")}
            className="shrink-0"
          >
            Revisar
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
