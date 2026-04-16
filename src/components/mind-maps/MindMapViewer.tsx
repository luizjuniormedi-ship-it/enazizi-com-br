import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  Panel,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BookOpen, X } from "lucide-react";

interface MindMapNode {
  name: string;
  color: string;
  details?: string;
  children?: MindMapNode[];
}

interface MindMapData {
  title: string;
  nodes: MindMapNode[];
  references?: string[];
  clinical_pearls?: string[];
  traps?: string[];
}

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; minimap: string }> = {
  blue:   { bg: "#dbeafe", border: "#3b82f6", text: "#1e3a5f", minimap: "#3b82f6" },
  sky:    { bg: "#e0f2fe", border: "#38bdf8", text: "#0c4a6e", minimap: "#38bdf8" },
  purple: { bg: "#ede9fe", border: "#8b5cf6", text: "#3b0764", minimap: "#8b5cf6" },
  amber:  { bg: "#fef3c7", border: "#f59e0b", text: "#78350f", minimap: "#f59e0b" },
  yellow: { bg: "#fef9c3", border: "#eab308", text: "#713f12", minimap: "#eab308" },
  green:  { bg: "#dcfce7", border: "#22c55e", text: "#14532d", minimap: "#22c55e" },
  red:    { bg: "#fee2e2", border: "#ef4444", text: "#7f1d1d", minimap: "#ef4444" },
  gray:   { bg: "#f3f4f6", border: "#6b7280", text: "#1f2937", minimap: "#6b7280" },
  orange: { bg: "#ffedd5", border: "#f97316", text: "#7c2d12", minimap: "#f97316" },
  pink:   { bg: "#fce7f3", border: "#ec4899", text: "#831843", minimap: "#ec4899" },
};

function getColors(color: string) {
  return COLOR_MAP[color] || COLOR_MAP.blue;
}

/* ── Improved hierarchical tree layout (top-down) ── */
function buildFlowElements(data: MindMapData): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  let nodeId = 0;

  const categoryCount = data.nodes.length;

  // Layout params
  const catSpacing = 260; // horizontal spacing between categories
  const totalCatWidth = (categoryCount - 1) * catSpacing;
  const startX = -totalCatWidth / 2;
  const catY = 180;
  const childStartY = 360;
  const childSpacingY = 70;
  const childSpacingX = 170;

  // ── Root node ──
  const centerId = `node-${nodeId++}`;
  nodes.push({
    id: centerId,
    position: { x: -100, y: 0 },
    data: { label: data.title, details: "", color: "blue" },
    style: {
      background: "hsl(var(--primary))",
      color: "white",
      border: "none",
      borderRadius: "14px",
      padding: "14px 28px",
      fontSize: "15px",
      fontWeight: 700,
      minWidth: "200px",
      textAlign: "center" as const,
      boxShadow: "0 8px 32px hsl(var(--primary) / 0.35)",
    },
  });

  data.nodes.forEach((cat, catIdx) => {
    const cx = startX + catIdx * catSpacing;
    const colors = getColors(cat.color);
    const catId = `node-${nodeId++}`;

    nodes.push({
      id: catId,
      position: { x: cx - 70, y: catY },
      data: { label: cat.name, details: cat.details || "", color: cat.color },
      style: {
        background: colors.bg,
        color: colors.text,
        border: `2px solid ${colors.border}`,
        borderRadius: "10px",
        padding: "10px 16px",
        fontSize: "12px",
        fontWeight: 600,
        minWidth: "140px",
        textAlign: "center" as const,
        cursor: "pointer",
        boxShadow: `0 2px 8px ${colors.border}33`,
      },
    });

    edges.push({
      id: `e-${centerId}-${catId}`,
      source: centerId,
      target: catId,
      type: "smoothstep",
      style: { stroke: colors.border, strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: colors.border, width: 12, height: 12 },
    });

    // ── Children ──
    if (cat.children && cat.children.length > 0) {
      const childCount = cat.children.length;
      const totalChildWidth = (childCount - 1) * childSpacingX;
      const childStartX = cx - totalChildWidth / 2;

      cat.children.forEach((child, childIdx) => {
        const childColors = getColors(child.color || cat.color);
        const childId = `node-${nodeId++}`;

        // Stagger rows if many children
        const row = Math.floor(childIdx / 3);
        const col = childIdx % 3;
        let childX: number, childY: number;

        if (childCount <= 3) {
          childX = childStartX + childIdx * childSpacingX - 55;
          childY = childStartY;
        } else {
          const colsInRow = Math.min(3, childCount - row * 3);
          const rowWidth = (colsInRow - 1) * childSpacingX;
          childX = cx - rowWidth / 2 + col * childSpacingX - 55;
          childY = childStartY + row * childSpacingY;
        }

        nodes.push({
          id: childId,
          position: { x: childX, y: childY },
          data: { label: child.name, details: child.details || "", color: child.color || cat.color },
          style: {
            background: childColors.bg,
            color: childColors.text,
            border: `1.5px solid ${childColors.border}`,
            borderRadius: "8px",
            padding: "6px 12px",
            fontSize: "10px",
            fontWeight: 500,
            maxWidth: "150px",
            textAlign: "center" as const,
            cursor: "pointer",
            opacity: 0.92,
          },
        });

        edges.push({
          id: `e-${catId}-${childId}`,
          source: catId,
          target: childId,
          type: "smoothstep",
          style: { stroke: childColors.border, strokeWidth: 1.5, opacity: 0.5 },
        });
      });
    }
  });

  return { nodes, edges };
}

