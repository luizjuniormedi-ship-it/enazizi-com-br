import { memo } from "react";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Props {
  q: any;
  globalIdx: number;
  block: string;
  isExpanded: boolean;
  onToggleExpand: (idx: number) => void;
  onRemove: (idx: number) => void;
}

/**
 * Item individual de questão no preview. Memoizado com comparator
 * que verifica apenas as props relevantes — expandir uma questão
 * não rerenderiza as outras.
 */
const SimuladoQuestionItem = memo(
  function SimuladoQuestionItem({ q, globalIdx, block, isExpanded, onToggleExpand, onRemove }: Props) {
    return (
      <div
        className={`bg-white/5 border border-white/5 rounded-2xl text-xs transition-all overflow-hidden ${
          isExpanded ? "ring-1 ring-primary/30 border-primary/20" : ""
        }`}
      >
        <div
          className="p-4 flex items-start justify-between gap-3 cursor-pointer hover:bg-white/5 transition-colors"
          onClick={() => onToggleExpand(globalIdx)}
        >
          <div className="min-w-0 flex-1">
            <p className="font-bold uppercase tracking-tight mb-2 line-clamp-2 opacity-90 group-hover:opacity-100 transition-opacity">
              Q{globalIdx + 1}: {q.statement}
            </p>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge variant="outline" className="text-[9px] font-black uppercase border-white/10 bg-white/5">
                {q.topic || block}
              </Badge>
              {q.difficulty_level && (
                <Badge
                  className={`text-[9px] ${
                    q.difficulty_level === "facil"
                      ? "bg-emerald-500/20 text-emerald-700 border-emerald-300"
                      : q.difficulty_level === "dificil"
                      ? "bg-red-500/20 text-red-700 border-red-300"
                      : "bg-yellow-500/20 text-yellow-700 border-yellow-300"
                  }`}
                  variant="outline"
                >
                  {q.difficulty_level === "facil"
                    ? "🟢 Fácil"
                    : q.difficulty_level === "dificil"
                    ? "🔴 Difícil"
                    : "🟡 Intermediário"}
                </Badge>
              )}
              <span className="text-muted-foreground">
                Gabarito: {String.fromCharCode(65 + q.correct_index)}
              </span>
              {isExpanded ? (
                <ChevronUp className="h-3 w-3 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(globalIdx);
            }}
            className="text-muted-foreground hover:text-destructive shrink-0 p-1 rounded hover:bg-destructive/10"
            title="Excluir questão"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
        {isExpanded && (
          <div className="px-4 pb-4 space-y-4 border-t border-white/5 pt-4 bg-black/20">
            <p className="text-xs leading-relaxed whitespace-pre-wrap">{q.statement}</p>
            {Array.isArray(q.options) && q.options.length > 0 && (
              <div className="space-y-1">
                {q.options.map((opt: string, oi: number) => (
                  <div
                    key={oi}
                    className={`px-3 py-2 rounded-xl text-[11px] transition-all border ${
                      oi === q.correct_index
                        ? "bg-emerald-500/10 text-emerald-400 font-bold border-emerald-500/30 shadow-glow-sm"
                        : "bg-white/5 border-white/5 text-muted-foreground opacity-60"
                    }`}
                  >
                    {opt}
                  </div>
                ))}
              </div>
            )}
            {q.explanation && (
              <div className="bg-white/5 border border-white/5 rounded-xl p-3 text-[11px] leading-relaxed text-muted-foreground">
                <span className="font-black uppercase tracking-widest text-primary text-[9px] block mb-1">Explicação Técnica:</span> {q.explanation}
              </div>
            )}
          </div>
        )}
      </div>
    );
  },
  (prev, next) =>
    prev.q === next.q &&
    prev.globalIdx === next.globalIdx &&
    prev.block === next.block &&
    prev.isExpanded === next.isExpanded
);

export default SimuladoQuestionItem;
