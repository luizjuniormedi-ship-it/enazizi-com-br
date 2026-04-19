export type Msg = { role: "user" | "assistant"; content: string };

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
}

export interface Upload {
  id: string;
  filename: string;
  category: string | null;
  extracted_text: string | null;
}

export interface QuickAction {
  label: string;
  prompt: string;
  icon?: string;
}

export interface LinkToAgent {
  label: string;
  path: string;
  stateKey: string;
}

export interface TimelineEntry {
  label: string;
  icon: string;
  time: string;
}
