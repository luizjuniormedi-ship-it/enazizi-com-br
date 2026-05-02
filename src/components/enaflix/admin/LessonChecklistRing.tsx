import { Check, Circle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

const ITEMS: Array<[string, string]> = [
  ["title_reviewed", "Título revisado"],
  ["content_reviewed", "Conteúdo revisado"],
  ["video_attached", "Vídeo anexado"],
  ["no_hallucination", "Sem alucinação"],
  ["ready_to_publish", "Pronto para publicar"],
];

interface Props {
  checklist: Record<string, boolean>;
  onToggle: (key: string) => void;
  disabled?: boolean;
}

export function LessonChecklistRing({ checklist, onToggle, disabled }: Props) {
  const completed = ITEMS.filter(([k]) => !!checklist[k]).length;
  const total = ITEMS.length;
  const pct = Math.round((completed / total) * 100);
  const r = 28;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  const ringColor = pct === 100 ? "stroke-emerald-400" : pct >= 60 ? "stroke-cyan-400" : "stroke-violet-400";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4">
      <div className="flex items-center gap-4">
        <div className="relative h-20 w-20 shrink-0">
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r={r} className="stroke-white/10" strokeWidth="6" fill="none" />
            <circle
              cx="40"
              cy="40"
              r={r}
              className={cn(ringColor, "transition-all duration-700")}
              strokeWidth="6"
              fill="none"
              strokeDasharray={`${dash} ${c}`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-black text-white tabular-nums">{pct}%</span>
            <span className="text-[8px] font-bold uppercase tracking-widest text-white/40">{completed}/{total}</span>
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-white/50">Checklist editorial</div>
          <div className="text-sm font-bold text-white mt-0.5">
            {pct === 100 ? "Pronto para publicar" : "Curadoria em andamento"}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-1.5">
        {ITEMS.map(([key, label]) => {
          const done = !!checklist[key];
          return (
            <label
              key={key}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs transition-colors cursor-pointer",
                "hover:bg-white/5",
                done ? "text-white" : "text-white/55",
                disabled && "opacity-60 cursor-not-allowed",
              )}
            >
              <Checkbox
                checked={done}
                onCheckedChange={() => !disabled && onToggle(key)}
                disabled={disabled}
                className="border-white/30 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
              />
              <span className={cn(done && "line-through decoration-emerald-400/40")}>{label}</span>
              {done ? (
                <Check className="ml-auto h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Circle className="ml-auto h-3 w-3 text-white/20" />
              )}
            </label>
          );
        })}
      </div>
    </div>
  );
}
