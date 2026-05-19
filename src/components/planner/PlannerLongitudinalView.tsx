import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { 
  Loader2, CalendarDays, CheckCircle2, Circle, BookOpen, 
  Printer, Zap, MessageSquare, HelpCircle, Layers, Flame, RefreshCw, Clock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { encodeStudyContext, type StudyContext } from "@/lib/studyContext";
import { toast } from "@/hooks/use-toast";

interface StudyPlanItem {
  id: string;
  week_number: number;
  topic: string;
  subtopic?: string | null;
  discipline: string;
  status: string;
  priority_score: number;
  estimated_minutes: number;
  task_type: string;
}

const TASK_TYPE_CONFIG: Record<string, { label: string; icon: any; color: string; bgColor: string }> = {
  tutor_lesson: { label: "Aula Tutor", icon: MessageSquare, color: "text-blue-500", bgColor: "bg-blue-500/10" },
  question_practice: { label: "Questões", icon: HelpCircle, color: "text-purple-500", bgColor: "bg-purple-500/10" },
  fsrs_review: { label: "Revisão FSRS", icon: RefreshCw, color: "text-amber-500", bgColor: "bg-amber-500/10" },
  error_recovery: { label: "Recuperação", icon: Flame, color: "text-red-500", bgColor: "bg-red-500/10" },
  flashcards: { label: "Flashcards", icon: Layers, color: "text-emerald-500", bgColor: "bg-emerald-500/10" },
  mini_simulado: { label: "Simulado", icon: Zap, color: "text-primary", bgColor: "bg-primary/10" },
  summary: { label: "Resumo", icon: BookOpen, color: "text-slate-400", bgColor: "bg-slate-400/10" },
  rest_block: { label: "Descanso", icon: Clock, color: "text-slate-500", bgColor: "bg-slate-500/10" },
};

export default function PlannerLongitudinalView({ planId }: { planId: string | null }) {
  const [items, setItems] = useState<StudyPlanItem[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);

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

  const handleStudy = (item: StudyPlanItem) => {
    const ctx: StudyContext = {
      source: "planner",
      specialty: item.discipline,
      topic: item.topic,
      subtopic: item.subtopic || undefined,
      difficulty: item.priority_score > 70 ? "dificil" : "intermediario",
      reason: `Tarefa do cronograma — Semana ${item.week_number}`
    };

    const params = encodeStudyContext(ctx);
    const queryString = params.toString();
    
    // Telemetry
    import("@/lib/pedagogicalTelemetry").then(({ telemetry }) => {
      telemetry.track("planner_topic_opened", {
        topic: item.topic,
        week: item.week_number,
        task_type: item.task_type
      });
    });

    navigate(`/dashboard/sessao-estudo?${queryString}`);
  };

  const handlePrint = () => {
    window.print();
    import("@/lib/pedagogicalTelemetry").then(({ telemetry }) => {
      telemetry.track("planner_printed", { plan_id: planId });
    });
  };

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
    <div className="space-y-6 print:m-0 print:p-0" ref={printRef}>
      {/* Legend & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="flex flex-wrap gap-2">
          {Object.entries(TASK_TYPE_CONFIG).map(([type, config]) => (
            <div key={type} className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/5 border border-white/10">
              <config.icon className={cn("h-3 w-3", config.color)} />
              <span className="text-[9px] font-bold uppercase tracking-wider text-white/60">{config.label}</span>
            </div>
          ))}
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-8 text-[10px] uppercase font-black tracking-widest gap-2"
          onClick={handlePrint}
        >
          <Printer className="h-3.5 w-3.5" />
          Imprimir Planner
        </Button>
      </div>

      <div className="glass-card p-4 flex items-center justify-between print:border-none print:shadow-none">
        <div>
          <h3 className="text-sm font-bold flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            Cronograma Total — {weeks.length} Semanas
          </h3>
          <p className="text-[10px] text-muted-foreground">Distribuição macro até a aprovação.</p>
        </div>
        <div className="text-right">
          <div className="text-xl font-black text-primary">{progress}%</div>
          <div className="text-[9px] uppercase tracking-tighter text-muted-foreground">Viabilidade Trajetória</div>
        </div>
      </div>

      <div className="px-1 space-y-1 print:hidden">
        <Progress value={progress} className="h-1.5" />
        <div className="flex justify-between text-[8px] uppercase font-bold tracking-tighter opacity-50">
          <span>Início</span>
          <span>Aprovação</span>
        </div>
      </div>

      <div className="space-y-6 print:space-y-8">
        {weeks.map(weekNum => {
          const weekItems = items.filter(i => i.week_number === weekNum);
          const completedCount = weekItems.filter(i => i.status === "completed").length;

          return (
            <div key={weekNum} className="space-y-3 break-inside-avoid">
              <div className="flex items-center justify-between px-1 border-b border-white/10 pb-1">
                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-white/60">
                  Semana {weekNum}
                </h4>
                <span className="text-[10px] text-muted-foreground font-bold">
                  {completedCount}/{weekItems.length} temas concluídos
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {weekItems.map(item => {
                  const typeConfig = TASK_TYPE_CONFIG[item.task_type] || TASK_TYPE_CONFIG.tutor_lesson;
                  return (
                    <div 
                      key={item.id} 
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl border transition-all group",
                        item.status === "completed" 
                          ? "bg-emerald-500/5 border-emerald-500/20 opacity-70" 
                          : "bg-white/5 border-white/10 hover:border-white/20"
                      )}
                    >
                      <div className={cn("p-2 rounded-lg", typeConfig.bgColor, typeConfig.color)}>
                        <typeConfig.icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={cn("text-xs font-bold truncate", item.status === "completed" && "line-through text-muted-foreground")}>
                            {item.topic}
                          </span>
                          <Badge variant="outline" className="text-[8px] px-1 h-3.5 opacity-60">
                            {item.discipline}
                          </Badge>
                        </div>
                        <div className="text-[9px] text-muted-foreground flex items-center gap-2">
                          {item.subtopic && <span className="truncate max-w-[80px]">{item.subtopic}</span>}
                          <span>{item.estimated_minutes} min</span>
                          <span className="px-1.5 py-0.5 rounded-full bg-white/5 font-bold uppercase tracking-tighter">
                            {typeConfig.label}
                          </span>
                        </div>
                      </div>
                      
                      {item.status !== "completed" && (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity print:hidden"
                          onClick={() => handleStudy(item)}
                        >
                          <Zap className="h-3.5 w-3.5 text-primary fill-primary" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden;
          }
          #root, #root * {
            visibility: hidden;
          }
          .print-container, .print-container * {
            visibility: visible;
          }
          .print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
          }
          .glass-card, .bg-white\\/5 {
            background: none !important;
            border: 1px solid #ddd !important;
            color: black !important;
          }
          .text-white, .text-white\\/60, .text-muted-foreground {
            color: #333 !important;
          }
          .text-primary {
            color: #4f46e5 !important;
          }
          .bg-primary\\/10, .bg-blue-500\\/10, .bg-purple-500\\/10, .bg-amber-500\\/10, .bg-red-500\\/10, .bg-emerald-500\\/10 {
            background: #f3f4f6 !important;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}} />
    </div>
  );
}