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
        "flex items-end justify-between gap-4 mb-4",
        align === "center" && "flex-col items-center text-center",
        className,
      )}
    >
      <div className="min-w-0">
        {kicker && <div className="enaflix-hud-label mb-1">{kicker}</div>}
        <h2 className="enaflix-section-title">{title}</h2>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export const EnaflixSectionTitle = memo(SectionTitleBase);
