import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { hapticLight } from "@/lib/haptics";

interface ModuleEmptyStateProps {
  icon: string;
  title: string;
  description: string;
  steps: string[];
  actionLabel: string;
  actionPath?: string;
  onAction?: () => void;
  illustration?: "study" | "quiz" | "review" | "clinical" | "achievement";
}

const ILLUSTRATIONS: Record<string, string> = {
  study: "📖",
  quiz: "🧠",
  review: "🔄",
  clinical: "🩺",
  achievement: "🏆",
};

const GRADIENT_PAIRS: Record<string, string> = {
  study: "from-blue-500/8 to-indigo-500/5",
  quiz: "from-amber-500/8 to-orange-500/5",
  review: "from-emerald-500/8 to-teal-500/5",
  clinical: "from-rose-500/8 to-pink-500/5",
  achievement: "from-purple-500/8 to-violet-500/5",
};

const ModuleEmptyState = ({
  icon,
  title,
  description,
  steps,
  actionLabel,
  actionPath,
  onAction,
  illustration = "study",
}: ModuleEmptyStateProps) => {
  const navigate = useNavigate();

  const handleAction = () => {
    hapticLight();
    if (onAction) return onAction();
    if (actionPath) navigate(actionPath);
  };

  const grad = GRADIENT_PAIRS[illustration] || GRADIENT_PAIRS.study;
  const bigIcon = ILLUSTRATIONS[illustration] || "📖";

  return (
    <Card className={`border-dashed border-2 border-primary/20 bg-gradient-to-br ${grad} via-background overflow-hidden`}>
      <CardContent className="p-8 flex flex-col items-center text-center space-y-5 relative">
        {/* Decorative background icon */}
        <div className="absolute -top-4 -right-4 text-[120px] opacity-[0.04] pointer-events-none select-none leading-none">
          {bigIcon}
        </div>

        {/* Main icon with subtle animation */}
        <div className="relative">
          <span className="text-5xl block animate-bounce" style={{ animationDuration: "3s" }}>{icon}</span>
        </div>

        <div className="space-y-1.5">
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground max-w-md">{description}</p>
        </div>

        <div className="w-full max-w-sm text-left space-y-2.5 bg-muted/30 rounded-lg p-4 backdrop-blur-sm">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Como começar</p>
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span className="flex-shrink-0 h-5 w-5 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <p className="text-sm text-muted-foreground leading-relaxed">{step}</p>
            </div>
          ))}
        </div>

        <Button onClick={handleAction} size="lg" className="gap-2 mt-2 shadow-lg shadow-primary/20">
          <Sparkles className="h-4 w-4" />
          {actionLabel}
        </Button>
      </CardContent>
    </Card>
  );
};

export default ModuleEmptyState;
