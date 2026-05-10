import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lightbulb } from "lucide-react";
import type { StudyRecommendation, AdaptiveState } from "@/hooks/useStudyEngine";

interface Props {
  task: StudyRecommendation | null;
  adaptive?: AdaptiveState;
}

export default function MissionTutorHint({ task, adaptive }: Props) {
  const navigate = useNavigate();

  if (!task) return null;
  if (task.type !== "error_review" && task.type !== "review") return null;
  if (task.priority < 80) return null;

  const handleExplain = () => {
    const params = new URLSearchParams();
    params.set("topic", task.topic || "");
    params.set("specialty", task.specialty || "");
    params.set("tutor_mode", "mission");
    if (task.reason) params.set("error", task.reason);
    if (adaptive?.mode?.phase) params.set("phase", adaptive.mode.phase);
    if (adaptive?.overdueCount) params.set("pendingReviews", String(adaptive.overdueCount));
    if (adaptive?.approvalScore) params.set("accuracy", String(Math.round(adaptive.approvalScore)));
    navigate(`/dashboard/mentor?${params.toString()}`);
  };

  return (
    <Card className="rounded-xl border-primary/20 bg-primary/5">
      <CardContent className="p-4 flex items-center gap-3">
        <Lightbulb className="h-5 w-5 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium">Quer uma explicação rápida sobre {task.topic}?</p>
          <p className="text-[10px] text-muted-foreground">O Tutor IA pode ajudar — modo estratégico</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={handleExplain}
        >
          Explicar
        </Button>
      </CardContent>
    </Card>
  );
}
