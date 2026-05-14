/**
 * WelcomeBackScreen - Refined for Enterprise FUX
 * Minimalist, high-impact screen for returning or new users needing context.
 */
import { Rocket, Sparkles, Brain, CheckCircle2 } from "lucide-react";
import { Enaflix3DButton } from "@/components/enaflix/Enaflix3DButton";
import { motion } from "framer-motion";

const WelcomeBackScreen = ({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) => {
  return (
    <div className="min-h-screen bg-[#050508] flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
      
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md space-y-8 relative z-10"
      >
        <div className="space-y-4">
          <div className="h-20 w-20 rounded-[2rem] bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto shadow-glow-sm">
            <Sparkles className="h-10 w-10 text-primary animate-pulse" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-white uppercase italic">
            O Futuro é <span className="gradient-text">Adaptativo</span>
          </h1>
          <p className="text-white/60 font-medium leading-relaxed">
            Seja bem-vindo ao ENAFLIX Studio. Nossa IA acaba de reconstruir sua trilha de estudo baseada nos exames mais recentes.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {[
            { icon: Brain, label: "Conteúdo Personalizado" },
            { icon: CheckCircle2, label: "Foco no que cai na prova" },
            { icon: Rocket, label: "Otimização de tempo real" }
          ].map((item, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/5"
            >
              <item.icon className="h-5 w-5 text-primary" />
              <span className="text-[11px] font-black uppercase tracking-widest text-white/80">{item.label}</span>
            </motion.div>
          ))}
        </div>

        <div className="pt-4 space-y-4">
          <Enaflix3DButton size="lg" glow onClick={onStart} className="w-full">
            Iniciar Configuração
          </Enaflix3DButton>
          <button 
            onClick={onSkip}
            className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 hover:text-white transition-colors"
          >
            Pular e ir ao Dashboard
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default WelcomeBackScreen;