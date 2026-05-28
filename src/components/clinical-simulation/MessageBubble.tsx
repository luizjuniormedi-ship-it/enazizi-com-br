import React, { memo } from "react";
import ReactMarkdown from "react-markdown";
import { MessageCircle, Stethoscope, FileSearch, Syringe, Pill, Target, HelpCircle, Users, Activity, Brain, User, GraduationCap, Bone, HeartPulse } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface ManeuverPerformed {
  name: string; technique: string; finding: string; interpretation: string;
}

export interface ChatMessage {
  role: "doctor" | "simulation";
  content: string;
  type?: string;
  scoreDelta?: number;
  timestamp: number;
  teachingTip?: string;
  maneuversPerformed?: ManeuverPerformed[];
}

const VITAL_REGEX = /\b(PA|PAS|PAD|FC|FR|SpO2|Temp|Sat)\s*[:=]?\s*(\d{2,3}(?:[\/x]\d{2,3})?)\s*(mmHg|bpm|irpm|rpm|%|°C|ºC)?/gi;

const highlightVitals = (children: React.ReactNode): React.ReactNode => {
  if (!children) return children;
  if (typeof children === "string") {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    const regex = new RegExp(VITAL_REGEX.source, "gi");
    while ((match = regex.exec(children)) !== null) {
      if (match.index > lastIndex) parts.push(children.slice(lastIndex, match.index));
      const label = match[1].toUpperCase();
      const value = match[2];
      const unit = match[3] || "";
      parts.push(
        <span key={match.index} className="inline-flex items-center gap-0.5 mx-0.5 px-1.5 py-0.5 rounded bg-primary/15 text-primary text-xs font-semibold not-prose">
          <HeartPulse className="h-3 w-3" />
          {label} {value}{unit}
        </span>
      );
      lastIndex = regex.lastIndex;
    }
    if (parts.length === 0) return children;
    if (lastIndex < children.length) parts.push(children.slice(lastIndex));
    return <>{parts}</>;
  }
  if (Array.isArray(children)) return children.map((c, i) => <React.Fragment key={i}>{highlightVitals(c)}</React.Fragment>);
  return children;
};

const getTypeIcon = (type?: string) => {
  const map: Record<string, typeof Stethoscope> = {
    anamnesis: MessageCircle,
    physical_exam: Stethoscope,
    lab_result: FileSearch,
    imaging: FileSearch,
    prescription: Syringe,
    treatment: Pill,
    diagnosis_attempt: Target,
    preceptor_hint: HelpCircle,
    specialist_opinion: Users,
  };
  return map[type || ""] || Activity;
};

const MARKDOWN_COMPONENTS = {
  p: ({ children }: any) => <p className="break-words">{highlightVitals(children)}</p>,
  li: ({ children }: any) => <li className="break-words">{highlightVitals(children)}</li>,
  a: ({ children, href }: any) => (
    <a href={href} target="_blank" rel="noreferrer" className="break-all underline">{children}</a>
  ),
  pre: ({ children }: any) => (
    <pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-words text-xs">{children}</pre>
  ),
  code: ({ children }: any) => (
    <code className="break-words whitespace-pre-wrap">{children}</code>
  ),
  table: ({ children }: any) => (
    <div className="max-w-full overflow-x-auto"><table className="text-xs">{children}</table></div>
  ),
};


interface MessageBubbleProps {
  msg: ChatMessage;
}

const MessageBubble = memo(function MessageBubble({ msg }: MessageBubbleProps) {
  const TypeIcon = getTypeIcon(msg.type);
  return (
    <div className={`flex gap-2 min-w-0 ${msg.role === "doctor" ? "justify-end" : "justify-start"}`}>
      {msg.role === "simulation" && (
        <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-1">
          {msg.type === "preceptor_hint" ? (
            <Brain className="h-3.5 w-3.5 text-amber-500" />
          ) : msg.type === "specialist_opinion" ? (
            <Users className="h-3.5 w-3.5 text-blue-500" />
          ) : (
            <User className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
      )}
      <div
        className={`max-w-[78%] min-w-0 overflow-x-hidden rounded-2xl px-4 py-3 text-sm ${
          msg.role === "doctor"
            ? "bg-primary text-primary-foreground rounded-br-md"
            : msg.type === "preceptor_hint"
            ? "bg-amber-500/10 border-2 border-amber-500/30 rounded-bl-md"
            : msg.type === "specialist_opinion"
            ? "bg-blue-500/10 border-2 border-blue-500/30 rounded-bl-md"
            : "bg-muted/50 border border-border/50 rounded-bl-md"
        }`}
      >

        {msg.role === "simulation" && msg.type && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <TypeIcon className="h-3.5 w-3.5 opacity-60" />
            <span className="text-xs opacity-60 capitalize">
              {msg.type === "preceptor_hint" ? "Preceptor" : msg.type === "specialist_opinion" ? "Parecer Especialista" : msg.type?.replace("_", " ")}
            </span>
            {msg.scoreDelta !== undefined && msg.scoreDelta !== 0 && (
              <Badge variant={msg.scoreDelta > 0 ? "default" : "destructive"} className="text-[10px] px-1.5 py-0 h-4">
                {msg.scoreDelta > 0 ? `+${msg.scoreDelta}` : msg.scoreDelta}
              </Badge>
            )}
          </div>
        )}
        <div className={`break-words whitespace-pre-wrap leading-relaxed ${msg.role === "simulation" ? "prose prose-sm max-w-none dark:prose-invert" : ""}`}>
          {msg.role === "simulation" ? (
            <ReactMarkdown components={MARKDOWN_COMPONENTS}>{msg.content}</ReactMarkdown>
          ) : (
            <p className="whitespace-pre-wrap">{msg.content}</p>
          )}
        </div>
        {msg.maneuversPerformed && msg.maneuversPerformed.length > 0 && (
          <div className="mt-2 space-y-1.5">
            <p className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
              <Bone className="h-3 w-3" /> Manobras Realizadas
            </p>
            {msg.maneuversPerformed.map((m, mi) => (
              <div key={mi} className="p-2 rounded-lg bg-accent/10 border border-accent/20 space-y-0.5">
                <p className="text-[11px] font-bold text-accent-foreground">{m.name}</p>
                <p className="text-[10px] text-muted-foreground"><strong>Técnica:</strong> {m.technique}</p>
                <p className="text-[10px] text-muted-foreground"><strong>Achado:</strong> {m.finding}</p>
                <p className="text-[10px] text-muted-foreground"><strong>Significado:</strong> {m.interpretation}</p>
              </div>
            ))}
          </div>
        )}
        {msg.teachingTip && (
          <div className="mt-2 p-2 rounded-lg bg-primary/5 border border-primary/20 flex items-start gap-1.5">
            <GraduationCap className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
            <p className="text-[11px] text-primary/80">{msg.teachingTip}</p>
          </div>
        )}
      </div>
      {msg.role === "doctor" && (
        <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-1">
          <Stethoscope className="h-3.5 w-3.5 text-primary" />
        </div>
      )}
    </div>
  );
}, (prev, next) => prev.msg === next.msg);

export default MessageBubble;
