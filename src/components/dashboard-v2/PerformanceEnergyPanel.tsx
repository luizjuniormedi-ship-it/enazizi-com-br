import { motion } from "framer-motion";
import { Activity, Flame, CalendarCheck, RotateCcw, Zap } from "lucide-react";

interface Props {
  streak: number;
  studyMinutes: number;
  pendingReviews: number;
  questionsThisWeek: number;
  daysActiveThisWeek: number;
}

function Chip({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-border/30 bg-card/30`}>
      <div className={`shrink-0 ${color}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider leading-none">{label}</p>
        <p className="text-base font-bold tabular-nums text-foreground leading-tight mt-0.5">{value}</p>
      </div>
    </div>
  );
}

export default function PerformanceEnergyPanel({ streak, studyMinutes, pendingReviews, questionsThisWeek, daysActiveThisWeek }: Props) {
  const intensity = questionsThisWeek >= 100 ? "Alta" : questionsThisWeek >= 40 ? "Média" : "Baixa";
  const intensityColor = questionsThisWeek >= 100 ? "text-emerald-400" : questionsThisWeek >= 40 ? "text-amber-400" : "text-muted-foreground";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.4 }}
      className="rounded-2xl border border-border/50 bg-card/50 p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold text-foreground">⚡ Energia</span>
        </div>
        <span className={`text-xs font-semibold ${intensityColor}`}>Intensidade: {intensity}</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        <Chip
          icon={<Flame className="h-4 w-4" />}
          label="Streak"
          value={`${streak}d`}
          color="text-amber-400"
        />
        <Chip
          icon={<Zap className="h-4 w-4" />}
          label="Questões/sem"
          value={String(questionsThisWeek)}
          color="text-primary"
        />
        <Chip
          icon={<CalendarCheck className="h-4 w-4" />}
          label="Dias ativos"
          value={`${daysActiveThisWeek}/7`}
          color="text-emerald-400"
        />
        <Chip
          icon={<RotateCcw className="h-4 w-4" />}
          label="Revisões"
          value={String(pendingReviews)}
          color={pendingReviews > 10 ? "text-red-400" : "text-muted-foreground"}
        />
        <Chip
          icon={<Activity className="h-4 w-4" />}
          label="Tempo/sem"
          value={studyMinutes > 0 ? `${studyMinutes}min` : "—"}
          color="text-blue-400"
        />
      </div>
    </motion.div>
  );
}
