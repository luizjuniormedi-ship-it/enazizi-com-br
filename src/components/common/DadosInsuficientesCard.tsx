/**
 * DadosInsuficientesCard
 * Fallback honesto para quando um widget não tem dados reais para mostrar.
 * Substitui simulações, Math.random() e cards hardcoded por uma mensagem clara.
 */
import { Sparkles } from "lucide-react";
import { motion } from "framer-motion";

interface DadosInsuficientesCardProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  className?: string;
}

export const DadosInsuficientesCard = ({
  title = "Análise ainda em construção",
  description = "Continue estudando para desbloquear métricas personalizadas.",
  icon,
  className = "",
}: DadosInsuficientesCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`p-6 rounded-3xl bg-white/[0.02] border border-white/[0.06] flex items-start gap-4 ${className}`}
    >
      <div className="h-10 w-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
        {icon ?? <Sparkles className="h-4 w-4 text-primary/70" />}
      </div>
      <div className="space-y-1">
        <h4 className="text-sm font-bold text-white/80">{title}</h4>
        <p className="text-xs text-white/50 leading-relaxed">{description}</p>
      </div>
    </motion.div>
  );
};

export default DadosInsuficientesCard;
