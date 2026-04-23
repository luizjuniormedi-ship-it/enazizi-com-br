import type { EnaflixBadge } from "./enaflixModules";

interface BadgeStyle {
  label: string;
  className: string;
}

/**
 * Estilos visuais dos badges do Enaflix.
 * Apenas tokens semânticos (sem cores cruas).
 */
export const ENAFLIX_BADGE_STYLES: Record<EnaflixBadge, BadgeStyle> = {
  novo: {
    label: "NOVO",
    className: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  },
  ia: {
    label: "IA",
    className: "bg-violet-500/20 text-violet-300 border-violet-500/40",
  },
  recomendado: {
    label: "RECOMENDADO",
    className: "bg-primary/20 text-primary border-primary/40",
  },
  "em-alta": {
    label: "EM ALTA",
    className: "bg-pink-500/20 text-pink-300 border-pink-500/40",
  },
  urgente: {
    label: "URGENTE",
    className: "bg-destructive/20 text-destructive border-destructive/40",
  },
  premium: {
    label: "PREMIUM",
    className: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  },
  "em-breve": {
    label: "EM BREVE",
    className: "bg-muted text-muted-foreground border-border",
  },
};

/**
 * Mapeia o accent visual do card para um gradiente sutil.
 * Usa tokens HSL via classes utilitárias do Tailwind.
 */
export const ENAFLIX_ACCENT_GRADIENTS: Record<string, string> = {
  primary: "from-primary/30 via-primary/10 to-transparent",
  warning: "from-amber-500/30 via-amber-500/10 to-transparent",
  success: "from-emerald-500/30 via-emerald-500/10 to-transparent",
  destructive: "from-destructive/30 via-destructive/10 to-transparent",
  info: "from-sky-500/30 via-sky-500/10 to-transparent",
  purple: "from-violet-500/30 via-violet-500/10 to-transparent",
  pink: "from-pink-500/30 via-pink-500/10 to-transparent",
};
