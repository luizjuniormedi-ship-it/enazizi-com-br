import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type AgentAccent =
  | "primary"
  | "warning"
  | "success"
  | "destructive"
  | "info"
  | "purple"
  | "pink"
  | "amber"
  | "rose"
  | "teal"
  | "violet";

interface Props {
  to: string;
  icon: LucideIcon;
  title: string;
  description: string;
  accent?: AgentAccent;
  isNew?: boolean;
  highlight?: boolean;
  /** Tag pequena no topo (ex: "Principal", "Novo agente") */
  badge?: string;
}

/**
 * Halo radial por accent — desenha o glow volumétrico no canto superior direito.
 * Mesmo padrão do EnaflixModuleCard mas calibrado para grid de agentes (cards menores).
 */
const ACCENT_HALO: Record<AgentAccent, string> = {
  primary: "bg-[radial-gradient(circle_at_80%_20%,hsl(var(--primary)/0.50),transparent_60%)]",
  warning: "bg-[radial-gradient(circle_at_80%_20%,hsl(38_92%_50%/0.50),transparent_60%)]",
  success: "bg-[radial-gradient(circle_at_80%_20%,hsl(160_84%_39%/0.50),transparent_60%)]",
  destructive: "bg-[radial-gradient(circle_at_80%_20%,hsl(var(--destructive)/0.50),transparent_60%)]",
  info: "bg-[radial-gradient(circle_at_80%_20%,hsl(199_89%_48%/0.50),transparent_60%)]",
  purple: "bg-[radial-gradient(circle_at_80%_20%,hsl(262_83%_58%/0.50),transparent_60%)]",
  pink: "bg-[radial-gradient(circle_at_80%_20%,hsl(330_81%_60%/0.50),transparent_60%)]",
  amber: "bg-[radial-gradient(circle_at_80%_20%,hsl(38_92%_50%/0.50),transparent_60%)]",
  rose: "bg-[radial-gradient(circle_at_80%_20%,hsl(346_77%_60%/0.50),transparent_60%)]",
  teal: "bg-[radial-gradient(circle_at_80%_20%,hsl(173_80%_40%/0.50),transparent_60%)]",
  violet: "bg-[radial-gradient(circle_at_80%_20%,hsl(262_83%_58%/0.50),transparent_60%)]",
};

const ACCENT_RIM: Record<AgentAccent, string> = {
  primary: "shadow-[0_0_50px_-12px_hsl(var(--primary)/0.65)]",
  warning: "shadow-[0_0_50px_-12px_hsl(38_92%_50%/0.65)]",
  success: "shadow-[0_0_50px_-12px_hsl(160_84%_39%/0.65)]",
  destructive: "shadow-[0_0_50px_-12px_hsl(var(--destructive)/0.65)]",
  info: "shadow-[0_0_50px_-12px_hsl(199_89%_48%/0.65)]",
  purple: "shadow-[0_0_50px_-12px_hsl(262_83%_58%/0.65)]",
  pink: "shadow-[0_0_50px_-12px_hsl(330_81%_60%/0.65)]",
  amber: "shadow-[0_0_50px_-12px_hsl(38_92%_50%/0.65)]",
  rose: "shadow-[0_0_50px_-12px_hsl(346_77%_60%/0.65)]",
  teal: "shadow-[0_0_50px_-12px_hsl(173_80%_40%/0.65)]",
  violet: "shadow-[0_0_50px_-12px_hsl(262_83%_58%/0.65)]",
};

const ACCENT_ICON: Record<AgentAccent, string> = {
  primary: "text-primary",
  warning: "text-amber-300",
  success: "text-emerald-300",
  destructive: "text-red-300",
  info: "text-sky-300",
  purple: "text-violet-300",
  pink: "text-pink-300",
  amber: "text-amber-300",
  rose: "text-rose-300",
  teal: "text-teal-300",
  violet: "text-violet-300",
};

