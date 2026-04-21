import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, ArrowRight, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { buildStudyPath } from "@/lib/studyRouter";
import { type StudyRecommendation } from "@/lib/studyEngine";
import { markRecommendationClicked } from "@/lib/coverageBoostTelemetry";

/**
 * Shows "Next up" prompt after completing a task to maintain continuous flow.
 */
interface Props {
  completedTask: StudyRecommendation;
  nextTask?: StudyRecommendation | null;
  onContinue: () => void;
  onStop: () => void;
}

export default function ContinuousFlowPrompt({ completedTask, nextTask, onContinue, onStop }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();

  if (!nextTask) {
    return (
      <Card className="border-emerald-500/30 bg-emerald-500/5 animate-scale-in">
        <CardContent className="p-4 text-center space-y-3">
          <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mx-auto">
            <Sparkles className="h-6 w-6 text-emerald-500" />
          </div>
          <h3 className="text-sm font-semibold">Parabéns! Todos os blocos concluídos 🎉</h3>
          <p className="text-xs text-muted-foreground">Você completou todas as tarefas de hoje!</p>
          <Button variant="outline" size="sm" onClick={onStop}>
            Voltar ao Dashboard
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/30 bg-primary/5 animate-scale-in">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          <span className="text-sm font-medium">
            <strong>{completedTask.topic}</strong> concluído!
          </span>
        </div>

        <div className="rounded-lg bg-card border p-3">
          <p className="text-xs text-muted-foreground mb-1">Próximo bloco:</p>
          <p className="text-sm font-semibold">{nextTask.topic}</p>
          <p className="text-[11px] text-muted-foreground">{nextTask.reason}</p>
        </div>

        <div className="flex gap-2">
          <Button
            className="flex-1 gap-1.5"
            size="sm"
            onClick={() => {
              if (user?.id) void markRecommendationClicked(user.id, nextTask.id);
              onContinue();
              navigate(buildStudyPath(nextTask));
            }}
          >
            Continuar <ArrowRight className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="sm" onClick={onStop}>
            Parar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
