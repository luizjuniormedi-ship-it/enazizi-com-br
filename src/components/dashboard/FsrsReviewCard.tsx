import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Layers, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

/**
 * Card simples no Dashboard que mostra quantos flashcards estão prontos para revisão
 * e oferece um CTA de 1-clique para iniciar a sessão de revisão.
 *
 * Usa apenas dados existentes (tabela `flashcards` por enquanto, fallback se não houver dados FSRS).
 * NÃO altera backend nem cria nova lógica de planejamento.
 */
export default function FsrsReviewCard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dueCount, setDueCount] = useState<number | null>(null);
  const [totalCards, setTotalCards] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        // 1) FSRS due (cards com `due <= now`)
        const nowIso = new Date().toISOString();
        const { count: due } = await supabase
          .from("legacy_fsrs_bridge")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .lte("due", nowIso);

        // 2) Total de flashcards do usuário (para fallback)
        const { count: total } = await supabase
          .from("flashcards")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id);

        if (cancelled) return;
        setDueCount(due ?? 0);
        setTotalCards(total ?? 0);
      } catch {
        if (!cancelled) setDueCount(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Não renderiza se o usuário não tem flashcards
  if (dueCount === null || totalCards === 0) return null;

  const hasDue = dueCount > 0;

  return (
    <Card className="overflow-hidden border-border/60">
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary shrink-0">
            <Layers className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold">
                {hasDue
                  ? `${dueCount} flashcard${dueCount === 1 ? "" : "s"} para revisar`
                  : "Flashcards em dia"}
              </span>
              {hasDue && (
                <Badge variant="secondary" className="text-[10px]">Hoje</Badge>
              )}
            </div>
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              {hasDue
                ? "Revise agora para fortalecer a memória de longo prazo."
                : `${totalCards} cards no total · próxima revisão em breve.`}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant={hasDue ? "default" : "outline"}
          onClick={() => navigate("/dashboard/flashcards?auto=1")}
        >
          {hasDue ? "Revisar" : "Abrir"}
          <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </CardContent>
    </Card>
  );
}
