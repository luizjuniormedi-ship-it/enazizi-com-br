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
    <div className="absolute bottom-4 right-4 w-[420px] max-w-[calc(100vw-2rem)] z-50 animate-fade-in">
      <div
        className="rounded-2xl border bg-background/95 backdrop-blur-xl shadow-2xl overflow-hidden"
        style={{ borderColor: colors.border + "40" }}
      >
        {/* Colored header */}
        <div
          className="px-5 py-4 flex items-center justify-between"
          style={{ background: `linear-gradient(135deg, ${colors.bg}, transparent)` }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="h-4 w-4 rounded-full flex-shrink-0 ring-2 ring-white/50"
              style={{ background: colors.border }}
            />
            <h3 className="text-base font-bold" style={{ color: colors.text }}>
              {node.label}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted/50 transition-colors flex-shrink-0"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <ScrollArea className="max-h-[400px]">
          <div className="px-5 pb-5 pt-4 space-y-4">
            {/* Main explanation */}
            <p className="text-sm leading-relaxed text-foreground/85 whitespace-pre-line">
              {node.details}
            </p>

            {/* Clinical Pearls */}
            {clinicalPearls?.length ? (
              <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-4">
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-2 mb-2">
                  <Lightbulb className="h-4 w-4" />
                  Pérolas Clínicas
                </p>
                {clinicalPearls.map((p, i) => (
                  <p key={i} className="text-xs text-foreground/70 leading-relaxed mb-1">• {p}</p>
                ))}
              </div>
            ) : null}

            {/* Traps */}
            {traps?.length ? (
              <div className="rounded-xl bg-red-500/5 border border-red-500/20 p-4">
                <p className="text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  Armadilhas de Prova
                </p>
                {traps.map((t, i) => (
                  <p key={i} className="text-xs text-foreground/70 leading-relaxed mb-1">• {t}</p>
                ))}
              </div>
            ) : null}

            {/* References */}
            {references?.length ? (
              <div className="pt-3 border-t border-border/50">
                <p className="text-xs font-semibold text-muted-foreground flex items-center gap-2 mb-2">
                  <BookOpen className="h-4 w-4" />
                  Referências
                </p>
                {references.map((r, i) => (
                  <p key={i} className="text-xs text-muted-foreground/80 mb-0.5">📚 {r}</p>
                ))}
              </div>
            ) : null}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
