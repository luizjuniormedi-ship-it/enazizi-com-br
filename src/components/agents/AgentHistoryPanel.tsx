import { memo } from "react";
import { Trash2 } from "lucide-react";
import type { Conversation } from "./agentChatTypes";

interface AgentHistoryPanelProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onLoad: (id: string) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
}

const AgentHistoryPanel = memo(({ conversations, activeConversationId, onLoad, onDelete }: AgentHistoryPanelProps) => (
  <div className="glass-card p-3 mb-2 max-h-48 overflow-y-auto space-y-1">
    {conversations.length === 0 ? (
      <p className="text-sm text-muted-foreground text-center py-2">Nenhuma conversa salva.</p>
    ) : (
      conversations.map((c) => (
        <div
          key={c.id}
          onClick={() => onLoad(c.id)}
          className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${
            activeConversationId === c.id ? "bg-primary/10 text-primary" : "hover:bg-secondary"
          }`}
        >
          <span className="truncate flex-1 mr-2">{c.title}</span>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString("pt-BR")}</span>
            <button onClick={(e) => onDelete(c.id, e)} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))
    )}
  </div>
));
AgentHistoryPanel.displayName = "AgentHistoryPanel";
export default AgentHistoryPanel;
