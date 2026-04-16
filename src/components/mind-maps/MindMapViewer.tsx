import { useState, useCallback, useRef, useEffect } from "react";
import { ChevronDown, ChevronRight, Lightbulb, AlertTriangle, BookOpen, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";
import { getNodeColors, CATEGORY_ICONS } from "./MindMapNode";

/* ── Types ── */
interface MindMapNodeData {
  name: string;
  color: string;
  details?: string;
  children?: MindMapNodeData[];
}

interface MindMapData {
  title: string;
  nodes: MindMapNodeData[];
  references?: string[];
  clinical_pearls?: string[];
  traps?: string[];
}

/* ── Detail Panel (bottom sheet on mobile, side panel on desktop) ── */
function DetailPanel({
  node,
  onClose,
  references,
  clinicalPearls,
  traps,
}: {
  node: { label: string; details: string; color: string } | null;
  onClose: () => void;
  references?: string[];
  clinicalPearls?: string[];
  traps?: string[];
}) {
  if (!node) return null;
  const colors = getNodeColors(node.color);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-0 left-0 right-0 z-50 lg:absolute lg:bottom-4 lg:right-4 lg:left-auto lg:w-[420px] lg:max-w-[calc(100vw-2rem)]"
    >
      <div
        className="rounded-t-2xl lg:rounded-2xl border bg-background/95 backdrop-blur-xl shadow-2xl overflow-hidden max-h-[70vh] lg:max-h-[500px]"
        style={{ borderColor: colors.border + "40" }}
      >
        <div
          className="px-5 py-4 flex items-center justify-between sticky top-0 z-10"
          style={{ background: `linear-gradient(135deg, ${colors.bg}, transparent)` }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="h-4 w-4 rounded-full shrink-0 ring-2 ring-white/50" style={{ background: colors.border }} />
            <h3 className="text-base font-bold truncate" style={{ color: colors.text }}>{node.label}</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted/50 transition-colors shrink-0">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <ScrollArea className="max-h-[calc(70vh-60px)] lg:max-h-[440px]">
          <div className="px-5 pb-5 pt-3 space-y-4">
            <p className="text-sm leading-relaxed text-foreground/85 whitespace-pre-line">{node.details}</p>

            {clinicalPearls?.length ? (
              <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-4">
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-2 mb-2">
                  <Lightbulb className="h-4 w-4" /> Pérolas Clínicas
                </p>
                {clinicalPearls.map((p, i) => (
                  <p key={i} className="text-xs text-foreground/70 leading-relaxed mb-1">• {p}</p>
                ))}
              </div>
            ) : null}

            {traps?.length ? (
              <div className="rounded-xl bg-red-500/5 border border-red-500/20 p-4">
                <p className="text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4" /> Armadilhas de Prova
                </p>
                {traps.map((t, i) => (
                  <p key={i} className="text-xs text-foreground/70 leading-relaxed mb-1">• {t}</p>
                ))}
              </div>
            ) : null}

            {references?.length ? (
              <div className="pt-3 border-t border-border/50">
                <p className="text-xs font-semibold text-muted-foreground flex items-center gap-2 mb-2">
                  <BookOpen className="h-4 w-4" /> Referências
                </p>
                {references.map((r, i) => (
                  <p key={i} className="text-xs text-muted-foreground/80 mb-0.5">📚 {r}</p>
                ))}
              </div>
            ) : null}
          </div>
        </ScrollArea>
      </div>
    </motion.div>
  );
}

/* ── Leaf Item ── */
function LeafItem({
  node,
  parentColor,
  onSelect,
}: {
  node: MindMapNodeData;
  parentColor: string;
  onSelect: (n: MindMapNodeData) => void;
}) {
  const colors = getNodeColors(node.color || parentColor);
  const hasDetails = !!node.details;

  return (
    <motion.div
      role="button"
      tabIndex={hasDetails ? 0 : undefined}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className={`w-full text-left flex items-start gap-3 px-4 py-3 rounded-xl border transition-all
        ${hasDetails ? "hover:shadow-md cursor-pointer active:scale-[0.99]" : "cursor-default"}
      `}
      style={{
        background: `${colors.bg}cc`,
        borderColor: colors.border + "44",
      }}
      onClick={() => hasDetails && onSelect(node)}
    >
      <span
        className="mt-1 h-2.5 w-2.5 rounded-full shrink-0"
        style={{ background: colors.border }}
      />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium leading-snug" style={{ color: colors.text }}>
          {node.name}
        </span>
        {hasDetails && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">Toque para ver detalhes</p>
        )}
      </div>
    </motion.button>
  );
}

