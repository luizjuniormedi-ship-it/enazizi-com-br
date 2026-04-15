import { motion } from "framer-motion";
import { Flame, CheckCircle, Clock, Percent } from "lucide-react";

interface Props {
  questionsToday: number;
  accuracyToday: number;
  streak: number;
  studyMinutes: number;
}

export default function DailyProgressCard({ questionsToday, accuracyToday, streak, studyMinutes }: Props) {
  const stats = [
    { icon: <CheckCircle className="h-4 w-4 text-primary" />, label: "Questões", value: String(questionsToday) },
    { icon: <Percent className="h-4 w-4 text-emerald-400" />, label: "Acertos", value: `${accuracyToday}%` },
    { icon: <Flame className="h-4 w-4 text-amber-400" />, label: "Streak", value: `${streak}d` },
    { icon: <Clock className="h-4 w-4 text-blue-400" />, label: "Tempo", value: studyMinutes > 0 ? `${studyMinutes}min` : "—" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.4 }}
      whileHover={{ scale: 1.02 }}
      className="rounded-2xl border border-border/50 bg-muted/30 p-5 space-y-3 transition-shadow hover:shadow-md"
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        <Flame className="h-4 w-4" />
        <span className="text-xs font-semibold uppercase tracking-wider">Progresso de hoje</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="flex items-center gap-2.5">
            <div className="shrink-0">{s.icon}</div>
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
              <p className="text-lg font-bold tabular-nums leading-tight text-foreground">{s.value}</p>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