export function MindMapViewer({ mapData }: { mapData: MindMapData }) {
  const [selectedNode, setSelectedNode] = useState<{ label: string; details: string; color: string } | null>(null);

  const { initialNodes, initialEdges } = useMemo(() => {
    const { nodes, edges } = buildFlowElements(mapData);
    return { initialNodes: nodes, initialEdges: edges };
  }, [mapData]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const onNodeClick = useCallback((_: any, node: Node) => {
    const d = node.data as any;
    if (d.details) {
      setSelectedNode({ label: d.label, details: d.details, color: d.color });
    }
  }, []);

  return (
    <div className="relative w-full h-full rounded-xl border bg-background/50 overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.3, maxZoom: 1.2 }}
        minZoom={0.15}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} size={1} color="hsl(var(--muted-foreground) / 0.08)" />
        <Controls
          showInteractive={false}
          className="!bg-background !border-border !shadow-lg [&>button]:!bg-background [&>button]:!border-border [&>button]:!text-foreground"
        />
        <MiniMap
          nodeColor={(n) => {
            const c = (n.data as any)?.color;
            return COLOR_MAP[c]?.minimap || "#3b82f6";
          }}
          style={{ borderRadius: 8, opacity: 0.85 }}
          maskColor="hsl(var(--background) / 0.7)"
        />

        {/* Tip panel */}
        <Panel position="top-left">
          <div className="bg-background/80 backdrop-blur-sm border rounded-lg px-3 py-2 text-[10px] text-muted-foreground shadow-sm">
            💡 Clique em um nó para ver a explicação detalhada
          </div>
        </Panel>

        {/* References panel */}
        {(mapData.references?.length || mapData.clinical_pearls?.length || mapData.traps?.length) && (
          <Panel position="top-right">
            <Card className="w-60 shadow-lg bg-background/95 backdrop-blur-sm">
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-xs flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5" />
                  Referências & Dicas
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 pt-0">
                <ScrollArea className="max-h-40">
                  {mapData.references?.length ? (
                    <ul className="space-y-0.5">
                      {mapData.references.map((r, i) => (
                        <li key={i} className="text-[10px] text-muted-foreground">📚 {r}</li>
                      ))}
                    </ul>
                  ) : null}
                  {mapData.clinical_pearls?.length ? (
                    <div className="mt-2 pt-2 border-t">
                      <p className="text-[10px] font-semibold mb-1">💡 Pérolas Clínicas</p>
                      {mapData.clinical_pearls.map((p, i) => (
                        <p key={i} className="text-[10px] text-muted-foreground">• {p}</p>
                      ))}
                    </div>
                  ) : null}
                  {mapData.traps?.length ? (
                    <div className="mt-2 pt-2 border-t">
                      <p className="text-[10px] font-semibold mb-1">⚠️ Armadilhas de Prova</p>
                      {mapData.traps.map((t, i) => (
                        <p key={i} className="text-[10px] text-muted-foreground">• {t}</p>
                      ))}
                    </div>
                  ) : null}
                </ScrollArea>
              </CardContent>
            </Card>
          </Panel>
        )}
      </ReactFlow>

      {/* Detail panel */}
      {selectedNode && (
        <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-50 animate-fade-in">
          <Card className="shadow-xl border-2" style={{ borderColor: COLOR_MAP[selectedNode.color]?.border }}>
            <CardHeader className="pb-2 pt-3 px-4 flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-full flex-shrink-0"
                  style={{ background: COLOR_MAP[selectedNode.color]?.border }}
                />
                <CardTitle className="text-sm">{selectedNode.label}</CardTitle>
              </div>
              <button onClick={() => setSelectedNode(null)} className="p-1 hover:bg-muted rounded">
                <X className="h-4 w-4" />
              </button>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <ScrollArea className="max-h-48">
                <p className="text-xs leading-relaxed text-muted-foreground whitespace-pre-line">{selectedNode.details}</p>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
