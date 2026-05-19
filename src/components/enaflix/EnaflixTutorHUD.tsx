import { memo, type ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * EnaflixTutorHUD — invólucro holográfico para o Tutor IA (Fase 5).
 * Não substitui o chat, apenas envolve o conteúdo com identidade
 * "IA médica viva" (anel orbital, partículas neurais, glow violeta).
 *
 *   <EnaflixTutorHUD title="Tutor IA" status="thinking">
 *     <ChatMessages />
 *   </EnaflixTutorHUD>
 */
interface Props {
  title?: string;
  subtitle?: string;
  status?: "idle" | "thinking" | "speaking";
  children: ReactNode;
  className?: string;
}

function TutorHUDBase({
  title = "Tutor IA V3",
  subtitle = "Assistente médico cinematográfico",
  status = "idle",
  children,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "relative isolate rounded-[28px] enaflix-glass overflow-hidden",
        className,
      )}
    >
      {/* Orbital ring */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full blur-3xl",
          status === "thinking" && "enaflix-holo-pulse",
        )}
        style={{
          background:
            "radial-gradient(circle, hsl(var(--enaflix-violet) / 0.55), transparent 70%)",
        }}
      />

      {/* Header HUD */}
      <header className="relative flex items-center gap-3 px-5 py-4 border-b border-white/5">
        <span className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-400/30 to-cyan-400/20 ring-1 ring-white/10 pixar-breathe">
          <Sparkles className="h-5 w-5 text-cyan-200" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-foreground truncate">{title}</h3>
            <span className="enaflix-hud-label">AI · LIVE</span>
          </div>
          <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>
        </div>
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            status === "idle" && "bg-muted-foreground/40",
            status === "thinking" && "bg-violet-400 enaflix-holo-pulse",
            status === "speaking" && "bg-cyan-400 enaflix-holo-pulse",
          )}
        />
      </header>

      {/* Body */}
      <div className="relative">{children}</div>
    </div>
  );
}

export const EnaflixTutorHUD = memo(TutorHUDBase);
