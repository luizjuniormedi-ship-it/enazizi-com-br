import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Award, ArrowRight } from "lucide-react";

interface Props {
  simuladosCompleted: number;
  lastScore: number | null;
  accuracy: number;
}

function getReadiness(accuracy: number, simulados: number) {
  if (simulados === 0) return { label: "Sem dados", color: "text-muted-foreground", bg: "bg-muted/30" };
  if (accuracy >= 80) return { label: "Forte", color: "text-emerald-400", bg: "bg-emerald-500/10" };
  if (accuracy >= 60) return { label: "Competitivo", color: "text-blue-400", bg: "bg-blue-500/10" };
  if (accuracy >= 40) return { label: "Construindo", color: "text-amber-400", bg: "bg-amber-500/10" };
  return { label: "Iniciar treino", color: "text-red-400", bg: "bg-red-500/10" };
}

export default function ReadinessCard({ simuladosCompleted, lastScore, accuracy }: Props) {
  const navigate = useNavigate();
  const readiness = getReadiness(accuracy, simuladosCompleted);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35, duration: 0.4 }}
      whileHover={{ scale: 1.02 }}
      className={`rounded-2xl border border-border/50 ${readiness.bg} p-5 space-y-3 transition-shadow hover:shadow-md`}
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        <Award className="h-4 w-4" />
        <span className="text-xs font-semibold uppercase tracking-wider">Prontidão</span>
      </div>

      <div className="space-y-1">
        <div className="flex items-end gap-2">
          <span className={`text-3xl font-black tabular-nums ${readiness.color}`}>
            {simuladosCompleted > 0 ? `${lastScore ?? accuracy}%` : "—"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {simuladosCompleted} {simuladosCompleted === 1 ? "simulado" : "simulados"} · {readiness.label}
        </p>
      </div>

      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl gap-1.5 text-xs border-border/50 hover:bg-accent/50"
          onClick={() => navigate("/dashboard/simulados")}
        >
          Simulado rápido <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </motion.div>
    </motion.div>
  );
}
