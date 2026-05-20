import { encodeStudyContext, type StudyContext } from "@/lib/studyContext";

export function handleStrategicNavigation(navigate: any, item: { 
  topic: string; 
  discipline?: string; 
  subtopic?: string; 
  task_type?: string;
  week_number?: number;
  priority_score?: number;
  reason?: string;
}) {
  const ctx: StudyContext = {
    source: "planner",
    specialty: item.discipline,
    topic: item.topic,
    subtopic: item.subtopic,
    difficulty: (item.priority_score || 50) > 70 ? "dificil" : "intermediario",
    reason: item.reason || `Tarefa estratégica do cronograma`,
    taskType: (item.task_type as any) || "review"
  };

  const params = encodeStudyContext(ctx);
  navigate(`/dashboard/sessao-estudo?${params.toString()}`);
}
