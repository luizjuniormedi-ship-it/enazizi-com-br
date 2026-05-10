import { useState, useEffect } from "react";
import { BookMarked, Calendar, ChevronRight, Clock, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface ActiveMentorship {
  id: string;
  name: string;
  exam_date: string | null;
  topics: { topic: string; subtopic: string | null }[];
  professor_name?: string;
  daysUntilExam: number | null;
  topicProgress?: { total: number; started: number; completed: number };
}

const MentorshipBanner = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mentorships, setMentorships] = useState<ActiveMentorship[]>([]);

  useEffect(() => {
    if (!user) return;
    loadMentorships();
  }, [user]);

  const loadMentorships = async () => {
    if (!user) return;

    const { data: targets } = await supabase
      .from("mentor_theme_plan_targets")
      .select("plan_id")
      .eq("target_id", user.id);

    if (!targets || targets.length === 0) return;

    const planIds = [...new Set(targets.map(t => t.plan_id))];

    const { data: plans } = await supabase
      .from("mentor_theme_plans")
      .select("id, name, exam_date, professor_id")
      .in("id", planIds)
      .eq("status", "active");

    if (!plans || plans.length === 0) return;

    const activePlanIds = plans.map(p => p.id);

    // Parallel: topics, profiles, progress
    const [{ data: topics }, profIds, { data: progress }] = await Promise.all([
      supabase.from("mentor_theme_plan_topics").select("plan_id, topic, subtopic").in("plan_id", activePlanIds),
      Promise.resolve([...new Set(plans.map(p => p.professor_id))]),
      supabase.from("mentor_theme_plan_progress").select("plan_id, status").eq("user_id", user.id).in("plan_id", activePlanIds),
    ]);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .in("user_id", profIds);
    const profMap: Record<string, string> = {};
    (profiles || []).forEach(p => { profMap[p.user_id] = p.display_name || "Professor"; });

    const enriched: ActiveMentorship[] = plans.map(p => {
      const planTopics = (topics || []).filter(t => t.plan_id === p.id);
      const planProgress = (progress || []).filter(pr => pr.plan_id === p.id);
      const daysUntilExam = p.exam_date
        ? Math.ceil((new Date(p.exam_date).getTime() - Date.now()) / 86400000)
        : null;

      return {
        id: p.id,
        name: p.name,
        exam_date: p.exam_date,
        professor_name: profMap[p.professor_id],
        daysUntilExam,
        topics: planTopics.map(t => ({ topic: t.topic, subtopic: t.subtopic })),
        topicProgress: {
          total: planTopics.length,
          started: planProgress.filter(pr => pr.status !== "pending").length,
          completed: planProgress.filter(pr => pr.status === "completed").length,
        },
      };
    });

    setMentorships(enriched);
  };

  if (mentorships.length === 0) return null;

  const urgencyStyle = (days: number | null) => {
    if (days === null) return "";
    if (days <= 7) return "border-red-500/30 bg-red-500/5";
    if (days <= 14) return "border-orange-500/30 bg-orange-500/5";
    if (days <= 30) return "border-yellow-500/30 bg-yellow-500/5";
    return "border-primary/30 bg-primary/5";
  };

  const urgencyBadge = (days: number | null) => {
    if (days === null) return null;
    if (days <= 0) return <Badge variant="destructive" className="text-[10px]">HOJE!</Badge>;
    if (days <= 7) return <Badge variant="destructive" className="text-[10px]">🔴 {days} dias</Badge>;
    if (days <= 14) return <Badge className="bg-orange-500 text-white text-[10px]">🟠 {days} dias</Badge>;
    if (days <= 30) return <Badge className="bg-yellow-500 text-white text-[10px]">🟡 {days} dias</Badge>;
    return <Badge variant="secondary" className="text-[10px]">{days} dias</Badge>;
  };

  return (
    <div className="space-y-2">
      {mentorships.map(m => {
        const progressPct = m.topicProgress && m.topicProgress.total > 0
          ? Math.round((m.topicProgress.started / m.topicProgress.total) * 100)
          : 0;

        return (
          <Card key={m.id} className={urgencyStyle(m.daysUntilExam)}>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                  <BookMarked className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  {/* Header */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold truncate">📋 Mentoria: {m.name}</h3>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {m.professor_name || "Professor"}
                    </Badge>
                    {m.daysUntilExam !== null && urgencyBadge(m.daysUntilExam)}
                  </div>

                  {/* Topics */}
                  <div className="flex flex-wrap gap-1">
                    {m.topics.slice(0, 5).map((t, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px]">
                        {t.topic}{t.subtopic ? ` → ${t.subtopic}` : ""}
                      </Badge>
                    ))}
                    {m.topics.length > 5 && (
                      <Badge variant="secondary" className="text-[10px]">+{m.topics.length - 5}</Badge>
                    )}
                  </div>

                  {/* Progress bar */}
                  {m.topicProgress && m.topicProgress.total > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>{m.topicProgress.started}/{m.topicProgress.total} temas iniciados</span>
                        <span>{progressPct}%</span>
                      </div>
                      <Progress value={progressPct} className="h-1.5" />
                    </div>
                  )}

                  {/* Exam date + CTA */}
                  <div className="flex items-center justify-between gap-2">
                    {m.exam_date && (
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Prova: {new Date(m.exam_date).toLocaleDateString("pt-BR")}
                      </p>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] gap-1 shrink-0"
                      onClick={() => navigate("/dashboard/mentor?topic=" + encodeURIComponent(m.topics[0]?.topic || ""))}
                    >
                      <Zap className="h-3 w-3" /> Estudar agora
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default MentorshipBanner;
