/**
 * UnifiedMissionHero
 * Hero único e canônico da plataforma. Substitui (gradualmente):
 *   - DashboardHero
 *   - CinematicMissionHero
 *   - MissionHeroAnimated
 *   - CockpitHero
 *
 * Princípio: 1 CTA principal derivado de useStudyNext().
 * Não inventa frases; se não houver recomendação real, usa fallback honesto.
 */
import { motion } from "framer-motion";
import { Rocket, Clock, Brain } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Enaflix3DButton } from "@/components/enaflix/Enaflix3DButton";
import { EnaflixBadge } from "@/components/enaflix/EnaflixBadge";

interface UnifiedMissionHeroProps {
  firstName: string;
  recommendationTitle?: string | null;
  recommendationDescription?: string | null;
  adaptiveJustification?: string | null;
  primaryHref?: string;
  secondaryHref?: string;
  posterUrl?: string;
}

const FALLBACK_TITLE = "Continuar revisão inteligente";
const FALLBACK_DESC = "Vamos retomar pelo que mais importa hoje.";

export function UnifiedMissionHero({
  firstName,
  recommendationTitle,
  recommendationDescription,
  adaptiveJustification,
  primaryHref = "/dashboard/sessao-estudo?source=dashboard_hero",
  secondaryHref = "/dashboard/flashcards",
  posterUrl = "https://images.unsplash.com/photo-1576091160550-2173bdb999ef?q=80&w=2000&auto=format&fit=crop",
}: UnifiedMissionHeroProps) {
  const navigate = useNavigate();
  const title = recommendationTitle?.trim() || FALLBACK_TITLE;
  const desc = recommendationDescription?.trim() || FALLBACK_DESC;

  return (
    <div className="px-4 sm:px-8 lg:px-14">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8 }}
        className="relative min-h-[420px] sm:min-h-[460px] rounded-[40px] overflow-hidden flex items-end p-6 sm:p-12 lg:p-16 group"
        data-testid="unified-mission-hero"
      >
        <div className="absolute inset-0">
          <img
            src={posterUrl}
            alt="Missão"
            className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050508] via-[#050508]/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#050508]/80 via-transparent to-transparent" />
        </div>

        <div className="relative z-10 max-w-3xl space-y-6">
          <div className="flex flex-col gap-2">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3"
            >
              <EnaflixBadge type="ia" className="bg-primary/20 text-primary border-primary/40" />
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/50">
                Missão de hoje
              </span>
            </motion.div>
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tighter text-white leading-[0.95] drop-shadow-2xl">
              Olá, <span className="gradient-text">{firstName}</span>
            </h1>
            <p className="text-base sm:text-xl text-white/80 font-medium max-w-xl leading-tight">
              {title} — {desc}
            </p>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <Enaflix3DButton
              size="lg"
              glow
              iconLeft={<Rocket className="h-5 w-5" />}
              onClick={() => navigate(primaryHref)}
            >
              Continuar missão
            </Enaflix3DButton>
            <Enaflix3DButton
              variant="outline"
              size="lg"
              iconLeft={<Clock className="h-5 w-5" />}
              onClick={() => navigate(secondaryHref)}
            >
              Ver revisões
            </Enaflix3DButton>

            {adaptiveJustification && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
                <Brain className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold text-white/70 italic">
                  {adaptiveJustification}
                </span>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default UnifiedMissionHero;
