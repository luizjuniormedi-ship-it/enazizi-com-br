import { useState, useCallback, useMemo, useRef } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Lightbulb, AlertTriangle, BookOpen, X, ArrowLeft } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
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

interface FlatNode {
  label: string;
  details: string;
  color: string;
  parentLabel?: string;
}

/* ── Build flat navigable list ── */
function buildFlatNodes(data: MindMapData): FlatNode[] {
  const flat: FlatNode[] = [];
  for (const cat of data.nodes) {
    if (cat.details) flat.push({ label: cat.name, details: cat.details, color: cat.color });
    for (const child of cat.children || []) {
      if (child.details) flat.push({ label: child.name, details: child.details, color: child.color || cat.color, parentLabel: cat.name });
    }
  }
  return flat;
}

/* ══════════════════════════════════════════════════
   READING PANEL — large, comfortable, navigable
   ══════════════════════════════════════════════════ */
function ReadingPanel({
  node,
  flatNodes,
  currentIndex,
  onNavigate,
  onClose,
  references,
  clinicalPearls,
  traps,
}: {
  node: FlatNode;
  flatNodes: FlatNode[];
  currentIndex: number;
  onNavigate: (idx: number) => void;
  onClose: () => void;
  references?: string[];
  clinicalPearls?: string[];
  traps?: string[];
}) {
  const colors = getNodeColors(node.color);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < flatNodes.length - 1;

  // Parse details into sections if structured with ## headers
  const sections = useMemo(() => {
    const text = node.details;
    // Try to split by markdown-like headers
    const parts = text.split(/\n(?=#{1,3}\s)/);
    if (parts.length > 1) {
      return parts.map(part => {
        const match = part.match(/^(#{1,3})\s+(.+)\n?([\s\S]*)/);
        if (match) return { title: match[2].trim(), body: match[3].trim() };
        return { title: "", body: part.trim() };
      }).filter(s => s.body || s.title);
    }
    return [{ title: "", body: text }];
  }, [node.details]);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset scroll on navigation
  const prevIdx = useRef(currentIndex);
  if (prevIdx.current !== currentIndex) {
    prevIdx.current = currentIndex;
    scrollRef.current?.scrollTo({ top: 0 });
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex flex-col lg:flex-row"
    >
      {/* Backdrop — dims the map on desktop */}
      <div
        className="hidden lg:block lg:w-[40%] xl:w-[45%] bg-black/40 backdrop-blur-sm cursor-pointer"
        onClick={onClose}
      />

      {/* Reading area — fullscreen mobile, 55-60% desktop */}
      <div className="flex-1 flex flex-col bg-background overflow-hidden lg:border-l border-border/50 lg:shadow-2xl">
        {/* Header */}
        <div
          className="shrink-0 px-5 sm:px-8 py-4 sm:py-5 flex items-center gap-3 border-b"
          style={{
            background: `linear-gradient(135deg, ${colors.bg}, transparent)`,
            borderColor: colors.border + "30",
          }}
        >
          <button
            onClick={onClose}
            className="p-2 -ml-2 rounded-xl hover:bg-background/50 transition-colors shrink-0"
          >
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </button>
          <div className="flex-1 min-w-0">
            {node.parentLabel && (
              <p className="text-xs text-muted-foreground mb-0.5">{node.parentLabel}</p>
            )}
            <h1 className="text-xl sm:text-2xl font-bold leading-tight truncate" style={{ color: colors.text }}>
              {node.label}
            </h1>
          </div>
          <span
            className="h-4 w-4 rounded-full shrink-0 ring-2 ring-white/30"
            style={{ background: colors.border }}
          />
        </div>

        {/* Content — scrollable */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-5 sm:px-8 py-6 sm:py-8 space-y-6">
            {/* Main explanation */}
            {sections.map((sec, i) => (
              <div key={i}>
                {sec.title && (
                  <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: colors.border }} />
                    {sec.title}
                  </h2>
                )}
                <p className="text-base leading-[1.8] text-foreground/90 whitespace-pre-line">
                  {sec.body}
                </p>
              </div>
            ))}

            {/* Clinical Pearls */}
            {clinicalPearls?.length ? (
              <div className="rounded-2xl bg-amber-500/5 border border-amber-500/20 p-5 sm:p-6">
                <p className="text-sm font-bold text-amber-600 dark:text-amber-400 flex items-center gap-2 mb-3">
                  <Lightbulb className="h-5 w-5" /> Pérolas Clínicas
                </p>
                <div className="space-y-2">
                  {clinicalPearls.map((p, i) => (
                    <p key={i} className="text-base text-foreground/80 leading-relaxed pl-4 border-l-2 border-amber-500/30">
                      {p}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Exam Traps */}
            {traps?.length ? (
              <div className="rounded-2xl bg-red-500/5 border border-red-500/20 p-5 sm:p-6">
                <p className="text-sm font-bold text-red-600 dark:text-red-400 flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-5 w-5" /> Armadilhas de Prova
                </p>
                <div className="space-y-2">
                  {traps.map((t, i) => (
                    <p key={i} className="text-base text-foreground/80 leading-relaxed pl-4 border-l-2 border-red-500/30">
                      {t}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}

            {/* References */}
            {references?.length ? (
              <div className="pt-4 border-t border-border/30">
                <p className="text-sm font-bold text-muted-foreground flex items-center gap-2 mb-3">
                  <BookOpen className="h-4 w-4" /> Referências
                </p>
                {references.map((r, i) => (
                  <p key={i} className="text-sm text-muted-foreground/80 mb-1">📚 {r}</p>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {/* Navigation footer */}
        <div className="shrink-0 border-t border-border/50 px-5 sm:px-8 py-3 sm:py-4 flex items-center justify-between bg-background/95 backdrop-blur-sm">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 rounded-xl"
            disabled={!hasPrev}
            onClick={() => onNavigate(currentIndex - 1)}
          >
            <ChevronLeft className="h-4 w-4" /> Anterior
          </Button>

          <span className="text-xs text-muted-foreground tabular-nums">
            {currentIndex + 1} / {flatNodes.length}
          </span>

          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 rounded-xl"
            disabled={!hasNext}
            onClick={() => onNavigate(currentIndex + 1)}
          >
            Próximo <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
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
          <p className="text-xs text-muted-foreground mt-0.5">Toque para ler</p>
        )}
      </div>
      {hasDetails && (
        <ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
      )}
    </motion.div>
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
              Ler
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

/* ═══════════════════════════════════════════
   MAIN VIEWER
   ═══════════════════════════════════════════ */
export function MindMapViewer({ mapData }: { mapData: MindMapData }) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const flatNodes = useMemo(() => buildFlatNodes(mapData), [mapData]);

  const handleSelectNode = useCallback((n: MindMapNodeData) => {
    if (!n.details) return;
    // Find this node in flatNodes
    const idx = flatNodes.findIndex(f => f.label === n.name && f.details === n.details);
    setSelectedIndex(idx >= 0 ? idx : null);
  }, [flatNodes]);

  const selectedNode = selectedIndex !== null ? flatNodes[selectedIndex] : null;

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

        {/* Category sections */}
        {mapData.nodes.map((cat, i) => (
          <CategorySection
            key={`${cat.name}-${i}`}
            node={cat}
            defaultOpen={false}
            onSelectNode={handleSelectNode}
          />
        ))}

        {/* Global pearls + traps */}
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

      {/* Reading Panel — fullscreen mobile, 55-60% side panel desktop */}
      <AnimatePresence>
        {selectedNode && selectedIndex !== null && (
          <ReadingPanel
            node={selectedNode}
            flatNodes={flatNodes}
            currentIndex={selectedIndex}
            onNavigate={setSelectedIndex}
            onClose={() => setSelectedIndex(null)}
            references={mapData.references}
            clinicalPearls={mapData.clinical_pearls}
            traps={mapData.traps}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
