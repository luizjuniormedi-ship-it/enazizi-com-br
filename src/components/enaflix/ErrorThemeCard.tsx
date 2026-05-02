import { motion } from "framer-motion";
import { AlertTriangle, TrendingDown, TrendingUp, Minus, Play, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  tema: string;
  total: number;
  trend: "improving" | "worsening" | "stable";
  subtemas: { subtema: string; count: number }[];
  onClick: () => void;
  onTrain: () => void;
}

export function ErrorThemeCard({ tema, total, trend, subtemas, onClick, onTrain }: Props) {
  const trendIcons = {
    improving: <TrendingUp className="h-4 w-4 text-emerald-500" />,
    worsening: <TrendingDown className="h-4 w-4 text-destructive" />,
    stable: <Minus className="h-4 w-4 text-white/30" />
  };

  const trendLabels = {
    improving: "Em recuperação",
    worsening: "Atenção necessária",
    stable: "Estável"
  };

  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="bg-white/5 backdrop-blur-xl border border-white/5 rounded-2xl p-6 hover:bg-white/[0.08] transition-all group relative overflow-hidden"
      onClick={onClick}
    >
      {/* Background Glow */}
      <div className={cn(
        "absolute -top-12 -right-12 w-24 h-24 blur-[40px] rounded-full opacity-10",
        total >= 10 ? "bg-destructive" : "bg-amber-500"
      )} />

      <div className="flex justify-between items-start mb-6">
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-white group-hover:text-primary transition-colors">{tema}</h3>
          <div className="flex items-center gap-2">
            {trendIcons[trend]}
            <span className="text-[10px] uppercase font-bold tracking-widest text-white/40">{trendLabels[trend]}</span>
          </div>
        </div>
        <div className="text-right">
          <div className={cn(
            "text-3xl font-black leading-none",
            total >= 10 ? "text-destructive" : "text-amber-500"
          )}>{total}</div>
          <div className="text-[10px] uppercase font-bold tracking-widest text-white/20">Erros</div>
        </div>
      </div>

      <div className="space-y-3 mb-6">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-white/30">
          <span>Subtemas mais frequentes</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {subtemas.slice(0, 3).map((s, i) => (
            <span key={i} className="px-2 py-1 rounded bg-white/5 border border-white/5 text-[10px] text-white/60 font-medium">
              {s.subtema} ({s.count})
            </span>
          ))}
          {subtemas.length > 3 && (
            <span className="text-[10px] text-white/30 font-bold self-center">+{subtemas.length - 3}</span>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTrain();
          }}
          className="flex-1 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-primary hover:text-white transition-all shadow-glow-sm"
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          Treinar Agora
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            // Action for recommendation
          }}
          className="h-10 w-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all"
          title="Ver recomendação da IA"
        >
          <Sparkles className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}
