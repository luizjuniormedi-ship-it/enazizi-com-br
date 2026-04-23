import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { hapticLight } from "@/lib/haptics";
import { CinematicEmptyState, type CinematicModule } from "@/components/cinematic";
import { MagneticButton } from "@/components/cinematic";

interface ModuleEmptyStateProps {
  /** Ícone emoji legacy — preservado para compat, mas não exibido (substituído pelo EnaziziSymbol) */
  icon?: string;
  title: string;
  description: string;
  steps?: string[];
  actionLabel: string;
  actionPath?: string;
  onAction?: () => void;
  /** Legacy — mapeado para módulo cinematográfico */
  illustration?: "study" | "quiz" | "review" | "clinical" | "achievement";
  /** Override direto: força um módulo específico */
  module?: CinematicModule;
}

/**
 * Mapeamento legacy → módulos cinematográficos.
 * Mantém retrocompatibilidade: cada illustration vira um módulo com hue próprio.
 */
const ILLUSTRATION_TO_MODULE: Record<string, CinematicModule> = {
  study: "tutor",
  quiz: "flashcard",
  review: "simulado",
  clinical: "professor",
  achievement: "ranking",
};

/**
 * ModuleEmptyState — wrapper sobre CinematicEmptyState.
 * Mantém 100% da API antiga. Internamente migrado para o sistema cinematográfico Pixar.
 */
const ModuleEmptyState = ({
  title,
  description,
  steps,
  actionLabel,
  actionPath,
  onAction,
  illustration = "study",
  module,
}: ModuleEmptyStateProps) => {
  const navigate = useNavigate();

  const handleAction = () => {
    hapticLight();
    if (onAction) return onAction();
    if (actionPath) navigate(actionPath);
  };

  const resolvedModule = module ?? ILLUSTRATION_TO_MODULE[illustration] ?? "tutor";

  return (
    <CinematicEmptyState
      module={resolvedModule}
      title={title}
      symbolVariant="neural"
      description={
        <span className="block space-y-4">
          <span className="block">{description}</span>
          {steps && steps.length > 0 && (
            <span className="mt-4 block text-left max-w-sm mx-auto rounded-xl bg-background/40 backdrop-blur-md border border-border/40 p-4 space-y-2.5">
              <span className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Como começar
              </span>
              {steps.map((step, i) => (
                <span key={i} className="flex items-start gap-2.5">
                  <span
                    className="flex-shrink-0 h-5 w-5 rounded-full text-xs font-bold flex items-center justify-center mt-0.5"
                    style={{
                      background: "hsl(var(--module-hue) / 0.18)",
                      color: "hsl(var(--module-hue))",
                    }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-sm text-muted-foreground leading-relaxed">{step}</span>
                </span>
              ))}
            </span>
          )}
        </span>
      }
      action={
        <MagneticButton module={resolvedModule} size="lg" onClick={handleAction} className="gap-2">
          <Sparkles className="h-4 w-4" />
          {actionLabel}
        </MagneticButton>
      }
    />
  );
};

export default ModuleEmptyState;
