/**
 * GuidedFocusCard
 * ───────────────
 * Top-1 fraqueza do usuário, derivada de error_bank (mais recente / mais errado).
 * Só renderiza se houver fraqueza identificada.
 *
 * Leitura única e barata (1 query). Não cria escrita.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface Weakness {
  tema: string;
  subtema: string | null;
  vezes: number;
}

export default function GuidedFocusCard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [weak, setWeak] = useState<Weakness | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("error_bank")
          .select("tema, subtema, vezes_errado")
          .eq("user_id", user.id)
          .eq("dominado", false)
          .order("vezes_errado", { ascending: false })
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cancelled) return;
        if (data?.tema) {
          setWeak({ tema: data.tema, subtema: data.subtema, vezes: data.vezes_errado || 0 });
        }
      } catch {
        /* silencioso */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!loaded || !weak) return null;

  return (
    <Card className="overflow-hidden border-destructive/30 bg-destructive/5">
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="rounded-lg bg-destructive/15 p-2 text-destructive shrink-0">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{weak.tema}</p>
            <p className="text-xs text-muted-foreground truncate">
              {weak.subtema ? `${weak.subtema} · ` : ""}
              {weak.vezes > 1 ? `${weak.vezes} erros recentes` : "Erro recente"}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10"
          onClick={() => navigate("/dashboard/banco-erros?source=guided_focus")}
        >
          Treinar
          <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </CardContent>
    </Card>
  );
}
