import { motion } from "framer-motion";
import { BrainCircuit, Info, TrendingUp, Sparkles, Activity, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface JourneyEvent {
  id: string;
  created_at: string;
  trigger_type: string;
  action_taken: string;
  explanation: string;
  impact_summary?: string;
  friction_score_snapshot: number;
}

interface Props {
  events: JourneyEvent[];
}

const icons: Record<string, any> = {
  quiz_error: TrendingUp,
  tutor_open: Sparkles,
  replay_spike: Activity,
  low_retention: ShieldCheck,
  default: BrainCircuit
};

export function JourneyTimeline({ events }: Props) {
  return (
    <div className="relative space-y-8 px-4 sm:px-8 lg:px-14">
      {/* Central Line */}
      <div className="absolute left-12 top-0 bottom-0 w-px bg-gradient-to-b from-primary/50 via-primary/20 to-transparent hidden sm:block" />

      {events.map((event, i) => {
        const Icon = icons[event.trigger_type] || icons.default;
        
        return (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="relative flex gap-6 group"
          >
            {/* Dot/Icon container */}
            <div className="relative z-10 flex-shrink-0 hidden sm:block">
              <div className="h-16 w-16 rounded-2xl bg-[#1a1a1e] border border-white/10 flex items-center justify-center group-hover:border-primary/50 transition-colors shadow-xl">
                <Icon className="h-6 w-6 text-primary" />
              </div>
            </div>

            {/* Content Card */}
            <div className="flex-1 bg-white/5 backdrop-blur-xl border border-white/5 rounded-2xl p-6 hover:bg-white/[0.08] transition-all group-hover:translate-x-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white group-hover:text-primary transition-colors">
                    {event.action_taken}
                  </h3>
                  <p className="text-xs text-white/40 font-medium uppercase tracking-wider">
                    {new Date(event.created_at).toLocaleDateString()} • {event.trigger_type.replace('_', ' ')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Ajuste da IA</span>
                  <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${event.friction_score_snapshot * 100}%` }}
                      className="h-full bg-primary"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex gap-3 items-start">
                  <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-sm text-white/70 leading-relaxed">
                    {event.explanation}
                  </p>
                </div>

                {event.impact_summary && (
                  <div className="flex gap-3 items-start p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                    <TrendingUp className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-emerald-400 italic">
                      Impacto: {event.impact_summary}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