/**
 * AgentPosterCard — cartão "poster" cinematográfico Pixar/Disney+/Netflix.
 *
 * Camadas:
 *  1. Background base profundo
 *  2. Halo radial por accent (canto superior direito)
 *  3. Vinheta inferior (legibilidade)
 *  4. Noise overlay sutil
 *  5. Shine sweep no hover
 *  6. Conteúdo (icone flutuante, título, descrição, CTA)
 *
 * Motion:
 *  - Tilt 3D ±5deg seguindo o mouse (desktop apenas)
 *  - Hover lift + glow rim por accent
 *  - Float idle no ícone
 *  - Desabilitado em pointer:coarse e prefers-reduced-motion
 */
export function AgentPosterCard({
  to,
  icon: Icon,
  title,
  description,
  accent = "primary",
  isNew,
  highlight,
  badge,
}: Props) {
  const halo = ACCENT_HALO[accent];
  const rim = ACCENT_RIM[accent];
  const iconColor = ACCENT_ICON[accent];

  const cardRef = useRef<HTMLAnchorElement>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, hovered: false });

  // Delay determinístico para o float idle
  const floatDelay = `${(title.charCodeAt(0) % 8) * 0.18}s`;

  const handleMouseMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const ry = (px - 0.5) * 10;
    const rx = (0.5 - py) * 7;
    setTilt({ rx, ry, hovered: true });
  };

  const handleMouseLeave = () => setTilt({ rx: 0, ry: 0, hovered: false });

  return (
    <Link
      ref={cardRef}
      to={to}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      aria-label={`${title} — ${description}`}
      className={cn(
        "group relative block overflow-hidden rounded-2xl text-left isolate",
        "min-h-[210px] p-5",
        "bg-[#0a0a12] border border-white/[0.08]",
        "transition-[transform,box-shadow,border-color] duration-500 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)]",
        "[transform-style:preserve-3d] will-change-transform",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "hover:border-white/25 cursor-pointer",
        `hover:${rim}`,
        highlight && "ring-1 ring-primary/40 border-primary/30",
      )}
      style={{
        transform: tilt.hovered
          ? `perspective(900px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) translateY(-4px) scale(1.02)`
          : "perspective(900px) rotateX(0) rotateY(0) translateY(0) scale(1)",
      }}
    >
      {/* Halo radial por accent */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 mix-blend-screen opacity-60 transition-opacity duration-500",
          "group-hover:opacity-90",
          halo,
        )}
      />

      {/* Vinheta inferior */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/60 via-black/15 to-transparent pointer-events-none"
      />

      {/* Noise overlay */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.05] pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />

      {/* Shine sweep no hover */}
      <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className={cn(
            "absolute inset-y-0 left-0 w-1/2 -skew-x-12",
            "bg-gradient-to-r from-transparent via-white/15 to-transparent",
            "-translate-x-[120%] opacity-0",
            "group-hover:opacity-100 group-hover:animate-shine-sweep",
          )}
        />
      </div>

      {/* Badges */}
      {(isNew || badge) && (
        <div className="absolute top-3 right-3 z-10 flex gap-1.5">
          {badge && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-white">
              {badge}
            </span>
          )}
          {isNew && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-primary-foreground shadow-lg">
              NOVO
            </span>
          )}
        </div>
      )}

      {/* Conteúdo */}
      <div
        className="relative h-full flex flex-col z-10"
        style={{ transform: tilt.hovered ? "translateZ(28px)" : undefined }}
      >
        {/* Icon flutuante */}
        <div
          className={cn(
            "h-12 w-12 rounded-xl flex items-center justify-center mb-4",
            "bg-white/10 backdrop-blur-md border border-white/15",
            "shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)]",
            "transition-all duration-500 group-hover:scale-110 group-hover:-rotate-3",
          )}
          style={{ animation: `float 6s ease-in-out infinite`, animationDelay: floatDelay }}
        >
          <Icon className={cn("h-6 w-6 drop-shadow-lg", iconColor)} />
        </div>

        <div className="flex-1 space-y-2">
          <h3 className="text-base font-bold text-white leading-tight tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]">
            {title}
          </h3>
          <p className="text-sm text-white/75 leading-relaxed line-clamp-3 drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)]">
            {description}
          </p>
        </div>

        {/* CTA */}
        <div className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-white opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-[-4px] group-hover:translate-x-0">
          <span>Acessar agente</span>
          <ArrowRight className="h-4 w-4" />
        </div>
      </div>
    </Link>
  );
}
