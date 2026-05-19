import { motion } from "framer-motion";
import { Film, Sparkles, CheckCircle2, Clock, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

interface Counter {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent: string;
}

interface Props {
  total: number;
  published: number;
  structuring: number;
  pendingReview: number;
}

export function ProductionHeroHeader({ total, published, structuring, pendingReview }: Props) {
  const counters: Counter[] = [
    { label: "Total", value: total, icon: <Film className="h-4 w-4" />, accent: "text-white" },
    { label: "Publicadas", value: published, icon: <CheckCircle2 className="h-4 w-4" />, accent: "text-emerald-300" },
    { label: "Estruturando", value: structuring, icon: <Sparkles className="h-4 w-4" />, accent: "text-violet-300" },
    { label: "Aguardando", value: pendingReview, icon: <Eye className="h-4 w-4" />, accent: "text-amber-300" },
  ];

  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-violet-950/60 via-[#0a0a12]/80 to-[#0a0a12]/95 px-6 sm:px-10 py-10 sm:py-14 mb-8 backdrop-blur-xl">
      {/* ambient glows */}
      <div className="pointer-events-none absolute -top-32 -left-20 h-72 w-72 rounded-full bg-violet-600/30 blur-[100px] animate-pulse" />
      <div className="pointer-events-none absolute -bottom-32 -right-20 h-72 w-72 rounded-full bg-fuchsia-500/20 blur-[120px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(139,92,246,0.15),_transparent_60%)]" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 max-w-4xl"
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-violet-200 mb-4">
          <Sparkles className="h-3 w-3" /> ENAFLIX • Studio
        </div>
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight bg-gradient-to-r from-white via-white to-violet-200 bg-clip-text text-transparent leading-[1.05]">
          Central de Produção ENAFLIX
        </h1>
        <p className="mt-3 text-sm sm:text-base text-white/60 max-w-2xl">
          Aulas baseadas no comportamento real dos alunos no Tutor IA V3, Questões e Flashcards.
        </p>
      </motion.div>

      <div className="relative z-10 mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {counters.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.06, duration: 0.5 }}
            className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md px-4 py-3 hover:border-white/20 hover:bg-white/10 transition-all"
          >
            <div className={cn("flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest", c.accent)}>
              {c.icon} {c.label}
            </div>
            <div className="mt-1 text-3xl font-black text-white tabular-nums">{c.value}</div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
