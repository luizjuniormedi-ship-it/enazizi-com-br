import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  Maximize2,
  Minimize2,
  MoreVertical,
  Plus,
  History,
  HelpCircle,
  LogOut,
  Target,
  ArrowLeft,
  Sparkles,
  Brain,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import tutorAvatar from "@/assets/tutor-avatar-hd.png";

interface CinematicTutorHeroProps {
  isFullscreen: boolean;
  setIsFullscreen: (v: boolean) => void;
  studyStarted: boolean;
  taxaAcerto: number;
  showHistory: boolean;
  setShowHistory: (v: boolean) => void;
  onFinishSession: () => void;
  onNewSession: () => void;
  onShowOnboarding: () => void;
}

/**
 * CinematicTutorHero — header cinematográfico do Tutor IA.
 *
 * Substitui o TutorHeader chato por uma experiência de "mentor vivo":
 *  - Ambient glow roxo (hue-tutor)
 *  - Avatar com ring pulsante e float discreto
 *  - Status de sessão (online + presença)
 *  - Performance ring quando estudando
 *  - Atmosfera calma e focada (Apple + Pixar)
 */
export const CinematicTutorHero: React.FC<CinematicTutorHeroProps> = ({
  isFullscreen,
  setIsFullscreen,
  studyStarted,
  taxaAcerto,
  showHistory,
  setShowHistory,
  onFinishSession,
  onNewSession,
  onShowOnboarding,
}) => {
  const navigate = useNavigate();

  const performanceTone =
    taxaAcerto >= 75
      ? "text-success"
      : taxaAcerto >= 50
      ? "text-warning"
      : "text-destructive";

  return (
    <header
      className={cn(
        "relative overflow-hidden rounded-2xl mb-3",
        "glass-premium animate-fade-in",
      )}
      style={{ ["--module-hue" as never]: "var(--hue-tutor)" } as React.CSSProperties}
    >
      {/* Ambient glow — calmo, focado */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            "radial-gradient(ellipse at 15% 50%, hsl(var(--module-hue) / 0.18), transparent 55%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 right-1/4 h-40 w-40 rounded-full blur-3xl opacity-40"
        style={{ background: "hsl(var(--module-hue) / 0.35)" }}
      />

      <div className="relative flex items-center justify-between gap-3 px-3 py-2.5 sm:px-4 sm:py-3">
        {/* Lado esquerdo — Avatar premium + identidade */}
        <div className="min-w-0 flex-1 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard")}
            className="h-9 w-9 flex-shrink-0 rounded-xl hover:bg-white/5"
            title="Voltar ao Dashboard"
            aria-label="Voltar ao Dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          {/* Avatar com aura cinematográfica */}
          <div className="relative flex-shrink-0">
            {/* Halo pulsante */}
            <div
              aria-hidden
              className="absolute inset-0 rounded-2xl blur-xl opacity-60 animate-pulse"
              style={{
                background:
                  "radial-gradient(circle, hsl(var(--module-hue) / 0.6), transparent 70%)",
              }}
            />
            {/* Ring elegante */}
            <div
              className={cn(
                "relative h-12 w-12 sm:h-14 sm:w-14 rounded-2xl overflow-hidden flex items-center justify-center",
                "ring-2 ring-white/15",
                "shadow-[0_8px_24px_-6px_hsl(var(--module-hue)/0.4)]",
                "transition-transform duration-700",
                "[transition-timing-function:var(--ease-out-expo)]",
                "hover:scale-105",
                "bg-primary/20 p-1.5",
              )}
              style={{
                animation: "float 6s ease-in-out infinite",
              }}
            >
              <img
                src="/src/assets/enazizi-mascot.png"
                alt="Tutor IA"
                className="h-full w-full object-contain"
              />
            </div>
            {/* Status dot — presença viva */}
            <span
              aria-hidden
              className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-success ring-2 ring-background animate-pulse"
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm sm:text-base font-bold truncate text-foreground">
                Tutor IA
              </h1>
              <Sparkles
                className="h-3 w-3 flex-shrink-0"
                style={{ color: "hsl(var(--module-hue))" }}
              />
            </div>
            <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-muted-foreground">
              <Brain className="h-3 w-3" />
              <span className="truncate">Mentor inteligente • Protocolo ENAZIZI</span>
            </div>
          </div>
        </div>

        {/* Lado direito — Performance + ações */}
        <div className="flex gap-1.5 flex-shrink-0 items-center">
          {studyStarted && (
            <div
              className={cn(
                "hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full",
                "glass-premium border-module",
                "text-[11px] font-bold tabular-nums",
                performanceTone,
              )}
              title={`Taxa de acerto: ${taxaAcerto}%`}
            >
              <Target className="h-3 w-3" />
              <span>{taxaAcerto}%</span>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/dashboard")}
            className="h-8 gap-1 hidden sm:flex"
            title="Sair do Tutor"
          >
            <LogOut className="h-3.5 w-3.5" /> Sair
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="h-8 w-8"
            title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
            aria-label={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                aria-label="Mais opções"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="glass-premium">
              {studyStarted && (
                <DropdownMenuItem
                  onClick={onFinishSession}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="h-4 w-4 mr-2" /> Finalizar sessão
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onNewSession}>
                <Plus className="h-4 w-4 mr-2" /> Nova sessão
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowHistory(!showHistory)}>
                <History className="h-4 w-4 mr-2" /> Histórico
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onShowOnboarding}>
                <HelpCircle className="h-4 w-4 mr-2" /> Como usar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default CinematicTutorHero;
