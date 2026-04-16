import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Crosshair, BookOpen, Brain, FileQuestion, Map } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FocusItem {
  label: string;
  type: "weakness" | "review" | "error";
  action: { label: string; path: string };
}

interface Props {
  weakestArea?: string;
  pendingReviews: number;
  errorsCount: number;
}

export default function WeeklyFocusPanel({ weakestArea, pendingReviews, errorsCount }: Props) {
  const navigate = useNavigate();

  const items: FocusItem[] = [];

  if (weakestArea) {
    items.push({
      label: weakestArea,
      type: "weakness",
      action: { label: "Treinar", path: "/dashboard/image-quiz" },
    });
  }

  if (pendingReviews > 0) {
    items.push({
      label: `${pendingReviews} revisões pendentes`,
      type: "review",
      action: { label: "Revisar", path: "/dashboard/revisoes" },
    });
  }

  if (errorsCount > 5) {
    items.push({
      label: `${errorsCount} erros no banco`,
      type: "error",
      action: { label: "Corrigir", path: "/dashboard/banco-erros" },
    });
  }

  if (items.length === 0) return null;

  const iconMap = {
    weakness: <Crosshair className="h-4 w-4 text-destructive/70" />,
    review: <Brain className="h-4 w-4 text-amber-400" />,
    error: <FileQuestion className="h-4 w-4 text-red-400" />,
  };

  const bgMap = {
    weakness: "bg-destructive/5 border-destructive/15",
    review: "bg-amber-500/5 border-amber-500/15",
    error: "bg-red-500/5 border-red-500/15",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.4 }}
      className="rounded-2xl border border-border/50 bg-card/50 p-5 space-y-4"
    >
      <div className="flex items-center gap-2">
        <Crosshair className="h-4 w-4 text-primary" />
        <span className="text-sm font-bold text-foreground">🎯 Foco da semana</span>
      </div>

      <div className="space-y-2.5">
        {items.slice(0, 3).map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.55 + i * 0.08, duration: 0.3 }}
            className={`flex items-center gap-3 px-3.5 py-3 rounded-xl border ${bgMap[item.type]}`}
          >
            {iconMap[item.type]}
            <span className="flex-1 text-sm font-medium text-foreground/90 truncate">{item.label}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2.5 text-xs rounded-lg shrink-0"
              onClick={() => navigate(item.action.path)}
            >
              {item.action.label}
            </Button>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
