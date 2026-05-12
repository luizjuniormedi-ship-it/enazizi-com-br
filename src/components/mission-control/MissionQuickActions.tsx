import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Brain, FileQuestion, Search, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

/**
 * Maps study-next recommendation type → contextual quick actions.
 * Mirrors STUDY_NEXT_ACTION_MAP from backend.
 */
const ACTIONS_MAP: Record<string, { label: string; icon: React.ReactNode; endpoint: string }[]> = {
  review: [
    { label: "Resumo do tema", icon: <BookOpen className="h-4 w-4" />, endpoint: "summarize-topic" },
    { label: "Explicação profunda", icon: <Search className="h-4 w-4" />, endpoint: "explain-deep" },
  ],
  error_review: [
    { label: "Reforço de erro", icon: <Brain className="h-4 w-4" />, endpoint: "reinforce-error" },
    { label: "Questão adaptativa", icon: <FileQuestion className="h-4 w-4" />, endpoint: "generate-adaptive-question" },
  ],
  daily_task: [
    { label: "Questão adaptativa", icon: <FileQuestion className="h-4 w-4" />, endpoint: "generate-adaptive-question" },
    { label: "Explicação rápida", icon: <Sparkles className="h-4 w-4" />, endpoint: "explain-simple" },
  ],
  free_study: [
    { label: "Explicação rápida", icon: <Sparkles className="h-4 w-4" />, endpoint: "explain-simple" },
    { label: "Resumo do tema", icon: <BookOpen className="h-4 w-4" />, endpoint: "summarize-topic" },
  ],
  image_quiz: [
    { label: "Resumo do tema", icon: <BookOpen className="h-4 w-4" />, endpoint: "summarize-topic" },
    { label: "Explicação rápida", icon: <Sparkles className="h-4 w-4" />, endpoint: "explain-simple" },
  ],
  mnemonic: [
    { label: "Reforço de erro", icon: <Brain className="h-4 w-4" />, endpoint: "reinforce-error" },
    { label: "Explicação rápida", icon: <Sparkles className="h-4 w-4" />, endpoint: "explain-simple" },
  ],
};

interface Props {
  type: string;
  topic?: string;
}

export default function MissionQuickActions({ type, topic }: Props) {
  const navigate = useNavigate();
  const actions = ACTIONS_MAP[type] || ACTIONS_MAP.free_study;

  const handleAction = (endpoint: string) => {
    console.log("[MissionControl] Quick action:", endpoint, "Topic:", topic);
    
    // Mapping endpoints to app routes and parameters
    const topicParam = topic ? `&topic=${encodeURIComponent(topic)}` : "";
    
    switch (endpoint) {
      case "summarize-topic":
        navigate(`/dashboard/sessao-estudo?auto=1&focus=review${topicParam}`);
        break;
      case "explain-deep":
        navigate(`/dashboard/sessao-estudo?auto=1&focus=full${topicParam}`);
        break;
      case "explain-simple":
        navigate(`/dashboard/sessao-estudo?auto=1&focus=compact${topicParam}`);
        break;
      case "reinforce-error":
        navigate(`/dashboard/sessao-estudo?auto=1&focus=correction${topicParam}`);
        break;
      case "generate-adaptive-question":
        navigate(`/dashboard/sessao-estudo?auto=1&focus=practice${topicParam}`);
        break;
      default:
        navigate(`/dashboard/sessao-estudo?auto=1${topicParam}`);
    }
  };

  return (
    <Card className="border-border/50">
      <CardContent className="p-4 sm:p-5 space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          Ações rápidas
        </h3>
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => (
            <Button
              key={a.endpoint}
              variant="secondary"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => handleAction(a.endpoint)}
            >
              {a.icon}
              {a.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
