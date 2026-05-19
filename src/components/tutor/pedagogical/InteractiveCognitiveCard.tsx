
import { motion } from "framer-motion";
import { Brain, Check, Search, Zap, HelpCircle, MinusCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PedagogicalAction = 'continue' | 'deepen' | 'analogy' | 'clinical' | 'simplify';

interface InteractiveCognitiveCardProps {
  onAction: (action: PedagogicalAction) => void;
  comprehensionScore?: number;
}

export function InteractiveCognitiveCard({ onAction, comprehensionScore = 85 }: InteractiveCognitiveCardProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="mt-8 mb-4 flex flex-col items-center gap-6 py-10 px-8 rounded-[40px] bg-black/40 border border-primary/30 backdrop-blur-2xl shadow-[0_0_50px_rgba(var(--primary),0.1)] relative overflow-hidden group"
    >
      {/* Background FX */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
      
      <div className="flex items-center gap-4 text-primary relative z-10">
        <div className="p-3 rounded-2xl bg-primary/10 ring-1 ring-primary/20">
          <Brain className="h-7 w-7 animate-pulse" />
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-[0.3em]">Gating Pedagógico Ativo</span>
          <span className="text-xl font-black tracking-tighter text-white">Consolidação de Raciocínio</span>
        </div>
      </div>

      <p className="text-center text-white/60 text-sm max-w-md relative z-10 leading-relaxed">
        O Tutor interrompeu o avanço para garantir que a base fisiopatológica esteja sólida. 
        Como você prefere prosseguir com este tema?
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full relative z-10">
        <ActionButton 
          icon={Check} 
          label="Entendi, Próxima Etapa" 
          onClick={() => onAction('continue')} 
          primary
        />
        <ActionButton 
          icon={Search} 
          label="Quero Aprofundar" 
          onClick={() => onAction('deepen')} 
        />
        <ActionButton 
          icon={Zap} 
          label="Ver Analogia" 
          onClick={() => onAction('analogy')} 
        />
        <ActionButton 
          icon={HelpCircle} 
          label="Exemplo Clínico" 
          onClick={() => onAction('clinical')} 
        />
        <ActionButton 
          icon={MinusCircle} 
          label="Simplificar" 
          onClick={() => onAction('simplify')} 
        />
        
        {/* State Indicator */}
        <div className="flex flex-col justify-center px-6 py-4 rounded-3xl bg-white/5 border border-white/5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-bold uppercase tracking-widest text-white/40">Entendimento</span>
            <span className="text-[10px] font-bold text-primary">{comprehensionScore}%</span>
          </div>
          <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${comprehensionScore}%` }}
              className="h-full bg-primary"
            />
          </div>
        </div>
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 opacity-30">
        <div className="h-1 w-1 rounded-full bg-primary animate-ping" />
        <span className="text-[8px] font-bold uppercase tracking-widest">Aguardando Validação Socrática</span>
      </div>
    </motion.div>
  );
}

function ActionButton({ icon: Icon, label, onClick, primary = false }: { 
  icon: any, 
  label: string, 
  onClick: () => void,
  primary?: boolean 
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-5 py-4 rounded-3xl transition-all duration-300 group/btn border",
        primary 
          ? "bg-primary text-white border-white/20 hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(var(--primary),0.3)]" 
          : "bg-white/5 text-white/70 border-white/5 hover:bg-white/10 hover:border-white/10 hover:text-white"
      )}
    >
      <Icon className={cn("h-4 w-4 transition-transform group-hover/btn:scale-110", primary ? "text-white" : "text-primary")} />
      <span className="text-xs font-bold tracking-tight">{label}</span>
      {primary && <ArrowRight className="ml-auto h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />}
    </button>
  );
}
