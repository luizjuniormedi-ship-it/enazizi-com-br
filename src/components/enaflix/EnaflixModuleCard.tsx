import { useNavigate } from "react-router-dom";
import { ArrowRight, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { ENAFLIX_ACCENT_GRADIENTS } from "@/data/enaflix/enaflixBadges";
import type { EnaflixModule } from "@/data/enaflix/enaflixModules";
import { EnaflixBadge } from "./EnaflixBadge";

interface Props {
  module: EnaflixModule;
  /** Quando true, marca como bloqueado (sem rota / em breve) */
  comingSoon?: boolean;
  onNavigate?: (m: EnaflixModule) => void;
}

export function EnaflixModuleCard({ module, comingSoon, onNavigate }: Props) {
  const navigate = useNavigate();
  const Icon = module.icon;
  const accent = module.accent ?? "primary";
  const gradient = ENAFLIX_ACCENT_GRADIENTS[accent] ?? ENAFLIX_ACCENT_GRADIENTS.primary;
  const disabled = comingSoon || !module.route;
  const badge = disabled ? "em-breve" : module.badge;

  const handleClick = () => {
    if (disabled || !module.route) return;
    onNavigate?.(module);
    navigate(module.route);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      aria-label={`${module.title} — ${module.description}`}
      className={cn(
        "group relative shrink-0 w-[220px] sm:w-[260px] h-[150px] sm:h-[170px]",
        "rounded-2xl overflow-hidden text-left",
        "bg-gradient-to-br from-white/[0.07] to-white/[0.02]",
        "border border-white/10",
        "transition-all duration-300 ease-out",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        disabled
          ? "opacity-60 cursor-not-allowed"
          : "hover:scale-[1.04] hover:border-white/25 hover:shadow-2xl hover:shadow-primary/20 cursor-pointer",
      )}
    >
      {/* Accent gradient overlay */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-80 transition-opacity duration-300 group-hover:opacity-100",
          gradient,
        )}
      />
      {/* Glow on hover */}
      <div
        aria-hidden
        className={cn(
          "absolute -inset-px rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100 pointer-events-none",
          "bg-gradient-to-br from-primary/30 via-transparent to-transparent blur-xl",
        )}
      />

      {/* Conteúdo */}
      <div className="relative h-full flex flex-col justify-between p-4">
        <div className="flex items-start justify-between gap-2">
          <div
            className={cn(
              "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
              "bg-white/10 backdrop-blur-sm border border-white/15",
              "transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-4deg]",
            )}
          >
            <Icon className="h-5 w-5 text-white drop-shadow" />
          </div>
          {badge && <EnaflixBadge type={badge} />}
        </div>

        <div className="space-y-1">
          <h3 className="text-base font-bold text-white leading-tight line-clamp-1 drop-shadow">
            {module.title}
          </h3>
          <p className="text-xs text-white/70 line-clamp-2 leading-snug">{module.description}</p>
        </div>

        {/* CTA arrow */}
        <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
          {disabled ? (
            <Lock className="h-4 w-4 text-white/70" />
          ) : (
            <ArrowRight className="h-4 w-4 text-white" />
          )}
        </div>
      </div>
    </button>
  );
}
