import { motion } from "framer-motion";
import { Target, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Props {
  score: number;
  trend?: "up" | "down" | "stable";
}

function getZone(score: number) {
  if (score >= 85) return { label: "Pronto", color: "text-emerald-400", bg: "bg-emerald-500/15", ring: "ring-emerald-500/30" };
  if (score >= 70) return { label: "Forte", color: "text-green-400", bg: "bg-green-500/15", ring: "ring-green-500/30" };
  if (score >= 55) return { label: "Competitivo", color: "text-blue-400", bg: "bg-blue-500/15", ring: "ring-blue-500/30" };
  if (score >= 35) return { label: "Risco", color: "text-amber-400", bg: "bg-amber-500/15", ring: "ring-amber-500/30" };
  return { label: "Crítico", color: "text-red-400", bg: "bg-red-500/15", ring: "ring-red-500/30" };
}

const TrendIcon = ({ trend }: { trend?: string }) => {
  if (trend === "up") return <TrendingUp className="h-4 w-4 text-emerald-400" />;
  if (trend === "down") return <TrendingDown className="h-4 w-4 text-red-400" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
};

const trendLabel = (trend?: string) => {
  if (trend === "up") return "Subindo";
  if (trend === "down") return "Caindo";
  return "Estável";
};

export default function ApprovalScoreCard({ score, trend }: Props) {
  const zone = getZone(score);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.4 }}
      whileHover={{ scale: 1.02 }}
      className={`rounded-2xl border border-border/50 ${zone.bg} p-5 space-y-3 transition-shadow hover:shadow-md`}
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        <Target className="h-4 w-4" />
        <span className="text-xs font-semibold uppercase tracking-wider">Score de Aprovação</span>
      </div>

      <div className="flex items-end gap-3">
        <span className={`text-4xl font-black tabular-nums ${zone.color}`}>{score}%</span>
        <div className="flex items-center gap-1.5 pb-1">
          <TrendIcon trend={trend} />
          <span className="text-xs text-muted-foreground">{trendLabel(trend)}</span>
        </div>
      </div>

      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${zone.color} ${zone.bg} ring-1 ${zone.ring}`}>
        {zone.label}
      </div>
    </motion.div>
  );
}
