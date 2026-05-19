import { memo, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

/**
 * EnaflixSectionTitle — título cinematográfico de seção (Fase 5).
 * Compatível com layout Netflix-style (poster rows + dashboards).
 *
 *   <EnaflixSectionTitle
 *      kicker="Tutor IA V3"
 *      title="Continue de onde parou"
 *      action={<Button>Ver tudo</Button>}
 *   />
 */
interface Props {
  kicker?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  align?: "left" | "center";
  className?: string;
}

function SectionTitleBase({
  kicker,
  title,
  subtitle,
  action,
  align = "left",
  className,
}: Props) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-10",
        align === "center" && "items-center text-center",
        className,
      )}
    >
      <div className="min-w-0 space-y-3">
        {kicker && (
          <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-4 mb-2"
          >
            <div className="h-[2px] w-12 bg-gradient-to-r from-primary via-primary to-transparent rounded-full shadow-[0_0_10px_hsl(var(--primary))]" />
            <span className="text-[10px] font-black uppercase tracking-[0.5em] text-white/50">{kicker}</span>
          </motion.div>
        )}
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter text-white leading-[0.9] drop-shadow-[0_4px_12px_rgba(0,0,0,1)]">
          {title}
        </h2>
        {subtitle && (
          <p className="text-lg text-white/40 font-medium max-w-3xl leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
      {action && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="shrink-0 relative z-10"
        >
          {action}
        </motion.div>
      )}
    </div>
  );
}

export const EnaflixSectionTitle = memo(SectionTitleBase);
