import { Sparkles, Eye, CheckCircle2, Film, AlertTriangle, Archive, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const MAP: Record<string, { label: string; icon: React.ReactNode; className: string; glow: string }> = {
  structuring:       { label: "Estruturando IA",       icon: <Sparkles className="h-3 w-3" />,    className: "bg-violet-500/20 text-violet-200 border-violet-400/40",      glow: "shadow-[0_0_20px_-5px_rgba(139,92,246,0.6)]" },
  pending_review:    { label: "Revisão humana",        icon: <Eye className="h-3 w-3" />,         className: "bg-amber-500/20 text-amber-200 border-amber-400/40",         glow: "shadow-[0_0_18px_-5px_rgba(245,158,11,0.5)]" },
  in_production:     { label: "Em produção",           icon: <Film className="h-3 w-3" />,        className: "bg-sky-500/20 text-sky-200 border-sky-400/40",               glow: "shadow-[0_0_18px_-5px_rgba(56,189,248,0.5)]" },
  needs_adjustment:  { label: "Necessita ajuste",      icon: <AlertTriangle className="h-3 w-3" />, className: "bg-orange-500/20 text-orange-200 border-orange-400/40",   glow: "shadow-[0_0_18px_-5px_rgba(249,115,22,0.5)]" },
  ready_to_publish:  { label: "Pronto p/ publicar",    icon: <CheckCircle2 className="h-3 w-3" />, className: "bg-cyan-500/20 text-cyan-200 border-cyan-400/40",          glow: "shadow-[0_0_22px_-5px_rgba(34,211,238,0.6)]" },
  published:         { label: "Publicado",             icon: <CheckCircle2 className="h-3 w-3" />, className: "bg-emerald-500/25 text-emerald-200 border-emerald-400/50", glow: "shadow-[0_0_24px_-5px_rgba(16,185,129,0.7)]" },
  unpublished:       { label: "Despublicado",          icon: <XCircle className="h-3 w-3" />,     className: "bg-white/10 text-white/60 border-white/15",                  glow: "" },
  archived:          { label: "Arquivado",             icon: <Archive className="h-3 w-3" />,     className: "bg-white/10 text-white/60 border-white/15",                  glow: "" },
  rejected:          { label: "Rejeitado",             icon: <XCircle className="h-3 w-3" />,     className: "bg-rose-500/20 text-rose-200 border-rose-400/40",            glow: "shadow-[0_0_18px_-5px_rgba(244,63,94,0.5)]" },
};

export function LessonStatusBadge({ status, className }: { status: string; className?: string }) {
  const cfg = MAP[status] ?? { label: status, icon: <Clock className="h-3 w-3" />, className: "bg-white/10 text-white/60 border-white/15", glow: "" };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md",
        cfg.className,
        cfg.glow,
        className,
      )}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}
