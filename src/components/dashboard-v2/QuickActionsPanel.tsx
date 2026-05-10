import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Image, FileText, AlertCircle, Brain, Sparkles,
  MessageSquare, Map, Stethoscope, BookOpen,
} from "lucide-react";

interface QuickAction {
  icon: React.ReactNode;
  label: string;
  path: string;
  highlight?: boolean;
  comingSoon?: boolean;
}

interface Props {
  hasErrors: boolean;
  hasPendingReviews: boolean;
}

export default function QuickActionsPanel({ hasErrors, hasPendingReviews }: Props) {
  const navigate = useNavigate();

  const actions: QuickAction[] = [
    { icon: <Image className="h-5 w-5" />, label: "Quiz de Imagens", path: "/dashboard/image-quiz", highlight: true },
    { icon: <FileText className="h-5 w-5" />, label: "Simulado", path: "/dashboard/simulados" },
    { icon: <AlertCircle className="h-5 w-5" />, label: "Banco de Erros", path: "/dashboard/banco-erros", highlight: hasErrors },
    { icon: <Brain className="h-5 w-5" />, label: "Flashcards", path: "/dashboard/flashcards" },
    { icon: <Sparkles className="h-5 w-5" />, label: "Mnemônico", path: "/dashboard/mnemonic-studio-v2" },
    { icon: <MessageSquare className="h-5 w-5" />, label: "Tutor IA", path: "/dashboard/tutor-v2" },
    { icon: <Map className="h-5 w-5" />, label: "Mapas Mentais", path: "/dashboard/mapas-mentais" },
    { icon: <Stethoscope className="h-5 w-5" />, label: "Plantão", path: "/dashboard/clinical-simulation" },
    { icon: <BookOpen className="h-5 w-5" />, label: "Revisões", path: "/dashboard/revisoes", highlight: hasPendingReviews },
  ];

  // Sort: highlighted items first
  const sorted = [...actions].sort((a, b) => (b.highlight ? 1 : 0) - (a.highlight ? 1 : 0));

  const handleClick = (action: QuickAction) => {
    if (action.comingSoon) {
      toast.info("Mapas Mentais em breve", {
        description: "Estamos preparando essa funcionalidade. Você será avisado quando estiver pronta.",
      });
      return;
    }
    navigate(action.path);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.7, duration: 0.4 }}
      className="rounded-2xl border border-border/50 bg-card/50 p-5 space-y-4"
    >
      <span className="text-sm font-bold text-foreground">🚀 Acesso rápido</span>

      <div className="grid grid-cols-4 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {sorted.map((action, i) => (
          <motion.button
            key={action.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.75 + i * 0.04, duration: 0.2 }}
            whileHover={{ scale: 1.08, y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleClick(action)}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-colors
              ${action.highlight
                ? "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
                : "border-border/30 bg-card/30 text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
          >
            {action.icon}
            <span className="text-[10px] font-medium leading-tight text-center">{action.label}</span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
