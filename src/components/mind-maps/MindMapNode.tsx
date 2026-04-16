import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  blue:   { bg: "#eff6ff", border: "#3b82f6", text: "#1e3a5f", glow: "rgba(59,130,246,0.15)" },
  sky:    { bg: "#ecfeff", border: "#06b6d4", text: "#0c4a6e", glow: "rgba(6,182,212,0.15)" },
  purple: { bg: "#f3e8ff", border: "#8b5cf6", text: "#3b0764", glow: "rgba(139,92,246,0.15)" },
  amber:  { bg: "#fffbeb", border: "#f59e0b", text: "#78350f", glow: "rgba(245,158,11,0.15)" },
  yellow: { bg: "#fefce8", border: "#eab308", text: "#713f12", glow: "rgba(234,179,8,0.15)" },
  green:  { bg: "#f0fdf4", border: "#22c55e", text: "#14532d", glow: "rgba(34,197,94,0.15)" },
  red:    { bg: "#fef2f2", border: "#ef4444", text: "#7f1d1d", glow: "rgba(239,68,68,0.15)" },
  gray:   { bg: "#f9fafb", border: "#6b7280", text: "#1f2937", glow: "rgba(107,114,128,0.15)" },
  orange: { bg: "#fff7ed", border: "#f97316", text: "#7c2d12", glow: "rgba(249,115,22,0.15)" },
  pink:   { bg: "#fdf2f8", border: "#ec4899", text: "#831843", glow: "rgba(236,72,153,0.15)" },
};

export const CATEGORY_ICONS: Record<string, string> = {
  blue: "📘", sky: "📊", purple: "🔬", yellow: "🔍", amber: "🔍",
  green: "💊", red: "⚠️", gray: "📈", orange: "🔄", pink: "🎯",
};

export function getNodeColors(color: string) {
  return COLOR_MAP[color] || COLOR_MAP.blue;
}

/** Root node — main topic */
export const RootNode = memo(({ data }: NodeProps) => (
  <div className="relative group">
    <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0 !w-0 !h-0" />
    <div
      className="px-7 py-4 rounded-2xl text-white font-bold text-[15px] text-center min-w-[220px] shadow-2xl transition-transform duration-200 group-hover:scale-[1.02]"
      style={{
        background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.85))",
        boxShadow: "0 8px 32px hsl(var(--primary) / 0.3), 0 0 0 1px hsl(var(--primary) / 0.1)",
      }}
    >
      {(data as any).label}
    </div>
  </div>
));
RootNode.displayName = "RootNode";

/** Category node — main branches */
export const CategoryNode = memo(({ data, selected }: NodeProps) => {
  const d = data as any;
  const colors = getNodeColors(d.color);
  const icon = CATEGORY_ICONS[d.color] || "📌";

  return (
    <div className="relative group">
      <Handle type="target" position={Position.Top} className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0 !w-0 !h-0" />
      <div
        className="px-4 py-3 rounded-xl text-center min-w-[150px] max-w-[200px] transition-all duration-200 group-hover:scale-[1.03] group-hover:shadow-lg"
        style={{
          background: colors.bg,
          color: colors.text,
          border: `2px solid ${selected ? colors.border : colors.border + "99"}`,
          boxShadow: selected
            ? `0 0 0 3px ${colors.glow}, 0 4px 16px ${colors.glow}`
            : `0 2px 8px ${colors.glow}`,
        }}
      >
        <span className="text-sm mr-1.5">{icon}</span>
        <span className="text-[12px] font-semibold leading-tight">{d.label}</span>
        {d.details && (
          <div className="mt-1 text-[9px] opacity-60 font-normal truncate">
            Clique para detalhes
          </div>
        )}
      </div>
    </div>
  );
});
CategoryNode.displayName = "CategoryNode";

/** Leaf node — children */
export const LeafNode = memo(({ data, selected }: NodeProps) => {
  const d = data as any;
  const colors = getNodeColors(d.color);

  return (
    <div className="relative group">
      <Handle type="target" position={Position.Top} className="!bg-transparent !border-0 !w-0 !h-0" />
      <div
        className="px-3 py-2 rounded-lg text-center max-w-[160px] transition-all duration-200 group-hover:scale-[1.04]"
        style={{
          background: `${colors.bg}dd`,
          color: colors.text,
          border: `1.5px solid ${selected ? colors.border : colors.border + "66"}`,
          boxShadow: selected ? `0 0 0 2px ${colors.glow}` : "none",
          fontSize: "10px",
          fontWeight: 500,
        }}
      >
        {d.label}
      </div>
    </div>
  );
});
LeafNode.displayName = "LeafNode";

export const nodeTypes = {
  root: RootNode,
  category: CategoryNode,
  leaf: LeafNode,
};
