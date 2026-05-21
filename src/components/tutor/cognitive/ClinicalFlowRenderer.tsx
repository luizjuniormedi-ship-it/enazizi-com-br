import { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, ArrowRight, Stethoscope, GitBranch, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

import type { ClinicalFlowBlock } from "@/types/tutor";
import { CognitiveEmpty, dedupeBy, devWarn, safeArray } from "./_validation";

interface Props {
  block: ClinicalFlowBlock;
}

/**
 * ClinicalFlowRenderer — Cognitive UI
 *
 * Transforma payload `clinical_flow` (nodes + edges) em um fluxograma
 * visual cinematográfico. Layout em colunas por nível topológico.
 * Sem dependências externas de grafo — render simples e responsivo.
 */
export function ClinicalFlowRenderer({ block }: Props) {
  const title = block?.payload?.title;
  const rawNodes = safeArray<ClinicalFlowBlock["payload"]["nodes"][number]>(block?.payload?.nodes);
  const rawEdges = safeArray<ClinicalFlowBlock["payload"]["edges"][number]>(block?.payload?.edges);

  // Sanitização: dedup ids, descarta edges órfãs
  const nodes = useMemo(() => {
    const valid = rawNodes.filter((n) => n && typeof n.id === "string" && typeof n.label === "string");
    const deduped = dedupeBy(valid, (n) => n.id);
    if (deduped.length !== rawNodes.length) {
      devWarn("ClinicalFlowRenderer", "nodes inválidos/duplicados foram filtrados");
    }
    return deduped;
  }, [rawNodes]);

  const nodeIds = useMemo(() => new Set(nodes.map((n) => n.id)), [nodes]);
  const edges = useMemo(() => {
    const ok = rawEdges.filter((e) => e && nodeIds.has(e.from) && nodeIds.has(e.to));
    if (ok.length !== rawEdges.length) {
      devWarn("ClinicalFlowRenderer", "edges órfãs descartadas", {
        before: rawEdges.length,
        after: ok.length,
      });
    }
    return ok;
  }, [rawEdges, nodeIds]);

  const [hovered, setHovered] = useState<string | null>(null);
  const levels = useMemo(() => buildLevels(nodes, edges), [nodes, edges]);
  const mainPath = useMemo(() => longestPath(nodes, edges), [nodes, edges]);
  const mainSet = new Set(mainPath);

  if (nodes.length === 0) {
    return <CognitiveEmpty title="Fluxo clínico" message="Sem nós para renderizar." />;
  }

  useEffect(() => {
    console.log("[ClinicalFlowRenderer] Rendering with", nodes.length, "nodes and", edges.length, "edges");
  }, [nodes.length, edges.length]);

  return (

    <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-card/60 via-card/40 to-primary/5 p-4 backdrop-blur-md">
      <div className="mb-3 flex items-center gap-2">
        <div className="grid h-7 w-7 place-items-center rounded-lg bg-primary/15 text-primary">
          <GitBranch className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-foreground">{title || "Fluxo clínico"}</h4>
          <p className="text-xs text-muted-foreground">Raciocínio visual · caminho principal destacado</p>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
        {levels.map((level, lIdx) => (
          <div key={lIdx} className="flex min-w-[160px] flex-col gap-3">
            {level.map((nodeId) => {
              const node = nodes.find((n) => n.id === nodeId);
              if (!node) return null;
              const tone = nodeTone(node.kind);
              const isMain = mainSet.has(node.id);
              const isHover = hovered === node.id;
              return (
                <motion.div
                  key={node.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: lIdx * 0.05 }}
                  onHoverStart={() => setHovered(node.id)}
                  onHoverEnd={() => setHovered(null)}
                  className={cn(
                    "group relative cursor-default rounded-xl border p-3 text-xs transition-all",
                    tone.border,
                    tone.bg,
                    isMain && "ring-1 ring-primary/40",
                    isHover && "shadow-elevated",
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div className={cn("mt-0.5 grid h-5 w-5 place-items-center rounded-md", tone.iconBg)}>
                      {tone.icon}
                    </div>
                    <div className="flex-1 leading-snug text-foreground">{node.label}</div>
                  </div>
                  {isMain && (
                    <span className="absolute -right-1 -top-1 h-2 w-2 animate-pulse rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" />
                  )}
                </motion.div>
              );
            })}
          </div>
        ))}

        {/* Coluna terminal: setas de saída ilustrativas */}
        <div className="flex items-center text-muted-foreground/40">
          <ArrowRight className="h-4 w-4" />
        </div>
      </div>

      {/* Edges descritivas — tooltip-like list (mobile-friendly) */}
      {edges.length > 0 && (
        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 overflow-hidden rounded-lg border border-border/50 bg-background/60 p-2 text-[11px] text-muted-foreground"
            >
              {edges
                .filter((e) => e.from === hovered || e.to === hovered)
                .map((e, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="font-medium text-foreground">{labelOf(nodes, e.from)}</span>
                    <ArrowRight className="h-3 w-3" />
                    <span className="font-medium text-foreground">{labelOf(nodes, e.to)}</span>
                    {e.label && <span className="ml-1 italic">— {e.label}</span>}
                  </div>
                ))}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

// ---------- helpers ----------

function nodeTone(kind?: "decision" | "action" | "outcome") {
  switch (kind) {
    case "decision":
      return {
        border: "border-amber-500/30",
        bg: "bg-amber-500/5",
        iconBg: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
        icon: <AlertTriangle className="h-3 w-3" />,
      };
    case "outcome":
      return {
        border: "border-emerald-500/30",
        bg: "bg-emerald-500/5",
        iconBg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
        icon: <Activity className="h-3 w-3" />,
      };
    default:
      return {
        border: "border-primary/25",
        bg: "bg-primary/5",
        iconBg: "bg-primary/15 text-primary",
        icon: <Stethoscope className="h-3 w-3" />,
      };
  }
}

function labelOf(nodes: ClinicalFlowBlock["payload"]["nodes"], id: string) {
  return nodes.find((n) => n.id === id)?.label ?? id;
}

function buildLevels(
  nodes: ClinicalFlowBlock["payload"]["nodes"],
  edges: ClinicalFlowBlock["payload"]["edges"],
): string[][] {
  const incoming = new Map<string, number>();
  nodes.forEach((n) => incoming.set(n.id, 0));
  edges.forEach((e) => incoming.set(e.to, (incoming.get(e.to) ?? 0) + 1));

  const levels: string[][] = [];
  const placed = new Set<string>();
  let frontier = nodes.filter((n) => (incoming.get(n.id) ?? 0) === 0).map((n) => n.id);
  if (frontier.length === 0 && nodes.length > 0) frontier = [nodes[0].id];

  let guard = 0;
  while (frontier.length > 0 && guard++ < 32) {
    levels.push(frontier);
    frontier.forEach((id) => placed.add(id));
    const next = new Set<string>();
    frontier.forEach((id) => {
      edges
        .filter((e) => e.from === id)
        .forEach((e) => {
          if (!placed.has(e.to)) next.add(e.to);
        });
    });
    frontier = Array.from(next);
  }

  // Adiciona órfãos
  const remaining = nodes.filter((n) => !placed.has(n.id)).map((n) => n.id);
  if (remaining.length > 0) levels.push(remaining);
  return levels;
}

function longestPath(
  nodes: ClinicalFlowBlock["payload"]["nodes"],
  edges: ClinicalFlowBlock["payload"]["edges"],
): string[] {
  const adj = new Map<string, string[]>();
  edges.forEach((e) => {
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from)!.push(e.to);
  });
  let best: string[] = [];
  const dfs = (id: string, path: string[], seen: Set<string>) => {
    if (path.length > best.length) best = [...path];
    (adj.get(id) ?? []).forEach((nx) => {
      if (seen.has(nx)) return;
      seen.add(nx);
      dfs(nx, [...path, nx], seen);
      seen.delete(nx);
    });
  };
  nodes.forEach((n) => dfs(n.id, [n.id], new Set([n.id])));
  return best;
}
