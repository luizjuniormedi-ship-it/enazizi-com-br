import { motion } from "framer-motion";
import { FileText, Clock, Play, BarChart3, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  subtitle: string;
  count: number;
  timeMinutes: number;
  difficulty?: "facil" | "intermediario" | "dificil" | "misto";
  image?: string;
  badge?: string;
  onClick: () => void;
  dataTestId?: string;
  "data-testid"?: string;
}

export function SimuladoProfileCard({ title, subtitle, count, timeMinutes, difficulty, image, badge, onClick, dataTestId, "data-testid": dataTestIdAttr }: Props) {
  const diffLabels = {
    facil: "Iniciante",
    intermediario: "Intermediário",
    dificil: "Avançado",
    misto: "Misto"
  };

  return (
    <motion.div
      whileHover={{ y: -5, scale: 1.02 }}
      className="group relative flex-shrink-0 w-[300px] h-[200px] cursor-pointer overflow-hidden rounded-2xl bg-[#1a1a1e] border border-white/5 transition-all duration-500"
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      role="button"
      tabIndex={0}
      data-testid={dataTestId || dataTestIdAttr}
      aria-label={`Gerar simulado: ${title}`}
    >
      {/* Thumbnail */}
      {image ? (
        <img
          src={image}
          alt={title}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-60"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1a1a1e] to-[#2a2a2e]">
          <FileText className="h-12 w-12 text-white/5" />
        </div>
      )}

      {/* Overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

      {/* Badge */}
      {badge && (
        <div className="absolute left-4 top-4">
          <span className="rounded-full bg-primary/90 px-3 py-1 text-[9px] font-black uppercase tracking-[0.15em] text-white backdrop-blur-md shadow-glow-sm">
            {badge}
          </span>
        </div>
      )}

      {/* Content */}
      <div className="absolute inset-0 flex flex-col justify-end p-5">
        <div className="space-y-1">
          <h3 className="font-black text-lg leading-tight text-white line-clamp-1 group-hover:text-primary transition-colors">
            {title}
          </h3>
          <p className="text-xs text-white/50 line-clamp-1 font-medium">
            {subtitle}
          </p>
          
          <div className="flex items-center gap-4 pt-2 border-t border-white/5 mt-2">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-white/40 uppercase tracking-widest">
              <FileText className="h-3 w-3" />
              {count} questões
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-white/40 uppercase tracking-widest">
              <Clock className="h-3 w-3" />
              {timeMinutes} min
            </div>
            {difficulty && (
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-white/40 uppercase tracking-widest">
                <BarChart3 className="h-3 w-3" />
                {diffLabels[difficulty]}
              </div>
            )}
          </div>
        </div>

        {/* Play Button Hover */}
        <div className="absolute right-5 bottom-5 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
          <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center shadow-glow-md">
            <Play className="h-4 w-4 text-white fill-current" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
