import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Brain, ArrowRight } from "lucide-react";

export default function ErrorReviewCard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ["error-review-card", user?.id],
    enabled: !!user,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data: errors, count } = await supabase
        .from("error_bank")
        .select("tema, subtema, vezes_errado, categoria_erro", { count: "exact" })
        .eq("user_id", user!.id)
        .eq("dominado", false)
        .order("vezes_errado", { ascending: false })
        .limit(10);

      return { errors: errors || [], total: count || 0 };
    },
  });

  if (!data || data.total === 0) return null;

  const topErrors = data.errors.slice(0, 5);
  const errorSummary = topErrors
    .map((e) => `${e.tema}${e.subtema ? ` (${e.subtema})` : ""} — errou ${e.vezes_errado}x`)
    .join("\n");

  const handleReviewWithTutor = () => {
    const prompt = `🎯 MODO REVISÃO DE ERROS ATIVADO

O aluno possui ${data.total} erros não dominados no Banco de Erros. Os principais temas com dificuldade são:

${errorSummary}

Por favor:
1. Faça uma revisão rápida e objetiva dos conceitos-chave de cada tema listado
2. Gere 1 questão de cada tema para testar se o aluno superou a dificuldade
3. Foque nos pontos que mais causam erro em provas de residência
4. Use enfoques DIFERENTES dos que o aluno já viu (aborde por outro ângulo clínico)`;

    navigate("/dashboard/mentor", {
      state: {
        initialMessage: prompt,
        fromErrorReview: true,
      },
    });
  };

  const handleGoToErrorBank = () => {
    navigate("/dashboard/banco-erros");
  };

  return (
    <Card className="border-destructive/30 bg-gradient-to-br from-destructive/5 to-background overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-destructive/10 shrink-0">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              Revisão de Erros
              <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
                {data.total} {data.total === 1 ? "erro" : "erros"}
              </span>
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Temas frequentes: {topErrors.slice(0, 3).map((e) => e.tema).join(", ")}
            </p>
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={handleReviewWithTutor} className="gap-1.5 text-xs">
                <Brain className="h-3.5 w-3.5" />
                Revisar com Tutor IA
              </Button>
              <Button size="sm" variant="outline" onClick={handleGoToErrorBank} className="gap-1.5 text-xs">
                Ver Banco de Erros
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
