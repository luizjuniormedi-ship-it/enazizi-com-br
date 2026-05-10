import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowRight } from "lucide-react";

/**
 * Detects topics the user is avoiding (low practice + low accuracy)
 * and suggests them for focused study.
 */
export default function BehavioralAlerts() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: alerts } = useQuery({
    queryKey: ["behavioral-alerts", user?.id],
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data: topics } = await supabase
        .from("user_topic_profiles")
        .select("topic, specialty, accuracy, total_questions, last_practiced_at")
        .eq("user_id", user!.id)
        .lt("accuracy", 50)
        .gt("total_questions", 2);

      if (!topics?.length) return [];

      const now = Date.now();
      return topics
        .filter((t) => {
          const daysSince = t.last_practiced_at
            ? (now - new Date(t.last_practiced_at).getTime()) / 86400000
            : 999;
          return daysSince > 7; // Not practiced in 7+ days
        })
        .slice(0, 3)
        .map((t) => ({
          topic: t.topic,
          specialty: t.specialty,
          accuracy: Math.round(t.accuracy),
          totalQ: t.total_questions,
        }));
    },
  });

  if (!alerts?.length) return null;

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardContent className="p-4 space-y-2">
        <h3 className="text-sm font-semibold flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4" /> Temas que precisam de atenção
        </h3>
        <p className="text-xs text-muted-foreground">
          Esses temas têm baixo desempenho e não são praticados há mais de 7 dias.
        </p>
        <div className="space-y-1.5">
          {alerts.map((a) => (
            <div
              key={a.topic}
              className="flex items-center justify-between rounded-lg bg-card border border-border/50 px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium">{a.topic}</p>
                <p className="text-[10px] text-muted-foreground">
                  {a.accuracy}% acerto · {a.totalQ} questões
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 text-xs"
                onClick={() => navigate(`/dashboard/mentor?topic=${encodeURIComponent(a.topic)}&specialty=${encodeURIComponent(a.specialty)}&origin=alert`)}
              >
                Estudar <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
