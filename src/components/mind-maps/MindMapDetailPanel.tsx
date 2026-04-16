import { X, BookOpen, AlertTriangle, Lightbulb } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getNodeColors } from "./MindMapNode";

interface Props {
  node: { label: string; details: string; color: string } | null;
  onClose: () => void;
  references?: string[];
  clinicalPearls?: string[];
  traps?: string[];
}

export function MindMapDetailPanel({ node, onClose, references, clinicalPearls, traps }: Props) {
  if (!node) return null;

  const colors = getNodeColors(node.color);

  return (
    <div className="absolute bottom-4 right-4 w-[340px] z-50 animate-fade-in">
      <div
        className="rounded-2xl border bg-background/95 backdrop-blur-xl shadow-2xl overflow-hidden"
        style={{ borderColor: colors.border + "40" }}
      >
        {/* Colored header */}
        <div
          className="px-4 py-3 flex items-center justify-between"
          style={{ background: `linear-gradient(135deg, ${colors.bg}, transparent)` }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="h-3 w-3 rounded-full flex-shrink-0 ring-2 ring-white/50"
              style={{ background: colors.border }}
            />
            <h3 className="text-sm font-bold truncate" style={{ color: colors.text }}>
              {node.label}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors flex-shrink-0"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <ScrollArea className="max-h-[320px]">
          <div className="px-4 pb-4 pt-3 space-y-3">
            {/* Main explanation */}
            <p className="text-xs leading-relaxed text-foreground/80 whitespace-pre-line">
              {node.details}
            </p>

            {/* Clinical Pearls */}
            {clinicalPearls?.length ? (
              <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3">
                <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5 mb-1.5">
                  <Lightbulb className="h-3 w-3" />
                  Pérolas Clínicas
                </p>
                {clinicalPearls.map((p, i) => (
                  <p key={i} className="text-[10px] text-foreground/70 leading-relaxed">• {p}</p>
                ))}
              </div>
            ) : null}

            {/* Traps */}
            {traps?.length ? (
              <div className="rounded-lg bg-red-500/5 border border-red-500/20 p-3">
                <p className="text-[10px] font-semibold text-red-600 dark:text-red-400 flex items-center gap-1.5 mb-1.5">
                  <AlertTriangle className="h-3 w-3" />
                  Armadilhas de Prova
                </p>
                {traps.map((t, i) => (
                  <p key={i} className="text-[10px] text-foreground/70 leading-relaxed">• {t}</p>
                ))}
              </div>
            ) : null}

            {/* References */}
            {references?.length ? (
              <div className="pt-2 border-t border-border/50">
                <p className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1.5 mb-1">
                  <BookOpen className="h-3 w-3" />
                  Referências
                </p>
                {references.map((r, i) => (
                  <p key={i} className="text-[9px] text-muted-foreground/70">📚 {r}</p>
                ))}
              </div>
            ) : null}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
