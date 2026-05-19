import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, CalendarDays, CheckCircle2, Circle, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface StudyPlanItem {
  id: string;
  week_number: number;
  topic: string;
  discipline: string;
  status: string;
  priority_score: number;
  estimated_minutes: number;
}

export default function PlannerLongitudinalView({ planId }: { planId: string | null }) {
  const [items, setItems] = useState<StudyPlanItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!planId) return;

    const fetchItems = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("study_plan_items")
        .select("*")
        .eq("study_plan_id", planId)
        .order("week_number", { ascending: true })
        .order("priority_score", { ascending: false });

      if (error) {
        console.error("Error fetching study plan items:", error);
      } else {
        setItems(data as StudyPlanItem[]);
      }
      setLoading(false);
    };

    fetchItems();
  }, [planId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!planId || items.length === 0) {
    return (
      <div className="text-center p-12 glass-card">
        <p className="text-muted-foreground">Gere um cronograma para ver sua trajetória longitudinal.</p>
      </div>
    );
  }

  const weeks = Array.from(new Set(items.map(i => i.week_number))).sort((a, b) => a - b);
  const totalCompleted = items.filter(i => i.status === "completed").length;
  const progress = Math.round((totalCompleted / items.length) * 100);

  return (
    <div className="space-y-6">
      <div className="glass-card p-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            Cronograma Total — {weeks.length} Semanas
          </h3>
          <p className="text-[10px] text-muted-foreground">Distribuição total de conteúdo até a prova.</p>
        </div>
        <div className="text-right">
          <div className="text-xl font-black text-primary">{progress}%</div>
          <div className="text-[9px] uppercase tracking-tighter text-muted-foreground">Progresso Total</div>
        </div>
      </div>

      <Progress value={progress} className="h-1.5" />

      <div className="space-y-4">
        {weeks.map(weekNum => {
          const weekItems = items.filter(i => i.week_number === weekNum);
          const completedCount = weekItems.filter(i => i.status === "completed").length;
          const weekProgress = Math.round((completedCount / weekItems.length) * 100);

          return (
            <div key={weekNum} className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h4 className="text-xs font-bold uppercase tracking-widest text-white/60">
                  Semana {weekNum}
                </h4>
                <span className="text-[10px] text-muted-foreground">
                  {completedCount}/{weekItems.length} temas concluídos
                </span>
              </div>
              <div className="space-y-1">
                {weekItems.map(item => (
                  <div 
                    key={item.id} 
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border transition-all",
                      item.status === "completed" 
                        ? "bg-emerald-500/5 border-emerald-500/20 opacity-70" 
                        : "bg-white/5 border-white/10"
                    )}
                  >
                    {item.status === "completed" ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    ) : (
                      <Circle className="h-4 w-4 text-white/20 flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium truncate">{item.topic}</span>
                        <Badge variant="outline" className="text-[8px] px-1 h-3.5">
                          {item.discipline}
                        </Badge>
                      </div>
                      <div className="text-[9px] text-muted-foreground mt-0.5">
                        {item.subtopic && <span className="mr-2 text-white/60">{item.subtopic} •</span>}
                        {item.estimated_minutes} min • Prioridade: {item.priority_score}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
