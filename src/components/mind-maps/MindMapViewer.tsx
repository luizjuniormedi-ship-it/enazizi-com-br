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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  blue:   { bg: "hsl(217 91% 95%)", border: "hsl(217 91% 60%)", text: "hsl(217 91% 30%)", minimap: "hsl(217 91% 60%)" },
  sky:    { bg: "hsl(199 89% 93%)", border: "hsl(199 89% 48%)", text: "hsl(199 89% 25%)", minimap: "hsl(199 89% 48%)" },
  purple: { bg: "hsl(262 83% 94%)", border: "hsl(262 83% 58%)", text: "hsl(262 83% 30%)", minimap: "hsl(262 83% 58%)" },
  amber:  { bg: "hsl(38 92% 92%)",  border: "hsl(38 92% 50%)",  text: "hsl(38 92% 25%)",  minimap: "hsl(38 92% 50%)" },
  yellow: { bg: "hsl(48 96% 90%)",  border: "hsl(48 96% 53%)",  text: "hsl(48 96% 25%)",  minimap: "hsl(48 96% 53%)" },
  green:  { bg: "hsl(142 76% 92%)", border: "hsl(142 76% 36%)", text: "hsl(142 76% 18%)", minimap: "hsl(142 76% 36%)" },
  red:    { bg: "hsl(0 84% 94%)",   border: "hsl(0 84% 60%)",   text: "hsl(0 84% 30%)",   minimap: "hsl(0 84% 60%)" },
  gray:   { bg: "hsl(220 9% 93%)",  border: "hsl(220 9% 46%)",  text: "hsl(220 9% 25%)",  minimap: "hsl(220 9% 46%)" },
  orange: { bg: "hsl(25 95% 92%)",  border: "hsl(25 95% 53%)",  text: "hsl(25 95% 25%)",  minimap: "hsl(25 95% 53%)" },
  pink:   { bg: "hsl(339 90% 94%)", border: "hsl(339 90% 51%)", text: "hsl(339 90% 28%)", minimap: "hsl(339 90% 51%)" },
};

function getColors(color: string) {
  return COLOR_MAP[color] || COLOR_MAP.blue;
}

function buildFlowElements(data: MindMapData): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  let nodeId = 0;

  // Center node
  const centerId = `node-${nodeId++}`;
  nodes.push({
    id: centerId,
    position: { x: 0, y: 0 },
    data: { label: data.title, details: "", color: "blue" },
    type: "default",
    style: {
      background: "hsl(var(--primary))",
      color: "white",
      border: "2px solid hsl(var(--primary))",
      borderRadius: "12px",
      padding: "12px 20px",
      fontSize: "14px",
      fontWeight: 700,
      minWidth: "180px",
      textAlign: "center" as const,
      boxShadow: "0 4px 20px hsl(var(--primary) / 0.3)",
    },
  });

  const categoryCount = data.nodes.length;
  const radius = 320;

  data.nodes.forEach((cat, catIdx) => {
    const angle = (2 * Math.PI * catIdx) / categoryCount - Math.PI / 2;
    const cx = Math.cos(angle) * radius;
    const cy = Math.sin(angle) * radius;
    const colors = getColors(cat.color);
    const catId = `node-${nodeId++}`;

    nodes.push({
      id: catId,
      position: { x: cx - 80, y: cy - 20 },
      data: { label: cat.name, details: cat.details || "", color: cat.color },
      style: {
        background: colors.bg,
        color: colors.text,
        border: `2px solid ${colors.border}`,
        borderRadius: "10px",
        padding: "8px 14px",
        fontSize: "12px",
        fontWeight: 600,
        minWidth: "120px",
        textAlign: "center" as const,
        cursor: "pointer",
      },
    });

    edges.push({
      id: `edge-${centerId}-${catId}`,
      source: centerId,
      target: catId,
      style: { stroke: colors.border, strokeWidth: 2 },
      animated: false,
    });

    if (cat.children) {
      const childRadius = 160;
      const spread = Math.PI / Math.max(cat.children.length, 3);
      const baseAngle = angle;

      cat.children.forEach((child, childIdx) => {
        const childAngle = baseAngle + (childIdx - (cat.children!.length - 1) / 2) * spread * 0.5;
        const childX = cx + Math.cos(childAngle) * childRadius;
        const childY = cy + Math.sin(childAngle) * childRadius;
        const childColors = getColors(child.color || cat.color);
        const childId = `node-${nodeId++}`;

        nodes.push({
          id: childId,
          position: { x: childX - 60, y: childY - 15 },
          data: { label: child.name, details: child.details || "", color: child.color || cat.color },
          style: {
            background: childColors.bg,
            color: childColors.text,
            border: `1.5px solid ${childColors.border}`,
            borderRadius: "8px",
            padding: "6px 10px",
            fontSize: "10px",
            fontWeight: 500,
            maxWidth: "140px",
            textAlign: "center" as const,
            cursor: "pointer",
            opacity: 0.95,
          },
        });

        edges.push({
          id: `edge-${catId}-${childId}`,
          source: catId,
          target: childId,
          style: { stroke: childColors.border, strokeWidth: 1.5, opacity: 0.6 },
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
    <div className="relative w-full h-[calc(100vh-160px)] rounded-xl border bg-background overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} size={1} />
        <Controls />
        <MiniMap
          nodeColor={(n) => {
            const c = (n.data as any)?.color;
            return COLOR_MAP[c]?.minimap || "hsl(var(--primary))";
          }}
          style={{ borderRadius: 8 }}
        />

        {/* References panel */}
        {(mapData.references?.length || mapData.clinical_pearls?.length) && (
          <Panel position="top-right">
            <Card className="w-64 shadow-lg">
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-xs flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5" />
                  Referências
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 pt-0">
                <ScrollArea className="max-h-32">
                  <ul className="space-y-1">
                    {mapData.references?.map((r, i) => (
                      <li key={i} className="text-[10px] text-muted-foreground">• {r}</li>
                    ))}
                  </ul>
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
                      <p className="text-[10px] font-semibold mb-1">⚠️ Armadilhas</p>
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
        <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-50">
          <Card className="shadow-xl border-2" style={{ borderColor: COLOR_MAP[selectedNode.color]?.border }}>
            <CardHeader className="pb-2 pt-3 px-4 flex-row items-center justify-between">
              <CardTitle className="text-sm">{selectedNode.label}</CardTitle>
              <button onClick={() => setSelectedNode(null)} className="p-1 hover:bg-muted rounded">
                <X className="h-4 w-4" />
              </button>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <ScrollArea className="max-h-40">
                <p className="text-xs leading-relaxed text-muted-foreground">{selectedNode.details}</p>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