/* ── Category Section (collapsible) ── */
function CategorySection({
  node,
  defaultOpen,
  onSelectNode,
}: {
  node: MindMapNodeData;
  defaultOpen: boolean;
  onSelectNode: (n: MindMapNodeData) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const colors = getNodeColors(node.color);
  const icon = CATEGORY_ICONS[node.color] || "📌";
  const childCount = node.children?.length ?? 0;
  const hasDetails = !!node.details;
  const sectionRef = useRef<HTMLDivElement>(null);

  const handleToggle = useCallback(() => {
    const next = !open;
    setOpen(next);
    // Scroll into view when opening
    if (next && sectionRef.current) {
      setTimeout(() => {
        sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 150);
    }
  }, [open]);

  return (
    <div ref={sectionRef} className="rounded-2xl border overflow-hidden transition-shadow hover:shadow-md"
      style={{ borderColor: colors.border + "55" }}
    >
      {/* Category header — always visible */}
      <button
        onClick={handleToggle}
        className="w-full flex items-center gap-3 px-5 py-4 text-left transition-colors hover:brightness-95 active:scale-[0.995]"
        style={{ background: colors.bg }}
      >
        <span className="text-xl shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <span className="text-[15px] font-bold leading-tight" style={{ color: colors.text }}>
            {node.name}
          </span>
          {childCount > 0 && (
            <span className="text-xs font-normal ml-2" style={{ color: colors.text + "99" }}>
              ({childCount})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasDetails && (
            <button
              onClick={(e) => { e.stopPropagation(); onSelectNode(node); }}
              className="text-xs px-2.5 py-1 rounded-lg border transition-colors hover:bg-background/50"
              style={{ borderColor: colors.border + "44", color: colors.text }}
            >
              Detalhes
            </button>
          )}
          <motion.div
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="h-5 w-5" style={{ color: colors.border }} />
          </motion.div>
        </div>
      </button>

      {/* Children — collapsible */}
      <AnimatePresence initial={false}>
        {open && node.children && node.children.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-2 space-y-2 border-t" style={{ borderColor: colors.border + "22" }}>
              {node.children.map((child, i) => (
                <LeafItem
                  key={`${child.name}-${i}`}
                  node={child}
                  parentColor={node.color}
                  onSelect={onSelectNode}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Main Viewer ── */
export function MindMapViewer({ mapData }: { mapData: MindMapData }) {
  const [selectedNode, setSelectedNode] = useState<{ label: string; details: string; color: string } | null>(null);

  const handleSelectNode = useCallback((n: MindMapNodeData) => {
    if (n.details) {
      setSelectedNode({ label: n.name, details: n.details, color: n.color });
    }
  }, []);

  return (
    <div className="relative w-full h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-3 sm:px-6 py-6 space-y-4">
        {/* Root title */}
        <div className="text-center mb-6">
          <div
            className="inline-block px-8 py-4 rounded-2xl text-white font-bold text-lg shadow-xl"
            style={{
              background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.85))",
              boxShadow: "0 8px 32px hsl(var(--primary) / 0.25)",
            }}
          >
            {mapData.title}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            {mapData.nodes.length} {mapData.nodes.length === 1 ? "seção" : "seções"} · Toque para expandir
          </p>
        </div>

        {/* Category sections — collapsed by default */}
        {mapData.nodes.map((cat, i) => (
          <CategorySection
            key={`${cat.name}-${i}`}
            node={cat}
            defaultOpen={false}
            onSelectNode={handleSelectNode}
          />
        ))}

        {/* Global info: pearls + traps */}
        {(mapData.clinical_pearls?.length || mapData.traps?.length) ? (
          <div className="space-y-3 pt-4 border-t border-border/30">
            {mapData.clinical_pearls?.length ? (
              <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-4">
                <p className="text-sm font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-2 mb-2">
                  <Lightbulb className="h-4 w-4" /> Pérolas Clínicas
                </p>
                {mapData.clinical_pearls.map((p, i) => (
                  <p key={i} className="text-sm text-foreground/70 leading-relaxed mb-1">• {p}</p>
                ))}
              </div>
            ) : null}

            {mapData.traps?.length ? (
              <div className="rounded-xl bg-red-500/5 border border-red-500/20 p-4">
                <p className="text-sm font-semibold text-red-600 dark:text-red-400 flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4" /> Armadilhas de Prova
                </p>
                {mapData.traps.map((t, i) => (
                  <p key={i} className="text-sm text-foreground/70 leading-relaxed mb-1">• {t}</p>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Detail panel overlay */}
      <AnimatePresence>
        {selectedNode && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-40 lg:hidden"
              onClick={() => setSelectedNode(null)}
            />
            <DetailPanel
              node={selectedNode}
              onClose={() => setSelectedNode(null)}
              references={mapData.references}
              clinicalPearls={mapData.clinical_pearls}
              traps={mapData.traps}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
