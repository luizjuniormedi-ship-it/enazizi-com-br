import { memo } from "react";
import type { QuickAction, TimelineEntry } from "./agentChatTypes";
import { cn } from "@/lib/utils";

interface AgentQuickActionsProps {
  quickActions?: QuickAction[];
  visible: boolean;
  onSend: (prompt: string) => void;
}

export const AgentQuickActions = memo(({ quickActions, visible, onSend }: AgentQuickActionsProps) => {
  if (!visible || !quickActions || quickActions.length === 0) return null;
  return (
    <div className="flex gap-2 overflow-x-auto pb-4 px-4 sm:px-12 scrollbar-hide">
      {quickActions.map((action, idx) => (
        <button
          key={idx}
          onClick={() => onSend(action.prompt)}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex-shrink-0 whitespace-nowrap",
            "bg-white/5 border border-white/10 text-white/40 hover:text-primary hover:border-primary/40 hover:bg-primary/5 hover:scale-105 active:scale-95"
          )}
        >
          {action.icon && <span className="text-base">{action.icon}</span>}
          <span>{action.label.replace(/^[^\s]+\s/, "")}</span>
        </button>
      ))}
    </div>
  );
});
AgentQuickActions.displayName = "AgentQuickActions";

interface AgentTimelineProps {
  entries: TimelineEntry[];
}

export const AgentTimeline = memo(({ entries }: AgentTimelineProps) => {
  if (entries.length === 0) return null;
  return (
    <div className="flex gap-2 overflow-x-auto pb-4 px-4 sm:px-12 scrollbar-hide opacity-40 hover:opacity-100 transition-opacity">
      {entries.map((entry, idx) => (
        <span
          key={idx}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/5 bg-white/5 text-[9px] font-bold uppercase tracking-wider text-white/60 whitespace-nowrap flex-shrink-0"
        >
          <span>{entry.icon}</span>
          <span className="max-w-[120px] truncate">{entry.label}</span>
          <span className="text-white/20 ml-1">{entry.time}</span>
        </span>
      ))}
    </div>
  );
});
AgentTimeline.displayName = "AgentTimeline";