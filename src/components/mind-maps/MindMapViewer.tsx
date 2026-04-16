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
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { nodeTypes, getNodeColors } from "./MindMapNode";
import { MindMapDetailPanel } from "./MindMapDetailPanel";

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

function buildFlowElements(data: MindMapData): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  let nodeId = 0;

  const categoryCount = data.nodes.length;
  const catSpacing = 280;
  const totalCatWidth = (categoryCount - 1) * catSpacing;
  const startX = -totalCatWidth / 2;
  const catY = 200;
  const childStartY = 400;
  const childSpacingY = 80;
  const childSpacingX = 180;

  const centerId = `node-${nodeId++}`;
  nodes.push({
    id: centerId,
    type: "root",
    position: { x: -110, y: 0 },
    data: { label: data.title },
  });

  data.nodes.forEach((cat, catIdx) => {
    const cx = startX + catIdx * catSpacing;
    const colors = getNodeColors(cat.color);
    const catId = `node-${nodeId++}`;

    nodes.push({
      id: catId,
      type: "category",
      position: { x: cx - 75, y: catY },
      data: { label: cat.name, details: cat.details || "", color: cat.color },
    });

    edges.push({
      id: `e-${centerId}-${catId}`,
      source: centerId,
      target: catId,
      type: "smoothstep",
      style: { stroke: colors.border, strokeWidth: 2, opacity: 0.6 },
      markerEnd: { type: MarkerType.ArrowClosed, color: colors.border, width: 10, height: 10 },
    });

    if (cat.children?.length) {
      const childCount = cat.children.length;
      const totalChildWidth = (childCount - 1) * childSpacingX;
      const childStartX = cx - totalChildWidth / 2;

      cat.children.forEach((child, childIdx) => {
        const childColors = getNodeColors(child.color || cat.color);
        const childId = `node-${nodeId++}`;
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
          type: "leaf",
          position: { x: childX, y: childY },
          data: { label: child.name, details: child.details || "", color: child.color || cat.color },
        });

        edges.push({
          id: `e-${catId}-${childId}`,
          source: catId,
          target: childId,
          type: "smoothstep",
          style: { stroke: childColors.border, strokeWidth: 1.5, opacity: 0.35 },
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
    <div className="relative w-full h-full overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3, maxZoom: 1.2 }}
        minZoom={0.1}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
        className="!bg-transparent"
      >
        <Background gap={32} size={1} color="hsl(var(--muted-foreground) / 0.06)" />
        <Controls
          showInteractive={false}
          className="!bg-background/90 !backdrop-blur-sm !border-border/50 !shadow-xl !rounded-xl [&>button]:!bg-background [&>button]:!border-border/30 [&>button]:!text-foreground [&>button]:!rounded-lg"
        />
        <MiniMap
          nodeColor={(n) => {
            const c = (n.data as any)?.color;
            return getNodeColors(c).border;
          }}
          className="!rounded-xl !border-border/30 !shadow-lg"
          maskColor="hsl(var(--background) / 0.75)"
          style={{ borderRadius: 12 }}
        />
      </ReactFlow>

      {/* Detail panel */}
      <MindMapDetailPanel
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
        references={mapData.references}
        clinicalPearls={mapData.clinical_pearls}
        traps={mapData.traps}
      />
    </div>
  );
}
