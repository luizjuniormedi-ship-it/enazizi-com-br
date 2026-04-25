import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, AlertTriangle, ChevronRight, Clock } from "lucide-react";
import { useStudyEngine } from "@/hooks/useStudyEngine";
import { buildStudyPath } from "@/lib/studyRouter";
import { useAuth } from "@/hooks/useAuth";
import { markRecommendationClicked } from "@/lib/coverageBoostTelemetry";
import { telemetry } from "@/lib/pedagogicalTelemetry";

export default function PendingReviewsCard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: recommendations } = useStudyEngine();

  const reviews = (recommendations || []).filter(
    (r) => r.type === "review" || r.type === "error_review"
  );

  if (reviews.length === 0) {
    return (
      <Card className="border-border/40">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Brain className="h-4 w-4 text-amber-500" />
            Revisões Pendentes
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <p className="text-xs text-muted-foreground">✅ Revisões em dia</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-500/20">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Brain className="h-4 w-4 text-amber-500" />
          Revisões Pendentes
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 ml-auto">
            {reviews.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-1.5">
        {reviews.slice(0, 4).map((rev) => (
          <div
            key={rev.id}
            className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors group"
            onClick={() => {
              if (user?.id) void markRecommendationClicked(user.id, rev.id);
              telemetry.track('revisoes_clicked', { topic: rev.topic, type: rev.type, priority: rev.priority, total_pending: reviews.length });
              telemetry.track('study_session_started', { origin: 'pending_reviews', task_type: rev.type, task_topic: rev.topic });
              navigate(buildStudyPath(rev));
            }}
          >
            {rev.priority >= 85 && (
              <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{rev.topic}</p>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Clock className="h-2.5 w-2.5" />
                {rev.estimatedMinutes}min · {rev.reason}
              </p>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </div>
        ))}
        {reviews.length > 4 && (
          <Button variant="ghost" size="sm" className="w-full text-xs h-7 text-muted-foreground" onClick={() => { telemetry.track('revisoes_clicked', { origin: 'see_all', total_pending: reviews.length }); navigate("/dashboard/planner"); }}>
            Ver todas as revisões
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
