import { memo } from "react";
import { motion } from "framer-motion";
import { Play, Film, Clock, Sparkles, Upload, MoreHorizontal } from "lucide-react";
import { LessonStatusBadge } from "./LessonStatusBadge";
import { cn } from "@/lib/utils";

interface Props {
  lesson: any;
  onOpen: (lesson: any) => void;
  index?: number;
}

function LessonProductionCardInner({ lesson, onOpen, index = 0 }: Props) {
  const sc = (lesson.structured_content as any) ?? {};
  const isStructured = !!sc?.title;
  const hasVideo = !!lesson.video_url;
  const checklist = (lesson.quality_checklist as any) ?? {};
  const checklistKeys = ["title_reviewed", "content_reviewed", "video_attached", "no_hallucination", "ready_to_publish"];
  const checklistDone = checklistKeys.filter((k) => !!checklist[k]).length;
  const score = typeof lesson.pedagogical_score === "number"
    ? lesson.pedagogical_score
    : Math.round((checklistDone / checklistKeys.length) * 100);
  const duration = lesson.duration ?? 900;
  const minutes = Math.max(1, Math.floor(duration / 60));

  return (
    <motion.button
      type="button"
      onClick={() => onOpen(lesson)}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.4), duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4 }}
      className="group text-left relative overflow-hidden rounded-2xl border border-white/10 bg-[#13131e]/80 backdrop-blur-xl hover:border-violet-400/40 transition-all duration-500 focus:outline-none focus:ring-2 focus:ring-violet-400/60"
    >
      {/* thumbnail */}
      <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-violet-900/30 via-[#1a1a2e] to-[#0a0a12]">
        {lesson.thumbnail_url ? (
          <img
            src={lesson.thumbnail_url}
            alt={lesson.title || "Aula"}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Film className="h-14 w-14 text-white/10 group-hover:text-violet-400/40 transition-colors duration-500" />
          </div>
        )}

        {/* gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-t from-violet-900/40 via-transparent to-transparent transition-opacity duration-500" />

        {/* play button on hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-500">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 backdrop-blur-md border border-white/20 shadow-2xl">
            <Play className="h-6 w-6 text-white fill-white ml-0.5" />
          </div>
        </div>

        {/* top badges */}
        <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-2">
          <LessonStatusBadge status={lesson.status} />
          {isStructured && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-200 backdrop-blur-md">
              <Sparkles className="h-2.5 w-2.5" /> IA
            </span>
          )}
        </div>

        {/* bottom meta */}
        <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-white/70">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" /> {minutes} min
          </span>
          {hasVideo ? (
            <span className="flex items-center gap-1 text-emerald-300">
              <Film className="h-3 w-3" /> Vídeo
            </span>
          ) : (
            <span className="flex items-center gap-1 text-amber-300">
              <Upload className="h-3 w-3" /> Aguarda upload
            </span>
          )}
        </div>
      </div>

      {/* body */}
      <div className="p-4 space-y-2">
        <div className="text-[10px] font-bold uppercase tracking-widest text-violet-300/80 truncate">
          {lesson.subject || "Medicina"} {lesson.topic ? `· ${lesson.topic}` : ""}
        </div>
        <h3 className="font-black text-base leading-tight text-white line-clamp-2 group-hover:text-violet-200 transition-colors">
          {lesson.title || "Sem título"}
        </h3>
        <p className="text-xs text-white/45 line-clamp-2 min-h-[2rem]">
          {lesson.short_summary || sc?.objective || "Estruturação cinematográfica em andamento."}
        </p>

        <div className="pt-3 mt-2 flex items-center justify-between border-t border-white/5">
          <div className="flex items-center gap-1.5">
            <div className={cn(
              "h-1.5 w-1.5 rounded-full",
              score >= 80 ? "bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]" :
              score >= 50 ? "bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]" :
                            "bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.8)]"
            )} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">
              Score {score}
            </span>
          </div>
          <MoreHorizontal className="h-4 w-4 text-white/30 group-hover:text-white/70 transition-colors" />
        </div>
      </div>
    </motion.button>
  );
}

export const LessonProductionCard = memo(LessonProductionCardInner);
