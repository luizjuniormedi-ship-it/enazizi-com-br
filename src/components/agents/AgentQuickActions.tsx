import { memo } from "react";
import type { QuickAction, TimelineEntry } from "./agentChatTypes";

interface AgentQuickActionsProps {
  quickActions?: QuickAction[];
  visible: boolean;
  onSend: (prompt: string) => void;
}

export const AgentQuickActions = memo(({ quickActions, visible, onSend }: AgentQuickActionsProps) => {
  if (!visible || !quickActions || quickActions.length === 0) return null;
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1.5 mb-2 scrollbar-hide">
      {quickActions.map((action, idx) => (
        <button
          key={idx}
          onClick={() => onSend(action.prompt)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-medium bg-gradient-to-br from-primary/10 to-accent/10 text-primary hover:from-primary/20 hover:to-accent/20 transition-colors border border-primary/20 flex-shrink-0 whitespace-nowrap"
        >
          {action.icon && <span>{action.icon}</span>}
          {action.label.replace(/^[^\s]+\s/, "")}
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
    <div className="flex gap-1.5 overflow-x-auto pb-1 mb-2 scrollbar-hide">
      {entries.map((entry, idx) => (
        <span
          key={idx}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-border/60 bg-muted/50 text-[10px] font-medium text-muted-foreground whitespace-nowrap flex-shrink-0"
        >
          <span>{entry.icon}</span>
          <span className="max-w-[100px] truncate">{entry.label}</span>
          <span className="text-muted-foreground/60">{entry.time}</span>
        </span>
      ))}
    </div>
  );
});
AgentTimeline.displayName = "AgentTimeline";
