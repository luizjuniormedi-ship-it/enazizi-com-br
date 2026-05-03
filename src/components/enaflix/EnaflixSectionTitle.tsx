import { memo, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * EnaflixSectionTitle — título cinematográfico de seção (Fase 5).
 * Compatível com layout Netflix-style (poster rows + dashboards).
 *
 *   <EnaflixSectionTitle
 *      kicker="Tutor IA"
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
        "flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8",
        align === "center" && "items-center text-center",
        className,
      )}
    >
      <div className="min-w-0 space-y-2">
        {kicker && (
          <div className="flex items-center gap-3 mb-1">
            <div className="h-1 w-8 bg-gradient-to-r from-primary to-accent rounded-full" />
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40">{kicker}</span>
          </div>
        )}
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tighter text-white leading-none drop-shadow-2xl">
          {title}
        </h2>
        {subtitle && (
          <p className="text-base text-white/50 font-medium max-w-2xl leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0 relative z-10">{action}</div>}
    </div>
  );
}

export const EnaflixSectionTitle = memo(SectionTitleBase);
